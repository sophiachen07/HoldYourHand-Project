import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { nativeGoogleSignOut } from '../services/nativeGoogle';
import {
  userApi,
  type GoogleProfileInfo,
  type LoginResponse,
  type SyncPayload,
} from '../services/userApi';

const STORAGE_KEY_ACCOUNT = '@aura_user_account';
const STORAGE_KEY_GUEST = '@aura_guest_mode'; // 訪客模式：資料只存在手機，不寫入資料庫
const STORAGE_KEY_PROFILE = '@aura_user_profile';
const STORAGE_KEY_ONBOARDING = '@aura_onboarding_completed';
const STORAGE_KEY_BEHAVIOR_DB = '@aura_bfrb_history_db';
const STORAGE_KEY_DAILY_HISTORY = '@aura_daily_history';
const STORAGE_KEY_FIRST_ACTIVE_DATE = '@aura_first_active_date';
const STORAGE_KEY_LAST_ACTIVE_DATE = '@aura_last_active_date';

// 台灣時區 (GMT+8) 日期工具函數
export function getTaiwanDate(d: Date = new Date()): Date {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600000);
}

export function getTaiwanDateString(d: Date = new Date()): string {
  const twDate = getTaiwanDate(d);
  const year = twDate.getFullYear();
  const month = String(twDate.getMonth() + 1).padStart(2, '0');
  const date = String(twDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export function getWeekdayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const day = dateObj.getUTCDay();
  const map = ['日', '一', '二', '三', '四', '五', '六'];
  return map[day];
}

export function formatMonthDay(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  }
  return dateStr;
}

export function formatWeekdayWithDate(dateStr: string): string {
  const weekday = getWeekdayName(dateStr);
  const md = formatMonthDay(dateStr);
  return `${weekday} ${md}`;
}

export const BFRB_DRIVERS = {
  UNCONSCIOUS: ['壓力與焦慮驅動'],
  CONSCIOUS: [
    '無聊、缺乏刺激',
    '注意力不足過動症',
    '無法接受不平整',
    '強迫症',
  ],
} as const;

export const BFRB_BEHAVIOR_TYPES = [
  '摳皮膚',
  '拔毛髮',
  '咬指甲',
  '其他',
] as const;

export type UserProfile = {
  name: string;
  age: string;
  gender: string;
  bfrbDrivers: string[];
  bfrbTypes: string[];
  bfrbDriver?: string | string[];
  bfrbType?: string | string[];
  avatarUrl?: string | null; // Google 大頭貼
};

export function getProfileDrivers(p?: Partial<UserProfile> | null): string[] {
  if (!p) return ['壓力與焦慮驅動'];
  if (Array.isArray(p.bfrbDrivers) && p.bfrbDrivers.length > 0) {
    return p.bfrbDrivers;
  }
  if (Array.isArray(p.bfrbDriver) && p.bfrbDriver.length > 0) {
    return p.bfrbDriver;
  }
  if (typeof p.bfrbDriver === 'string' && p.bfrbDriver.trim()) {
    return p.bfrbDriver.split(/[,、]/).map((s) => s.trim()).filter(Boolean);
  }
  return ['壓力與焦慮驅動'];
}

export function getProfileTypes(p?: Partial<UserProfile> | null): string[] {
  if (!p) return ['摳皮膚'];
  if (Array.isArray(p.bfrbTypes) && p.bfrbTypes.length > 0) {
    return p.bfrbTypes;
  }
  if (Array.isArray(p.bfrbType) && p.bfrbType.length > 0) {
    return p.bfrbType;
  }
  if (typeof p.bfrbType === 'string' && p.bfrbType.trim()) {
    return p.bfrbType.split(/[,、]/).map((s) => s.trim()).filter(Boolean);
  }
  return ['摳皮膚'];
}

export type BehaviorStatItem = {
  type: string;
  title: string;
  icon: string;
  description: string;
  count: number;
  todayCount: number;
};

export type DailyRecord = {
  date: string; // YYYY-MM-DD (GMT+8)
  occurred: number; // 已發生次數
  restrained: number; // 已克制次數
  relaxed: number; // 舒緩練習次數
};

export const defaultBehaviorStats: Record<string, BehaviorStatItem> = {
  摳皮膚: {
    type: '摳皮膚',
    title: '摳皮行為',
    icon: '🖐️',
    description: '高發情境：任務瓶頸焦慮、缺乏刺激時。',
    count: 12,
    todayCount: 3,
  },
  拔毛髮: {
    type: '拔毛髮',
    title: '拉扯皮／拔毛傾向',
    icon: '💇',
    description: '高發情境：深夜放空思考時。',
    count: 4,
    todayCount: 1,
  },
  咬指甲: {
    type: '咬指甲',
    title: '咬指甲／啃咬指肉',
    icon: '🦷',
    description: '高發情境：視覺或觸覺不適。',
    count: 8,
    todayCount: 2,
  },
  其他: {
    type: '其他',
    title: '其他身體重複行為',
    icon: '✨',
    description: '高發情境：特定情境習慣性動作。',
    count: 2,
    todayCount: 0,
  },
};

// 新帳號用的歸零統計（不含展示用假數字）
export function createEmptyBehaviorStats(): Record<string, BehaviorStatItem> {
  const result: Record<string, BehaviorStatItem> = {};
  Object.keys(defaultBehaviorStats).forEach((key) => {
    result[key] = { ...defaultBehaviorStats[key], count: 0, todayCount: 0 };
  });
  return result;
}

function createEmptyDailyRecord(dateStr: string): DailyRecord {
  return { date: dateStr, occurred: 0, restrained: 0, relaxed: 0 };
}

// 對應資料庫 users 表：id 由 MySQL 自動編號，以 email 辨識
export type UserAccount = {
  userId: number;
  email: string;
};

export type LoginResult = {
  isNew: boolean;
  onboardingCompleted: boolean;
  googleProfile?: GoogleProfileInfo;
};

const SYNC_DEBOUNCE_MS = 1500;

export const defaultProfile: UserProfile = {
  name: '宇航',
  age: '21',
  gender: '男性',
  bfrbDrivers: ['壓力與焦慮驅動'],
  bfrbTypes: ['摳皮膚'],
  bfrbDriver: '壓力與焦慮驅動',
  bfrbType: '摳皮膚',
};

type UserContextValue = {
  account: UserAccount | null;
  loginWithEmail: (email: string) => Promise<LoginResult>;
  loginWithGoogle: (accessToken: string) => Promise<LoginResult>;
  loginWithGoogleNative: (idToken: string, accessToken: string | null) => Promise<LoginResult>;
  isGuest: boolean;
  loginAsGuest: () => Promise<{ onboardingCompleted: boolean }>;
  profile: UserProfile;
  hasCompletedOnboarding: boolean;
  isReady: boolean;
  behaviorStats: Record<string, BehaviorStatItem>;
  dailyHistory: Record<string, DailyRecord>;
  firstActiveDate: string;
  lastActiveDate: string;
  todayRecord: DailyRecord;
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (overrideProfile?: Partial<UserProfile>) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  recordBehaviorTrigger: (type?: string | string[]) => Promise<void>;
  revertLastTrigger: (type?: string | string[]) => Promise<void>;
  recordRestrained: (amount?: number) => Promise<void>;
  recordRelaxed: (amount?: number) => Promise<void>;
  injectMockHistory: (days?: number) => Promise<void>;
  triggerMidnightReset: () => Promise<void>;
  clearHistoryData: () => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [behaviorStats, setBehaviorStats] =
    useState<Record<string, BehaviorStatItem>>(defaultBehaviorStats);
  const [dailyHistory, setDailyHistory] =
    useState<Record<string, DailyRecord>>({});
  const [firstActiveDate, setFirstActiveDate] = useState<string>(getTaiwanDateString());
  const [lastActiveDate, setLastActiveDate] = useState<string>(getTaiwanDateString());
  const [isReady, setIsReady] = useState<boolean>(false);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const isGuestRef = useRef<boolean>(false);
  useEffect(() => {
    isGuestRef.current = isGuest;
  }, [isGuest]);

  // 給非同步回呼用的最新值
  const accountRef = useRef<UserAccount | null>(null);
  const hasCompletedOnboardingRef = useRef<boolean>(false);
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  useEffect(() => {
    hasCompletedOnboardingRef.current = hasCompletedOnboarding;
  }, [hasCompletedOnboarding]);

  const midnightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始化時自 AsyncStorage 讀取使用者資料、Onboarding 狀態與 BFRB 資料庫
  useEffect(() => {
    let isMounted = true;

    async function loadStoredData() {
      try {
        const todayStr = getTaiwanDateString();
        const [
          savedProfileJson,
          savedOnboarding,
          savedStatsJson,
          savedDailyJson,
          savedFirstDate,
          savedLastDate,
          savedAccountJson,
          savedGuest,
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_PROFILE),
          AsyncStorage.getItem(STORAGE_KEY_ONBOARDING),
          AsyncStorage.getItem(STORAGE_KEY_BEHAVIOR_DB),
          AsyncStorage.getItem(STORAGE_KEY_DAILY_HISTORY),
          AsyncStorage.getItem(STORAGE_KEY_FIRST_ACTIVE_DATE),
          AsyncStorage.getItem(STORAGE_KEY_LAST_ACTIVE_DATE),
          AsyncStorage.getItem(STORAGE_KEY_ACCOUNT),
          AsyncStorage.getItem(STORAGE_KEY_GUEST),
        ]);

        if (!isMounted) return;

        if (savedGuest === 'true') {
          setIsGuest(true);
        }

        if (savedAccountJson) {
          try {
            const parsedAccount = JSON.parse(savedAccountJson);
            if (parsedAccount?.userId && parsedAccount?.email) {
              setAccount(parsedAccount);
            }
          } catch (e) {
            console.error('解析帳號資料失敗:', e);
          }
        }

        if (savedProfileJson) {
          try {
            const parsed = JSON.parse(savedProfileJson);
            setProfile((prev) => ({ ...prev, ...parsed }));
          } catch (e) {
            console.error('解析儲存的使用者資料失敗:', e);
          }
        }

        if (savedOnboarding === 'true') {
          setHasCompletedOnboarding(true);
        } else {
          setHasCompletedOnboarding(false);
        }

        const initialFirstDate = savedFirstDate || todayStr;
        const initialLastDate = savedLastDate || todayStr;
        setFirstActiveDate(initialFirstDate);
        setLastActiveDate(initialLastDate);

        let parsedDaily: Record<string, DailyRecord> = {};
        if (savedDailyJson) {
          try {
            parsedDaily = JSON.parse(savedDailyJson);
          } catch (e) {
            console.error('解析每日歷史紀錄失敗:', e);
          }
        }

        // 若今日尚無紀錄，給予預設
        if (!parsedDaily[todayStr]) {
          parsedDaily[todayStr] = {
            date: todayStr,
            occurred: 3,
            restrained: 2,
            relaxed: 1,
          };
        }
        setDailyHistory(parsedDaily);

        let parsedStats: Record<string, BehaviorStatItem> = defaultBehaviorStats;
        if (savedStatsJson) {
          try {
            parsedStats = { ...defaultBehaviorStats, ...JSON.parse(savedStatsJson) };
          } catch (e) {
            console.error('解析 BFRB 行為資料庫失敗:', e);
          }
        }

        // 自動檢查跨日換日：若已跨越 00:00 (GMT+8)
        if (initialLastDate !== todayStr) {
          // 換日結算：今日 count 歸零
          Object.keys(parsedStats).forEach((key) => {
            parsedStats[key] = {
              ...parsedStats[key],
              todayCount: 0,
            };
          });
          if (!parsedDaily[todayStr]) {
            parsedDaily[todayStr] = {
              date: todayStr,
              occurred: 0,
              restrained: 0,
              relaxed: 0,
            };
          }
          await AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayStr);
          await AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(parsedStats));
          await AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(parsedDaily));
          setLastActiveDate(todayStr);
        }

        setBehaviorStats(parsedStats);
      } catch (error) {
        console.error('載入本機設定失敗:', error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    loadStoredData();

    // 啟動定時檢查跨夜換日（每分鐘檢查一次）
    midnightTimerRef.current = setInterval(() => {
      const currentToday = getTaiwanDateString();
      setLastActiveDate((prevLast) => {
        if (prevLast && prevLast !== currentToday) {
          // 跨日了，自動執行換日結算
          setBehaviorStats((prevStats) => {
            const nextStats = { ...prevStats };
            Object.keys(nextStats).forEach((k) => {
              nextStats[k] = { ...nextStats[k], todayCount: 0 };
            });
            AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(nextStats)).catch(
              console.error
            );
            return nextStats;
          });

          setDailyHistory((prevDaily) => {
            const nextDaily = { ...prevDaily };
            if (!nextDaily[currentToday]) {
              nextDaily[currentToday] = {
                date: currentToday,
                occurred: 0,
                restrained: 0,
                relaxed: 0,
              };
            }
            AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(nextDaily)).catch(
              console.error
            );
            return nextDaily;
          });

          AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, currentToday).catch(console.error);
          return currentToday;
        }
        return prevLast;
      });
    }, 60 * 1000);

    return () => {
      isMounted = false;
      if (midnightTimerRef.current) {
        clearInterval(midnightTimerRef.current);
      }
    };
  }, []);

  // 以 email 登入資料庫：已有資料就載入，新帳號則從零開始
  // 套用後端回傳的登入結果（email 登入與 Google 登入共用）
  const applyLoginResponse = useCallback(async (res: LoginResponse): Promise<LoginResult> => {
    const email = res.email;
    const todayStr = getTaiwanDateString();
    const nextAccount: UserAccount = { userId: res.userId, email: res.email };

    // 舊版本機資料搬遷：手機上已有資料、但從未登入過，且這個 email 是新帳號
    // 訪客的資料不上傳（訪客模式的承諾是不寫入資料庫）
    const migrateLocalData =
      res.isNew &&
      hasCompletedOnboardingRef.current &&
      !accountRef.current &&
      !isGuestRef.current;

    // 改用正式帳號登入：離開訪客模式
    setIsGuest(false);
    await AsyncStorage.removeItem(STORAGE_KEY_GUEST);

    if (migrateLocalData) {
      // 保留目前畫面上的資料，稍後由自動同步上傳
      setAccount(nextAccount);
      await AsyncStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(nextAccount));
      console.log(`[UserContext] 已將本機資料綁定到帳號 #${res.userId}`);
      return { isNew: true, onboardingCompleted: true };
    }

    let nextProfile: UserProfile;
    let nextStats: Record<string, BehaviorStatItem>;
    let nextDaily: Record<string, DailyRecord>;
    let nextFirstDate: string;

    if (res.onboardingCompleted) {
      const drivers = res.profile.bfrbDrivers?.length
        ? res.profile.bfrbDrivers
        : getProfileDrivers(null);
      const types = res.profile.bfrbTypes?.length ? res.profile.bfrbTypes : getProfileTypes(null);
      nextProfile = {
        name: res.profile.name || defaultProfile.name,
        age: res.profile.age || defaultProfile.age,
        gender: res.profile.gender || defaultProfile.gender,
        bfrbDrivers: drivers,
        bfrbTypes: types,
        bfrbDriver: drivers.join('、'),
        bfrbType: types.join('、'),
        avatarUrl: res.profile.avatarUrl || null,
      };
      nextStats = { ...createEmptyBehaviorStats(), ...res.behaviorStats };
      nextDaily = { ...res.dailyHistory };
      nextFirstDate = res.firstActiveDate || todayStr;

      // 上次使用不是今天：今日次數歸零
      if (res.lastActiveDate && res.lastActiveDate !== todayStr) {
        Object.keys(nextStats).forEach((k) => {
          nextStats[k] = { ...nextStats[k], todayCount: 0 };
        });
      }
    } else {
      // 新帳號：Google 登入時資料庫已存了 Google 提供的資料，預填到設定頁
      nextProfile = {
        ...defaultProfile,
        name: res.profile.name || defaultProfile.name,
        age: res.profile.age || defaultProfile.age,
        gender: res.profile.gender || defaultProfile.gender,
        avatarUrl: res.profile.avatarUrl || null,
      };
      nextStats = createEmptyBehaviorStats();
      nextDaily = {};
      nextFirstDate = todayStr;
    }

    if (!nextDaily[todayStr]) {
      nextDaily[todayStr] = createEmptyDailyRecord(todayStr);
    }

    setProfile(nextProfile);
    setBehaviorStats(nextStats);
    setDailyHistory(nextDaily);
    setFirstActiveDate(nextFirstDate);
    setLastActiveDate(todayStr);
    setHasCompletedOnboarding(res.onboardingCompleted);
    setAccount(nextAccount);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_ACCOUNT, JSON.stringify(nextAccount)),
      AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(nextProfile)),
      AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(nextStats)),
      AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(nextDaily)),
      AsyncStorage.setItem(STORAGE_KEY_FIRST_ACTIVE_DATE, nextFirstDate),
      AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayStr),
      res.onboardingCompleted
        ? AsyncStorage.setItem(STORAGE_KEY_ONBOARDING, 'true')
        : AsyncStorage.removeItem(STORAGE_KEY_ONBOARDING),
    ]);

    console.log(
      `[UserContext] 登入帳號 #${res.userId} ${email}${res.isNew ? '（新帳號）' : ''}`
    );
    return {
      isNew: res.isNew,
      onboardingCompleted: res.onboardingCompleted,
      googleProfile: res.googleProfile,
    };
  }, []);

  // 訪客登入：不連資料庫，資料只存在這台裝置
  const loginAsGuest = useCallback(async () => {
    // 已經是訪客且設定過：沿用手機上的訪客資料
    if (isGuestRef.current && hasCompletedOnboardingRef.current) {
      return { onboardingCompleted: true };
    }

    const todayStr = getTaiwanDateString();
    const freshStats = createEmptyBehaviorStats();
    const freshDaily = { [todayStr]: createEmptyDailyRecord(todayStr) };

    setAccount(null);
    setIsGuest(true);
    setProfile(defaultProfile);
    setBehaviorStats(freshStats);
    setDailyHistory(freshDaily);
    setFirstActiveDate(todayStr);
    setLastActiveDate(todayStr);
    setHasCompletedOnboarding(false);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_GUEST, 'true'),
      AsyncStorage.removeItem(STORAGE_KEY_ACCOUNT),
      AsyncStorage.removeItem(STORAGE_KEY_ONBOARDING),
      AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(defaultProfile)),
      AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(freshStats)),
      AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(freshDaily)),
      AsyncStorage.setItem(STORAGE_KEY_FIRST_ACTIVE_DATE, todayStr),
      AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayStr),
    ]);

    console.log('[UserContext] 以訪客身分使用（不寫入資料庫）');
    return { onboardingCompleted: false };
  }, []);

  const loginWithEmail = useCallback(
    async (rawEmail: string) =>
      applyLoginResponse(await userApi.login(rawEmail.trim().toLowerCase())),
    [applyLoginResponse]
  );

  const loginWithGoogleNative = useCallback(
    async (idToken: string, accessToken: string | null) =>
      applyLoginResponse(await userApi.googleLoginNative(idToken, accessToken)),
    [applyLoginResponse]
  );

  const loginWithGoogle = useCallback(
    async (accessToken: string) => applyLoginResponse(await userApi.googleLogin(accessToken)),
    [applyLoginResponse]
  );

  // 自動同步：資料有變動時，延遲 1.5 秒把整包資料寫進 MySQL
  useEffect(() => {
    if (!isReady || !account || !hasCompletedOnboarding) return;

    const payload: SyncPayload = {
      profile: {
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        bfrbDrivers: getProfileDrivers(profile),
        bfrbTypes: getProfileTypes(profile),
      },
      onboardingCompleted: true,
      firstActiveDate,
      lastActiveDate,
      behaviorStats,
      dailyHistory,
    };

    const timer = setTimeout(() => {
      userApi.sync(account.userId, payload).catch((err) => {
        if (err?.status === 404) {
          // 資料庫裡已沒有這個帳號（例如資料庫被清空）：自動登出，回到登入頁重新登入
          console.warn('[UserContext] 資料庫找不到此帳號，已自動登出');
          setAccount(null);
          setHasCompletedOnboarding(false);
          AsyncStorage.multiRemove([STORAGE_KEY_ACCOUNT, STORAGE_KEY_ONBOARDING]).catch(
            console.error
          );
          return;
        }
        console.warn('[UserContext] 同步資料庫失敗（下次變動時會再嘗試）:', err.message);
      });
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    isReady,
    account,
    hasCompletedOnboarding,
    profile,
    behaviorStats,
    dailyHistory,
    firstActiveDate,
    lastActiveDate,
  ]);

  const updateProfile = useCallback(async (partial: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...partial };
      // 確保陣列與字串同步
      if (partial.bfrbDrivers) {
        next.bfrbDriver = partial.bfrbDrivers.join('、');
      } else if (partial.bfrbDriver && !partial.bfrbDrivers) {
        next.bfrbDrivers = getProfileDrivers(next);
      }
      if (partial.bfrbTypes) {
        next.bfrbType = partial.bfrbTypes.join('、');
      } else if (partial.bfrbType && !partial.bfrbTypes) {
        next.bfrbTypes = getProfileTypes(next);
      }
      AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(next)).catch((err) =>
        console.error('儲存個人資料失敗:', err)
      );
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(
    async (overrideProfile?: Partial<UserProfile>) => {
      const todayStr = getTaiwanDateString();
      setProfile((prev) => {
        const next = { ...prev, ...(overrideProfile || {}) };
        if (overrideProfile?.bfrbDrivers) {
          next.bfrbDriver = overrideProfile.bfrbDrivers.join('、');
        } else {
          next.bfrbDrivers = getProfileDrivers(next);
        }
        if (overrideProfile?.bfrbTypes) {
          next.bfrbType = overrideProfile.bfrbTypes.join('、');
        } else {
          next.bfrbTypes = getProfileTypes(next);
        }
        AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(next)).catch((err) =>
          console.error('儲存個人資料失敗:', err)
        );
        return next;
      });
      setHasCompletedOnboarding(true);
      setFirstActiveDate(todayStr);
      setLastActiveDate(todayStr);
      await AsyncStorage.setItem(STORAGE_KEY_ONBOARDING, 'true');
      await AsyncStorage.setItem(STORAGE_KEY_FIRST_ACTIVE_DATE, todayStr);
      await AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayStr);
    },
    []
  );

  const resetOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(false);
    await AsyncStorage.removeItem(STORAGE_KEY_ONBOARDING);
  }, []);

  // 記錄一次行為觸發，並持久化至 dailyHistory 與 behaviorStats
  const recordBehaviorTrigger = useCallback(
    async (targetType?: string | string[]) => {
      const todayStr = getTaiwanDateString();
      const rawTarget = targetType || profile.bfrbTypes || profile.bfrbType || '摳皮膚';
      const key: string = Array.isArray(rawTarget)
        ? rawTarget[0] || '摳皮膚'
        : String(rawTarget || '摳皮膚');

      // 0. 寫入資料庫事件紀錄（失敗不影響本機統計）
      const currentAccount = accountRef.current;
      if (currentAccount) {
        userApi.logEvent(currentAccount.userId, key).catch((err) =>
          console.warn('[UserContext] 事件寫入資料庫失敗:', err.message)
        );
      }

      // 1. 更新 behaviorStats
      setBehaviorStats((prev) => {
        const currentItem = prev[key] || {
          type: key,
          title: `${key}行為`,
          icon:
            key === '拔毛髮'
              ? '💇'
              : key === '咬指甲'
              ? '🦷'
              : key === '其他'
              ? '✨'
              : '🖐️',
          description: '即時感測事件紀錄。',
          count: 0,
          todayCount: 0,
        };

        const updatedItem: BehaviorStatItem = {
          ...currentItem,
          count: currentItem.count + 1,
          todayCount: currentItem.todayCount + 1,
        };

        const nextStats = {
          ...prev,
          [key]: updatedItem,
        };

        AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(nextStats)).catch(
          (err) => console.error('儲存 BFRB 行為資料庫失敗:', err)
        );

        return nextStats;
      });

      // 2. 更新 dailyHistory
      setDailyHistory((prev) => {
        const existing = prev[todayStr] || {
          date: todayStr,
          occurred: 0,
          restrained: 0,
          relaxed: 0,
        };

        const nextRecord: DailyRecord = {
          ...existing,
          occurred: existing.occurred + 1,
        };

        const nextDaily = {
          ...prev,
          [todayStr]: nextRecord,
        };

        AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(nextDaily)).catch(
          (err) => console.error('儲存每日歷史紀錄失敗:', err)
        );

        return nextDaily;
      });
    },
    [profile.bfrbType, profile.bfrbTypes]
  );

  // 回退前一次誤判的觸發
  const revertLastTrigger = useCallback(
    async (targetType?: string | string[]) => {
      const todayStr = getTaiwanDateString();
      const rawTarget = targetType || profile.bfrbTypes || profile.bfrbType || '摳皮膚';
      const key: string = Array.isArray(rawTarget)
        ? rawTarget[0] || '摳皮膚'
        : String(rawTarget || '摳皮膚');

      const currentAccount = accountRef.current;
      if (currentAccount) {
        userApi.revertLastEvent(currentAccount.userId, key).catch((err) =>
          console.warn('[UserContext] 事件回退寫入資料庫失敗:', err.message)
        );
      }

      setBehaviorStats((prev) => {
        const currentItem = prev[key];
        if (!currentItem) return prev;

        const updatedItem: BehaviorStatItem = {
          ...currentItem,
          count: Math.max(0, currentItem.count - 1),
          todayCount: Math.max(0, currentItem.todayCount - 1),
        };

        const nextStats = {
          ...prev,
          [key]: updatedItem,
        };

        AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(nextStats)).catch(
          (err) => console.error('儲存 BFRB 行為資料庫失敗:', err)
        );

        return nextStats;
      });

      setDailyHistory((prev) => {
        const existing = prev[todayStr];
        if (!existing) return prev;

        const nextRecord: DailyRecord = {
          ...existing,
          occurred: Math.max(0, existing.occurred - 1),
        };

        const nextDaily = {
          ...prev,
          [todayStr]: nextRecord,
        };

        AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(nextDaily)).catch(
          (err) => console.error('儲存每日歷史紀錄失敗:', err)
        );

        return nextDaily;
      });
    },
    [profile.bfrbType]
  );

  // 記錄克制次數
  const recordRestrained = useCallback(async (amount = 1) => {
    const todayStr = getTaiwanDateString();
    setDailyHistory((prev) => {
      const existing = prev[todayStr] || {
        date: todayStr,
        occurred: 0,
        restrained: 0,
        relaxed: 0,
      };

      const nextDaily = {
        ...prev,
        [todayStr]: {
          ...existing,
          restrained: existing.restrained + amount,
        },
      };

      AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(nextDaily)).catch(
        console.error
      );
      return nextDaily;
    });
  }, []);

  // 記錄舒緩練習次數
  const recordRelaxed = useCallback(async (amount = 1) => {
    const todayStr = getTaiwanDateString();
    setDailyHistory((prev) => {
      const existing = prev[todayStr] || {
        date: todayStr,
        occurred: 0,
        restrained: 0,
        relaxed: 0,
      };

      const nextDaily = {
        ...prev,
        [todayStr]: {
          ...existing,
          relaxed: existing.relaxed + amount,
        },
      };

      AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(nextDaily)).catch(
        console.error
      );
      return nextDaily;
    });
  }, []);

  // 測試指令 a: 注入過去假資料 (預設 60 天，每天 0~15 次)
  const injectMockHistory = useCallback(
    async (days: number = 60) => {
      const validDays = typeof days === 'number' && days > 0 ? days : 60;
      const today = getTaiwanDate();
      const mockDaily: Record<string, DailyRecord> = {};
      let totalOccurred = 0;
      let todayOccurred = 0;

      // 產生過去 validDays 天 (i 從 validDays - 1 倒數到 0，0 為今天)
      for (let i = validDays - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = getTaiwanDateString(d);

        // 隨機產生 0~15 次已發生、0~8 次已克制、0~5 次舒緩
        const occurred = Math.floor(Math.random() * 16);
        const restrained = Math.floor(Math.random() * 9);
        const relaxed = Math.floor(Math.random() * 6);

        mockDaily[dateStr] = {
          date: dateStr,
          occurred,
          restrained,
          relaxed,
        };

        totalOccurred += occurred;
        if (i === 0) {
          todayOccurred = occurred;
        }
      }

      const firstDateStr = getTaiwanDateString(
        new Date(today.getTime() - (validDays - 1) * 24 * 60 * 60 * 1000)
      );
      const todayStr = getTaiwanDateString(today);
      const rawKey = profile.bfrbTypes || profile.bfrbType || '摳皮膚';
      const key: string = Array.isArray(rawKey)
        ? rawKey[0] || '摳皮膚'
        : String(rawKey || '摳皮膚');
      let nextStats: Record<string, BehaviorStatItem> = {};

      setBehaviorStats((prev) => {
        const current = prev[key] || defaultBehaviorStats[key] || {
          type: key,
          title: `${key}行為`,
          icon: '🖐️',
          description: '高發情境：任務瓶頸焦慮、缺乏刺激時。',
          count: 0,
          todayCount: 0,
        };

        nextStats = {
          ...prev,
          [key]: {
            ...current,
            count: totalOccurred,
            todayCount: todayOccurred,
          },
        };

        return nextStats;
      });

      setDailyHistory(mockDaily);
      setFirstActiveDate(firstDateStr);
      setLastActiveDate(todayStr);

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(nextStats)),
        AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(mockDaily)),
        AsyncStorage.setItem(STORAGE_KEY_FIRST_ACTIVE_DATE, firstDateStr),
        AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayStr),
      ]);

      console.log(`[DevTools] 已注入 ${validDays} 天假資料，總次數：`, totalOccurred);
    },
    [profile.bfrbType]
  );

  // 測試指令 c: 強制觸發 00:00 跨夜換日結算
  const triggerMidnightReset = useCallback(async () => {
    const todayStr = getTaiwanDateString();

    setBehaviorStats((prevStats) => {
      const nextStats = { ...prevStats };
      Object.keys(nextStats).forEach((k) => {
        nextStats[k] = { ...nextStats[k], todayCount: 0 };
      });
      AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(nextStats)).catch(
        console.error
      );
      return nextStats;
    });

    setDailyHistory((prevDaily) => {
      const nextDaily = { ...prevDaily };
      // 確保今日紀錄重置為 0
      nextDaily[todayStr] = {
        date: todayStr,
        occurred: 0,
        restrained: 0,
        relaxed: 0,
      };
      AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(nextDaily)).catch(
        console.error
      );
      return nextDaily;
    });

    await AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayStr);
    setLastActiveDate(todayStr);

    console.log('[DevTools] 已觸發 00:00 換日結算機制，今日摳抓次數已歸零。');
  }, []);

  // 清除目前所有 BFRB 歷史數據與統計資料
  const clearHistoryData = useCallback(async () => {
    const todayStr = getTaiwanDateString();

    const resetStats: Record<string, BehaviorStatItem> = {
      摳皮膚: {
        type: '摳皮膚',
        title: '摳皮行為',
        icon: '🖐️',
        description: '高發情境：任務瓶頸焦慮、缺乏刺激時。',
        count: 0,
        todayCount: 0,
      },
      拔毛髮: {
        type: '拔毛髮',
        title: '拉扯皮／拔毛傾向',
        icon: '💇',
        description: '高發情境：深夜放空思考時。',
        count: 0,
        todayCount: 0,
      },
      咬指甲: {
        type: '咬指甲',
        title: '咬指甲／啃咬指肉',
        icon: '🦷',
        description: '高發情境：視覺或觸覺不適。',
        count: 0,
        todayCount: 0,
      },
      其他: {
        type: '其他',
        title: '其他身體重複行為',
        icon: '✨',
        description: '高發情境：特定情境習慣性動作。',
        count: 0,
        todayCount: 0,
      },
    };

    const resetDaily: Record<string, DailyRecord> = {
      [todayStr]: {
        date: todayStr,
        occurred: 0,
        restrained: 0,
        relaxed: 0,
      },
    };

    setBehaviorStats(resetStats);
    setDailyHistory(resetDaily);
    setFirstActiveDate(todayStr);
    setLastActiveDate(todayStr);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY_BEHAVIOR_DB, JSON.stringify(resetStats)),
      AsyncStorage.setItem(STORAGE_KEY_DAILY_HISTORY, JSON.stringify(resetDaily)),
      AsyncStorage.setItem(STORAGE_KEY_FIRST_ACTIVE_DATE, todayStr),
      AsyncStorage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayStr),
    ]);

    console.log('[UserContext] 所有 BFRB 歷史紀錄與統計資料已清空重設。');
  }, []);

  // 登出：清除登入狀態與 Onboarding 紀錄
  const logout = useCallback(async () => {
    setAccount(null);
    setIsGuest(false);
    setHasCompletedOnboarding(false);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_ONBOARDING),
      AsyncStorage.removeItem(STORAGE_KEY_ACCOUNT),
      AsyncStorage.removeItem(STORAGE_KEY_GUEST),
      nativeGoogleSignOut(),
    ]);
    console.log('[UserContext] 已登出並重置登入狀態。');
  }, []);

  const todayRecord: DailyRecord = useMemo(() => {
    const todayStr = getTaiwanDateString();
    const selectedTypes = getProfileTypes(profile);
    const sumTodayCount = selectedTypes.reduce(
      (acc, t) => acc + (behaviorStats[t]?.todayCount || 0),
      0
    );
    return (
      dailyHistory[todayStr] || {
        date: todayStr,
        occurred: sumTodayCount,
        restrained: 0,
        relaxed: 0,
      }
    );
  }, [dailyHistory, behaviorStats, profile]);

  const value = useMemo(
    () => ({
      account,
      loginWithEmail,
      loginWithGoogle,
      loginWithGoogleNative,
      isGuest,
      loginAsGuest,
      profile,
      hasCompletedOnboarding,
      isReady,
      behaviorStats,
      dailyHistory,
      firstActiveDate,
      lastActiveDate,
      todayRecord,
      updateProfile,
      completeOnboarding,
      resetOnboarding,
      recordBehaviorTrigger,
      revertLastTrigger,
      recordRestrained,
      recordRelaxed,
      injectMockHistory,
      triggerMidnightReset,
      clearHistoryData,
      logout,
    }),
    [
      account,
      loginWithEmail,
      loginWithGoogle,
      loginWithGoogleNative,
      isGuest,
      loginAsGuest,
      profile,
      hasCompletedOnboarding,
      isReady,
      behaviorStats,
      dailyHistory,
      firstActiveDate,
      lastActiveDate,
      todayRecord,
      updateProfile,
      completeOnboarding,
      resetOnboarding,
      recordBehaviorTrigger,
      revertLastTrigger,
      recordRestrained,
      recordRelaxed,
      injectMockHistory,
      triggerMidnightReset,
      clearHistoryData,
      logout,
    ]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser 必須在 UserProvider 裡使用');
  }
  return context;
}

export default UserProvider;
