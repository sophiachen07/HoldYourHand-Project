// ==========================================
// 使用者資料 API（MySQL）
// 所有路由都掛在 /api/users 底下
// ==========================================
const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { getPool } = require('./db');
const {
  signToken,
  authenticateToken,
  requireSelf,
  generateVerificationCode,
  hashVerificationCode,
  verifyCodeHash,
  sendVerificationCodeMail,
} = require('./auth');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SENSOR_BATCH = 500;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// 登入與驗證頻率限制器：防範暴力嘗試
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 30, // 每個 IP 最多 30 次嘗試
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '嘗試次數過多，請於 15 分鐘後再試', code: 'RATE_LIMITED' },
});

// 發送驗證碼頻率限制器：防範郵件轟炸
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 分鐘
  max: 10, // 每個 IP 最多請求 10 次
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '請求驗證碼次數過多，請稍後再試', code: 'RATE_LIMITED' },
});

// Google ID Token 驗證器
let googleClient = null;
function getGoogleClient() {
  if (!googleClient) {
    const { OAuth2Client } = require('google-auth-library');
    googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }
  return googleClient;
}

// ---------- 工具函式 ----------

/** 毫秒時間戳 → 台灣時間 (GMT+8) 'YYYY-MM-DD HH:MM:SS.mmm' */
function toTaiwanDateTime(ms) {
  const d = new Date(Number(ms) + 8 * 3600 * 1000);
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

/** MySQL JSON 欄位：MySQL 會回傳物件，MariaDB 會回傳字串 */
function parseJsonColumn(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toInt(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toNullableNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 讀出某位使用者的完整資料，格式與 App 端 UserContext 相同 */
async function loadUserSnapshot(pool, userId) {
  const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return null;

  const [statRows] = await pool.query(
    'SELECT * FROM behavior_stats WHERE user_id = ?',
    [userId]
  );
  const [dailyRows] = await pool.query(
    'SELECT * FROM daily_records WHERE user_id = ? ORDER BY record_date',
    [userId]
  );

  const behaviorStats = {};
  for (const row of statRows) {
    behaviorStats[row.type] = {
      type: row.type,
      title: row.title || `${row.type}行為`,
      icon: row.icon || '🖐️',
      description: row.description || '',
      count: row.total_count,
      todayCount: row.today_count,
    };
  }

  const dailyHistory = {};
  for (const row of dailyRows) {
    dailyHistory[row.record_date] = {
      date: row.record_date,
      occurred: row.occurred,
      restrained: row.restrained,
      relaxed: row.relaxed,
    };
  }

  return {
    userId: user.id,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    onboardingCompleted: Boolean(user.onboarding_completed),
    firstActiveDate: user.first_active_date,
    lastActiveDate: user.last_active_date,
    profile: {
      name: user.name || '',
      age: user.age || '',
      gender: user.gender || '',
      bfrbDrivers: parseJsonColumn(user.bfrb_drivers, []),
      bfrbTypes: parseJsonColumn(user.bfrb_types, []),
      avatarUrl: user.avatar_url || null,
    },
    behaviorStats,
    dailyHistory,
  };
}

/**
 * 依 Google 或 Email 認證後找到或建立使用者，並簽發本專案 JWT 憑證
 */
async function findOrCreateUser({ email, googleId, name, age, gender, avatarUrl, isEmailVerified, via } = {}) {
  const pool = getPool();
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name ? String(name).slice(0, 100) : null;
  const cleanAge = age ? String(age).slice(0, 10) : null;
  const cleanGender = gender ? String(gender).slice(0, 20) : null;
  const cleanAvatar = avatarUrl ? String(avatarUrl).slice(0, 500) : null;
  const cleanGoogleId = googleId ? String(googleId).slice(0, 100) : null;
  const emailVerifiedVal = isEmailVerified ? 1 : 0;

  let existingUser = null;

  // 1. 若有 googleId，優先依據 google_id 尋找使用者
  if (cleanGoogleId) {
    const [[byGoogle]] = await pool.query('SELECT * FROM users WHERE google_id = ?', [cleanGoogleId]);
    if (byGoogle) existingUser = byGoogle;
  }

  // 2. 若尚未找到，依據 email 尋找使用者
  if (!existingUser) {
    const [[byEmail]] = await pool.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (byEmail) {
      existingUser = byEmail;
      // 若找到已有此信箱但未綁定 googleId，進行帳號關聯
      if (cleanGoogleId && !byEmail.google_id) {
        await pool.query('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?', [
          cleanGoogleId,
          byEmail.id,
        ]);
        console.log(`[Auth] 使用者 #${byEmail.id} 已綁定 Google ID: ${cleanGoogleId}`);
      }
    }
  }

  let userId;
  let isNew = false;

  if (existingUser) {
    userId = existingUser.id;
    // 更新驗證狀態與未填欄位
    const updates = [];
    const params = [];

    if (isEmailVerified && !existingUser.email_verified) {
      updates.push('email_verified = 1');
    }
    if (cleanName) {
      updates.push("name = COALESCE(NULLIF(name, ''), ?)");
      params.push(cleanName);
    }
    if (cleanAge) {
      updates.push("age = COALESCE(NULLIF(age, ''), ?)");
      params.push(cleanAge);
    }
    if (cleanGender) {
      updates.push("gender = COALESCE(NULLIF(gender, ''), ?)");
      params.push(cleanGender);
    }
    if (cleanAvatar) {
      updates.push("avatar_url = COALESCE(avatar_url, ?)");
      params.push(cleanAvatar);
    }

    if (updates.length > 0) {
      params.push(userId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }
  } else {
    // 建立新使用者
    isNew = true;
    const [result] = await pool.query(
      `INSERT INTO users (email, google_id, email_verified, name, age, gender, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cleanEmail, cleanGoogleId, emailVerifiedVal, cleanName, cleanAge, cleanGender, cleanAvatar]
    );
    userId = result.insertId;
  }

  const snapshot = await loadUserSnapshot(pool, userId);
  // 簽發專屬 JWT Token（7 天效期）
  const token = signToken({ userId, email: cleanEmail });

  console.log(
    `[Auth] 登入成功 #${userId} ${cleanEmail}${via ? `（${via}）` : ''}${isNew ? '（新建立帳號）' : ''}`
  );

  return {
    token,
    isNew,
    ...snapshot,
  };
}

// ---------- Google 帳號輔助 ----------

const GOOGLE_GENDER_MAP = { male: '男性', female: '女性' };

function calcAge({ year, month, day }) {
  if (!year || !month || !day) return null;
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

function pickPrimary(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.find((item) => item?.metadata?.primary) || list[0];
}

async function getGoogleProfile(accessToken, { expectedEmail } = {}) {
  let tokenInfo;
  try {
    const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
      params: { access_token: accessToken },
      timeout: 10000,
    });
    tokenInfo = data;
  } catch {
    const err = new Error('Google 登入驗證失敗，請重新登入');
    err.status = 401;
    throw err;
  }

  if (expectedEmail) {
    if (String(tokenInfo.email || '').toLowerCase() !== expectedEmail) {
      const err = new Error('Google 憑證與登入帳號不一致');
      err.status = 401;
      throw err;
    }
  } else if (tokenInfo.aud !== GOOGLE_CLIENT_ID && tokenInfo.azp !== GOOGLE_CLIENT_ID) {
    const err = new Error('Google 憑證不屬於本應用程式');
    err.status = 401;
    throw err;
  }
  if (!tokenInfo.email || String(tokenInfo.email_verified) !== 'true') {
    const err = new Error('這個 Google 帳號的 email 尚未驗證');
    err.status = 401;
    throw err;
  }

  const profile = {
    email: tokenInfo.email.toLowerCase(),
    googleId: tokenInfo.sub || tokenInfo.user_id || null,
    name: null,
    age: null,
    gender: null,
    avatarUrl: null,
  };

  try {
    const { data } = await axios.get('https://people.googleapis.com/v1/people/me', {
      params: { personFields: 'names,photos,birthdays,genders' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    profile.name = pickPrimary(data.names)?.displayName || null;
    const photo = pickPrimary(data.photos);
    if (photo?.url && !photo.default) profile.avatarUrl = photo.url;

    const birthday = (data.birthdays || []).find((b) => b?.date?.year) || null;
    const age = birthday ? calcAge(birthday.date) : null;
    if (age) profile.age = String(age);

    const genderValue = pickPrimary(data.genders)?.value;
    if (genderValue && genderValue !== 'unspecified') {
      profile.gender = GOOGLE_GENDER_MAP[genderValue] || '其他';
    }
  } catch (err) {
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      profile.name = data.name || null;
      profile.avatarUrl = data.picture || null;
      if (data.sub && !profile.googleId) profile.googleId = data.sub;
    } catch {
      // 容錯
    }
  }

  return profile;
}

// ---------- 資料庫連線中介軟體 ----------

function requireDb(req, res, next) {
  if (!getPool()) {
    return res.status(503).json({ error: '資料庫尚未連線，請確認 MySQL 已啟動且 .env 設定正確' });
  }
  next();
}

// ---------- 驗證端點 ----------

/**
 * 1. 索取 Email 登入驗證碼 (OTP)
 * - 60 秒冷卻防重複點擊
 * - 每 IP 頻率限制防郵件轟炸
 * - 驗證碼有效期限 10 分鐘，以 SHA-256 儲存雜湊
 */
router.post('/send-code', otpSendLimiter, requireDb, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: '請輸入有效的電子郵件地址' });
    }

    const pool = getPool();

    // 檢查同信箱 60 秒冷卻時間 (Cooldown)
    const [[lastRequest]] = await pool.query(
      `SELECT created_at FROM email_verifications
       WHERE email = ? AND created_at > (NOW() - INTERVAL 60 SECOND)
       ORDER BY id DESC LIMIT 1`,
      [email]
    );

    if (lastRequest) {
      return res.status(429).json({
        error: '驗證碼發送過於頻繁，請等待 60 秒後再重新索取',
        code: 'COOLDOWN_ACTIVE',
      });
    }

    // 產生 6 位數純數字驗證碼
    const code = generateVerificationCode();
    const codeHash = hashVerificationCode(email, code);

    // 儲存於 email_verifications，有效期限 10 分鐘
    await pool.query(
      `INSERT INTO email_verifications (email, code_hash, expires_at)
       VALUES (?, ?, NOW() + INTERVAL 10 MINUTE)`,
      [email, codeHash]
    );

    // 發送郵件或於開發模式中記錄日誌
    const mailResult = await sendVerificationCodeMail(email, code);

    res.json({
      ok: true,
      message: mailResult.sent
        ? '驗證碼已發送至您的電子信箱'
        : '驗證碼已產出（伺服器處於開發測試模式，請於後端日誌查看）',
      devMode: mailResult.devMode,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. 驗證 Email 驗證碼並登入 (OTP 登入)
 * - 限制最多 5 次錯誤嘗試，超過立即作廢，防止暴力破解
 * - 驗證成功後自動標記信箱已驗證，並簽發本專案 JWT Token
 */
router.post('/verify-code', authLimiter, requireDb, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: '請輸入有效的電子郵件地址' });
    }
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '請輸入 6 位數純數字驗證碼' });
    }

    const pool = getPool();

    // 查詢該信箱最新一筆未被使用且尚未過期的驗證碼紀錄
    const [[record]] = await pool.query(
      `SELECT * FROM email_verifications
       WHERE email = ? AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [email]
    );

    if (!record) {
      return res.status(400).json({
        error: '驗證碼無效或已過期，請重新索取驗證碼',
        code: 'CODE_EXPIRED_OR_NOT_FOUND',
      });
    }

    // 檢查錯誤嘗試次數
    if (record.attempts >= record.max_attempts) {
      return res.status(400).json({
        error: '驗證碼錯誤嘗試次數已達上限，此驗證碼已失效，請重新索取',
        code: 'MAX_ATTEMPTS_EXCEEDED',
      });
    }

    // 安全常數時間比對
    const isMatch = verifyCodeHash(email, code, record.code_hash);
    if (!isMatch) {
      const nextAttempts = record.attempts + 1;
      await pool.query('UPDATE email_verifications SET attempts = ? WHERE id = ?', [
        nextAttempts,
        record.id,
      ]);
      const remaining = Math.max(0, record.max_attempts - nextAttempts);
      return res.status(400).json({
        error: `驗證碼不正確，剩餘嘗試次數：${remaining} 次`,
        code: 'INVALID_CODE',
        remainingAttempts: remaining,
      });
    }

    // 驗證通過：標記該紀錄已使用
    await pool.query('UPDATE email_verifications SET consumed_at = NOW() WHERE id = ?', [record.id]);

    // 登入或建立帳號，並簽發正式 JWT 憑證
    const result = await findOrCreateUser({
      email,
      isEmailVerified: true,
      via: 'Email OTP',
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 3. 廢除舊有免密碼直接以 Email 登入的端點，避免身分冒用漏洞
 */
router.post('/login', (req, res) => {
  return res.status(400).json({
    error: '為了保護您的帳號與健康資料安全，直接 Email 登入已停用，請使用驗證碼或 Google 登入',
    code: 'VERIFICATION_REQUIRED',
  });
});

/**
 * 4. Google 登入
 * - 驗證 Google ID Token 簽章、受眾 aud、iss、sub、email_verified
 * - 綁定穩定 Google ID (sub)
 * - 簽發本專案 JWT Token
 */
router.post('/google-login', authLimiter, requireDb, async (req, res, next) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: '後端尚未設定 GOOGLE_CLIENT_ID' });
    }

    const idToken = String(req.body?.idToken || req.body?.credential || '');
    const accessToken = String(req.body?.accessToken || '');
    if (!idToken && !accessToken) {
      return res.status(400).json({ error: '缺少 Google 登入憑證' });
    }

    let googleProfile;

    if (idToken) {
      let payload;
      try {
        const ticket = await getGoogleClient().verifyIdToken({
          idToken,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') throw err;
        return res.status(401).json({ error: 'Google 登入憑證驗證失敗，請重新登入' });
      }

      // 驗證必要欄位：iss, sub, email, email_verified
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!payload?.iss || !validIssuers.includes(payload.iss)) {
        return res.status(401).json({ error: 'Google 憑證簽發者 (iss) 無效' });
      }

      if (!payload?.sub) {
        return res.status(401).json({ error: 'Google 憑證缺少使用者識別碼 (sub)' });
      }

      if (!payload?.email || !payload.email_verified) {
        return res.status(401).json({ error: '這個 Google 帳號的 email 尚未完成驗證' });
      }

      const email = payload.email.toLowerCase();
      googleProfile = {
        email,
        googleId: payload.sub,
        name: payload.name || null,
        age: null,
        gender: null,
        avatarUrl: payload.picture || null,
      };

      if (accessToken) {
        try {
          const details = await getGoogleProfile(accessToken, { expectedEmail: email });
          googleProfile = {
            ...googleProfile,
            name: details.name || googleProfile.name,
            age: details.age,
            gender: details.gender,
            avatarUrl: details.avatarUrl || googleProfile.avatarUrl,
          };
        } catch (err) {
          console.warn(`[Google] 讀取詳細資料失敗，帶入基本資料：${err.message}`);
        }
      }
    } else {
      // 僅提供 AccessToken (網頁版分支)
      try {
        googleProfile = await getGoogleProfile(accessToken);
      } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        throw err;
      }
    }

    // 依據 Google 帳號找到或建立使用者，並簽發 JWT Token
    const result = await findOrCreateUser({
      email: googleProfile.email,
      googleId: googleProfile.googleId,
      name: googleProfile.name,
      age: googleProfile.age,
      gender: googleProfile.gender,
      avatarUrl: googleProfile.avatarUrl,
      isEmailVerified: true,
      via: 'Google',
    });

    res.json({
      ...result,
      googleProfile: {
        name: googleProfile.name,
        age: googleProfile.age,
        gender: googleProfile.gender,
        avatarUrl: googleProfile.avatarUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------- 私人資料 API (全面受 JWT 與本人權限防護) ----------

/**
 * 取得當前登入者自身完整資料 (透過 Token 自動辨識)
 */
router.get('/me', authenticateToken, requireDb, async (req, res, next) => {
  try {
    const snapshot = await loadUserSnapshot(getPool(), req.user.userId);
    if (!snapshot) {
      return res.status(404).json({ error: '找不到該使用者' });
    }
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

/**
 * 依 userId 取得資料：必須驗證 Token 且只能讀取本人 (防 BOLA)
 */
router.get('/:userId', authenticateToken, requireSelf, requireDb, async (req, res, next) => {
  try {
    res.json(await loadUserSnapshot(getPool(), req.userId));
  } catch (err) {
    next(err);
  }
});

/**
 * 同步：必須驗證 Token 且只能同步本人資料 (防 BOLA)
 */
router.put('/:userId/sync', authenticateToken, requireSelf, requireDb, async (req, res, next) => {
  const body = req.body || {};
  const profile = body.profile || {};
  const behaviorStats = body.behaviorStats || {};
  const dailyHistory = body.dailyHistory || {};

  const firstActiveDate = DATE_PATTERN.test(body.firstActiveDate) ? body.firstActiveDate : null;
  const lastActiveDate = DATE_PATTERN.test(body.lastActiveDate) ? body.lastActiveDate : null;

  const statValues = Object.values(behaviorStats)
    .filter((s) => s && typeof s.type === 'string' && s.type.trim())
    .map((s) => [
      req.userId,
      s.type.slice(0, 20),
      s.title ? String(s.title).slice(0, 100) : null,
      s.icon ? String(s.icon).slice(0, 16) : null,
      s.description ? String(s.description).slice(0, 255) : null,
      toInt(s.count),
      toInt(s.todayCount),
    ]);

  const dailyValues = Object.values(dailyHistory)
    .filter((d) => d && DATE_PATTERN.test(d.date))
    .map((d) => [req.userId, d.date, toInt(d.occurred), toInt(d.restrained), toInt(d.relaxed)]);

  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE users SET
         name = ?, age = ?, gender = ?, bfrb_drivers = ?, bfrb_types = ?,
         onboarding_completed = ?, first_active_date = ?, last_active_date = ?
       WHERE id = ?`,
      [
        profile.name ? String(profile.name).slice(0, 100) : null,
        profile.age ? String(profile.age).slice(0, 10) : null,
        profile.gender ? String(profile.gender).slice(0, 20) : null,
        JSON.stringify(Array.isArray(profile.bfrbDrivers) ? profile.bfrbDrivers : []),
        JSON.stringify(Array.isArray(profile.bfrbTypes) ? profile.bfrbTypes : []),
        body.onboardingCompleted ? 1 : 0,
        firstActiveDate,
        lastActiveDate,
        req.userId,
      ]
    );

    await conn.query('DELETE FROM behavior_stats WHERE user_id = ?', [req.userId]);
    if (statValues.length > 0) {
      await conn.query(
        `INSERT INTO behavior_stats
           (user_id, type, title, icon, description, total_count, today_count)
         VALUES ?`,
        [statValues]
      );
    }

    await conn.query('DELETE FROM daily_records WHERE user_id = ?', [req.userId]);
    if (dailyValues.length > 0) {
      await conn.query(
        `INSERT INTO daily_records
           (user_id, record_date, occurred, restrained, relaxed)
         VALUES ?`,
        [dailyValues]
      );
    }

    await conn.commit();
    res.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

/**
 * 新增 BFRB 觸發事件：必須驗證 Token 且只能記錄到本人帳號 (防 BOLA)
 */
router.post('/:userId/events', authenticateToken, requireSelf, requireDb, async (req, res, next) => {
  try {
    const type = String(req.body?.type || '').trim().slice(0, 20) || '其他';
    const occurredAt = Number(req.body?.occurredAt) || Date.now();
    const [result] = await getPool().query(
      'INSERT INTO behavior_events (user_id, type, occurred_at) VALUES (?, ?, ?)',
      [req.userId, type, toTaiwanDateTime(occurredAt)]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

/**
 * 把最近一筆事件標記為誤判：必須驗證 Token 且只能操作本人帳號 (防 BOLA)
 */
router.post('/:userId/events/revert-last', authenticateToken, requireSelf, requireDb, async (req, res, next) => {
  try {
    const type = String(req.body?.type || '').trim().slice(0, 20);
    const [result] = await getPool().query(
      `UPDATE behavior_events SET reverted = 1
       WHERE user_id = ? AND reverted = 0 ${type ? 'AND type = ?' : ''}
       ORDER BY occurred_at DESC, id DESC
       LIMIT 1`,
      type ? [req.userId, type] : [req.userId]
    );
    res.json({ reverted: result.affectedRows });
  } catch (err) {
    next(err);
  }
});

/**
 * 查詢事件紀錄：必須驗證 Token 且只能查詢本人 (防 BOLA)
 */
router.get('/:userId/events', authenticateToken, requireSelf, requireDb, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const [rows] = await getPool().query(
      `SELECT id, type, occurred_at AS occurredAt, reverted
       FROM behavior_events WHERE user_id = ?
       ORDER BY occurred_at DESC, id DESC LIMIT ?`,
      [req.userId, limit]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * 批次寫入感測器數據：必須驗證 Token 且只能寫入本人 (防 BOLA)
 */
router.post('/:userId/sensor-readings', authenticateToken, requireSelf, requireDb, async (req, res, next) => {
  try {
    const readings = Array.isArray(req.body?.readings) ? req.body.readings : [];
    if (readings.length === 0) return res.json({ inserted: 0 });
    if (readings.length > MAX_SENSOR_BATCH) {
      return res.status(413).json({ error: `一次最多 ${MAX_SENSOR_BATCH} 筆` });
    }

    const values = readings.map((r) => [
      req.userId,
      toTaiwanDateTime(Number(r.timestamp) || Date.now()),
      toNullableNumber(r.distance),
      toNullableNumber(r.angularVelocity),
      toNullableNumber(r.heartRate),
      toNullableNumber(r.spo2),
      r.motorStatus == null ? null : (r.motorStatus ? 1 : 0),
      r.isOutOfRange == null ? null : (r.isOutOfRange ? 1 : 0),
      r.source ? String(r.source).slice(0, 16) : null,
    ]);

    const [result] = await getPool().query(
      `INSERT INTO sensor_readings
         (user_id, recorded_at, distance, angular_velocity, heart_rate, spo2,
          motor_status, is_out_of_range, source)
       VALUES ?`,
      [values]
    );
    res.status(201).json({ inserted: result.affectedRows });
  } catch (err) {
    next(err);
  }
});

// 統一錯誤處理（不洩漏資料庫內部敏感資訊）
router.use((err, req, res, next) => {
  console.error('[DB API Error]', err.message);
  res.status(err.status || 500).json({
    error: err.status === 401 || err.status === 403 ? err.message : '伺服器內部錯誤，請稍後再試',
  });
});

module.exports = router;
