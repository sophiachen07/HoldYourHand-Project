import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
  Zap,
} from 'lucide-react-native';

import { useSensor } from '../contexts/SensorContext';
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
    startScan,
    stopScan,
    connectDevice,
    disconnectDevice,
  } = useSensor();

  const isConnected = status === 'connected' && sensorData?.connected === true;
  const isScanning = status === 'scanning';
  const isConnecting = status === 'connecting';

  function getStatusBadge() {
    if (isConnected) {
      return {
        text: `${connectedDeviceName || 'Hold your hand'} 已連線`,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.15)',
        border: 'rgba(16,185,129,0.3)',
      };
    }
    if (isScanning) {
      return {
        text: '正在搜尋 BLE 穿戴手環...',
        color: '#06b6d4',
        bg: 'rgba(6,182,212,0.15)',
        border: 'rgba(6,182,212,0.3)',
      };
    }
    if (isConnecting) {
      return {
        text: '正在建立藍牙連線與訂閱...',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.15)',
        border: 'rgba(245,158,11,0.3)',
      };
    }
    if (status === 'error') {
      return {
        text: '連線發生錯誤，請重試',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.15)',
        border: 'rgba(239,68,68,0.3)',
      };
    }
    return {
      text: mode === 'ble' ? '手環未連線' : '模擬器未連線',
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.1)',
      border: 'rgba(148,163,184,0.2)',
    };
  }

  const badge = getStatusBadge();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 頂部導航 */}
        <View style={styles.navigation}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>

          <Text style={styles.navigationTitle}>裝置連線管理</Text>
        </View>

        {/* 模式切換器 (BLE 真機 / 模擬器) */}
        <View style={styles.modeToggleContainer}>
          <Pressable
            style={[
              styles.modeTab,
              mode === 'ble' && styles.modeTabActive,
            ]}
            onPress={() => {
              if (mode !== 'ble') {
                disconnectDevice();
                setMode('ble');
              }
            }}
          >
            <Bluetooth size={14} color={mode === 'ble' ? '#06b6d4' : '#94a3b8'} />
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
            style={[
              styles.modeTab,
              mode === 'simulator' && styles.modeTabActive,
            ]}
            onPress={() => {
              if (mode !== 'simulator') {
                disconnectDevice();
                setMode('simulator');
              }
            }}
          >
            <Server size={14} color={mode === 'simulator' ? '#c084fc' : '#94a3b8'} />
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
            {mode === 'ble' ? '連接 HoldYourHand 手環' : '連接開發測試模擬器'}
          </Text>
          <Text style={styles.description}>
            {mode === 'ble'
              ? '手機將透過 BLE 接收 ESP32 推播之即時動作、距離與生理數據。'
              : '手機將透過區網 WebSocket 接收電腦端測試面板之模擬數據。'}
          </Text>
        </View>

        {/* 視覺雷達動態圈 */}
        <View style={styles.radarContainer}>
          <View style={styles.outerCircle}>
            <View style={styles.middleCircle}>
              <LinearGradient
                colors={
                  isConnected
                    ? ['#06b6d4', '#10b981']
                    : isScanning
                    ? ['#8b5cf6', '#06b6d4']
                    : ['#334155', '#1e293b']
                }
                style={styles.deviceCircle}
              >
                {mode === 'ble' ? (
                  <Bluetooth size={36} color="#ffffff" />
                ) : (
                  <Radio size={36} color="#ffffff" />
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
            <View
              style={[
                styles.statusDot,
                { backgroundColor: badge.color },
              ]}
            />
            <Text style={[styles.statusText, { color: badge.color }]}>
              {badge.text}
            </Text>
          </View>
        </View>

        {/* BLE 掃描與裝置清單區 */}
        {mode === 'ble' && !isConnected && (
          <View style={styles.scanSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>附近的手環裝置</Text>
              {isScanning ? (
                <Pressable
                  style={styles.scanButtonSmall}
                  onPress={stopScan}
                >
                  <ActivityIndicator size="small" color="#06b6d4" />
                  <Text style={styles.scanButtonSmallText}>停止搜尋</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.scanButtonSmall}
                  onPress={startScan}
                >
                  <RefreshCw size={13} color="#06b6d4" />
                  <Text style={styles.scanButtonSmallText}>重新搜尋</Text>
                </Pressable>
              )}
            </View>

            {discoveredDevices.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  {isScanning
                    ? '正在搜尋周圍的 HoldYourHand_Device...\n請確保手環已開機並處於廣播模式'
                    : '尚未發現裝置，請點擊「搜尋裝置」開始配對'}
                </Text>

                {!isScanning && (
                  <Pressable
                    style={styles.primaryScanButton}
                    onPress={startScan}
                  >
                    <Bluetooth size={16} color="#ffffff" />
                    <Text style={styles.primaryScanButtonText}>
                      搜尋 HoldYourHand 手環
                    </Text>
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
                      style={[
                        styles.deviceItem,
                        isTarget && styles.deviceItemTarget,
                      ]}
                      onPress={() => connectDevice(dev.id)}
                    >
                      <View style={styles.deviceInfo}>
                        <View style={styles.deviceIconBox}>
                          <Bluetooth
                            size={18}
                            color={isTarget ? '#06b6d4' : '#94a3b8'}
                          />
                        </View>
                        <View>
                          <View style={styles.deviceNameRow}>
                            <Text style={styles.deviceName}>
                              {dev.name || '未知裝置'}
                            </Text>
                            {isTarget && (
                              <View style={styles.vipTag}>
                                <Sparkles size={10} color="#06b6d4" />
                                <Text style={styles.vipTagText}>目標手環</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.deviceMac}>
                            UUID / MAC: {dev.id.slice(0, 17)}
                            {dev.rssi !== null ? ` · 訊號: ${dev.rssi} dBm` : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.connectButtonBox}>
                        <Text style={styles.connectButtonText}>一鍵配對</Text>
                        <ChevronRight size={14} color="#06b6d4" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* 已連線後的即時資料卡片 */}
        {isConnected && sensorData && (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <View style={styles.liveTitleGroup}>
                <CheckCircle2 size={16} color="#10b981" />
                <Text style={styles.liveTitle}>即時感測器數值</Text>
              </View>
              <Text style={styles.liveFrequency}>100ms / 10 Hz 串流中</Text>
            </View>

            {/* 5 大指標網格 */}
            <View style={styles.metricsRow}>
              {/* 距離 */}
              <View style={styles.metricMiniCard}>
                <View style={styles.metricMiniHeader}>
                  <Ruler size={13} color="#06b6d4" />
                  <Text style={styles.metricMiniLabel}>手部距離</Text>
                </View>
                <Text style={styles.metricMiniValue}>
                  {sensorData.isOutOfRange
                    ? '無障礙物'
                    : `${sensorData.distance} mm`}
                </Text>
                <Text
                  style={[
                    styles.metricMiniSub,
                    !sensorData.isOutOfRange &&
                      sensorData.distance < 50 &&
                      styles.alertText,
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
                  <Compass size={13} color="#c084fc" />
                  <Text style={styles.metricMiniLabel}>角速度</Text>
                </View>
                <Text style={styles.metricMiniValue}>
                  {sensorData.angularVelocity.toFixed(1)}{' '}
                  <Text style={styles.metricUnit}>deg/s</Text>
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
                  {sensorData.heartRate.toFixed(1)}{' '}
                  <Text style={styles.metricUnit}>BPM</Text>
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
                  <Droplet size={13} color="#06b6d4" />
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

            {/* 馬達震動狀態條 */}
            <View
              style={[
                styles.motorStatusBar,
                sensorData.motorStatus && styles.motorStatusBarActive,
              ]}
            >
              <Zap
                size={15}
                color={sensorData.motorStatus ? '#f59e0b' : '#94a3b8'}
              />
              <Text
                style={[
                  styles.motorStatusText,
                  sensorData.motorStatus && styles.motorStatusTextActive,
                ]}
              >
                {sensorData.motorStatus
                  ? '📳 ESP32 震動馬達運作中（觸覺反饋提醒）'
                  : '手環馬達待機監測中'}
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
                  colors={['#8b5cf6', '#06b6d4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.startMonitorButtonText}>
                    進入即時健康儀表板 ›
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                style={styles.disconnectButton}
                onPress={disconnectDevice}
              >
                <Text style={styles.disconnectButtonText}>中斷手環連線</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07050f',
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
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 26,
    lineHeight: 28,
  },
  navigationTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modeTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  description: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
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
    borderColor: 'rgba(6,182,212,0.18)',
    backgroundColor: 'rgba(6,182,212,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.22)',
    backgroundColor: 'rgba(139,92,246,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scanSection: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  scanButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(6,182,212,0.1)',
  },
  scanButtonSmallText: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  primaryScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
  },
  primaryScanButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  deviceList: {
    gap: 10,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  deviceItemTarget: {
    borderColor: 'rgba(6,182,212,0.4)',
    backgroundColor: 'rgba(6,182,212,0.06)',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  vipTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(6,182,212,0.15)',
  },
  vipTagText: {
    color: '#06b6d4',
    fontSize: 9,
    fontWeight: '700',
  },
  deviceMac: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  connectButtonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  connectButtonText: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '700',
  },
  liveCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.2)',
    backgroundColor: 'rgba(6,182,212,0.04)',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  liveTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  liveFrequency: {
    color: '#06b6d4',
    fontSize: 10,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  metricMiniCard: {
    flex: 1,
    padding: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metricMiniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricMiniLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  metricMiniValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  metricMiniSub: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 3,
    fontWeight: '600',
  },
  alertText: {
    color: '#ef4444',
  },
  motorStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 4,
  },
  motorStatusBarActive: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
    borderWidth: 1,
  },
  motorStatusText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  motorStatusTextActive: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  lastTimeText: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 10,
    textAlign: 'right',
  },
  bottomSection: {
    marginTop: 20,
    gap: 12,
  },
  startMonitorButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMonitorButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  disconnectButton: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  disconnectButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
});