// ==========================================
// 使用者資料 API（MySQL）
// 所有路由都掛在 /api/users 底下
// ==========================================
const express = require('express');
const axios = require('axios');
const { getPool } = require('./db');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SENSOR_BATCH = 500;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// Google ID Token 驗證器（套件未安裝時不影響其他功能）
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
 * 以 email 找到或建立使用者，回傳登入結果與完整資料。
 * extra（Google 提供的姓名、年齡、性別、大頭貼）只會補進空白欄位，不覆蓋使用者自己填的資料。
 */
async function loginByEmail(email, { name, age, gender, avatarUrl, via } = {}) {
  const pool = getPool();
  const cleanName = name ? String(name).slice(0, 100) : null;
  const cleanAge = age ? String(age).slice(0, 10) : null;
  const cleanGender = gender ? String(gender).slice(0, 20) : null;
  const cleanAvatar = avatarUrl ? String(avatarUrl).slice(0, 500) : null;

  const [result] = await pool.query(
    'INSERT IGNORE INTO users (email, name, age, gender, avatar_url) VALUES (?, ?, ?, ?, ?)',
    [email, cleanName, cleanAge, cleanGender, cleanAvatar]
  );
  const isNew = result.affectedRows === 1;

  if (!isNew && (cleanName || cleanAge || cleanGender || cleanAvatar)) {
    await pool.query(
      `UPDATE users SET
         name = COALESCE(NULLIF(name, ''), ?),
         age = COALESCE(NULLIF(age, ''), ?),
         gender = COALESCE(NULLIF(gender, ''), ?),
         avatar_url = COALESCE(?, avatar_url)
       WHERE email = ?`,
      [cleanName, cleanAge, cleanGender, cleanAvatar, email]
    );
  }

  const [[user]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  const snapshot = await loadUserSnapshot(pool, user.id);

  console.log(
    `[DB] 使用者登入 #${user.id} ${email}${via ? `（${via}）` : ''}${isNew ? '（新建立）' : ''}`
  );
  return { isNew, ...snapshot };
}

// ---------- Google 帳號資料 ----------

const GOOGLE_GENDER_MAP = { male: '男性', female: '女性' };

/** 依生日計算台灣時間的實歲 */
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

/**
 * 用 Google Access Token 取得已驗證的 email 與個人資料。
 * 會先確認這個 token 是發給我們的用戶端 ID，避免被別的網站的 token 冒用。
 */
async function getGoogleProfile(accessToken) {
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

  if (tokenInfo.aud !== GOOGLE_CLIENT_ID && tokenInfo.azp !== GOOGLE_CLIENT_ID) {
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
    // People API 沒開啟或使用者沒授權：改用基本資料，不影響登入
    const reason = err.response?.data?.error?.message || err.message;
    console.warn(`[Google] 讀取生日／性別失敗，只帶入基本資料：${reason}`);
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });
      profile.name = data.name || null;
      profile.avatarUrl = data.picture || null;
    } catch {
      // 連基本資料都拿不到就只用 email
    }
  }

  return profile;
}

// ---------- 中介軟體 ----------

// 資料庫未連線時直接回 503，聊天等其他功能不受影響
router.use((req, res, next) => {
  if (!getPool()) {
    return res.status(503).json({ error: '資料庫尚未連線，請確認 MySQL 已啟動且 .env 設定正確' });
  }
  next();
});

// 檢查 :userId 是否存在
async function requireUser(req, res, next) {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: '無效的使用者 ID' });
  }
  try {
    const [[row]] = await getPool().query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!row) return res.status(404).json({ error: '找不到此使用者' });
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

// ---------- 路由 ----------

// 以 email 登入：不存在就自動建立，並回傳該使用者的所有資料
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: '請輸入有效的 email' });
    }

    res.json(await loginByEmail(email));
  } catch (err) {
    next(err);
  }
});

// Google 登入
// - accessToken：網頁版按鈕使用，可同時取得姓名、大頭貼、生日、性別
// - credential：Google ID Token（只有 email 與姓名），保留相容
router.post('/google-login', async (req, res, next) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: '後端尚未設定 GOOGLE_CLIENT_ID' });
    }

    const accessToken = String(req.body?.accessToken || '');
    if (accessToken) {
      let googleProfile;
      try {
        googleProfile = await getGoogleProfile(accessToken);
      } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        throw err;
      }
      const result = await loginByEmail(googleProfile.email, { ...googleProfile, via: 'Google' });
      return res.json({
        ...result,
        googleProfile: {
          name: googleProfile.name,
          age: googleProfile.age,
          gender: googleProfile.gender,
          avatarUrl: googleProfile.avatarUrl,
        },
      });
    }

    const credential = String(req.body?.credential || '');
    if (!credential) {
      return res.status(400).json({ error: '缺少 Google 登入憑證' });
    }

    let payload;
    try {
      const ticket = await getGoogleClient().verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') throw err;
      return res.status(401).json({ error: 'Google 登入驗證失敗，請重新登入' });
    }

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: '這個 Google 帳號的 email 尚未驗證' });
    }

    const email = payload.email.toLowerCase();
    res.json(await loginByEmail(email, { name: payload.name, via: 'Google' }));
  } catch (err) {
    next(err);
  }
});

// 取得使用者完整資料
router.get('/:userId', requireUser, async (req, res, next) => {
  try {
    res.json(await loadUserSnapshot(getPool(), req.userId));
  } catch (err) {
    next(err);
  }
});

// 同步：App 端把目前的個人資料、統計、每日紀錄整包送上來覆蓋
router.put('/:userId/sync', requireUser, async (req, res, next) => {
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

// 新增一筆 BFRB 觸發事件
router.post('/:userId/events', requireUser, async (req, res, next) => {
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

// 把最近一筆（同類型）事件標記為誤判
router.post('/:userId/events/revert-last', requireUser, async (req, res, next) => {
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

// 查詢事件紀錄（預設最近 100 筆）
router.get('/:userId/events', requireUser, async (req, res, next) => {
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

// 批次寫入感測器數據
router.post('/:userId/sensor-readings', requireUser, async (req, res, next) => {
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

// 錯誤處理
router.use((err, req, res, next) => {
  console.error('[DB API Error]', err.message);
  res.status(500).json({ error: '資料庫操作失敗', detail: err.message });
});

module.exports = router;
