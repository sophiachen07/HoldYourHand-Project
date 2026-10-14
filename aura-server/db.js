// ==========================================
// MySQL 連線與自動建表
// ==========================================
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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

/** 建立資料庫（若不存在）、建立資料表，並建立連線池 */
async function initDatabase() {
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
    throw new Error(`DB_NAME 只能包含英文、數字、底線：${DB_NAME}`);
  }

  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }

  pool = mysql.createPool({
    ...DB_CONFIG,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true, // DATE 直接回傳 'YYYY-MM-DD' 字串，避免時區位移
    charset: 'utf8mb4',
  });

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
}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool, DB_NAME };
