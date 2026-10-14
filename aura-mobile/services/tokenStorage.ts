// ==========================================
// 安全憑證儲存模組 (SecureStore 支援與 Web 降級)
// ==========================================
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SECURE_TOKEN_KEY = 'aura_auth_token_v1';

// 記憶體中暫存 Token 快取
let inMemoryToken: string | null = null;

export async function getStoredToken(): Promise<string | null> {
  if (inMemoryToken) {
    return inMemoryToken;
  }

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        inMemoryToken = window.localStorage.getItem(SECURE_TOKEN_KEY);
      }
    } else {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        inMemoryToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
      }
    }
  } catch (err) {
    console.warn('[TokenStorage] 讀取安全憑證失敗:', err);
  }

  return inMemoryToken;
}

export async function setStoredToken(token: string): Promise<void> {
  inMemoryToken = token;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SECURE_TOKEN_KEY, token);
      }
    } else {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      }
    }
  } catch (err) {
    console.warn('[TokenStorage] 儲存安全憑證失敗:', err);
  }
}

export async function clearStoredToken(): Promise<void> {
  inMemoryToken = null;

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SECURE_TOKEN_KEY);
      }
    } else {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
      }
    }
  } catch (err) {
    console.warn('[TokenStorage] 清除安全憑證失敗:', err);
  }
}
