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
        ] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_PROFILE),
          AsyncStorage.getItem(STORAGE_KEY_ONBOARDING),
          AsyncStorage.getItem(STORAGE_KEY_BEHAVIOR_DB),
          AsyncStorage.getItem(STORAGE_KEY_DAILY_HISTORY),
          AsyncStorage.getItem(STORAGE_KEY_FIRST_ACTIVE_DATE),
          AsyncStorage.getItem(STORAGE_KEY_LAST_ACTIVE_DATE),
        ]);

        if (!isMounted) return;

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
    setHasCompletedOnboarding(false);
    await AsyncStorage.removeItem(STORAGE_KEY_ONBOARDING);
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
