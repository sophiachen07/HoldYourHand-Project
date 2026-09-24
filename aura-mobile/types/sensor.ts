export type ConnectionStatus =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export type SocketStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type ConnectionMode = 'ble' | 'simulator';

export interface BleHoldYourHandData {
  /** 距離 (mm)，當 >= 9999 時代表超出範圍或未感應到障礙物 */
  distance: number;
  /** 空間角速度向量模長 sqrt(gx^2+gy^2+gz^2) (deg/s) */
  angularVelocity: number;
  /** 心率 (BPM) */
  heartRate: number;
  /** 血氧濃度 (%) */
  spo2: number;
  /** 震動馬達狀態 (true: 震動中, false: 待機/冷卻) */
  motorStatus: boolean;
  /** 是否超出測距範圍 (dist >= 9999) */
  isOutOfRange: boolean;
  /** 時間戳記 (毫秒) */
  timestamp: number;
}

export interface BleDiscoveredDevice {
  id: string;
  name: string;
  rssi: number | null;
}

export interface SensorData {
  connected: boolean;
  deviceId?: string;
  /** 距離 (mm) */
  distance: number;
  /** 空間角速度 (deg/s) */
  angularVelocity: number;
  /** 心率 (BPM) */
  heartRate: number;
  /** 血氧濃度 (%) */
  spo2: number;
  /** 馬達觸覺震動狀態 */
  motorStatus: boolean;
  /** 距離是否超出範圍 (>= 9999) */
  isOutOfRange: boolean;
  timestamp: number;
}
