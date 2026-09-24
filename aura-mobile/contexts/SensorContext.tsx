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

import type {
  BleDiscoveredDevice,
  BleHoldYourHandData,
  ConnectionMode,
  ConnectionStatus,
  SensorData,
} from '../types/sensor';
import { bleService, BLE_CONFIG } from '../services/bleService';
import { useUser } from './UserContext';

// 模擬器 WebSocket 連線位置
const SOCKET_URL = 'ws://192.168.0.14:8080';

type SensorContextValue = {
  status: ConnectionStatus;
  mode: ConnectionMode;
  setMode: (mode: ConnectionMode) => void;
  sensorData: SensorData | null;
  lastMessageAt: string | null;
  connectedDeviceName: string | null;
  discoveredDevices: BleDiscoveredDevice[];
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: () => Promise<void>;
};

const SensorContext = createContext<SensorContextValue | null>(null);

export function SensorProvider({ children }: PropsWithChildren) {
  const { injectMockHistory, recordBehaviorTrigger, triggerMidnightReset } =
    useUser();

  const [mode, setMode] = useState<ConnectionMode>('ble');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<BleDiscoveredDevice[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBleDataRef = useRef<SensorData | null>(null);

  // 用 ref 保存最新的指令處理函式，避免重複建立連線
  const actionsRef = useRef({
    injectMockHistory,
    recordBehaviorTrigger,
    triggerMidnightReset,
  });

  useEffect(() => {
    actionsRef.current = {
      injectMockHistory,
      recordBehaviorTrigger,
      triggerMidnightReset,
    };
  }, [injectMockHistory, recordBehaviorTrigger, triggerMidnightReset]);

  // ==========================================
  // 1. 100ms 高頻資料節流機制 (Throttle)
  // ==========================================
  const scheduleThrottledUpdate = useCallback((newData: SensorData) => {
    latestBleDataRef.current = newData;

    if (!throttleTimerRef.current) {
      throttleTimerRef.current = setTimeout(() => {
        if (latestBleDataRef.current) {
          setSensorData(latestBleDataRef.current);
          setLastMessageAt(new Date().toISOString());
        }
        throttleTimerRef.current = null;
      }, 90); // ~11 FPS 順暢更新，避免 React Native JS Thread 過載
    }
  }, []);

  // ==========================================
  // 2. BLE 藍牙控制邏輯
  // ==========================================
  const handleBleData = useCallback((data: BleHoldYourHandData) => {
    const unifiedData: SensorData = {
      connected: true,
      distance: data.distance,
      angularVelocity: data.angularVelocity,
      heartRate: data.heartRate,
      spo2: data.spo2,
      motorStatus: data.motorStatus,
      isOutOfRange: data.isOutOfRange,
      timestamp: data.timestamp,
    };

    scheduleThrottledUpdate(unifiedData);
  }, [scheduleThrottledUpdate]);

  const startScan = useCallback(async () => {
    if (mode !== 'ble') return;
    setStatus('scanning');
    setDiscoveredDevices([]);

    try {
      await bleService.startScan(
        (device) => {
          setDiscoveredDevices((prev) => {
            const exists = prev.some((d) => d.id === device.id);
            if (exists) {
              return prev.map((d) => (d.id === device.id ? device : d));
            }
            return [...prev, device];
          });
        },
        (error) => {
          console.warn('[SensorContext] 藍牙掃描錯誤:', error);
          setStatus('error');
        }
      );
    } catch (e) {
      console.error('[SensorContext] 啟動掃描失敗:', e);
      setStatus('error');
    }
  }, [mode]);

  const stopScan = useCallback(() => {
    bleService.stopScan();
    if (status === 'scanning') {
      setStatus('disconnected');
    }
  }, [status]);

  const connectDevice = useCallback(async (deviceId: string) => {
    setStatus('connecting');
    try {
      const device = await bleService.connectDevice(
        deviceId,
        handleBleData,
        () => {
          // 意外斷線回呼
          setStatus('disconnected');
          setConnectedDeviceName(null);
          setSensorData(null);
        }
      );

      setStatus('connected');
      setConnectedDeviceName(device.name || BLE_CONFIG.TARGET_DEVICE_NAME);
    } catch (err) {
      console.error('[SensorContext] BLE 連線失敗:', err);
      setStatus('error');
    }
  }, [handleBleData]);

  const disconnectDevice = useCallback(async () => {
    if (mode === 'ble') {
      await bleService.disconnectDevice();
      setStatus('disconnected');
      setConnectedDeviceName(null);
      setSensorData(null);
    } else if (socketRef.current) {
      socketRef.current.close();
      setStatus('disconnected');
      setSensorData(null);
    }
  }, [mode]);

  // ==========================================
  // 3. WebSocket 模擬器連線邏輯 (Fallback)
  // ==========================================
  useEffect(() => {
    if (mode !== 'simulator') {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    let isActive = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connectWs() {
      if (!isActive) return;

      const currentSocket = socketRef.current;
      if (
        currentSocket &&
        (currentSocket.readyState === WebSocket.OPEN ||
          currentSocket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setStatus('connecting');
      const socket = new WebSocket(SOCKET_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isActive) return;
        console.log('[SensorContext] WebSocket 模擬器已連線');
        setStatus('connected');
        setConnectedDeviceName('WebSocket 模擬器');
      };

      socket.onmessage = (event) => {
        if (!isActive) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'sensor-data') {
            const raw = message as any;
            const distVal = typeof raw.distance === 'number' ? raw.distance : 180;
            const isOut = raw.isOutOfRange ?? (distVal >= 9999);
            const unified: SensorData = {
              connected: Boolean(raw.connected),
              distance: distVal,
              angularVelocity: typeof raw.angularVelocity === 'number' ? raw.angularVelocity : 0,
              heartRate: typeof raw.heartRate === 'number' ? raw.heartRate : 72,
              spo2: typeof raw.spo2 === 'number' ? raw.spo2 : 98,
              motorStatus: Boolean(raw.motorStatus),
              isOutOfRange: isOut,
              timestamp: Date.now(),
            };
            scheduleThrottledUpdate(unified);
          } else if (message.type === 'dev-inject-data') {
            const days = typeof message.days === 'number' && message.days > 0 ? message.days : 60;
            actionsRef.current.injectMockHistory(days);
          } else if (message.type === 'dev-trigger-pick') {
            actionsRef.current.recordBehaviorTrigger();
          } else if (message.type === 'dev-trigger-midnight') {
            actionsRef.current.triggerMidnightReset();
          }
        } catch (error) {
          console.error('[SensorContext] 無法解析 WebSocket 資料：', error);
        }
      };

      socket.onerror = (error) => {
        if (!isActive) return;
        console.error('[SensorContext] WebSocket 錯誤：', error);
        setStatus('error');
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (!isActive) return;
        setStatus('disconnected');
        reconnectTimer = setTimeout(() => connectWs(), 2000);
      };
    }

    connectWs();

    return () => {
      isActive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socketRef.current) socketRef.current.close();
    };
  }, [mode, scheduleThrottledUpdate]);

  // 元件卸載時清理
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
      bleService.disconnectDevice();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      status,
      mode,
      setMode,
      sensorData,
      lastMessageAt,
      connectedDeviceName,
      discoveredDevices,
      startScan,
      stopScan,
      connectDevice,
      disconnectDevice,
    }),
    [
      status,
      mode,
      sensorData,
      lastMessageAt,
      connectedDeviceName,
      discoveredDevices,
      startScan,
      stopScan,
      connectDevice,
      disconnectDevice,
    ]
  );

  return (
    <SensorContext.Provider value={contextValue}>
      {children}
    </SensorContext.Provider>
  );
}

export function useSensor() {
  const context = useContext(SensorContext);
  if (!context) {
    throw new Error('useSensor 必須在 SensorProvider 裡使用');
  }
  return context;
}

export default SensorProvider;