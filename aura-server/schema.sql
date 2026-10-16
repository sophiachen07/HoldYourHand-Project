-- HoldYourHand MySQL 資料表結構
-- 後端啟動時會自動建立（db.js），這個檔案僅供參考，
-- 也可以在 MySQL Workbench 手動執行。

CREATE DATABASE IF NOT EXISTS holdyourhand
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE holdyourhand;

-- 使用者：以 email 辨識，id 由資料庫自動編號
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  google_id VARCHAR(100) NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  name VARCHAR(100) NULL,
  age VARCHAR(10) NULL,
  gender VARCHAR(20) NULL,
  avatar_url VARCHAR(500) NULL,
  bfrb_drivers JSON NULL,
  bfrb_types JSON NULL,
  onboarding_completed TINYINT(1) NOT NULL DEFAULT 0,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  first_active_date DATE NULL,
  last_active_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 信箱一次性驗證碼 (OTP)
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
);

-- 各類 BFRB 行為的累計統計（每位使用者每種類型一筆）
CREATE TABLE IF NOT EXISTS behavior_stats (
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(100) NULL,
  icon VARCHAR(16) NULL,
  description VARCHAR(255) NULL,
  total_count INT NOT NULL DEFAULT 0,
  today_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 每日統計（每位使用者每天一筆）
CREATE TABLE IF NOT EXISTS daily_records (
  user_id INT UNSIGNED NOT NULL,
  record_date DATE NOT NULL,
  occurred INT NOT NULL DEFAULT 0,
  restrained INT NOT NULL DEFAULT 0,
  relaxed INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, record_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 每一次 BFRB 觸發事件（含時間），被標記誤判時 reverted = 1
CREATE TABLE IF NOT EXISTS behavior_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  reverted TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_events_user_time (user_id, occurred_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 手環感測器原始數據（App 端每秒取樣一筆、批次上傳）
CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  distance INT NULL,
  angular_velocity FLOAT NULL,
  heart_rate FLOAT NULL,
  spo2 INT NULL,
  motor_status TINYINT(1) NULL,
  is_out_of_range TINYINT(1) NULL,
  source VARCHAR(16) NULL,
  INDEX idx_sensor_user_time (user_id, recorded_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
