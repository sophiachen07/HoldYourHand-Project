// ==========================================
// 手機版 Google 登入（開發版／正式版 App 才有，Expo Go 與網頁版不支援）
// 使用 @react-native-google-signin/google-signin
// ==========================================
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/user.birthday.read',
  'https://www.googleapis.com/auth/user.gender.read',
];

export const NATIVE_GOOGLE_UNAVAILABLE_MESSAGE =
  'Expo Go 無法使用 Google 登入。請使用打包後的開發版 App，或用電腦瀏覽器開啟網頁版。目前請先用電子信箱或訪客登入。';

let cachedModule: any | null | undefined;
let configuredClientId: string | null = null;

/** Expo Go 與網頁版沒有原生 Google 模組，直接回傳 null，避免 App 當掉 */
function getGoogleModule(): any | null {
  if (Platform.OS === 'web') return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    cachedModule = require('@react-native-google-signin/google-signin');
  } catch (err) {
    console.warn('[NativeGoogle] 無法載入 Google 登入模組:', err);
    cachedModule = null;
  }
  return cachedModule;
}

export function isNativeGoogleAvailable(): boolean {
  return getGoogleModule() !== null;
}

export type NativeGoogleTokens = {
  idToken: string;
  accessToken: string | null;
};

/**
 * 開啟 Google 帳號選擇畫面。
 * 回傳 null 代表使用者自己取消登入。
 * webClientId 必須是 Google Cloud 的「網頁應用程式」用戶端 ID（後端用它驗證身分）。
 */
export async function nativeGoogleSignIn(webClientId: string): Promise<NativeGoogleTokens | null> {
  const googleModule = getGoogleModule();
  if (!googleModule) {
    throw new Error(NATIVE_GOOGLE_UNAVAILABLE_MESSAGE);
  }
  const { GoogleSignin, statusCodes } = googleModule;

  if (configuredClientId !== webClientId) {
    GoogleSignin.configure({ webClientId, scopes: GOOGLE_SCOPES });
    configuredClientId = webClientId;
  }

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();
    // 新版套件回傳 { type, data }，舊版直接回傳使用者資料
    if (response?.type === 'cancelled') return null;
    const data = response?.data ?? response;

    const idToken: string | undefined = data?.idToken;
    if (!idToken) {
      throw new Error('沒有取得 Google 憑證，請確認 Google Cloud 的用戶端設定。');
    }

    let accessToken: string | null = null;
    try {
      accessToken = (await GoogleSignin.getTokens())?.accessToken ?? null;
    } catch (err) {
      console.warn('[NativeGoogle] 取得 Access Token 失敗，只會帶入基本資料:', err);
    }

    return { idToken, accessToken };
  } catch (err: any) {
    if (statusCodes && err?.code === statusCodes.SIGN_IN_CANCELLED) return null;

    const code = String(err?.code ?? '');
    if (code === '10' || /DEVELOPER_ERROR/i.test(String(err?.message))) {
      throw new Error(
        'Google 登入設定錯誤（DEVELOPER_ERROR）：請確認 Google Cloud 已建立 Android 用戶端，且套件名稱與 SHA-1 指紋正確。'
      );
    }
    if (statusCodes && err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('這支手機沒有可用的 Google Play 服務，無法使用 Google 登入。');
    }
    throw err;
  }
}

/** 登出時一併清除 Google 登入狀態，下次才能選擇其他帳號 */
export async function nativeGoogleSignOut(): Promise<void> {
  const googleModule = getGoogleModule();
  if (!googleModule) return;
  try {
    await googleModule.GoogleSignin.signOut();
  } catch {
    // 本來就沒登入 Google 時會失敗，忽略即可
  }
}
