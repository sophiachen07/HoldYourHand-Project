import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import {
  Bluetooth,
  Brain,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  LogOut,
  Radio,
  Trash2,
  User,
} from 'lucide-react-native';

import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuraColors } from '../constants/auraTheme';
import { useSensor } from '../contexts/SensorContext';
import { getProfileDrivers, getProfileTypes, useUser } from '../contexts/UserContext';

const STORAGE_KEY_VIBRATION_STRENGTH = 'aura_vibration_strength';

const vibrationPresets = [
  {
    label: '輕度',
    value: 30,
  },
  {
    label: '中度',
    value: 60,
  },
  {
    label: '強度',
    value: 100,
  },
];

export default function SettingsScreen() {
  const { profile, clearHistoryData, logout } = useUser();
  const { status, mode, connectedDeviceName, sensorData } = useSensor();
  const isDeviceConnected = status === 'connected' && sensorData?.connected === true;
  const [vibrationStrength, setVibrationStrength] = useState(60);

  // 讀取先前儲存的振動強度
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_VIBRATION_STRENGTH);
        if (saved !== null) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            setVibrationStrength(parsed);
          }
        }
      } catch (err) {
        console.warn('讀取震動強度失敗:', err);
      }
    })();
  }, []);

  // 即時更新並自動儲存
  const handleUpdateVibration = (value: number) => {
    const val = Math.round(value);
    setVibrationStrength(val);
    AsyncStorage.setItem(STORAGE_KEY_VIBRATION_STRENGTH, String(val)).catch((err) =>
      console.warn('自動儲存震動強度失敗:', err)
    );
    try {
      Haptics.selectionAsync();
    } catch {
      // 忽略不支援觸覺反饋的環境
    }
  };

  function handleClearData() {
    Alert.alert(
      '清除目前數據資料',
      '確定要清除所有 BFRB 歷史紀錄與統計數據嗎？此操作將使所有次數歸零且無法復原。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認清除',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearHistoryData();
              Alert.alert('已清除', '所有歷史紀錄與統計數據已重設歸零。');
            } catch (err) {
              Alert.alert('錯誤', '清除資料失敗，請重試。');
            }
          },
        },
      ]
    );
  }

  function handleLogout() {
    Alert.alert('確認登出', '您確定要登出並返回登入頁面嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確認登出',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(tabs)');
          } catch (err) {
            router.replace('/(tabs)');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        <View style={styles.purpleGlow} />
        <View style={styles.cyanGlow} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 頂部導航列 */}
        <View style={styles.navigation}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft
              size={18}
              color={AuraColors.white}
            />
          </Pressable>

          <Text style={styles.navigationTitle}>
            設定
          </Text>
        </View>

        {/* 畫面最上方：個人基本資料導航按鈕 */}
        <Pressable
          style={({ pressed }) => [
            styles.profileNavCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push('/profile')}
        >
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.18)', 'rgba(6, 182, 212, 0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileNavGradient}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>
                {profile.name ? profile.name.slice(0, 1) : '宇'}
              </Text>
            </View>

            <View style={styles.profileNavInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileNavName}>
                  {profile.name || '宇航'}
                </Text>
                <View style={styles.profileTag}>
                  <Text style={styles.profileTagText}>
                    {profile.gender || '男性'} · {profile.age || '21'} 歲
                  </Text>
                </View>
              </View>
              <Text style={styles.profileNavSub}>
                點擊修改個人基本資料與 BFRB 篩查設定
              </Text>
            </View>

            <ChevronRight size={18} color={AuraColors.muted} />
          </LinearGradient>
        </Pressable>

        {/* 裝置連線導航按鈕 */}
        <Pressable
          style={({ pressed }) => [
            styles.deviceNavCard,
            pressed && styles.cardPressed,
          ]}
          onPress={() => router.push('/device')}
        >
          <LinearGradient
            colors={
              isDeviceConnected
                ? ['rgba(16, 185, 129, 0.16)', 'rgba(6, 182, 212, 0.10)']
                : ['rgba(6, 182, 212, 0.14)', 'rgba(139, 92, 246, 0.08)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.deviceNavGradient}
          >
            <View
              style={[
                styles.deviceIconCircle,
                isDeviceConnected && styles.deviceIconCircleConnected,
              ]}
            >
              <Bluetooth
                size={20}
                color={isDeviceConnected ? '#10b981' : AuraColors.cyan}
              />
            </View>

            <View style={styles.deviceNavInfo}>
              <View style={styles.deviceNameRow}>
                <Text style={styles.deviceNavTitle}>
                  裝置連線
                </Text>
                <View
                  style={[
                    styles.deviceStatusBadge,
                    isDeviceConnected
                      ? styles.deviceStatusBadgeConnected
                      : styles.deviceStatusBadgeDisconnected,
                  ]}
                >
                  <View
                    style={[
                      styles.deviceStatusDot,
                      isDeviceConnected && styles.deviceStatusDotConnected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.deviceStatusText,
                      isDeviceConnected && styles.deviceStatusTextConnected,
                    ]}
                  >
                    {isDeviceConnected
                      ? `${connectedDeviceName || (mode === 'ble' ? 'Hold your hand' : '模擬器')} 已連線`
                      : '未連線 · 點擊前往設定'}
                  </Text>
                </View>
              </View>
              <Text style={styles.deviceNavSub}>
                切換 BLE 藍牙手環或 WebSocket 開發模擬器
              </Text>
            </View>

            <ChevronRight size={18} color={AuraColors.muted} />
          </LinearGradient>
        </Pressable>

        {/* 區塊 1：您的 BFRB 內在驅動設定（連動複選展示） */}
        <View style={styles.bfrbCard}>
          <View style={styles.bfrbTitleRow}>
            <Brain
              size={17}
              color={AuraColors.cyan}
            />

            <Text style={styles.bfrbTitle}>
              您的 BFRB 內在驅動設定
            </Text>

            <View style={styles.countBadgeCyan}>
              <Text style={styles.countBadgeTextCyan}>
                已設定 {getProfileDrivers(profile).length} 項
              </Text>
            </View>
          </View>

          <Text style={styles.bfrbDescription}>
            系統已記錄您在個人資料中所選擇的主要誘發動機：
          </Text>

          <View style={styles.badgeTagsContainer}>
            {getProfileDrivers(profile).map((driver) => (
              <View key={driver} style={styles.driverTagBadge}>
                <View style={styles.bfrbDot} />
                <Text style={styles.driverTagText}>{driver}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 區塊 2：您的 BFRB 行為類型（連動複選展示） */}
        <View style={styles.bfrbCard}>
          <View style={styles.bfrbTitleRow}>
            <Fingerprint
              size={17}
              color="#c084fc"
            />

            <Text style={[styles.bfrbTitle, { color: '#c084fc' }]}>
              您的 BFRB 行為類型
            </Text>

            <View style={styles.countBadgePurple}>
              <Text style={styles.countBadgeTextPurple}>
                已設定 {getProfileTypes(profile).length} 項
              </Text>
            </View>
          </View>

          <Text style={styles.bfrbDescription}>
            手環演算法首要辨識與防護的身體集中重複行為模式：
          </Text>

          <View style={styles.badgeTagsContainer}>
            {getProfileTypes(profile).map((type) => (
              <View key={type} style={styles.typeTagBadge}>
                <Text style={styles.typeTagEmoji}>
                  {type === '摳皮膚'
                    ? '🖐️'
                    : type === '拔毛髮'
                    ? '💇'
                    : type === '咬指甲'
                    ? '🦷'
                    : '✨'}
                </Text>
                <Text style={styles.typeTagText}>{type}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 區塊 3：手環回饋設定 */}
        <Text style={styles.pageTitle}>
          手環回饋設定
        </Text>

        <Text style={styles.pageSubtitle}>
          客製化調整智慧手環在偵測到摳抓或焦慮行為時的振動回饋強度。
        </Text>

        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <View style={styles.settingTitleRow}>
              <Radio
                size={17}
                color={AuraColors.purple}
              />

              <Text style={styles.settingTitle}>
                手環振動反饋強度
              </Text>
            </View>

            <View style={styles.percentageBadge}>
              <Text style={styles.percentageText}>
                {vibrationStrength}%
              </Text>
            </View>
          </View>

          <Text style={styles.settingDescription}>
            高壓或異常摳抓事件發生時，手環將按照此強度提供觸覺提醒。（點選或滑動即自動儲存更新）
          </Text>

          <View style={styles.presetRow}>
            {vibrationPresets.map((preset) => {
              const selected =
                vibrationStrength === preset.value;

              return (
                <Pressable
                  key={preset.value}
                  style={[
                    styles.presetButton,
                    selected &&
                      styles.presetButtonSelected,
                  ]}
                  onPress={() =>
                    handleUpdateVibration(
                      preset.value
                    )
                  }
                >
                  <Text
                    style={[
                      styles.presetLabel,
                      selected &&
                        styles.presetLabelSelected,
                    ]}
                  >
                    {preset.label}
                  </Text>

                  <Text
                    style={[
                      styles.presetValue,
                      selected &&
                        styles.presetValueSelected,
                    ]}
                  >
                    {preset.value}%
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customHeader}>
            <Text style={styles.customLabel}>
              自訂百分比
            </Text>

            <Text style={styles.customValue}>
              {vibrationStrength}%
            </Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            step={10}
            value={vibrationStrength}
            onValueChange={(value) =>
              handleUpdateVibration(value)
            }
            minimumTrackTintColor={
              AuraColors.cyan
            }
            maximumTrackTintColor="rgba(255,255,255,0.10)"
            thumbTintColor="#ffffff"
          />

          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>
              關閉
            </Text>

            <Text style={styles.sliderLabel}>
              最大
            </Text>
          </View>
        </View>

        <View style={styles.previewCard}>
          <View
            style={[
              styles.previewCircle,
              {
                opacity:
                  0.35 +
                  vibrationStrength / 160,
                transform: [
                  {
                    scale:
                      0.8 +
                      vibrationStrength /
                        250,
                  },
                ],
              },
            ]}
          >
            <Radio
              size={25}
              color={AuraColors.cyan}
            />
          </View>

          <View style={styles.previewTextArea}>
            <Text style={styles.previewTitle}>
              振動回饋預覽
            </Text>

            <Text style={styles.previewDescription}>
              目前設定為 {vibrationStrength}%
              強度。實際振動將由 Hold your hand
              智慧手環執行。
            </Text>
          </View>
        </View>

        {/* 區塊 4：資料管理與帳號操作 */}
        <View style={styles.dangerZoneCard}>
          <Text style={styles.dangerZoneTitle}>
            資料管理與帳號操作
          </Text>
          <Text style={styles.dangerZoneDesc}>
            管理本機已儲存的行為數據或安全登出當前帳號。
          </Text>

          {/* 清除目前數據資料按鈕 */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.clearDataButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleClearData}
          >
            <Trash2 size={16} color={AuraColors.warning} />
            <Text style={styles.clearDataButtonText}>
              清除目前數據資料
            </Text>
          </Pressable>

          {/* 登出按鈕 */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.logoutButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleLogout}
          >
            <LogOut size={16} color={AuraColors.muted} />
            <Text style={styles.logoutButtonText}>
              登出帳號
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      AuraColors.backgroundDeep,
  },

  background: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },

  purpleGlow: {
    position: 'absolute',
    top: 80,
    left: -130,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor:
      'rgba(139,92,246,0.09)',
  },

  cyanGlow: {
    position: 'absolute',
    right: -140,
    bottom: 40,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor:
      'rgba(6,182,212,0.07)',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 34,
  },

  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255,255,255,0.05)',
  },

  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 17,
    backgroundColor: AuraColors.card,
  },

  navigationTitle: {
    color: AuraColors.white,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 12,
  },

  profileNavCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.28)',
    marginBottom: 16,
  },

  profileNavGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },

  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AuraColors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },

  profileNavInfo: {
    flex: 1,
  },

  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },

  profileNavName: {
    color: AuraColors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  profileTag: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },

  profileTagText: {
    color: AuraColors.cyan,
    fontSize: 10,
    fontWeight: '700',
  },

  profileNavSub: {
    color: AuraColors.muted,
    fontSize: 11,
    lineHeight: 15,
  },

  // 裝置連線按鈕樣式
  deviceNavCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.28)',
    marginBottom: 16,
  },

  deviceNavGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },

  deviceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deviceIconCircleConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },

  deviceNavInfo: {
    flex: 1,
  },

  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  deviceNavTitle: {
    color: AuraColors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  deviceStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
  },

  deviceStatusBadgeConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },

  deviceStatusBadgeDisconnected: {
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },

  deviceStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },

  deviceStatusDotConnected: {
    backgroundColor: '#10b981',
  },

  deviceStatusText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },

  deviceStatusTextConnected: {
    color: '#10b981',
  },

  deviceNavSub: {
    color: AuraColors.muted,
    fontSize: 11,
    marginTop: 3,
  },

  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  bfrbCard: {
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 16,
    backgroundColor:
      'rgba(255,255,255,0.025)',
  },

  bfrbTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  bfrbTitle: {
    color: AuraColors.cyan,
    fontSize: 13,
    fontWeight: '800',
  },

  bfrbDescription: {
    color: AuraColors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 10,
  },

  bfrbValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor:
      'rgba(6,182,212,0.25)',
    borderRadius: 10,
    backgroundColor:
      'rgba(6,182,212,0.09)',
  },

  bfrbValuePurple: {
    borderColor:
      'rgba(192,132,252,0.25)',
    backgroundColor:
      'rgba(192,132,252,0.09)',
  },

  bfrbDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AuraColors.cyan,
  },

  behaviorEmoji: {
    fontSize: 14,
  },

  bfrbValueText: {
    color: AuraColors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  countBadgeCyan: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    marginLeft: 'auto',
  },

  countBadgeTextCyan: {
    color: AuraColors.cyan,
    fontSize: 10,
    fontWeight: '700',
  },

  countBadgePurple: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    marginLeft: 'auto',
  },

  countBadgeTextPurple: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: '700',
  },

  badgeTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  driverTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },

  driverTagText: {
    color: AuraColors.white,
    fontSize: 12,
    fontWeight: '600',
  },

  typeTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
  },

  typeTagEmoji: {
    fontSize: 14,
  },

  typeTagText: {
    color: AuraColors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  pageTitle: {
    color: AuraColors.white,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },

  pageSubtitle: {
    color: AuraColors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 18,
  },

  settingCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 18,
    backgroundColor: AuraColors.card,
  },

  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  settingTitle: {
    color: AuraColors.white,
    fontSize: 13,
    fontWeight: '800',
  },

  percentageBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor:
      'rgba(6,182,212,0.10)',
  },

  percentageText: {
    color: AuraColors.cyan,
    fontSize: 12,
    fontWeight: '800',
  },

  settingDescription: {
    color: AuraColors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },

  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },

  presetButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 12,
    backgroundColor:
      'rgba(255,255,255,0.025)',
  },

  presetButtonSelected: {
    borderColor: AuraColors.cyan,
    backgroundColor:
      'rgba(6,182,212,0.10)',
  },

  presetLabel: {
    color: AuraColors.muted,
    fontSize: 11,
    fontWeight: '700',
  },

  presetLabelSelected: {
    color: AuraColors.white,
  },

  presetValue: {
    color: AuraColors.mutedDark,
    fontSize: 9,
    marginTop: 3,
  },

  presetValueSelected: {
    color: AuraColors.cyan,
  },

  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  customLabel: {
    color: AuraColors.muted,
    fontSize: 10,
    fontWeight: '700',
  },

  customValue: {
    color: AuraColors.cyan,
    fontSize: 13,
    fontWeight: '800',
  },

  slider: {
    width: '100%',
    height: 36,
    marginTop: 4,
  },

  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  sliderLabel: {
    color: AuraColors.mutedDark,
    fontSize: 9,
  },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginTop: 14,
    borderWidth: 1,
    borderColor:
      'rgba(139,92,246,0.20)',
    borderRadius: 16,
    backgroundColor:
      'rgba(139,92,246,0.045)',
  },

  previewCircle: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      'rgba(6,182,212,0.32)',
    borderRadius: 27,
    backgroundColor:
      'rgba(6,182,212,0.10)',
  },

  previewTextArea: {
    flex: 1,
    marginLeft: 14,
  },

  previewTitle: {
    color: AuraColors.white,
    fontSize: 12,
    fontWeight: '800',
  },

  previewDescription: {
    color: AuraColors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  saveButtonWrapper: {
    marginTop: 24,
    borderRadius: 14,
  },

  saveButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
  },

  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  dangerZoneCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },

  dangerZoneTitle: {
    color: AuraColors.white,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },

  dangerZoneDesc: {
    color: AuraColors.mutedDark,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 14,
  },

  actionButton: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },

  clearDataButton: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },

  clearDataButtonText: {
    color: AuraColors.warning,
    fontSize: 13,
    fontWeight: '700',
  },

  logoutButton: {
    borderColor: AuraColors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 0,
  },

  logoutButtonText: {
    color: AuraColors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
});
