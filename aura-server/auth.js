// ==========================================
// 身分驗證與授權核心模組 (JWT, OTP, Middleware)
// ==========================================
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 取得 JWT 密鑰：若未設定則在啟動時自動生成臨時密鑰並發出警告
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn('⚠️ [Auth Warning] 未設定 JWT_SECRET 環境變數，目前使用隨機產生的暫時密鑰（重啟後先前 Token 將失效，正式環境請務必於 .env 設定 JWT_SECRET）');
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/** 簽發專屬 JWT 憑證 */
function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

/** 驗證 JWT 憑證 */
function verifyToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (err) {
    return null;
  }
}

/**
 * 身分驗證中介軟體 (強制要求登入)
 * 驗證請求標頭中的 Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: '未授權：請先登入後再進行此操作',
      code: 'UNAUTHORIZED',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: '授權標頭格式錯誤（必須為 Bearer <token>）',
      code: 'MALFORMED_HEADER',
    });
  }

  const token = parts[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return res.status(401).json({
      error: '登入憑證無效或已過期，請重新登入',
      code: 'INVALID_TOKEN',
    });
  }

  // 掛載已驗證之使用者身分
  req.user = {
    userId: Number(decoded.userId),
    email: decoded.email,
  };
  req.userId = req.user.userId;

  next();
}

/**
 * 可選身分驗證中介軟體 (公開端點或 AI 端點使用)
 * 若有提供有效 Token 則綁定 req.user，否則 req.user 為 null
 */
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  req.user = null;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const decoded = verifyToken(parts[1]);
      if (decoded && decoded.userId) {
        req.user = {
          userId: Number(decoded.userId),
          email: decoded.email,
        };
        req.userId = req.user.userId;
      }
    }
  }

  next();
}

/**
 * 嚴格比對使用者自身權限中介軟體 (防範 BOLA / IDOR)
 * 確保 URL 上的 :userId 必須與當前 Token 解析出之本人身分一致
 */
function requireSelf(req, res, next) {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({
      error: '未授權：身分未通過驗證',
      code: 'UNAUTHORIZED',
    });
  }

  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({
      error: '無效的使用者 ID 參數',
      code: 'INVALID_USER_ID',
    });
  }

  if (targetUserId !== req.user.userId) {
    console.warn(
      `[Security Audit] 偵測到越權存取嘗試！使用者 #${req.user.userId} 試圖操作使用者 #${targetUserId} 的資料`
    );
    return res.status(403).json({
      error: '禁止存取：您無權檢視或修改其他使用者的私人資料',
      code: 'FORBIDDEN_USER_ACCESS',
    });
  }

  // 確保 req.userId 固定為驗證後的本人 ID
  req.userId = req.user.userId;
  next();
}

/** 產生 6 位純數字驗證碼 */
function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/** 將信箱與驗證碼做 SHA-256 安全雜湊 */
function hashVerificationCode(email, code) {
  return crypto
    .createHash('sha256')
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest('hex');
}

/** 常數時間安全比對驗證碼雜湊 */
function verifyCodeHash(email, inputCode, storedHash) {
  const computed = hashVerificationCode(email, inputCode);
  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * 發送 OTP 驗證信 (或於開發環境中回報日誌)
 * 若有配置 SMTP_HOST / SMTP_USER 等變數，則寄出正式信件。
 * 若未配置，則回傳 devMode 標記並在伺服器終端輸出驗證碼，不偽裝郵件已寄送。
 */
async function sendVerificationCodeMail(email, code) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpFrom = process.env.SMTP_FROM || `"HoldYourHand" <no-reply@holdyourhand.app>`;

  const isSmtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);

  if (isSmtpConfigured) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: '【HoldYourHand 守把手】電子郵件安全登入驗證碼',
      text: `您好！\n\n您的 HoldYourHand 登入驗證碼為：${code}\n\n此驗證碼於 10 分鐘內有效，最多可嘗試 5 次。若非您本人操作，請忽略此郵件。`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2E7D6E; margin-top: 0;">HoldYourHand 守把手</h2>
          <p style="color: #4a5568; font-size: 15px;">您好，感謝您使用 HoldYourHand。請在 App 中輸入以下 6 位數驗證碼以完成安全身分驗證：</p>
          <div style="background-color: #f7fafc; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4338ca;">${code}</span>
          </div>
          <p style="color: #718096; font-size: 13px;">• 驗證碼有效期限為 10 分鐘，且僅能使用一次。<br>• 若非您本人申請，請忽略此郵件，您的帳號安全不會受到影響。</p>
        </div>
      `,
    });

    return { sent: true, devMode: false };
  } else {
    // 未設定 SMTP：記錄於後端終端機供本機測試，清楚提示設定方式
    console.log('----------------------------------------------------');
    console.log(`[Auth OTP (開發測試模式)] 收件者: ${email}`);
    console.log(`[Auth OTP (開發測試模式)] 驗證碼: ${code}`);
    console.log('[Auth OTP (開發測試模式)] ⚠️ 目前未設定 SMTP 環境變數 (SMTP_HOST/USER/PASS)，未寄送真實郵件。');
    console.log('----------------------------------------------------');
    return {
      sent: false,
      devMode: true,
      message: '伺服器未設定 SMTP 郵件服務，驗證碼已記錄於後端開發日誌中。',
    };
  }
}

module.exports = {
  signToken,
  verifyToken,
  authenticateToken,
  optionalAuthenticate,
  requireSelf,
  generateVerificationCode,
  hashVerificationCode,
  verifyCodeHash,
  sendVerificationCodeMail,
};
