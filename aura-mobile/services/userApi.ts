// ==========================================
// 與 aura-server 的 MySQL 使用者 API 溝通
// ==========================================
import { getApiBaseUrl } from '../constants/apiConfig';
import { getStoredToken, setStoredToken, clearStoredToken } from './tokenStorage';

export type ServerBehaviorStat = {
  type: string;
  title: string;
  icon: string;
  description: string;
  count: number;
  todayCount: number;
};

export type ServerDailyRecord = {
  date: string;
  occurred: number;
  restrained: number;
  relaxed: number;
};

export type ServerProfile = {
  name: string;
  age: string;
  gender: string;
  bfrbDrivers: string[];
  bfrbTypes: string[];
  avatarUrl?: string | null;
};

export type GoogleProfileInfo = {
  name: string | null;
  age: string | null;
  gender: string | null;
  avatarUrl: string | null;
};

export type UserSnapshot = {
  userId: number;
  email: string;
  emailVerified?: boolean;
  onboardingCompleted: boolean;
  firstActiveDate: string | null;
  lastActiveDate: string | null;
  profile: ServerProfile;
  behaviorStats: Record<string, ServerBehaviorStat>;
  dailyHistory: Record<string, ServerDailyRecord>;
};

export type LoginResponse = UserSnapshot & {
  token?: string;
  isNew: boolean;
  googleProfile?: GoogleProfileInfo;
};

export type SyncPayload = {
  profile: ServerProfile;
  onboardingCompleted: boolean;
  firstActiveDate: string;
  lastActiveDate: string;
  behaviorStats: Record<string, ServerBehaviorStat>;
  dailyHistory: Record<string, ServerDailyRecord>;
};

export type SensorReadingPayload = {
  timestamp: number;
  distance: number;
  angularVelocity: number;
  heartRate: number;
  spo2: number;
  motorStatus: boolean;
  isOutOfRange: boolean;
  source: 'ble' | 'simulator';
};

export type SendCodeResponse = {
  ok: boolean;
  message: string;
  devMode?: boolean;
};

const REQUEST_TIMEOUT_MS = 8000;

// Token 記憶體狀態與 401 監聽器
let activeAuthToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setApiToken(token: string | null) {
  activeAuthToken = token;
}

export function registerUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // 若尚未在記憶體中載入 Token，嘗試從安全儲存取得
  let token = activeAuthToken;
  if (!token) {
    token = await getStoredToken();
    if (token) activeAuthToken = token;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };

  // 自動附加 Authorization Bearer 標頭
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && unauthorizedHandler) {
        // Token 失效時觸發全域回呼
        unauthorizedHandler();
      }
      const error: Error & { status?: number; code?: string } = new Error(
        data?.error || `伺服器回應錯誤 (${res.status})`
      );
      error.status = res.status;
      error.code = data?.code;
      throw error;
    }
    return data as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('連線逾時，請確認後端伺服器已啟動、手機與電腦在同一個網路');
    }
    if (err instanceof TypeError) {
      throw new Error('無法連線到後端伺服器，請確認 node server.js 已啟動');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const userApi = {
  // 索取 Email 驗證碼
  sendVerificationCode(email: string) {
    return request<SendCodeResponse>('/api/users/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // 驗證 Email 驗證碼並登入
  async verifyEmailCode(email: string, code: string) {
    const res = await request<LoginResponse>('/api/users/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    if (res.token) {
      setApiToken(res.token);
      await setStoredToken(res.token);
    }
    return res;
  },

  // 取得目前已登入者的自身資料
  getCurrentUser() {
    return request<UserSnapshot>('/api/users/me');
  },

  // 網頁版 Google 登入
  async googleLogin(accessToken: string) {
    const res = await request<LoginResponse>('/api/users/google-login', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    });
    if (res.token) {
      setApiToken(res.token);
      await setStoredToken(res.token);
    }
    return res;
  },

  // 手機版 Google 登入（ID Token 驗證身分，Access Token 讀取生日／性別）
  async googleLoginNative(idToken: string, accessToken: string | null) {
    const res = await request<LoginResponse>('/api/users/google-login', {
      method: 'POST',
      body: JSON.stringify({ idToken, accessToken }),
    });
    if (res.token) {
      setApiToken(res.token);
      await setStoredToken(res.token);
    }
    return res;
  },

  getConfig() {
    return request<{ googleClientId: string | null }>('/api/config');
  },

  sync(userId: number, payload: SyncPayload) {
    return request<{ ok: boolean }>(`/api/users/${userId}/sync`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  logEvent(userId: number, type: string, occurredAt: number = Date.now()) {
    return request<{ id: number }>(`/api/users/${userId}/events`, {
      method: 'POST',
      body: JSON.stringify({ type, occurredAt }),
    });
  },

  revertLastEvent(userId: number, type?: string) {
    return request<{ reverted: number }>(`/api/users/${userId}/events/revert-last`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  },

  uploadSensorReadings(userId: number, readings: SensorReadingPayload[]) {
    return request<{ inserted: number }>(`/api/users/${userId}/sensor-readings`, {
      method: 'POST',
      body: JSON.stringify({ readings }),
    });
  },

  async clearAuth() {
    setApiToken(null);
    await clearStoredToken();
  },
};
