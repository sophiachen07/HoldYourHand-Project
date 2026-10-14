// ==========================================
// 已配對 BLE 裝置持久化存儲模組
// ==========================================
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PAIRED_DEVICE = '@aura_paired_ble_device_v1';

export type PairedDeviceInfo = {
  id: string; // BLE 裝置 ID (Android MAC 位址或 iOS UUID)
  name: string; // 裝置名稱 (預設 HoldYourHand_Device)
  pairedAt: number; // 首次配對時戳
  lastConnectedAt?: number; // 最近一次成功連線時戳
};

/** 讀取本機已綁定的裝置資訊 */
export async function getPairedDevice(): Promise<PairedDeviceInfo | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_PAIRED_DEVICE);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.id === 'string' && parsed.id.trim()) {
      return parsed as PairedDeviceInfo;
    }
  } catch (err) {
    console.warn('[PairedDeviceStorage] 讀取已綁定裝置失敗:', err);
  }
  return null;
}

/** 永久儲存已綁定的裝置資訊 */
export async function savePairedDevice(device: { id: string; name?: string | null }): Promise<PairedDeviceInfo> {
  const pairedInfo: PairedDeviceInfo = {
    id: device.id,
    name: device.name || 'HoldYourHand_Device',
    pairedAt: Date.now(),
    lastConnectedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY_PAIRED_DEVICE, JSON.stringify(pairedInfo));
    console.log(`[PairedDeviceStorage] 已成功綁定專屬裝置: ${pairedInfo.name} (${pairedInfo.id})`);
  } catch (err) {
    console.error('[PairedDeviceStorage] 儲存已綁定裝置失敗:', err);
  }

  return pairedInfo;
}

/** 更新最近一次連線時戳 */
export async function updateLastConnectedAt(): Promise<void> {
  try {
    const existing = await getPairedDevice();
    if (existing) {
      existing.lastConnectedAt = Date.now();
      await AsyncStorage.setItem(STORAGE_KEY_PAIRED_DEVICE, JSON.stringify(existing));
    }
  } catch (err) {
    console.warn('[PairedDeviceStorage] 更新連線時戳失敗:', err);
  }
}

/** 解除綁定（忘記此裝置） */
export async function clearPairedDevice(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_PAIRED_DEVICE);
    console.log('[PairedDeviceStorage] 已解除綁定裝置');
  } catch (err) {
    console.error('[PairedDeviceStorage] 解除綁定裝置失敗:', err);
  }
}
