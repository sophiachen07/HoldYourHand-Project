/**
 * 安全日誌工具 (Aura Logger)
 * - 開發環境 (__DEV__ = true)：輸出完整日誌以利除錯
 * - 正式環境 (__DEV__ = false)：壓制除錯日誌，避免使用者 Email、Token 或感測封包外洩至系統日誌 (Logcat)
 */
export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (__DEV__) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

export default logger;
