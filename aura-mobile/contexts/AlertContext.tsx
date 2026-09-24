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

import { PickingAlertModal } from '../components/alert';
import { useSensor } from './SensorContext';
import { useUser } from './UserContext';

import * as Haptics from 'expo-haptics';

const ALERT_COOLDOWN_MS = 1 * 30 * 1000; // 測試用 30 秒 (正式可改回 5 分鐘)
const NORMAL_RESET_MS = 20 * 1000; // 恢復正常至少 20 秒

type AlertContextValue = {
  isPicking: boolean;
  alertVisible: boolean;
  alertEligible: boolean;
  ignoredCurrentEvent: boolean;
  handleClosePickingAlert: () => void;
  handleFalseDetection: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: PropsWithChildren) {
  const { sensorData } = useSensor();
  const { profile, recordBehaviorTrigger, revertLastTrigger } = useUser();

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertEligible, setAlertEligible] = useState(true);
  const [ignoredCurrentEvent, setIgnoredCurrentEvent] = useState(false);

  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasData = sensorData !== null;
  const distance = sensorData?.distance ?? 9999;
  const angularVelocity = sensorData?.angularVelocity ?? 0;
  const heartRate = sensorData?.heartRate ?? 0;
  const motorStatus = sensorData?.motorStatus ?? false;

  // 綜合 BFRB 摳抓判定：ESP32 馬達震動中 或 (距離 < 50mm 且 角速度 20~150 deg/s 且 心率 >= 80 BPM)
  const isPicking = Boolean(
    hasData &&
      (motorStatus ||
        (!sensorData?.isOutOfRange &&
          distance < 50 &&
          angularVelocity >= 20.0 &&
          angularVelocity <= 150.0 &&
          heartRate >= 80.0))
  );

  // 異常時，只要目前具有提醒資格，就跳出全域提醒視窗並記錄行為
  useEffect(() => {
    if (isPicking && alertEligible && !alertVisible) {
      setAlertVisible(true);
      setAlertEligible(false);
      setIgnoredCurrentEvent(false);
      recordBehaviorTrigger(profile.bfrbType);

      // 手機端觸發震動反饋提醒
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        // 忽略無觸覺反饋裝置
      }
    }
  }, [
    isPicking,
    alertEligible,
    alertVisible,
    profile.bfrbType,
    recordBehaviorTrigger,
  ]);

  // 恢復正常後開始 20 秒計時重置資格
  useEffect(() => {
    if (!hasData) return;

    if (isPicking) {
      if (normalTimerRef.current) {
        clearTimeout(normalTimerRef.current);
        normalTimerRef.current = null;
      }
      return;
    }

    if (normalTimerRef.current) return;

    normalTimerRef.current = setTimeout(() => {
      setAlertEligible(true);
      setIgnoredCurrentEvent(false);

      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      normalTimerRef.current = null;
    }, NORMAL_RESET_MS);
  }, [hasData, isPicking]);

  // 元件卸載時清除計時器
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      if (normalTimerRef.current) {
        clearTimeout(normalTimerRef.current);
        normalTimerRef.current = null;
      }
    };
  }, []);

  const startAlertCooldown = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }

    cooldownTimerRef.current = setTimeout(() => {
      setAlertEligible(true);
      cooldownTimerRef.current = null;
    }, ALERT_COOLDOWN_MS);
  }, []);

  const handleClosePickingAlert = useCallback(() => {
    setAlertVisible(false);
    setAlertEligible(false);
    startAlertCooldown();
  }, [startAlertCooldown]);

  const handleFalseDetection = useCallback(() => {
    setIgnoredCurrentEvent(true);
    setAlertVisible(false);
    setAlertEligible(false);
    revertLastTrigger(profile.bfrbType);
    startAlertCooldown();
  }, [profile.bfrbType, revertLastTrigger, startAlertCooldown]);

  const value = useMemo(
    () => ({
      isPicking,
      alertVisible,
      alertEligible,
      ignoredCurrentEvent,
      handleClosePickingAlert,
      handleFalseDetection,
    }),
    [
      isPicking,
      alertVisible,
      alertEligible,
      ignoredCurrentEvent,
      handleClosePickingAlert,
      handleFalseDetection,
    ]
  );

  return (
    <AlertContext.Provider value={value}>
      {children}

      {/* 全域頂層摳抓警示提醒視窗，保證在任何頁面都能正常顯示與互動 */}
      <PickingAlertModal
        visible={alertVisible}
        onClose={handleClosePickingAlert}
        onFalseDetection={handleFalseDetection}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert 必須在 AlertProvider 裡使用');
  }
  return context;
}

export default AlertProvider;
