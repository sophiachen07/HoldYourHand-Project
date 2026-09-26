import Constants from 'expo-constants';

const FALLBACK_IP = '192.168.0.18';
const SERVER_PORT = '8080';

/**
 * 自動取得後端主機 IP
 * 開發環境下可從 Expo 的 hostUri 自動解析主機電腦 IP
 */
export function getHostIp(): string {
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
