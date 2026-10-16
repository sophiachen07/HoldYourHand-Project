import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEV_FALLBACK_IP = '192.168.0.14';
const DEV_SERVER_PORT = '8080';

/**
 * 自動取得後端主機 IP (僅用於開發除錯模式)
 */
export function getHostIp(): string {
  // 網頁版（瀏覽器開啟）：後端與網頁在同一台電腦，直接用網址列的主機
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return ip;
  }
  return DEV_FALLBACK_IP;
}

/**
 * 取得 HTTP API 基礎位址
 * 1. 優先讀取公開環境變數 EXPO_PUBLIC_API_URL (正式部署 / 雲端 / ngrok 網址)
 * 2. 次之若有 hostUri 則連線開發主機電腦
 * 3. 預設 Fallback 至區域網路 IP
 */
export function getApiBaseUrl(): string {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl && envApiUrl.trim() !== '') {
    const trimmed = envApiUrl.trim().replace(/\/+$/, '');
    if (!__DEV__ && !trimmed.startsWith('https://')) {
      console.warn('[Aura] 正式環境建議使用 HTTPS 通訊協定: ' + trimmed);
    }
    return trimmed;
  }
  if (!__DEV__) {
    throw new Error(
      '[Aura] 正式環境 EXPO_PUBLIC_API_URL 尚未設定！Release 版 APK 必須配置正確的後端伺服器網址。'
    );
  }
  return `http://${getHostIp()}:${DEV_SERVER_PORT}`;
}

/**
 * 取得 WebSocket 基礎位址
 * 1. 優先讀取公開環境變數 EXPO_PUBLIC_WS_URL
 * 2. 自動將 EXPO_PUBLIC_API_URL 轉化為 ws:// 或 wss:// 協定
 * 3. 預設 Fallback 至開發主機 WebSocket 埠口 (僅限開發模式)
 */
export function getWebSocketUrl(): string {
  const envWsUrl = process.env.EXPO_PUBLIC_WS_URL;
  if (envWsUrl && envWsUrl.trim() !== '') {
    return envWsUrl.trim().replace(/\/+$/, '');
  }
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl && envApiUrl.trim() !== '') {
    return envApiUrl.trim().replace(/\/+$/, '').replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  }
  if (!__DEV__) {
    throw new Error(
      '[Aura] 正式環境 EXPO_PUBLIC_WS_URL 尚未設定！Release 版 APK 必須配置正確的 WebSocket 網址。'
    );
  }
  return `ws://${getHostIp()}:${DEV_SERVER_PORT}`;
}
