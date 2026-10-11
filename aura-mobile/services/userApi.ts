// ==========================================
// 與 aura-server 的 MySQL 使用者 API 溝通
// ==========================================
import { getApiBaseUrl } from '../constants/apiConfig';

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
  onboardingCompleted: boolean;
  firstActiveDate: string | null;
  lastActiveDate: string | null;
  profile: ServerProfile;
  behaviorStats: Record<string, ServerBehaviorStat>;
  dailyHistory: Record<string, ServerDailyRecord>;
};

export type LoginResponse = UserSnapshot & {
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

const REQUEST_TIMEOUT_MS = 8000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error: Error & { status?: number } = new Error(
        data?.error || `伺服器回應錯誤 (${res.status})`
      );
      error.status = res.status;
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
  login(email: string) {
    return request<LoginResponse>('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  googleLogin(accessToken: string) {
    return request<LoginResponse>('/api/users/google-login', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    });
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
};
