// ==========================================
// MySQL 連線與自動建表
// ==========================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const isProduction = process.env.NODE_ENV === 'production';

// 正式環境安全防護：生產模式下強制要求設定資料庫密碼，禁止退回空密碼
if (isProduction) {
  if (!process.env.DB_PASSWORD) {
    throw new Error('[DB] 正式環境 (NODE_ENV=production) 必須設定 DB_PASSWORD 環境變數，禁止使用空密碼！');
  }
  if (!process.env.DB_USER || process.env.DB_USER === 'root') {
    console.warn('[DB] 建議：正式環境應使用獨立低權限資料庫帳號，避免直接使用 root。');
  }
}

// 智慧判斷是否為遠端雲端資料庫（如 Aiven, AWS RDS, GCP Cloud SQL 等）
const isRemoteHost = Boolean(
  process.env.DB_HOST &&
  process.env.DB_HOST !== 'localhost' &&
  !process.env.DB_HOST.startsWith('127.')
);

// 雲端 SSL 配置：若連線遠端資料庫或明確開啟 DB_SSL，啟用 TLS 加密
let sslConfig = undefined;
if (process.env.DB_SSL === 'true' || isRemoteHost) {
  sslConfig = {
    // 預設 rejectUnauthorized 設為 false，方便直接連線 Aiven，不需要另外貼 CA 憑證字串
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  };
  if (process.env.DB_SSL_CA) {
    sslConfig.ca = process.env.DB_SSL_CA;
  }
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.DB_NAME || 'holdyourhand';

let pool = null;

/** 讀取 schema.sql，只取 CREATE TABLE 語句 */
function loadTableStatements() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => /^CREATE TABLE/i.test(s));
}

/** 建立資料庫（若為本機環境且支援）、建立資料表，並建立連線池 */
async function initDatabase() {
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
    throw new Error(`DB_NAME 只能包含英文、數字、底線：${DB_NAME}`);
  }

  // 若為本機開發環境，嘗試自動建立資料庫；若是遠端雲端資料庫（如 Aiven），資料庫已建立，略過此步驟以防權限不足報錯
  if (!isRemoteHost) {
    try {
      const conn = await mysql.createConnection(DB_CONFIG);
      try {
        await conn.query(
          `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
      } finally {
        await conn.end();
      }
    } catch (err) {
      console.warn(`[DB] 本地嘗試建立資料庫略過（若資料庫已存在可忽略）: ${err.message}`);
    }
  }

  pool = mysql.createPool({
    ...DB_CONFIG,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true, // DATE 直接回傳 'YYYY-MM-DD' 字串，避免時區位移
    charset: 'utf8mb4',
    ssl: sslConfig,
  });

  // 測試連線連通性
  const testConn = await pool.getConnection();
  testConn.release();

  for (const statement of loadTableStatements()) {
    await pool.query(statement);
  }

  await runMigrations(pool);

  return pool;
}

/** 舊版資料表補上新欄位（CREATE TABLE IF NOT EXISTS 不會幫已存在的表加欄位） */
async function runMigrations(pool) {
  // 1. avatar_url
  const [[avatarCol]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'`,
    [DB_NAME]
  );
  if (Number(avatarCol.cnt) === 0) {
    await pool.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER gender');
    console.log('[DB] 已新增欄位 users.avatar_url');
  }

  // 2. google_id
  const [[googleCol]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_id'`,
    [DB_NAME]
  );
  if (Number(googleCol.cnt) === 0) {
    await pool.query('ALTER TABLE users ADD COLUMN google_id VARCHAR(100) NULL UNIQUE AFTER email');
    console.log('[DB] 已新增欄位 users.google_id');
  }

  // 3. email_verified
  const [[verifiedCol]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified'`,
    [DB_NAME]
  );
  if (Number(verifiedCol.cnt) === 0) {
    await pool.query('ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER onboarding_completed');
    console.log('[DB] 已新增欄位 users.email_verified');
  }

    // 4. email_verifications 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 5,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_expires (email, expires_at)
      )
    `);

    // 5. password_hash 密碼欄位
    const [[passwordCol]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash'`,
      [DB_NAME]
    );
    if (Number(passwordCol.cnt) === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER google_id');
      console.log('[DB] 已新增欄位 users.password_hash');
    }
  }

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool, DB_NAME };
