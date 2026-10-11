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
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'`,
    [DB_NAME]
  );
  if (Number(row.cnt) === 0) {
    await pool.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER gender');
    console.log('[DB] 已新增欄位 users.avatar_url');
  }
}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool, DB_NAME };
