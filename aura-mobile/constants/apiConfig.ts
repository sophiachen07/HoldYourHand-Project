import Constants from 'expo-constants';
import { Platform } from 'react-native';

const FALLBACK_IP = '192.168.0.18';
const SERVER_PORT = '8080';

/**
 * 自動取得後端主機 IP
 * 開發環境下可從 Expo 的 hostUri 自動解析主機電腦 IP
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
  return FALLBACK_IP;
}

/**
 * 取得 HTTP API 基礎位址 (例如 http://192.168.0.18:8080)
 */
export function getApiBaseUrl(): string {
  return `http://${getHostIp()}:${SERVER_PORT}`;
}

/**
 * 取得 WebSocket 基礎位址 (例如 ws://192.168.0.18:8080)
 */
export function getWebSocketUrl(): string {
  return `ws://${getHostIp()}:${SERVER_PORT}`;
}
