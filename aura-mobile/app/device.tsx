import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Activity,
  AlertCircle,
  Bluetooth,
  CheckCircle2,
  ChevronRight,
  Compass,
  Droplet,
  Heart,
  Radio,
  RefreshCw,
  Ruler,
  Server,
  Sparkles,
  Trash2,
  Watch,
  Zap,
} from 'lucide-react-native';

import { useSensor } from '../contexts/SensorContext';
import { useUser } from '../contexts/UserContext';
import { AuraColors } from '../constants/auraTheme';
import { BLE_CONFIG } from '../services/bleService';

export default function DeviceScreen() {
  const {
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
  } = useSensor();

  const { logout } = useUser();
  const [fastPairSuccess, setFastPairSuccess] = useState(false);
  const [isPairingAction, setIsPairingAction] = useState(false);

  const isConnected = status === 'connected' && sensorData?.connected === true;
  const isScanning = status === 'scanning';
  const isConnecting = status === 'connecting' || isPairingAction;
  const isReconnecting = status === 'reconnecting';

  // 搜尋到的 Fast Pair 候選裝置（優先尋找目標裝置或訊號強的裝置）
  const fastPairCandidate = useMemo(() => {
    if (isConnected || pairedDevice) return null;
    const target = discoveredDevices.find(
      (d) => d.name === BLE_CONFIG.TARGET_DEVICE_NAME || d.name?.includes('HoldYourHand')
    );
    if (target) return target;
    // 若沒有精確名稱，但有強訊號裝置 (>= -70 dBm)
    return discoveredDevices.find((d) => d.rssi !== null && d.rssi >= -70) || null;
  }, [discoveredDevices, isConnected, pairedDevice]);

  // 進入頁面時若尚未連線且為 BLE 模式，自動開啟掃描以觸發 Fast Pair
  useEffect(() => {
    if (mode === 'ble' && !isConnected && !pairedDevice && status === 'disconnected') {
      startScan();
    }
  }, [mode, isConnected, pairedDevice, status, startScan]);

  // 一鍵 Fast Pair 配對處理
  async function handleFastPair(deviceId: string, deviceName?: string) {
    setIsPairingAction(true);
    try {
      await pairDevice({ id: deviceId, name: deviceName || BLE_CONFIG.TARGET_DEVICE_NAME });
      setFastPairSuccess(true);
      // 配對成功後顯示 1.5 秒打勾卡片，隨後自動進入儀表板
      setTimeout(() => {
        router.replace('/dashboard');
      }, 1500);
    } catch (err: any) {
      Alert.alert('配對失敗', err?.message || '請確認裝置已開機並靠近手機');
    } finally {
      setIsPairingAction(false);
    }
  }

  // 解除綁定裝置確認
  function handleUnpair() {
    const doUnpair = async () => {
      await unpairDevice();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('確定要解除裝置綁定嗎？解除後將不再自動秒連。')) {
        doUnpair();
      }
      return;
    }

    Alert.alert('解除裝置綁定', '確定要忘記此專屬裝置嗎？解除後 App 將不再自動於背景秒連。', [
      { text: '取消', style: 'cancel' },
      { text: '忘記裝置', style: 'destructive', onPress: doUnpair },
    ]);
  }

  // 返回鍵
  function handleBackPress() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    const doLogout = async () => {
      await logout();
      router.replace('/(tabs)');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('確定要登出並返回登入頁嗎？')) doLogout();
      return;
    }

    Alert.alert('確認登出', '確定要登出並返回登入頁嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '登出', style: 'destructive', onPress: doLogout },
    ]);
  }

  function getStatusBadge() {
    if (isConnected) {
      return {
        text: `${connectedDeviceName || pairedDevice?.name || 'Hold your hand'} 已連線`,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.12)',
        border: 'rgba(16,185,129,0.25)',
      };
    }
    if (isReconnecting) {
      return {
        text: '裝置暫時離開，自動回網中...',
        color: '#d97706',
        bg: 'rgba(217,119,6,0.12)',
        border: 'rgba(217,119,6,0.25)',
      };
    }
    if (isScanning) {
      return {
        text: '正在搜尋附近的 BLE 穿戴裝置...',
        color: '#0284c7',
        bg: 'rgba(14,165,233,0.12)',
        border: 'rgba(14,165,233,0.25)',
      };
    }
    if (isConnecting) {
      return {
        text: '正在建立藍牙連線與訂閱...',
        color: '#d97706',
        bg: 'rgba(217,119,6,0.12)',
        border: 'rgba(217,119,6,0.25)',
      };
    }
    if (status === 'error') {
      return {
        text: '連線發生錯誤，請重試',
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.12)',
        border: 'rgba(220,38,38,0.25)',
      };
    }
    return {
      text: mode === 'ble' ? (pairedDevice ? '專屬裝置待機中' : '尚未配對裝置') : '模擬器未連線',
      color: '#64748b',
      bg: 'rgba(100,116,139,0.1)',
      border: 'rgba(100,116,139,0.2)',
    };
  }

  const badge = getStatusBadge();

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#EDE5F8', '#DEEEF8', '#E5F4EE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 頂部導航 */}
        <View style={styles.navigation}>
          <Pressable style={styles.backButton} onPress={handleBackPress}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>

          <Text style={styles.navigationTitle}>裝置連線管理</Text>
        </View>

        {/* 模式切換器 (BLE 真機 / 模擬器) */}
        <View style={styles.modeToggleContainer}>
          <Pressable
            style={[styles.modeTab, mode === 'ble' && styles.modeTabActive]}
            onPress={() => {
              if (mode !== 'ble') {
                disconnectDevice();
                setMode('ble');
              }
            }}
          >
            <Bluetooth
              size={15}
              color={mode === 'ble' ? '#1A2151' : '#64748B'}
            />
            <Text
              style={[
                styles.modeTabText,
                mode === 'ble' && styles.modeTabTextActive,
              ]}
            >
              BLE 藍牙真機
            </Text>
          </Pressable>

          <Pressable
            style={[styles.modeTab, mode === 'simulator' && styles.modeTabActive]}
            onPress={() => {
              if (mode !== 'simulator') {
                disconnectDevice();
                setMode('simulator');
              }
            }}
          >
            <Server
              size={15}
              color={mode === 'simulator' ? '#1A2151' : '#64748B'}
            />
            <Text
              style={[
                styles.modeTabText,
                mode === 'simulator' && styles.modeTabTextActive,
              ]}
            >
              WebSocket 模擬器
            </Text>
          </Pressable>
        </View>

        {/* 標題區 */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {mode === 'ble' ? 'HoldYourHand 智能裝置' : '開發測試模擬器'}
          </Text>
          <Text style={styles.description}>
            {mode === 'ble'
              ? '靠近手機即時配對，後續日常使用 100% 靜默無感定向秒連。'
              : '透過區域網路接收電腦端 dev-tools 模擬器發送之感測數據。'}
          </Text>
        </View>

        {/* 視覺動態雷達圈 */}
        <View style={styles.radarContainer}>
          <View style={styles.outerCircle}>
            <View style={styles.middleCircle}>
              <LinearGradient
                colors={
                  isConnected
                    ? ['#06b6d4', '#10b981']
                    : isReconnecting
                    ? ['#f59e0b', '#d97706']
                    : isScanning
                    ? ['#9B8AC1', '#38bdf8']
                    : ['#2A476E', '#1B3252']
                }
                style={styles.deviceCircle}
              >
                {mode === 'ble' ? (
                  <Bluetooth
                    size={36}
                    color={isConnected || isScanning || isReconnecting ? '#ffffff' : '#67b2f5'}
                  />
                ) : (
                  <Radio
                    size={36}
                    color={isConnected || isScanning ? '#ffffff' : '#67b2f5'}
                  />
                )}
              </LinearGradient>
            </View>
          </View>

          {/* 連線狀態徽章 */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: badge.bg,
                borderColor: badge.border,
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
            <Text style={[styles.statusText, { color: badge.color }]}>
              {badge.text}
            </Text>
          </View>
        </View>

        {/* ==================================================== */}
        {/* 情境一：Google Fast Pair 風格半卡片 (靠近裝置彈出) */}
        {/* ==================================================== */}
        {mode === 'ble' && fastPairCandidate && !isConnected && (
          <View style={styles.fastPairCard}>
            <LinearGradient
              colors={['#FFFFFF', '#F0F9FF']}
              style={styles.fastPairGradient}
            >
              <View style={styles.fastPairHeader}>
                <View style={styles.fastPairIconWrapper}>
                  <Sparkles size={20} color="#0284c7" />
                </View>
                <View style={styles.fastPairTitleBox}>
                  <Text style={styles.fastPairTitle}>✨ 發現附近的裝置</Text>
                  <Text style={styles.fastPairSubtitle}>
                    {fastPairCandidate.name || 'HoldYourHand_Device'}
                    {fastPairCandidate.rssi ? ` · 訊號極佳 (${fastPairCandidate.rssi} dBm)` : ''}
                  </Text>
                </View>
              </View>

              <Text style={styles.fastPairDesc}>
                偵測到裝置靠近，點擊按鈕即可一鍵綁定。之後每次開啟 App 皆能無感自動連線！
              </Text>

              {fastPairSuccess ? (
                <View style={styles.fastPairSuccessBox}>
                  <CheckCircle2 size={20} color="#10b981" />
                  <Text style={styles.fastPairSuccessText}>
                    配對成功！正在為您進入儀表板...
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={styles.fastPairButton}
                  disabled={isConnecting}
                  onPress={() => handleFastPair(fastPairCandidate.id, fastPairCandidate.name)}
                >
                  <LinearGradient
                    colors={['#0284c7', '#0ea5e9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.fastPairButtonGradient}
                  >
                    {isConnecting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Bluetooth size={16} color="#FFFFFF" />
                        <Text style={styles.fastPairButtonText}>一鍵配對並連線</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              )}
            </LinearGradient>
          </View>
        )}

        {/* ==================================================== */}
        {/* 情境二：專屬配對裝置卡片 (Apple Watch 靜默管理體驗) */}
        {/* ==================================================== */}
        {mode === 'ble' && pairedDevice && (
          <View style={styles.pairedDeviceCard}>
            <View style={styles.pairedCardHeader}>
              <View style={styles.pairedDeviceTitleGroup}>
                <Watch size={20} color="#0284c7" />
                <View>
                  <Text style={styles.pairedDeviceTitle}>我的專屬裝置</Text>
                  <Text style={styles.pairedDeviceSubtitle}>
                    {pairedDevice.name} ({pairedDevice.id.slice(0, 14)}...)
                  </Text>
                </View>
              </View>

              <Pressable style={styles.unpairBtn} onPress={handleUnpair}>
                <Trash2 size={15} color="#ef4444" />
                <Text style={styles.unpairBtnText}>忘記裝置</Text>
              </Pressable>
            </View>

            <View style={styles.pairedCardStatusRow}>
              <View style={styles.pairedStatusIndicator}>
                <View
                  style={[
                    styles.pairedStatusDot,
                    {
                      backgroundColor: isConnected
                        ? '#10b981'
                        : isReconnecting
                        ? '#f59e0b'
                        : '#94a3b8',
                    },
                  ]}
                />
                <Text style={styles.pairedStatusLabel}>
                  {isConnected
                    ? '已連線・即時監測中'
                    : isReconnecting
                    ? '暫時離線・自動回網中'
                    : '待機・開啟裝置即可無感秒連'}
                </Text>
              </View>

              {!isConnected && !isConnecting && (
                <Pressable
                  style={styles.quickConnectBtn}
                  onPress={() => connectDevice(pairedDevice.id)}
                >
                  <Text style={styles.quickConnectBtnText}>立即連線</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ==================================================== */}
        {/* BLE 掃描與裝置清單區 (尚未配對時手動搜尋) */}
        {/* ==================================================== */}
        {mode === 'ble' && !isConnected && !pairedDevice && !fastPairCandidate && (
          <View style={styles.scanSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>搜尋附近的裝置</Text>
              {isScanning ? (
                <Pressable style={styles.scanButtonSmall} onPress={stopScan}>
                  <ActivityIndicator size="small" color="#9B8AC1" />
                  <Text style={styles.scanButtonSmallText}>停止搜尋</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.scanButtonSmall} onPress={startScan}>
                  <RefreshCw size={13} color="#9B8AC1" />
                  <Text style={styles.scanButtonSmallText}>重新搜尋</Text>
                </Pressable>
              )}
            </View>

            {discoveredDevices.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {isScanning
                    ? '正在搜尋周圍的 HoldYourHand 裝置...\n請將裝置開機並靠近手機約 0.5 公尺'
                    : '尚未發現裝置，請點擊「搜尋 HoldYourHand 裝置」開始'}
                </Text>

                {!isScanning && (
                  <Pressable style={styles.primaryScanButton} onPress={startScan}>
                    <Bluetooth size={16} color="#1A2151" />
                    <Text style={styles.primaryScanButtonText}>搜尋 HoldYourHand 裝置</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.deviceList}>
                {discoveredDevices.map((dev) => {
                  const isTarget = dev.name === BLE_CONFIG.TARGET_DEVICE_NAME;
                  return (
                    <Pressable
                      key={dev.id}
                      style={[styles.deviceItem, isTarget && styles.deviceItemTarget]}
                      onPress={() => handleFastPair(dev.id, dev.name)}
                    >
                      <View style={styles.deviceInfo}>
                        <View style={styles.deviceIconBox}>
                          <Bluetooth size={18} color={isTarget ? '#0284c7' : '#9B8AC1'} />
                        </View>
                        <View>
                          <View style={styles.deviceNameRow}>
                            <Text style={styles.deviceName}>{dev.name || '未知裝置'}</Text>
                            {isTarget && (
                              <View style={styles.vipTag}>
                                <Sparkles size={10} color="#0284c7" />
                                <Text style={styles.vipTagText}>目標裝置</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.deviceMac}>
                            ID: {dev.id.slice(0, 17)}
                            {dev.rssi !== null ? ` · 訊號: ${dev.rssi} dBm` : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.connectButtonBox}>
                        <Text style={styles.connectButtonText}>一鍵配對</Text>
                        <ChevronRight size={14} color="#0284c7" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ==================================================== */}
        {/* 已連線後的即時數據面板 */}
        {/* ==================================================== */}
        {isConnected && sensorData && (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <View style={styles.liveTitleGroup}>
                <CheckCircle2 size={16} color="#10b981" />
                <Text style={styles.liveTitle}>即時感測器數值</Text>
              </View>
              <Text style={styles.liveFrequency}>100ms / 10 Hz 串流中</Text>
            </View>

            {/* 指標網格 */}
            <View style={styles.metricsRow}>
              {/* 距離 */}
              <View style={styles.metricMiniCard}>
                <View style={styles.metricMiniHeader}>
                  <Ruler size={13} color="#0284c7" />
                  <Text style={styles.metricMiniLabel}>手部距離</Text>
                </View>
                <Text style={styles.metricMiniValue}>
                  {sensorData.isOutOfRange ? '無障礙物' : `${sensorData.distance} mm`}
                </Text>
                <Text
                  style={[
                    styles.metricMiniSub,
                    !sensorData.isOutOfRange && sensorData.distance < 50 && styles.alertText,
                  ]}
                >
                  {sensorData.isOutOfRange
                    ? '範圍外 (>1.2m)'
                    : sensorData.distance < 50
                    ? '🚨 進入觸發區'
                    : '正常距離'}
                </Text>
              </View>

              {/* 角速度 */}
              <View style={styles.metricMiniCard}>
                <View style={styles.metricMiniHeader}>
                  <Compass size={13} color="#9B8AC1" />
                  <Text style={styles.metricMiniLabel}>角速度</Text>
                </View>
                <Text style={styles.metricMiniValue}>
                  {sensorData.angularVelocity.toFixed(1)} <Text style={styles.metricUnit}>deg/s</Text>
                </Text>
                <Text
                  style={[
                    styles.metricMiniSub,
                    sensorData.angularVelocity >= 20 &&
                      sensorData.angularVelocity <= 150 &&
                      styles.alertText,
                  ]}
                >
                  {sensorData.angularVelocity < 20
                    ? '放鬆靜止'
                    : sensorData.angularVelocity <= 150
                    ? '🚨 微動摳抓中'
                    : '劇烈活動'}
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              {/* 心率 */}
              <View style={styles.metricMiniCard}>
                <View style={styles.metricMiniHeader}>
                  <Heart size={13} color="#f43f5e" />
                  <Text style={styles.metricMiniLabel}>心率</Text>
                </View>
                <Text style={styles.metricMiniValue}>
                  {sensorData.heartRate.toFixed(1)} <Text style={styles.metricUnit}>BPM</Text>
                </Text>
                <Text
                  style={[
                    styles.metricMiniSub,
                    sensorData.heartRate >= 80 && styles.alertText,
                  ]}
                >
                  {sensorData.heartRate >= 80 ? '偏高 / 緊繃' : '平穩正常'}
                </Text>
              </View>

              {/* 血氧 */}
              <View style={styles.metricMiniCard}>
                <View style={styles.metricMiniHeader}>
                  <Droplet size={13} color="#0284c7" />
                  <Text style={styles.metricMiniLabel}>血氧</Text>
                </View>
                <Text style={styles.metricMiniValue}>
                  {sensorData.spo2} <Text style={styles.metricUnit}>%</Text>
                </Text>
                <Text style={styles.metricMiniSub}>
                  {sensorData.spo2 >= 95 ? '血氧充足' : '稍偏低'}
                </Text>
              </View>
            </View>

            {/* 馬達狀態 */}
            <View
              style={[
                styles.motorStatusBar,
                sensorData.motorStatus && styles.motorStatusBarActive,
              ]}
            >
              <Zap size={15} color={sensorData.motorStatus ? '#d97706' : '#64748b'} />
              <Text
                style={[
                  styles.motorStatusText,
                  sensorData.motorStatus && styles.motorStatusTextActive,
                ]}
              >
                {sensorData.motorStatus
                  ? '📳 ESP32 震動馬達運作中（觸覺反饋提醒）'
                  : '裝置馬達待機監測中'}
              </Text>
            </View>

            {lastMessageAt && (
              <Text style={styles.lastTimeText}>
                最新封包時間：{new Date(lastMessageAt).toLocaleTimeString('zh-TW')}
              </Text>
            )}
          </View>
        )}

        {/* 底部按鈕區 */}
        <View style={styles.bottomSection}>
          {isConnected ? (
            <>
              <Pressable
                style={styles.startMonitorButton}
                onPress={() => router.push('/dashboard')}
              >
                <LinearGradient
                  colors={['#9B8AC1', '#38bdf8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.startMonitorButtonText}>進入即時健康儀表板 ›</Text>
                </LinearGradient>
              </Pressable>

              <Pressable style={styles.disconnectButton} onPress={disconnectDevice}>
                <Text style={styles.disconnectButtonText}>中斷裝置連線</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={styles.skipButton}
              onPress={() => router.push('/dashboard')}
            >
              <Text style={styles.skipButtonText}>暫不連線，先進入儀表板 ›</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDE5F8',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(155,138,193,0.3)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    color: '#333333',
    fontSize: 26,
    lineHeight: 28,
  },
  navigationTitle: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(155,138,193,0.2)',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeTabActive: {
    backgroundColor: '#bfdff5',
    shadowColor: '#bfdff5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modeTabText: {
    color: '#6B6675',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#1A2151',
    fontWeight: '700',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#333333',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  description: {
    color: '#5A5A5A',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  radarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  outerCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: 'rgba(205,225,248,0.7)',
    backgroundColor: 'rgba(205,225,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleCircle: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  deviceCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Fast Pair 卡片
  fastPairCard: {
    marginVertical: 14,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  fastPairGradient: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  fastPairHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fastPairIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastPairTitleBox: {
    flex: 1,
  },
  fastPairTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0369a1',
  },
  fastPairSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  fastPairDesc: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginVertical: 12,
  },
  fastPairButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  fastPairButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  fastPairButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fastPairSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  fastPairSuccessText: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '700',
  },

  // 專屬配對裝置卡片
  pairedDeviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(155,138,193,0.25)',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  pairedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairedDeviceTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pairedDeviceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  pairedDeviceSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  unpairBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  unpairBtnText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  pairedCardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  pairedStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pairedStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pairedStatusLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  quickConnectBtn: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickConnectBtnText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '700',
  },

  // 掃描搜尋區
  scanSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(155,138,193,0.2)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  scanButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  scanButtonSmallText: {
    fontSize: 12,
    color: '#9B8AC1',
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  primaryScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#bfdff5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryScanButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A2151',
  },
  deviceList: {
    gap: 10,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deviceItemTarget: {
    borderColor: '#38bdf8',
    backgroundColor: '#f0f9ff',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  deviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  vipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vipTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  deviceMac: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  connectButtonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  connectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },

  // 即時數據卡片
  liveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(155,138,193,0.2)',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  liveTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  liveFrequency: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricMiniCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricMiniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricMiniLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  metricMiniValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  metricMiniSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  alertText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  motorStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  motorStatusBarActive: {
    backgroundColor: '#fef3c7',
  },
  motorStatusText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  motorStatusTextActive: {
    color: '#b45309',
    fontWeight: '700',
  },
  lastTimeText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },

  // 底部按鈕
  bottomSection: {
    marginTop: 8,
    gap: 10,
  },
  startMonitorButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMonitorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disconnectButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  disconnectButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});