// ==========================================
// 清空資料庫所有資料（保留資料表結構，編號從 1 重新開始）
// 用法：在 aura-server 資料夾執行  node scripts/reset-db.js --yes
// ⚠️ 無法復原，只建議用在測試資料
// ==========================================
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const TABLES = ['sensor_readings', 'behavior_events', 'daily_records', 'behavior_stats', 'users'];

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('這會刪除資料庫裡「所有」使用者與紀錄，且無法復原。');
    console.log('確定要清空的話，請執行：node scripts/reset-db.js --yes');
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || 'holdyourhand';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`已清空 ${table}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    const [[row]] = await conn.query('SELECT COUNT(*) AS cnt FROM users');
    console.log(`完成！目前使用者數量：${row.cnt}（資料庫：${dbName}）`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('清空失敗：', err.message);
  process.exit(1);
});
