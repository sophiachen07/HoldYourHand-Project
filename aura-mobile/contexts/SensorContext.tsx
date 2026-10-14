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
import { AppState, type AppStateStatus } from 'react-native';

import type {
  BleDiscoveredDevice,
  BleHoldYourHandData,
  ConnectionMode,
  ConnectionStatus,
  SensorData,
} from '../types/sensor';
import { bleService, BLE_CONFIG } from '../services/bleService';
import {
  clearPairedDevice,
  getPairedDevice,
  savePairedDevice,
  updateLastConnectedAt,
  type PairedDeviceInfo,
} from '../services/pairedDeviceStorage';
import { userApi, type SensorReadingPayload } from '../services/userApi';
import { useUser } from './UserContext';
import { getWebSocketUrl } from '../constants/apiConfig';

// 感測數據寫入資料庫：每秒最多取樣一筆，每 5 秒批次上傳
const SENSOR_SAMPLE_INTERVAL_MS = 1000;
const SENSOR_UPLOAD_INTERVAL_MS = 5000;
const SENSOR_BUFFER_LIMIT = 500;

// 情境三：暫時離開 10m 的指數退避重連序列 (3s -> 6s -> 15s -> 30s)
const RECONNECT_BACKOFF_MS = [3000, 6000, 15000, 30000];

type SensorContextValue = {
  status: ConnectionStatus;
  mode: ConnectionMode;
  setMode: (mode: ConnectionMode) => void;
  sensorData: SensorData | null;
  lastMessageAt: string | null;
  connectedDeviceName: string | null;
  discoveredDevices: BleDiscoveredDevice[];
  pairedDevice: PairedDeviceInfo | null;
  pairDevice: (device: { id: string; name?: string | null }) => Promise<void>;
  unpairDevice: () => Promise<void>;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: () => Promise<void>;
};

const SensorContext = createContext<SensorContextValue | null>(null);

export function SensorProvider({ children }: PropsWithChildren) {
  const { injectMockHistory, recordBehaviorTrigger, triggerMidnightReset, account } =
    useUser();

  const [mode, setMode] = useState<ConnectionMode>('ble');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<BleDiscoveredDevice[]>([]);
  const [pairedDevice, setPairedDevice] = useState<PairedDeviceInfo | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBleDataRef = useRef<SensorData | null>(null);
  const sensorBufferRef = useRef<SensorReadingPayload[]>([]);
  const lastSampleAtRef = useRef<number>(0);
  const modeRef = useRef<ConnectionMode>('ble');
  const pairedDeviceRef = useRef<PairedDeviceInfo | null>(null);
  const manualDisconnectRef = useRef<boolean>(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef<number>(0);

  useEffect(() => {
    modeRef.current = mode;
    // 切換到模擬器時，清除任何 BLE 重試定時器，避免干擾
    if (mode === 'simulator') {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      retryAttemptRef.current = 0;
    }
  }, [mode]);

  useEffect(() => {
    pairedDeviceRef.current = pairedDevice;
  }, [pairedDevice]);

  // 啟動時讀取本機持久化的裝置綁定記錄
  useEffect(() => {
    let isMounted = true;
    getPairedDevice().then((saved) => {
      if (isMounted && saved) {
        setPairedDevice(saved);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

    // 取樣進資料庫上傳暫存區
    const now = Date.now();
    if (now - lastSampleAtRef.current >= SENSOR_SAMPLE_INTERVAL_MS) {
      lastSampleAtRef.current = now;
      const buffer = sensorBufferRef.current;
      buffer.push({
        timestamp: newData.timestamp || now,
        distance: newData.distance,
        angularVelocity: newData.angularVelocity,
        heartRate: newData.heartRate,
        spo2: newData.spo2,
        motorStatus: newData.motorStatus,
        isOutOfRange: newData.isOutOfRange,
        source: modeRef.current,
      });
      if (buffer.length > SENSOR_BUFFER_LIMIT) {
        buffer.splice(0, buffer.length - SENSOR_BUFFER_LIMIT);
      }
    }

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
  const handleBleData = useCallback(
    (data: BleHoldYourHandData) => {
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
    },
    [scheduleThrottledUpdate]
  );

  // 清除重連定時器
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // 定向靜默連線 (Direct Connect)
  const connectDirectSilently = useCallback(
    async (deviceId: string, deviceName?: string) => {
      if (modeRef.current !== 'ble') return;

      // 如果已經在連線中且實體未斷，不重複連線
      const alreadyConnected = await bleService.isDeviceConnected(deviceId);
      if (alreadyConnected) {
        setStatus('connected');
        setConnectedDeviceName(deviceName || BLE_CONFIG.TARGET_DEVICE_NAME);
        retryAttemptRef.current = 0;
        return;
      }

      setStatus('connecting');
      try {
        const dev = await bleService.connectDirect(
          deviceId,
          handleBleData,
          () => {
            // 意外斷線回呼
            handleUnexpectedBleDisconnect();
          },
          6000
        );

        setStatus('connected');
        setConnectedDeviceName(dev.name || deviceName || BLE_CONFIG.TARGET_DEVICE_NAME);
        retryAttemptRef.current = 0;
        clearReconnectTimer();
        updateLastConnectedAt();
        console.log(`[SensorContext] 定向靜默連線成功: ${dev.name || deviceId}`);
      } catch (err: any) {
        console.warn(`[SensorContext] 定向連線嘗試未果 (${err?.message})，準備下次排程`);
        handleUnexpectedBleDisconnect();
      }
    },
    [handleBleData, clearReconnectTimer]
  );

  // 處理意外中斷（情境三：暫時離開 10m）
  const handleUnexpectedBleDisconnect = useCallback(() => {
    if (manualDisconnectRef.current) {
      // 使用者主動中斷，不進行自動重連
      setStatus('disconnected');
      setConnectedDeviceName(null);
      setSensorData(null);
      return;
    }

    if (modeRef.current !== 'ble') {
      setStatus('disconnected');
      setConnectedDeviceName(null);
      setSensorData(null);
      return;
    }

    const target = pairedDeviceRef.current;
    if (!target) {
      setStatus('disconnected');
      setConnectedDeviceName(null);
      setSensorData(null);
      return;
    }

    // 進入無感等待重連狀態（UI 呈琥珀色，不跳 Alert 阻斷）
    setStatus('reconnecting');
    setSensorData(null);

    // 指數退避排程重連
    clearReconnectTimer();
    const attempt = retryAttemptRef.current;
    const delay = RECONNECT_BACKOFF_MS[Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)];
    retryAttemptRef.current += 1;

    console.log(
      `[SensorContext] 裝置暫時離線，將於 ${delay / 1000} 秒後發起第 ${attempt + 1} 次背景回網嘗試...`
    );

    reconnectTimerRef.current = setTimeout(() => {
      if (modeRef.current === 'ble' && pairedDeviceRef.current && !manualDisconnectRef.current) {
        connectDirectSilently(pairedDeviceRef.current.id, pairedDeviceRef.current.name);
      }
    }, delay);
  }, [clearReconnectTimer, connectDirectSilently]);

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

  const connectDevice = useCallback(
    async (deviceId: string) => {
      manualDisconnectRef.current = false;
      clearReconnectTimer();
      retryAttemptRef.current = 0;
      setStatus('connecting');
      try {
        const device = await bleService.connectDevice(
          deviceId,
          handleBleData,
          () => {
            handleUnexpectedBleDisconnect();
          }
        );

        setStatus('connected');
        setConnectedDeviceName(device.name || BLE_CONFIG.TARGET_DEVICE_NAME);
        updateLastConnectedAt();
      } catch (err) {
        console.error('[SensorContext] BLE 連線失敗:', err);
        setStatus('error');
      }
    },
    [handleBleData, handleUnexpectedBleDisconnect, clearReconnectTimer]
  );

  // 綁定裝置（情境一：一鍵配對）
  const pairDevice = useCallback(
    async (device: { id: string; name?: string | null }) => {
      const saved = await savePairedDevice(device);
      setPairedDevice(saved);
      await connectDevice(saved.id);
    },
    [connectDevice]
  );

  // 解除綁定（忘記裝置）
  const unpairDevice = useCallback(async () => {
    manualDisconnectRef.current = true;
    clearReconnectTimer();
    await bleService.disconnectDevice();
    await clearPairedDevice();
    setPairedDevice(null);
    setStatus('disconnected');
    setConnectedDeviceName(null);
    setSensorData(null);
  }, [clearReconnectTimer]);

  const disconnectDevice = useCallback(async () => {
    manualDisconnectRef.current = true;
    clearReconnectTimer();
    retryAttemptRef.current = 0;

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
  }, [mode, clearReconnectTimer]);

  // ==========================================
  // 情境二：日常使用 (Apple Watch 靜默體驗)
  // App 冷啟動或從背景切換回前景時，發起定向連線
  // ==========================================
  useEffect(() => {
    let isSubscribed = true;

    async function handleAppState(nextAppState: AppStateStatus) {
      if (nextAppState === 'active' && modeRef.current === 'ble') {
        const target = pairedDeviceRef.current;
        if (!target) return;

        // Case A: 裝置原本就連著（剛跳出去回訊息再回來）
        const isConn = await bleService.isDeviceConnected(target.id);
        if (isConn) {
          // 100% 靜默！不跳任何視窗，直接使用
          if (status !== 'connected') {
            setStatus('connected');
            setConnectedDeviceName(target.name);
          }
          return;
        }

        // Case B: 裝置剛開機 / 重新開啟 App，發起定向秒連
        if (!manualDisconnectRef.current) {
          console.log('[SensorContext] App 回到前景，定向連線已綁定裝置:', target.name);
          connectDirectSilently(target.id, target.name);
        }
      }
    }

    const appStateSub = AppState.addEventListener('change', handleAppState);

    // 冷啟動首次嘗試連線
    if (pairedDevice && mode === 'ble' && status === 'disconnected' && !manualDisconnectRef.current) {
      connectDirectSilently(pairedDevice.id, pairedDevice.name);
    }

    return () => {
      isSubscribed = false;
      appStateSub.remove();
    };
  }, [pairedDevice, mode, connectDirectSilently, status]);

  // ==========================================
  // 3. WebSocket 模擬器連線邏輯 (Fallback / 開發模式)
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
      const socket = new WebSocket(getWebSocketUrl());
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

  // ==========================================
  // 4. 定時把感測數據批次寫入 MySQL
  // ==========================================
  useEffect(() => {
    if (!account) {
      sensorBufferRef.current = [];
      return;
    }

    let isUploading = false;
    const timer = setInterval(async () => {
      if (isUploading || sensorBufferRef.current.length === 0) return;
      const batch = sensorBufferRef.current;
      sensorBufferRef.current = [];
      isUploading = true;
      try {
        await userApi.uploadSensorReadings(account.userId, batch);
      } catch (err: any) {
        // 上傳失敗：放回暫存區，下次再試
        sensorBufferRef.current = [...batch, ...sensorBufferRef.current].slice(
          -SENSOR_BUFFER_LIMIT
        );
        console.warn('[SensorContext] 感測數據上傳失敗:', err?.message);
      } finally {
        isUploading = false;
      }
    }, SENSOR_UPLOAD_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [account]);

  // 元件卸載時清理
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
      bleService.disconnectDevice();
    };
  }, [clearReconnectTimer]);

  const contextValue = useMemo(
    () => ({
      status,
      mode,
      setMode,
      sensorData,
      lastMessageAt,
      connectedDeviceName,
      discoveredDevices,
      pairedDevice,
      pairDevice,
      unpairDevice,
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
      pairedDevice,
      pairDevice,
      unpairDevice,
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