import { BleManager, Device, Characteristic, Subscription } from 'react-native-ble-plx';
import { decode as atob } from 'base-64';
import { Platform, PermissionsAndroid } from 'react-native';
import { BleDiscoveredDevice, BleHoldYourHandData } from '../types/sensor';

export const BLE_CONFIG = {
  TARGET_DEVICE_NAME: 'HoldYourHand_Device',
  SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  CHARACTERISTIC_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
};

class BleService {
  private manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private monitorSubscription: Subscription | null = null;
  private isScanning: boolean = false;

  private getManager(): BleManager | null {
    if (!this.manager) {
      try {
        this.manager = new BleManager();
      } catch (err) {
        console.warn('[BLE Service] 目前環境不支援原生藍牙 (例如 Expo Go):', err);
        return null;
      }
    }
    return this.manager;
  }

  /**
   * 跨平台藍牙與定位權限申請
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          return (
            granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
              PermissionsAndroid.RESULTS.GRANTED &&
            granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
              PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Hold your hand 藍牙權限需求',
              message: 'App 需要定位權限以搜尋並連接手環 BLE 裝置',
              buttonNeutral: '稍後再說',
              buttonNegative: '取消',
              buttonPositive: '確定',
            }
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      } catch (err) {
        console.warn('[BLE Service] 申請權限失敗:', err);
        return false;
      }
    }
    // iOS 會由系統依據 app.json 的 infoPlist 自動彈出權限請求
    return true;
  }

  /**
   * 解析 ESP32 發送的 Base64 CSV 封包
   * 格式: 距離,角速度,心率,血氧,馬達狀態 (例如: "45,32.4,84.2,98,1")
   */
  parsePacket(base64String: string): BleHoldYourHandData | null {
    try {
      const rawString = atob(base64String).trim();
      if (!rawString) return null;

      const parts = rawString.split(',');
      if (parts.length < 5) {
        console.warn('[BLE Service] 封包欄位不足:', rawString);
        return null;
      }

      const dist = parseInt(parts[0], 10);
      const gyro = parseFloat(parts[1]);
      const hr = parseFloat(parts[2]);
      const spo2 = parseInt(parts[3], 10);
      const motor = parts[4].trim() === '1';

      const validDist = Number.isNaN(dist) ? 9999 : dist;

      return {
        distance: validDist,
        angularVelocity: Number.isNaN(gyro) ? 0 : gyro,
        heartRate: Number.isNaN(hr) ? 0 : hr,
        spo2: Number.isNaN(spo2) ? 0 : spo2,
        motorStatus: motor,
        isOutOfRange: validDist >= 9999,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[BLE Service] 資料解析異常:', error);
      return null;
    }
  }

  /**
   * 開始搜尋附近的 BLE 裝置
   */
  async startScan(
    onDeviceFound: (device: BleDiscoveredDevice) => void,
    onError: (error: any) => void
  ): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      onError(new Error('未取得藍牙掃描權限'));
      return;
    }

    const manager = this.getManager();
    if (!manager) {
      onError(new Error('當前環境（例如 Expo Go）不支援原生藍牙，請切換至「模擬器模式」測試'));
      return;
    }

    if (this.isScanning) {
      manager.stopDeviceScan();
    }

    this.isScanning = true;

    manager.startDeviceScan(
      null, // 掃描所有服務或指定 [BLE_CONFIG.SERVICE_UUID]
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          this.isScanning = false;
          onError(error);
          return;
        }

        if (device && device.name) {
          onDeviceFound({
            id: device.id,
            name: device.name,
            rssi: device.rssi,
          });
        }
      }
    );
  }

  /**
   * 停止掃描
   */
  stopScan(): void {
    if (this.manager && this.isScanning) {
      this.manager.stopDeviceScan();
      this.isScanning = false;
    }
  }

  /**
   * 連接至指定的 BLE 裝置並監聽特徵值推播
   */
  async connectDevice(
    deviceId: string,
    onData: (data: BleHoldYourHandData) => void,
    onDisconnect: () => void
  ): Promise<Device> {
    this.stopScan();
    const manager = this.getManager();
    if (!manager) {
      throw new Error('當前環境（例如 Expo Go）不支援原生藍牙');
    }

    // 先中斷既有連線
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch {
        // 忽略已斷線錯誤
      }
      this.connectedDevice = null;
    }

    // 連接裝置
    const device = await manager.connectToDevice(deviceId, {
      autoConnect: false,
    });
    this.connectedDevice = device;

    // 探索所有 Services 與 Characteristics
    await device.discoverAllServicesAndCharacteristics();

    // 監聽意外斷線
    device.onDisconnected((error, disconnectedDevice) => {
      console.log('[BLE Service] 裝置已中斷連線:', disconnectedDevice.name || disconnectedDevice.id);
      this.cleanupSubscription();
      this.connectedDevice = null;
      onDisconnect();
    });

    // 訂閱 ESP32 的 Characteristic Notify
    this.monitorSubscription = device.monitorCharacteristicForService(
      BLE_CONFIG.SERVICE_UUID,
      BLE_CONFIG.CHARACTERISTIC_UUID,
      (error, characteristic: Characteristic | null) => {
        if (error) {
          console.error('[BLE Service] Notify 接收錯誤:', error);
          return;
        }

        if (characteristic?.value) {
          const parsed = this.parsePacket(characteristic.value);
          if (parsed) {
            onData(parsed);
          }
        }
      }
    );

    return device;
  }

  /**
   * 斷開連線
   */
  async disconnectDevice(): Promise<void> {
    this.cleanupSubscription();
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
      } catch (err) {
        console.warn('[BLE Service] 斷線時發生錯誤:', err);
      } finally {
        this.connectedDevice = null;
      }
    }
  }

  private cleanupSubscription(): void {
    if (this.monitorSubscription) {
      this.monitorSubscription.remove();
      this.monitorSubscription = null;
    }
  }

  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }
}

export const bleService = new BleService();
