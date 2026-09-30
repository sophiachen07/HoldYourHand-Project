import { router } from 'expo-router';
import React, {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import {
  Activity,
  BarChart2,
  Bluetooth,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Database,
  Droplet,
  Flower2,
  Heart,
  Info,
  MessageCircle,
  Ruler,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wind,
  X,
  Zap,
} from 'lucide-react-native';

import { useAlert } from '../contexts/AlertContext';
import { useSensor } from '../contexts/SensorContext';
import {
  BFRB_BEHAVIOR_TYPES,
  DailyRecord,
  defaultBehaviorStats,
  formatMonthDay,
  formatWeekdayWithDate,
  getProfileTypes,
  getTaiwanDate,
  getTaiwanDateString,
  getWeekdayName,
  useUser,
} from '../contexts/UserContext';
import { AuraColors } from '../constants/auraTheme';

type DashboardTab = 'realtime' | 'statistics';

const GAUGE_RADIUS = 60;
const GAUGE_CIRCUMFERENCE =
  2 * Math.PI * GAUGE_RADIUS;

export default function DashboardScreen() {
  const { profile } = useUser();
  const { isPicking, ignoredCurrentEvent } = useAlert();
  const [activeTab, setActiveTab] =
    useState<DashboardTab>('realtime');
  const [showRelaxMenu, setShowRelaxMenu] = useState(false);

  const {
    status,
    sensorData,
    lastMessageAt,
    connectedDeviceName,
  } = useSensor();

  const hasData = sensorData !== null;

  const distance = sensorData?.distance ?? 9999;
  const angularVelocity = sensorData?.angularVelocity ?? 0;
  const heartRate = sensorData?.heartRate ?? 0;
  const spo2 = sensorData?.spo2 ?? 0;
  const motorStatus = sensorData?.motorStatus ?? false;
  const isOutOfRange = sensorData?.isOutOfRange ?? (distance >= 9999);

  // 壓力狀態：心率 > 80 BPM 或 BFRB 觸發
  const isStressed = hasData && heartRate >= 80;

  // 模擬壓力指數：目前依心率與角速度估算
  const stressScore = useMemo(() => {
    if (!hasData) {
      return 0;
    }

    const heartRatePart = ((heartRate - 60) / 40) * 100;
    return Math.min(
      100,
      Math.max(
        12,
        Math.round(heartRatePart)
      )
    );
  }, [hasData, heartRate]);

  // 距離進度 (50mm 以下為危險區，0~300mm 比例)
  const distancePercent = isOutOfRange
    ? 100
    : Math.min(100, Math.max(0, (distance / 300) * 100));

  // 角速度進度 (0~150 deg/s 比例)
  const gyroPercent = Math.min(
    100,
    Math.max(0, (angularVelocity / 150) * 100)
  );

  const gaugeOffset =
    GAUGE_CIRCUMFERENCE -
    (
      stressScore / 100
    ) *
      GAUGE_CIRCUMFERENCE;

  const connectionColor =
    status === 'connected' &&
    sensorData?.connected
      ? '#2E7D6E'
      : status === 'connecting'
        ? '#C59B27'
        : '#D9534F';

  const connectionText = getConnectionText(
    status,
    sensorData?.connected,
    hasData
  );

  const stressPresentation =
    getStressPresentation(
      hasData,
      isStressed,
      stressScore
    );

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
        {/* 頂部導航列 */}
        <View style={styles.topNavigation}>
          <View>
            <Text style={styles.navigationTitle}>
              健康儀表板
            </Text>

            <Text style={styles.navigationSubtitle}>
              Hold your hand 即時生理監測
            </Text>
          </View>

          <View style={styles.headerButtons}>
            <RoundIconButton
              onPress={() => setShowRelaxMenu(true)}
            >
              <Flower2
                size={18}
                color="#ffffff"
              />
            </RoundIconButton>

            <RoundIconButton
              onPress={() => router.push('/settings')}
            >
              <Settings
                size={18}
                color="#ffffff"
              />
            </RoundIconButton>
          </View>
        </View>

        {/* 模式切換器 (即時數據 / 統計分析) - 對齊膠囊風格 */}
        <View style={styles.tabs}>
          <Pressable
            style={[
              styles.tabButton,
              activeTab === 'realtime' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('realtime')}
          >
            <Activity
              size={15}
              color={activeTab === 'realtime' ? '#ffffff' : '#c9adf0'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'realtime' && styles.tabTextActive,
              ]}
            >
              即時數據
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              activeTab === 'statistics' && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab('statistics')}
          >
            <BarChart2
              size={15}
              color={activeTab === 'statistics' ? '#ffffff' : '#c9adf0'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'statistics' && styles.tabTextActive,
              ]}
            >
              統計分析
            </Text>
          </Pressable>
        </View>

        {/* 個人資料與手環狀態膠囊 */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={['#9B8AC1', '#CAE7E0']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {profile.name ? profile.name.slice(0, 1) : '宇'}
            </Text>
          </LinearGradient>

          <View style={styles.profileInformation}>
            <Text style={styles.profileName}>
              {profile.name || '宇航'}
            </Text>

            <Text style={styles.profileDescription}>
              {profile.age || '21'} 歲 · {profile.gender || '男性'}
            </Text>
          </View>

          <View
            style={[
              styles.connectionBadge,
              {
                backgroundColor:
                  status === 'connected' && sensorData?.connected
                    ? '#CAE7E0'
                    : '#F5C0C0',
                borderColor:
                  status === 'connected' && sensorData?.connected
                    ? 'rgba(46, 125, 110, 0.3)'
                    : 'rgba(217, 83, 79, 0.3)',
              },
            ]}
          >
            <View
              style={[
                styles.connectionDot,
                {
                  backgroundColor:
                    status === 'connected' && sensorData?.connected
                      ? '#10B981'
                      : '#EF4444',
                },
              ]}
            />

            <Text
              style={[
                styles.connectionBadgeText,
                {
                  color:
                    status === 'connected' && sensorData?.connected
                      ? '#2E7D6E'
                      : '#9C4146',
                },
              ]}
            >
              {connectionText}
            </Text>
          </View>
        </View>

        {activeTab === 'realtime' ? (
          <View>
            {/* 指標提示橫幅 */}
            <View style={styles.thresholdBanner}>
              <Text style={styles.thresholdIcon}>
                💡
              </Text>

              <Text style={styles.thresholdText}>
                BFRB 智慧防護指標：手部距離 ＜ 50 mm · 角速度 20~150 deg/s · 心率 ＞ 80 BPM
              </Text>
            </View>

            {/* 即時壓力指數卡片 */}
            <View style={styles.stressCard}>
              <Text style={styles.sectionLabel}>
                即時壓力指數
              </Text>

              <View style={styles.gaugeContainer}>
                <Svg
                  width={160}
                  height={160}
                  viewBox="0 0 140 140"
                >
                  <Defs>
                    <SvgLinearGradient
                      id="normalGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <Stop
                        offset="0%"
                        stopColor="#CAE7E0"
                      />

                      <Stop
                        offset="100%"
                        stopColor="#9B8AC1"
                      />
                    </SvgLinearGradient>

                    <SvgLinearGradient
                      id="alertGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <Stop
                        offset="0%"
                        stopColor="#F5C0C0"
                      />

                      <Stop
                        offset="100%"
                        stopColor="#E57373"
                      />
                    </SvgLinearGradient>
                  </Defs>

                  {/* 外圈雷達圓環底色 */}
                  <Circle
                    cx="70"
                    cy="70"
                    r={GAUGE_RADIUS}
                    fill="none"
                    stroke="rgba(205, 225, 248, 0.35)"
                    strokeWidth={8}
                  />

                  <Circle
                    cx="70"
                    cy="70"
                    r={GAUGE_RADIUS}
                    fill="none"
                    stroke={
                      isStressed
                        ? 'url(#alertGradient)'
                        : 'url(#normalGradient)'
                    }
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={
                      GAUGE_CIRCUMFERENCE
                    }
                    strokeDashoffset={
                      hasData
                        ? gaugeOffset
                        : GAUGE_CIRCUMFERENCE
                    }
                    rotation="-90"
                    origin="70, 70"
                  />
                </Svg>

                <View style={styles.gaugeContent}>
                  <Text style={styles.stressScore}>
                    {hasData
                      ? stressScore
                      : '--'}
                  </Text>

                  <Text style={styles.stressScoreLabel}>
                    壓力指數
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.stressStatus,
                  {
                    backgroundColor:
                      stressPresentation.color,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        isStressed || stressScore > 75
                          ? '#EF4444'
                          : '#10B981',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.stressStatusText,
                    { color: stressPresentation.textColor },
                  ]}
                >
                  {stressPresentation.label}
                </Text>
              </View>
            </View>

            {/* 生理數據：心率與血氧 */}
            <View style={styles.metricsGrid}>
              <MetricCard
                label="心率"
                value={
                  hasData
                    ? heartRate.toFixed(1)
                    : '--'
                }
                unit="BPM"
                status={
                  !hasData
                    ? '等待資料'
                    : heartRate >= 80
                      ? '偏高／警示門檻'
                      : '平穩'
                }
                warning={
                  hasData &&
                  heartRate >= 80
                }
                icon={
                  <Heart
                    size={16}
                    color={
                      heartRate >= 80
                        ? '#D9534F'
                        : '#9B8AC1'
                    }
                  />
                }
              />

              <MetricCard
                label="血氧濃度"
                value={
                  hasData
                    ? String(spo2)
                    : '--'
                }
                unit="%"
                status={
                  !hasData
                    ? '等待資料'
                    : spo2 < 95
                      ? '稍低'
                      : '極佳'
                }
                warning={
                  hasData &&
                  spo2 < 95
                }
                icon={
                  <Droplet
                    size={16}
                    color="#2E7D6E"
                  />
                }
              />
            </View>

            {/* 1. 手部接近距離 (VL53L0X 雷射測距) */}
            <View
              style={[
                styles.largeMetricCard,
                !isOutOfRange && distance < 50 && styles.warningCard,
              ]}
            >
              <View style={styles.metricHeader}>
                <View>
                  <Text style={styles.metricLabel}>
                    手部接近距離 (VL53L0X)
                  </Text>
                  <Text style={styles.metricSubLabel}>
                    {isOutOfRange
                      ? '超出量測範圍 (>1.2m)'
                      : distance < 50
                      ? '🚨 進入頭部/皮膚觸發區 (<50mm)'
                      : distance <= 100
                      ? '⚠️ 接近中 (50~100mm)'
                      : '安全距離'}
                  </Text>
                </View>

                <Ruler
                  size={16}
                  color={
                    !isOutOfRange && distance < 50
                      ? '#D9534F'
                      : '#9B8AC1'
                  }
                />
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.largeMetricValue}>
                  {hasData
                    ? isOutOfRange
                      ? '無障礙物'
                      : String(distance)
                    : '--'}
                </Text>

                {!isOutOfRange && hasData && (
                  <Text style={styles.metricUnit}>
                    mm
                  </Text>
                )}
              </View>

              <View style={styles.forceTrack}>
                <LinearGradient
                  colors={
                    !isOutOfRange && distance < 50
                      ? ['#F5C0C0', '#E57373']
                      : ['#CAE7E0', '#9B8AC1']
                  }
                  style={[
                    styles.forceFill,
                    {
                      width: `${distancePercent}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* 2. 手部動作角速度 (MPU6050 空間微動) */}
            <View
              style={[
                styles.largeMetricCard,
                angularVelocity >= 20 && angularVelocity <= 150 && styles.warningCard,
              ]}
            >
              <View style={styles.metricHeader}>
                <View>
                  <Text style={styles.metricLabel}>
                    手部動作角速度 (MPU6050)
                  </Text>
                  <Text style={styles.metricSubLabel}>
                    {angularVelocity < 20
                      ? '平穩放鬆 (<20 dps)'
                      : angularVelocity <= 150
                      ? '🚨 疑似重複摳抓微動 (20~150 dps)'
                      : '劇烈活動 (>150 dps)'}
                  </Text>
                </View>

                <Compass
                  size={16}
                  color={
                    angularVelocity >= 20 && angularVelocity <= 150
                      ? '#D9534F'
                      : '#9B8AC1'
                  }
                />
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.largeMetricValue}>
                  {hasData ? angularVelocity.toFixed(1) : '--'}
                </Text>

                <Text style={styles.metricUnit}>
                  deg/s
                </Text>
              </View>

              <View style={styles.forceTrack}>
                <LinearGradient
                  colors={
                    angularVelocity >= 20 && angularVelocity <= 150
                      ? ['#F5C0C0', '#E57373']
                      : ['#9B8AC1', '#CAE7E0']
                  }
                  style={[
                    styles.forceFill,
                    {
                      width: `${gyroPercent}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* 3. ESP32 馬達觸覺震動狀態 */}
            <View
              style={[
                styles.motorCard,
                motorStatus && styles.motorCardActive,
              ]}
            >
              <View style={styles.motorCardHeader}>
                <Zap
                  size={18}
                  color={motorStatus ? '#D9534F' : '#64748B'}
                />
                <Text
                  style={[
                    styles.motorCardTitle,
                    motorStatus && styles.motorCardTitleActive,
                  ]}
                >
                  {motorStatus
                    ? '📳 ESP32 震動馬達運作中（觸覺提醒反饋）'
                    : '手環觸覺馬達：待機監控中'}
                </Text>
              </View>
              <Text style={styles.motorCardSub}>
                {motorStatus
                  ? '手環偵測到 BFRB 行為成立，正持續震動 1 秒提醒您停止摳抓。'
                  : '條件齊備時，ESP32 邊緣狀態機將自動驅動 GPIO 23 震動提醒。'}
              </Text>
            </View>

            {/* 4. 連線裝置資訊卡 */}
            <View style={styles.deviceInformation}>
              <InformationRow
                label="連線裝置"
                value={
                  connectedDeviceName ??
                  (hasData ? 'HoldYourHand_Device' : '未連線')
                }
              />

              <InformationRow
                label="最新封包"
                value={
                  lastMessageAt
                    ? new Date(
                        lastMessageAt
                      ).toLocaleTimeString(
                        'zh-TW'
                      )
                    : '--'
                }
              />
            </View>
          </View>
        ) : (
          <StatisticsContent />
        )}
      </ScrollView>

      {/* 舒壓與解壓互動選單 Modal */}
      <Modal
        visible={showRelaxMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRelaxMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowRelaxMenu(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconBadge}>
                  <Flower2 size={16} color="#ffffff" />
                </View>
                <Text style={styles.modalTitle}>放鬆與解壓中心</Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowRelaxMenu(false)}
              >
                <X size={16} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              選擇您希望進行的舒壓或互動模式
            </Text>

            <View style={styles.modalOptionsContainer}>
              {/* 選項一：舒壓引導專區 */}
              <Pressable
                style={({ pressed }) => [
                  styles.optionCard,
                  pressed && styles.optionCardPressed,
                ]}
                onPress={() => {
                  setShowRelaxMenu(false);
                  router.push('/relax');
                }}
              >
                <View style={styles.optionPureCard}>
                  <View style={styles.optionIconContainer}>
                    <Wind size={22} color="#2E7D6E" />
                  </View>
                  <View style={styles.optionContent}>
                    <View style={styles.optionTitleRow}>
                      <Text style={styles.optionTitle}>舒壓引導專區</Text>
                      <View style={styles.badgeGuide}>
                        <Text style={styles.badgeGuideText}>呼吸 · 白噪音</Text>
                      </View>
                    </View>
                    <Text style={styles.optionDesc}>
                      科學節律呼吸引導與高沉浸白噪音音效，舒緩身心壓力
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#2E7D6E" />
                </View>
              </Pressable>

              {/* 選項二：好玩互動遊戲 */}
              <Pressable
                style={({ pressed }) => [
                  styles.optionCard,
                  pressed && styles.optionCardPressed,
                ]}
                onPress={() => {
                  setShowRelaxMenu(false);
                  router.push('/game');
                }}
              >
                <View style={styles.optionPureCard}>
                  <View style={styles.optionIconContainer}>
                    <Sparkles size={22} color="#2E7D6E" />
                  </View>
                  <View style={styles.optionContent}>
                    <View style={styles.optionTitleRow}>
                      <Text style={styles.optionTitle}>好玩互動遊戲</Text>
                      <View style={styles.badgeGame}>
                        <Text style={styles.badgeGameText}>極限進度條</Text>
                      </View>
                    </View>
                    <Text style={styles.optionDesc}>
                      長按蓄力挑戰幾何尺寸 100% 完美重合，享受粒子震動回饋
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#2E7D6E" />
                </View>
              </Pressable>

              {/* 選項三：守把手小樹洞 (AI 陪伴助理) */}
              <Pressable
                style={({ pressed }) => [
                  styles.optionCard,
                  pressed && styles.optionCardPressed,
                ]}
                onPress={() => {
                  setShowRelaxMenu(false);
                  router.push('/treehole' as any);
                }}
              >
                <View style={styles.optionPureCard}>
                  <View style={styles.optionIconContainer}>
                    <MessageCircle size={22} color="#2E7D6E" />
                  </View>
                  <View style={styles.optionContent}>
                    <View style={styles.optionTitleRow}>
                      <Text style={styles.optionTitle}>守把手小樹洞</Text>
                      <View style={styles.badgeTreehole}>
                        <Text style={styles.badgeTreeholeText}>AI 暖心陪伴</Text>
                      </View>
                    </View>
                    <Text style={styles.optionDesc}>
                      溫柔傾聽你的焦慮與緊繃，AI 陪伴小助手隨時守護你
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#2E7D6E" />
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DashboardTabButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.tabButton,
        active &&
          styles.tabButtonActive,
      ]}
      onPress={onPress}
    >
      <View
        style={{
          opacity: active ? 1 : 0.65,
        }}
      >
        {icon}
      </View>

      <Text
        style={[
          styles.tabText,
          active &&
            styles.tabTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RoundIconButton({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.roundIconButton,
        pressed && {
          opacity: 0.65,
        },
      ]}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

function MetricCard({
  label,
  value,
  unit,
  status,
  warning,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  status: string;
  warning: boolean;
  icon: ReactNode;
}) {
  return (
    <View
      style={[
        styles.metricCard,
        warning &&
          styles.warningCard,
      ]}
    >
      <View style={styles.metricHeader}>
        <Text style={styles.metricLabel}>
          {label}
        </Text>

        {icon}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.metricValue}>
          {value}
        </Text>

        <Text style={styles.metricUnit}>
          {unit}
        </Text>
      </View>

      <Text
        style={[
          styles.metricStatus,
          {
            color: warning
              ? '#D9534F'
              : '#2E7D6E',
          },
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

function ImuAxis({
  label,
  subtitle,
  value,
  hasData,
}: {
  label: string;
  subtitle: string;
  value: number;
  hasData: boolean;
}) {
  const warning =
    hasData &&
    Math.abs(value) > 2.5;

  return (
    <View style={styles.imuAxis}>
      <Text style={styles.imuAxisLabel}>
        {label}
      </Text>

      <Text style={styles.imuAxisSubtitle}>
        {subtitle}
      </Text>

      <Text
        style={[
          styles.imuAxisValue,
          warning && {
            color: '#D9534F',
          },
        ]}
      >
        {hasData
          ? `${value >= 0 ? '+' : ''}${value.toFixed(2)} g`
          : '--'}
      </Text>
    </View>
  );
}

type TimeFilter = 'day' | 'week' | 'month' | 'all';

type DayChartData = {
  dateStr: string;
  weekday: string;
  dayLabel: string;
  value: number;
  isToday: boolean;
  isFuture: boolean;
};

type WeekPeriod = {
  id: string;
  rangeLabel: string;
  days: DayChartData[];
  total: number;
  isCurrentWeek: boolean;
};

type MonthPeriod = {
  id: string;
  rangeLabel: string;
  days: DayChartData[];
  total: number;
  isCurrentMonth: boolean;
};

// 安全取得歷史資料涵蓋的最早日期與今天
function getEffectiveDateRange(
  firstActiveDateStr: string,
  dailyHistory: Record<string, DailyRecord>
): { startStr: string; endStr: string } {
  const todayStr = getTaiwanDateString();
  const dateKeys = Object.keys(dailyHistory).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
  let earliestStr = firstActiveDateStr || todayStr;
  if (dateKeys.length > 0) {
    dateKeys.sort();
    if (dateKeys[0] < earliestStr) {
      earliestStr = dateKeys[0];
    }
  }
  return { startStr: earliestStr, endStr: todayStr };
}

// 建立本地正午日期物件，避免跨日或時區偏移
function createLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date();
  dt.setFullYear(y, (m || 1) - 1, d || 1);
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function computeWeekPeriods(
  firstActiveDateStr: string,
  dailyHistory: Record<string, DailyRecord>
): WeekPeriod[] {
  const { startStr, endStr } = getEffectiveDateRange(firstActiveDateStr, dailyHistory);
  const todayStr = endStr;
  const todayDate = createLocalDate(todayStr);

  // 今天所在的週一
  const todayDow = (todayDate.getDay() + 6) % 7;
  const currentMonDate = new Date(todayDate.getTime() - todayDow * 24 * 60 * 60 * 1000);

  // 最早資料日期所在的週一
  const startDate = createLocalDate(startStr);
  const startDow = (startDate.getDay() + 6) % 7;
  const firstMonDate = new Date(startDate.getTime() - startDow * 24 * 60 * 60 * 1000);

  const periods: WeekPeriod[] = [];
  let iterDate = new Date(firstMonDate.getTime());
  let safety = 0;

  while (iterDate.getTime() <= currentMonDate.getTime() + 1000 && safety < 104) {
    safety++;
    const monStr = getTaiwanDateString(iterDate);
    const sunDate = new Date(iterDate.getTime() + 6 * 24 * 60 * 60 * 1000);
    const sunStr = getTaiwanDateString(sunDate);

    const days: DayChartData[] = [];
    let weekTotal = 0;
    const isCurrentWeek = monStr === getTaiwanDateString(currentMonDate);

    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(iterDate.getTime() + d * 24 * 60 * 60 * 1000);
      const dayStr = getTaiwanDateString(dayDate);
      const weekday = ['一', '二', '三', '四', '五', '六', '日'][d];
      const dayLabel = formatMonthDay(dayStr);
      const val = dailyHistory[dayStr]?.occurred || 0;
      const isToday = dayStr === todayStr;
      const isFuture = dayStr > todayStr;

      days.push({
        dateStr: dayStr,
        weekday,
        dayLabel,
        value: isFuture ? 0 : val,
        isToday,
        isFuture,
      });

      if (!isFuture) {
        weekTotal += val;
      }
    }

    const startMd = formatMonthDay(monStr);
    const endMd = formatMonthDay(sunStr);
    const rangeLabel = isCurrentWeek
      ? `${startMd} ~ ${endMd} (本週)`
      : `${startMd} ~ ${endMd}`;

    periods.push({
      id: monStr,
      rangeLabel,
      days,
      total: weekTotal,
      isCurrentWeek,
    });

    iterDate = new Date(iterDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return periods.length > 0
    ? periods
    : [
        {
          id: todayStr,
          rangeLabel: '本週',
          days: [
            {
              dateStr: todayStr,
              weekday: getWeekdayName(todayStr),
              dayLabel: formatMonthDay(todayStr),
              value: dailyHistory[todayStr]?.occurred || 0,
              isToday: true,
              isFuture: false,
            },
          ],
          total: dailyHistory[todayStr]?.occurred || 0,
          isCurrentWeek: true,
        },
      ];
}

function computeMonthPeriods(
  firstActiveDateStr: string,
  dailyHistory: Record<string, DailyRecord>
): MonthPeriod[] {
  const { startStr, endStr } = getEffectiveDateRange(firstActiveDateStr, dailyHistory);
  const todayStr = endStr;
  const todayDate = createLocalDate(todayStr);
  const startDate = createLocalDate(startStr);

  const diffDays = Math.max(
    0,
    Math.round((todayDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
  );
  const periodCount = Math.min(12, Math.max(1, Math.ceil((diffDays + 1) / 30)));

  const periods: MonthPeriod[] = [];

  for (let p = periodCount - 1; p >= 0; p--) {
    const endOffset = p * 30;
    const startOffset = endOffset + 29;

    const periodEndDate = new Date(todayDate.getTime() - endOffset * 24 * 60 * 60 * 1000);
    const periodStartDate = new Date(todayDate.getTime() - startOffset * 24 * 60 * 60 * 1000);

    const periodEndStr = getTaiwanDateString(periodEndDate);
    const periodStartStr = getTaiwanDateString(periodStartDate);

    const days: DayChartData[] = [];
    let monthTotal = 0;

    for (let d = 29; d >= 0; d--) {
      const dayDate = new Date(periodEndDate.getTime() - d * 24 * 60 * 60 * 1000);
      const dayStr = getTaiwanDateString(dayDate);
      const weekday = getWeekdayName(dayStr);
      const dayLabel = formatMonthDay(dayStr);
      const val = dailyHistory[dayStr]?.occurred || 0;
      const isToday = dayStr === todayStr;
      const isFuture = dayStr > todayStr;

      days.push({
        dateStr: dayStr,
        weekday,
        dayLabel,
        value: isFuture ? 0 : val,
        isToday,
        isFuture,
      });

      if (!isFuture) {
        monthTotal += val;
      }
    }

    const startMd = formatMonthDay(periodStartStr);
    const endMd = formatMonthDay(periodEndStr);
    const isCurrentMonth = p === 0;
    const rangeLabel = isCurrentMonth
      ? `${startMd} ~ ${endMd} (本月)`
      : `${startMd} ~ ${endMd}`;

    periods.push({
      id: `month_${periodStartStr}_${periodEndStr}`,
      rangeLabel,
      days,
      total: monthTotal,
      isCurrentMonth,
    });
  }

  return periods;
}

type TrendPoint = {
  id: string;
  label: string; // "第1週", "第2週", ..., "當週" 或 "第1月", "當月"
  subLabel: string; // "8/5", "8/12", etc.
  total: number; // 該週期總數
  avg: number; // 該週期平均每日摳抓次數 (如 4.2)
  isCurrent: boolean;
};

function computeWeeklyTrendPoints(
  firstActiveDateStr: string,
  dailyHistory: Record<string, DailyRecord>
): TrendPoint[] {
  const weekPeriods = computeWeekPeriods(firstActiveDateStr, dailyHistory);
  const totalWeeks = weekPeriods.length;

  return weekPeriods.map((wp, index) => {
    const isLast = index === totalWeeks - 1;
    // 最右邊、最新的一週強制顯示為「本週」，歷史週顯示為「第1週」、「第2週」...
    const label = isLast ? '本週' : `第${index + 1}週`;

    // 本週依據至今實際經過天數計算平均；歷史週以 7 天計算
    let activeDaysCount = 7;
    if (isLast) {
      const todayDate = getTaiwanDate();
      const todayDayOfWeek = (todayDate.getDay() + 6) % 7 + 1; // 週一為 1，週日為 7
      activeDaysCount = Math.max(1, todayDayOfWeek);
    }
    const avg = Number((wp.total / activeDaysCount).toFixed(1));
    const subLabel = wp.rangeLabel.split('~')[0].trim();

    return {
      id: wp.id,
      label,
      subLabel,
      total: wp.total,
      avg,
      isCurrent: isLast,
    };
  });
}

function computeMonthlyTrendPoints(
  firstActiveDateStr: string,
  dailyHistory: Record<string, DailyRecord>
): TrendPoint[] {
  const monthPeriods = computeMonthPeriods(firstActiveDateStr, dailyHistory);
  const totalMonths = monthPeriods.length;

  return monthPeriods.map((mp, index) => {
    const isLast = index === totalMonths - 1;
    // 最新的一月強制顯示為「本月」，歷史月顯示為「第1月」、「第2月」...
    const label = isLast ? '本月' : `第${index + 1}月`;
    const activeDays = isLast
      ? Math.min(30, Math.max(1, mp.days.filter((d) => !d.isFuture).length))
      : 30;
    const avg = Number((mp.total / activeDays).toFixed(1));
    const subLabel = mp.rangeLabel.split('~')[0].trim();

    return {
      id: mp.id,
      label,
      subLabel,
      total: mp.total,
      avg,
      isCurrent: isLast,
    };
  });
}

function WeekLineChartItem({
  period,
  isLast,
}: {
  period: WeekPeriod;
  isLast: boolean;
}) {
  const chartWidth = 310;
  const chartHeight = 175;
  const paddingLeft = 24;
  const paddingRight = 24;
  const paddingTop = 28;
  const paddingBottom = 42;

  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const maxVal = Math.max(6, ...period.days.map((d) => d.value));

  const points = period.days.map((d, i) => {
    const x = paddingLeft + i * (usableWidth / 6);
    const y = paddingTop + (1 - d.value / maxVal) * usableHeight;
    return {
      x,
      y,
      ...d,
    };
  });

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = (p0.x + p1.x) / 2;
    linePath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const bottomY = paddingTop + usableHeight;
  const areaPath = `${linePath} L ${points[6].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;
  const gradId = period.id.replace(/[^a-zA-Z0-9]/g, '_');

  return (
    <View style={[styles.weekChartCard, !isLast && { marginRight: 12 }]}>
      <View style={styles.weekChartHeader}>
        <View style={styles.weekRangeRow}>
          <Calendar size={12} color="#9B8AC1" />
          <Text style={styles.weekRangeText}>{period.rangeLabel}</Text>
        </View>
        <Text style={styles.weekTotalText}>週累計 {period.total} 次</Text>
      </View>

      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient
            id={`lineGrad_${gradId}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <Stop offset="0%" stopColor="#9B8AC1" />
            <Stop offset="50%" stopColor="#CAE7E0" />
            <Stop offset="100%" stopColor="#F5C0C0" />
          </SvgLinearGradient>

          <SvgLinearGradient
            id={`areaGrad_${gradId}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0%" stopColor="#CAE7E0" stopOpacity="0.45" />
            <Stop offset="70%" stopColor="#CAE7E0" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#CAE7E0" stopOpacity="0.00" />
          </SvgLinearGradient>
        </Defs>

        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + ratio * usableHeight;
          return (
            <Line
              key={idx}
              x1={paddingLeft - 4}
              y1={y}
              x2={chartWidth - paddingRight + 4}
              y2={y}
              stroke="rgba(200, 190, 180, 0.35)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        <Path
          d={areaPath}
          fill={`url(#areaGrad_${gradId})`}
        />

        <Path
          d={linePath}
          stroke={`url(#lineGrad_${gradId})`}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />

        {points.map((p, idx) => (
          <React.Fragment key={idx}>
            <Line
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={bottomY}
              stroke={
                p.isToday
                  ? 'rgba(155, 138, 193, 0.45)'
                  : 'rgba(200, 190, 180, 0.25)'
              }
              strokeDasharray="2 3"
              strokeWidth="1"
            />

            <Circle
              cx={p.x}
              cy={p.y}
              r={p.isToday ? 7 : 5}
              fill={
                p.isToday
                  ? 'rgba(155, 138, 193, 0.35)'
                  : 'rgba(202, 231, 224, 0.4)'
              }
            />

            <Circle
              cx={p.x}
              cy={p.y}
              r={p.isToday ? 4 : 3}
              fill={p.isToday ? '#9B8AC1' : '#FFFFFF'}
              stroke={p.isToday ? '#ffffff' : '#9B8AC1'}
              strokeWidth={p.isToday ? 2 : 1.5}
            />

            {(p.value > 0 || p.isToday) && (
              <SvgText
                x={p.x}
                y={p.y - 8}
                fill={p.isToday ? '#9B8AC1' : '#333333'}
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {p.value}
              </SvgText>
            )}

            <SvgText
              x={p.x}
              y={chartHeight - 19}
              fill={p.isToday ? '#9B8AC1' : '#5A5A5A'}
              fontSize="10.5"
              fontWeight={p.isToday ? '800' : '600'}
              textAnchor="middle"
            >
              {p.weekday}
            </SvgText>

            <SvgText
              x={p.x}
              y={chartHeight - 7}
              fill={p.isToday ? '#9B8AC1' : '#7E7889'}
              fontSize="9"
              fontWeight={p.isToday ? '700' : '500'}
              textAnchor="middle"
            >
              {p.dayLabel}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

function TrendLineChart({
  points,
  title,
  unitLabel,
}: {
  points: TrendPoint[];
  title: string;
  unitLabel: string;
}) {
  const minWidth = 310;
  const pointSpacing = 58;
  const paddingLeft = 32;
  const paddingRight = 32;

  const totalPoints = Math.max(1, points.length);
  const chartWidth =
    totalPoints === 1
      ? minWidth
      : Math.max(minWidth, paddingLeft + paddingRight + (totalPoints - 1) * pointSpacing);

  const chartHeight = 175;
  const paddingTop = 28;
  const paddingBottom = 42;

  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const maxVal = Math.max(5, ...points.map((p) => p.avg));

  const coords = points.map((p, i) => {
    const x =
      totalPoints === 1
        ? chartWidth / 2
        : paddingLeft + i * (usableWidth / (totalPoints - 1));
    const y = paddingTop + (1 - p.avg / maxVal) * usableHeight;
    return {
      x,
      y,
      ...p,
    };
  });

  let linePath = `M ${coords[0].x} ${coords[0].y}`;
  if (coords.length > 1) {
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      linePath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const bottomY = paddingTop + usableHeight;
  const lastX = coords[coords.length - 1].x;
  const firstX = coords[0].x;
  const areaPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  const gradId = title.replace(/[^a-zA-Z0-9]/g, '_');

  return (
    <View style={[styles.trendChartWrapper, { width: chartWidth }]}>
      <View style={styles.weekChartHeader}>
        <View style={styles.weekRangeRow}>
          <Calendar size={12} color="#9B8AC1" />
          <Text style={styles.weekRangeText}>{title}</Text>
        </View>
        <Text style={styles.weekTotalText}>{unitLabel}</Text>
      </View>

      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient
            id={`lineGrad_${gradId}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <Stop offset="0%" stopColor="#9B8AC1" />
            <Stop offset="50%" stopColor="#CAE7E0" />
            <Stop offset="100%" stopColor="#F5C0C0" />
          </SvgLinearGradient>

          <SvgLinearGradient
            id={`areaGrad_${gradId}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0%" stopColor="#CAE7E0" stopOpacity="0.45" />
            <Stop offset="70%" stopColor="#CAE7E0" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#CAE7E0" stopOpacity="0.00" />
          </SvgLinearGradient>
        </Defs>

        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + ratio * usableHeight;
          return (
            <Line
              key={idx}
              x1={paddingLeft - 4}
              y1={y}
              x2={chartWidth - paddingRight + 4}
              y2={y}
              stroke="rgba(200, 190, 180, 0.35)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {coords.length > 1 && (
          <Path d={areaPath} fill={`url(#areaGrad_${gradId})`} />
        )}

        {coords.length > 1 && (
          <Path
            d={linePath}
            stroke={`url(#lineGrad_${gradId})`}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
        )}

        {coords.map((p, idx) => (
          <React.Fragment key={idx}>
            <Line
              x1={p.x}
              y1={p.y}
              x2={p.x}
              y2={bottomY}
              stroke={
                p.isCurrent
                  ? 'rgba(155, 138, 193, 0.45)'
                  : 'rgba(200, 190, 180, 0.25)'
              }
              strokeDasharray="2 3"
              strokeWidth="1"
            />

            <Circle
              cx={p.x}
              cy={p.y}
              r={p.isCurrent ? 7 : 5}
              fill={
                p.isCurrent
                  ? 'rgba(155, 138, 193, 0.35)'
                  : 'rgba(202, 231, 224, 0.4)'
              }
            />

            <Circle
              cx={p.x}
              cy={p.y}
              r={p.isCurrent ? 4 : 3}
              fill={p.isCurrent ? '#9B8AC1' : '#FFFFFF'}
              stroke={p.isCurrent ? '#ffffff' : '#9B8AC1'}
              strokeWidth={p.isCurrent ? 2 : 1.5}
            />

            {/* Y 軸上方數據（帶入每週/每月平均次數） */}
            <SvgText
              x={p.x}
              y={p.y - 8}
              fill={p.isCurrent ? '#9B8AC1' : '#333333'}
              fontSize="10.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {p.avg}
            </SvgText>

            {/* X 軸標籤：第1週/第2週/本週 或 第1月/本月 */}
            <SvgText
              x={p.x}
              y={chartHeight - 19}
              fill={p.isCurrent ? '#9B8AC1' : '#5A5A5A'}
              fontSize="11"
              fontWeight={p.isCurrent ? '800' : '600'}
              textAnchor="middle"
            >
              {p.label}
            </SvgText>

            {/* X 軸副標籤：日期區間 */}
            <SvgText
              x={p.x}
              y={chartHeight - 7}
              fill={p.isCurrent ? '#9B8AC1' : '#7E7889'}
              fontSize="9"
              fontWeight={p.isCurrent ? '700' : '500'}
              textAnchor="middle"
            >
              {p.subLabel}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

function StatisticsContent() {
  const {
    profile,
    behaviorStats,
    dailyHistory,
    firstActiveDate,
    todayRecord,
  } = useUser();

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('day');
  const chartScrollRef = useRef<ScrollView | null>(null);

  // 取得使用者複選的行為列表與合併標題
  const selectedTypes = useMemo(() => getProfileTypes(profile), [profile]);
  const selectedTypesTitle = useMemo(() => selectedTypes.join('、'), [selectedTypes]);

  // 合併計算所有複選行為的累積次數與今日次數
  const aggregatedBehaviorStats = useMemo(() => {
    let totalCount = 0;
    let todayTotalCount = 0;
    const items = selectedTypes.map((type) => {
      const stat = behaviorStats[type] || defaultBehaviorStats[type] || {
        type,
        title: `${type}行為`,
        icon:
          type === '拔毛髮'
            ? '💇'
            : type === '咬指甲'
            ? '🦷'
            : type === '其他'
            ? '✨'
            : '🖐️',
        description: '高發情境：任務瓶頸焦慮、缺乏刺激時。',
        count: 0,
        todayCount: 0,
      };
      totalCount += stat.count || 0;
      todayTotalCount += stat.todayCount || 0;
      return stat;
    });

    return {
      items,
      totalCount,
      todayTotalCount: todayRecord.occurred ?? todayTotalCount,
    };
  }, [selectedTypes, behaviorStats, todayRecord.occurred]);

  const todayStr = getTaiwanDateString();
  const todayDate = getTaiwanDate();

  // 計算日、週、月、全部的累積數據
  const { filterOccurred, filterRestrained } = useMemo(() => {
    if (timeFilter === 'day') {
      const rec = dailyHistory[todayStr] || todayRecord;
      return {
        filterOccurred: rec.occurred ?? 0,
        filterRestrained: rec.restrained ?? 0,
      };
    }

    if (timeFilter === 'week') {
      let occ = 0;
      let res = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(todayDate.getTime() - i * 24 * 60 * 60 * 1000);
        const dStr = getTaiwanDateString(d);
        const rec = dailyHistory[dStr];
        if (rec) {
          occ += rec.occurred || 0;
          res += rec.restrained || 0;
        }
      }
      return { filterOccurred: occ, filterRestrained: res };
    }

    if (timeFilter === 'month') {
      let occ = 0;
      let res = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(todayDate.getTime() - i * 24 * 60 * 60 * 1000);
        const dStr = getTaiwanDateString(d);
        const rec = dailyHistory[dStr];
        if (rec) {
          occ += rec.occurred || 0;
          res += rec.restrained || 0;
        }
      }
      return { filterOccurred: occ, filterRestrained: res };
    }

    // 'all'
    let occ = 0;
    let res = 0;
    Object.values(dailyHistory).forEach((rec) => {
      occ += rec.occurred || 0;
      res += rec.restrained || 0;
    });
    occ = Math.max(occ, aggregatedBehaviorStats.totalCount || 0);
    return { filterOccurred: occ, filterRestrained: res };
  }, [timeFilter, dailyHistory, todayStr, todayDate, todayRecord, aggregatedBehaviorStats.totalCount]);

  // 動態描述文字：依照日、週、月、全部動態填入累積與平均次數 (連動複選行為類型)
  const dynamicDescriptionText = useMemo(() => {
    if (timeFilter === 'day') {
      return `BFRB行為紀錄：${selectedTypesTitle}累計 ${filterOccurred} 次，平均每日 ${filterOccurred} 次。`;
    }
    if (timeFilter === 'week') {
      return `BFRB行為紀錄：${selectedTypesTitle}累計 ${filterOccurred} 次，平均每週 ${filterOccurred} 次。`;
    }
    if (timeFilter === 'month') {
      return `BFRB行為紀錄：${selectedTypesTitle}累計 ${filterOccurred} 次，平均每月 ${filterOccurred} 次。`;
    }
    // 'all'
    const [fy, fm, fd] = (firstActiveDate || todayStr).split('-').map(Number);
    const firstDate = new Date(Date.UTC(fy, (fm || 1) - 1, fd || 1));
    const totalDays = Math.max(
      1,
      Math.round((todayDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    const avgDailyAll = (filterOccurred / totalDays).toFixed(1);
    return `BFRB行為紀錄：${selectedTypesTitle}累計 ${filterOccurred} 次，平均每日 ${avgDailyAll} 次。`;
  }, [timeFilter, selectedTypesTitle, filterOccurred, firstActiveDate, todayDate, todayStr]);

  // 計算週週期資料（供「日」模式平滑折線圖滑動，顯示每日累計次數）
  const weekPeriods = useMemo(() => {
    return computeWeekPeriods(firstActiveDate, dailyHistory);
  }, [firstActiveDate, dailyHistory]);

  // 計算跨週趨勢點（供「週」模式折線圖，顯示歷史週次與每週平均次數）
  const weeklyTrendPoints = useMemo(() => {
    return computeWeeklyTrendPoints(firstActiveDate, dailyHistory);
  }, [firstActiveDate, dailyHistory]);

  // 計算跨月趨勢點（供「月」模式折線圖，顯示歷史月份與每月平均次數）
  const monthlyTrendPoints = useMemo(() => {
    return computeMonthlyTrendPoints(firstActiveDate, dailyHistory);
  }, [firstActiveDate, dailyHistory]);

  // 圖表在初次載入、篩選切換與數據更新時，自動滑動至最右側（當前最新週期）
  useEffect(() => {
    const timer = setTimeout(() => {
      chartScrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, [weekPeriods.length, weeklyTrendPoints.length, monthlyTrendPoints.length, timeFilter]);

  return (
    <View style={styles.statisticsContainer}>
      {/* 1. 頂部時間篩選器與動態文字 */}
      <View style={styles.filterSection}>
        {/* 四個水平排列篩選按鈕 */}
        <View style={styles.filterBar}>
          {(['day', 'week', 'month', 'all'] as const).map((filterKey) => {
            const labels: Record<TimeFilter, string> = {
              day: '日',
              week: '週',
              month: '月',
              all: '全部',
            };
            const isSelected = timeFilter === filterKey;
            return (
              <Pressable
                key={filterKey}
                onPress={() => setTimeFilter(filterKey)}
                style={styles.filterButton}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    isSelected && styles.filterButtonTextActive,
                  ]}
                >
                  {labels[filterKey]}
                </Text>
                {/* 選中時的底線標示 */}
                <View
                  style={[
                    styles.filterIndicator,
                    isSelected && styles.filterIndicatorActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {/* 動態文字描述區塊 */}
        <View style={styles.dynamicHeaderBlock}>
          <Text style={styles.historyFormattedTitle}>
            {dynamicDescriptionText}
          </Text>
          <View style={styles.dbBadge}>
            <Database size={10} color="#2E7D6E" />
            <Text style={styles.dbBadgeText}>GMT+8 連線</Text>
          </View>
        </View>
      </View>

      {/* 2. 頂部兩個並排圓角卡片：「已發生」、「已克制」 */}
      <View style={styles.twoCardsRow}>
        {/* 卡片一：已發生 */}
        <View style={[styles.statOverviewCard, styles.occurredBorder]}>
          <View style={styles.statOverviewIconRow}>
            <View
              style={[
                styles.statIconBadge,
                { backgroundColor: 'rgba(245, 192, 192, 0.45)' },
              ]}
            >
              <Zap size={14} color="#D9534F" />
            </View>
            <Text style={styles.statOverviewLabel}>已發生</Text>
          </View>
          <View style={styles.statOverviewValueRow}>
            <Text
              style={[styles.statOverviewNumber, { color: '#D9534F' }]}
            >
              {filterOccurred}
            </Text>
            <Text style={styles.statOverviewUnit}>次</Text>
          </View>
          <Text style={styles.statOverviewSub}>感測觸發紀錄</Text>
        </View>

        {/* 卡片二：已克制 */}
        <View style={[styles.statOverviewCard, styles.restrainedBorder]}>
          <View style={styles.statOverviewIconRow}>
            <View
              style={[
                styles.statIconBadge,
                { backgroundColor: 'rgba(202, 231, 224, 0.45)' },
              ]}
            >
              <ShieldCheck size={14} color="#2E7D6E" />
            </View>
            <Text style={styles.statOverviewLabel}>已克制</Text>
          </View>
          <View style={styles.statOverviewValueRow}>
            <Text
              style={[styles.statOverviewNumber, { color: '#2E7D6E' }]}
            >
              {filterRestrained}
            </Text>
            <Text style={styles.statOverviewUnit}>次</Text>
          </View>
          <Text style={styles.statOverviewSub}>及時暫停中斷</Text>
        </View>
      </View>

      {/* 3. 支援歷史滑動的動態折線圖 (Line Chart) - 當選擇「全部」時完全隱藏 */}
      {timeFilter !== 'all' && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View>
              <Text style={styles.chartTitle}>
                {timeFilter === 'day'
                  ? '每日事件次數趨勢'
                  : timeFilter === 'week'
                  ? '每週事件次數趨勢'
                  : '每月事件次數趨勢'}
              </Text>
              <Text style={styles.chartSubtitle}>
                {timeFilter === 'day'
                  ? '橫向滑動可追溯歷史日數據 · 顯示每日累計摳抓次數'
                  : timeFilter === 'week'
                  ? '橫向滑動可追溯歷史週次 · 顯示每週平均摳抓次數'
                  : '橫向滑動可追溯歷史月份 · 顯示每月平均摳抓次數'}
              </Text>
            </View>
            <View style={styles.swipeHintBadge}>
              <TrendingUp size={11} color="#9B8AC1" />
              <Text style={styles.swipeHintText}>
                {timeFilter === 'day'
                  ? '每日趨勢'
                  : timeFilter === 'week'
                  ? '每週趨勢'
                  : '每月趨勢'}
              </Text>
            </View>
          </View>

          {/* 水平滑動的週/月/日折線圖群組 */}
          <ScrollView
            ref={chartScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartScrollContent}
            onContentSizeChange={() => {
              chartScrollRef.current?.scrollToEnd({ animated: false });
            }}
          >
            {timeFilter === 'day' ? (
              weekPeriods.map((period, idx) => (
                <WeekLineChartItem
                  key={period.id}
                  period={period}
                  isLast={idx === weekPeriods.length - 1}
                />
              ))
            ) : timeFilter === 'week' ? (
              <TrendLineChart
                points={weeklyTrendPoints}
                title="歷史每週趨勢"
                unitLabel="每週平均摳抓次數"
              />
            ) : (
              <TrendLineChart
                points={monthlyTrendPoints}
                title="歷史每月趨勢"
                unitLabel="每月平均摳抓次數"
              />
            )}
          </ScrollView>
        </View>
      )}

      {/* 4. 複選行為整合詳細資訊卡片 (把複選行為放在一起，一起統計) */}
      <View style={styles.integratedCard}>
        <View style={styles.integratedCardHeader}>
          <View style={styles.integratedEmojiGroup}>
            {aggregatedBehaviorStats.items.map((it) => (
              <View key={it.type} style={styles.emojiCircle}>
                <Text style={styles.emojiText}>
                  {it.icon ||
                    (it.type === '拔毛髮'
                      ? '💇'
                      : it.type === '咬指甲'
                      ? '🦷'
                      : it.type === '其他'
                      ? '✨'
                      : '🖐️')}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.integratedContent}>
            <View style={styles.integratedTitleRow}>
              <Text style={styles.integratedTitle}>
                {selectedTypesTitle} 行為統計
              </Text>
              <View style={styles.activeTagBadge}>
                <ShieldCheck size={11} color="#2E7D6E" />
                <Text style={styles.activeTagText}>
                  {selectedTypes.length > 1 ? `已整合 ${selectedTypes.length} 種` : '已選行為'}
                </Text>
              </View>
            </View>

            <Text style={styles.integratedDescription}>
              {selectedTypes.length > 1
                ? `已將您複選的行為（${selectedTypesTitle}）合併彙整統計。`
                : `${aggregatedBehaviorStats.items[0]?.description || '高發情境：任務瓶頸焦慮、缺乏刺激時。'}`}
            </Text>
          </View>

          <View style={styles.integratedCountCol}>
            <Text style={styles.integratedCountTotal}>
              累計 {aggregatedBehaviorStats.totalCount} 次
            </Text>
            <Text style={styles.integratedCountToday}>
              今日 {aggregatedBehaviorStats.todayTotalCount} 次
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function InformationRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.informationRow}>
      <Text style={styles.informationLabel}>
        {label}
      </Text>

      <Text style={styles.informationValue}>
        {value}
      </Text>
    </View>
  );
}

function getConnectionText(
  status: string,
  deviceConnected:
    | boolean
    | undefined,
  hasData: boolean
) {
  if (status === 'connecting') {
    return '連線中';
  }

  if (status !== 'connected') {
    return '伺服器中斷';
  }

  if (!hasData) {
    return '等待資料';
  }

  if (!deviceConnected) {
    return '裝置已斷線';
  }

  return '監測中';
}

function getStressPresentation(
  hasData: boolean,
  isStressed: boolean,
  score: number
) {
  if (!hasData) {
    return {
      label: '等待資料',
      color: 'rgba(255, 255, 255, 0.75)',
      textColor: '#7E7889',
    };
  }

  if (isStressed || score > 75) {
    return {
      label: '狀態：高壓警戒',
      color: 'rgba(245, 192, 192, 0.65)',
      textColor: '#D9534F',
    };
  }

  if (score > 40) {
    return {
      label: '狀態：輕度緊繃',
      color: 'rgba(253, 242, 184, 0.75)',
      textColor: '#8C6B14',
    };
  }

  return {
    label: '狀態：平靜放鬆',
    color: 'rgba(202, 231, 224, 0.75)',
    textColor: '#2E7D6E',
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDE5F8',
  },

  gradientBg: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
  },

  topNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(155, 138, 193, 0.18)',
  },

  navigationTitle: {
    color: '#1A2151',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  navigationSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },

  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },

  roundIconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#CDE1F8',
    shadowColor: '#A8C9EF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
  },

  avatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },

  avatarText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  profileInformation: {
    flex: 1,
    marginLeft: 12,
  },

  profileName: {
    color: '#1A2151',
    fontSize: 15,
    fontWeight: '800',
  },

  profileDescription: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },

  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 12,
  },

  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },

  connectionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  tabs: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(201, 173, 240, 0.35)',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },

  tabButton: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },

  tabButtonActive: {
    backgroundColor: '#c9adf0',
    shadowColor: '#c9adf0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },

  tabText: {
    color: '#6B6675',
    fontSize: 13,
    fontWeight: '600',
  },

  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  thresholdBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 110, 0.25)',
    borderRadius: 14,
    backgroundColor: 'rgba(202, 231, 224, 0.45)',
  },

  thresholdIcon: {
    marginRight: 7,
    fontSize: 13,
  },

  thresholdText: {
    flex: 1,
    color: '#2E7D6E',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },

  stressCard: {
    alignItems: 'center',
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },

  sectionLabel: {
    alignSelf: 'flex-start',
    color: '#5A5A5A',
    fontSize: 12,
    fontWeight: '700',
  },

  gaugeContainer: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },

  gaugeContent: {
    position: 'absolute',
    alignItems: 'center',
  },

  stressScore: {
    color: '#1A2151',
    fontSize: 36,
    fontWeight: '800',
  },

  stressScoreLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },

  stressStatus: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },

  stressStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },

  metricCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },

  largeMetricCard: {
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },

  warningCard: {
    borderColor: 'rgba(245, 192, 192, 0.85)',
    backgroundColor: 'rgba(245, 192, 192, 0.25)',
  },

  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  metricLabel: {
    color: '#5A5A5A',
    fontSize: 12,
    fontWeight: '700',
  },

  metricSubLabel: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },

  metricDescription: {
    color: '#64748B',
    fontSize: 9.5,
    marginTop: 3,
  },

  motorCard: {
    padding: 15,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },

  motorCardActive: {
    borderColor: 'rgba(245, 192, 192, 0.9)',
    backgroundColor: 'rgba(245, 192, 192, 0.35)',
  },

  motorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },

  motorCardTitle: {
    color: '#5A5A5A',
    fontSize: 13,
    fontWeight: '700',
  },

  motorCardTitleActive: {
    color: '#D9534F',
  },

  motorCardSub: {
    color: '#64748B',
    fontSize: 10.5,
    lineHeight: 15,
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },

  metricValue: {
    color: '#1A2151',
    fontSize: 24,
    fontWeight: '800',
  },

  largeMetricValue: {
    color: '#1A2151',
    fontSize: 24,
    fontWeight: '800',
  },

  metricUnit: {
    color: '#64748B',
    fontSize: 11,
    marginLeft: 5,
    fontWeight: '600',
  },

  metricStatus: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },

  forceTrack: {
    height: 7,
    marginTop: 10,
    overflow: 'hidden',
    borderRadius: 3.5,
    backgroundColor: 'rgba(205, 225, 248, 0.45)',
  },

  forceFill: {
    height: '100%',
    borderRadius: 3.5,
  },

  imuCard: {
    padding: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },

  imuGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  imuAxis: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  imuAxisLabel: {
    color: '#5A5A5A',
    fontSize: 10.5,
    fontWeight: '700',
  },

  imuAxisSubtitle: {
    color: '#64748B',
    fontSize: 8.5,
    marginTop: 2,
  },

  imuAxisValue: {
    color: '#1A2151',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },

  warningMessage: {
    color: '#D9534F',
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 9,
  },

  deviceInformation: {
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },

  informationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },

  informationLabel: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '600',
  },

  informationValue: {
    maxWidth: '65%',
    color: '#1A2151',
    fontSize: 11,
    fontWeight: '700',
  },

  statisticsContainer: {
    gap: 12,
  },

  historyCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },

  historyHeaderBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },

  historyFormattedTitle: {
    flex: 1,
    color: '#1A2151',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },

  dbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(202, 231, 224, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 110, 0.3)',
  },

  dbBadgeText: {
    color: '#2E7D6E',
    fontSize: 9.5,
    fontWeight: '700',
  },

  singleBehaviorItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    padding: 14,
  },

  singleBehaviorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  singleBehaviorIcon: {
    fontSize: 26,
    marginRight: 12,
  },

  singleBehaviorContent: {
    flex: 1,
  },

  singleBehaviorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  singleBehaviorName: {
    color: '#1A2151',
    fontSize: 13.5,
    fontWeight: '800',
  },

  activeTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(202, 231, 224, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 110, 0.3)',
  },

  activeTagText: {
    color: '#2E7D6E',
    fontSize: 9,
    fontWeight: '700',
  },

  singleBehaviorDescription: {
    color: '#5A5A5A',
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 4,
  },

  singleBehaviorCountCol: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },

  singleBehaviorCount: {
    color: '#2E7D6E',
    fontSize: 13.5,
    fontWeight: '800',
  },

  singleBehaviorToday: {
    color: '#64748B',
    fontSize: 9.5,
    marginTop: 3,
  },

  // 1. 時間篩選器與動態文字樣式
  filterSection: {
    marginBottom: 14,
  },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(201, 173, 240, 0.35)',
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  filterButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },

  filterButtonText: {
    color: '#6B6675',
    fontSize: 13,
    fontWeight: '600',
  },

  filterButtonTextActive: {
    color: '#c9adf0',
    fontWeight: '800',
  },

  filterIndicator: {
    width: 22,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 4,
  },

  filterIndicatorActive: {
    backgroundColor: '#c9adf0',
    shadowColor: '#c9adf0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },

  dynamicHeaderBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 2,
  },

  // 2. 頂部兩張並排圓角卡片樣式
  twoCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },

  statOverviewCard: {
    flex: 1,
    padding: 15,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },

  occurredBorder: {
    borderColor: 'rgba(245, 192, 192, 0.85)',
  },

  restrainedBorder: {
    borderColor: 'rgba(202, 231, 224, 0.85)',
  },

  statOverviewIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },

  statIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statOverviewLabel: {
    color: '#5A5A5A',
    fontSize: 10.5,
    fontWeight: '700',
  },

  statOverviewValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginBottom: 4,
  },

  statOverviewNumber: {
    fontSize: 24,
    fontWeight: '800',
  },

  statOverviewUnit: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
  },

  statOverviewSub: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '500',
  },

  // 3. 支援歷史滑動的週折線圖樣式
  chartCard: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },

  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },

  chartTitle: {
    color: '#1A2151',
    fontSize: 13,
    fontWeight: '700',
  },

  chartSubtitle: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },

  swipeHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(155, 138, 193, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(155, 138, 193, 0.25)',
  },

  swipeHintText: {
    color: '#9B8AC1',
    fontSize: 9.5,
    fontWeight: '700',
  },

  chartScrollContent: {
    paddingVertical: 2,
    paddingRight: 4,
  },

  trendChartWrapper: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },

  weekChartCard: {
    width: 310,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },

  weekChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 6,
  },

  weekRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  weekRangeText: {
    color: '#9B8AC1',
    fontSize: 11,
    fontWeight: '700',
  },

  weekTotalText: {
    color: '#5A5A5A',
    fontSize: 10.5,
    fontWeight: '600',
  },

  // 4. 複選行為整合統計卡片樣式
  integratedCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(202, 231, 224, 0.85)',
    marginBottom: 16,
    shadowColor: '#84719D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },

  integratedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  integratedEmojiGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -6,
  },

  emojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(202, 231, 224, 0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(46, 125, 110, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emojiText: {
    fontSize: 18,
  },

  integratedContent: {
    flex: 1,
  },

  integratedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 4,
  },

  integratedTitle: {
    color: '#1A2151',
    fontSize: 13.5,
    fontWeight: '800',
  },

  integratedDescription: {
    color: '#5A5A5A',
    fontSize: 10.5,
    lineHeight: 14,
  },

  integratedCountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  integratedCountTotal: {
    color: '#1A2151',
    fontSize: 13.5,
    fontWeight: '800',
  },

  integratedCountToday: {
    color: '#9B8AC1',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  breakdownContainer: {
    marginTop: 12,
  },

  breakdownDivider: {
    height: 1,
    backgroundColor: 'rgba(226, 232, 240, 0.7)',
    marginBottom: 10,
  },

  breakdownList: {
    gap: 8,
  },

  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },

  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  breakdownItemEmoji: {
    fontSize: 14,
  },

  breakdownItemName: {
    color: '#1A2151',
    fontSize: 12,
    fontWeight: '700',
  },

  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  breakdownItemCount: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '600',
  },

  breakdownItemToday: {
    color: '#2E7D6E',
    fontSize: 11,
    fontWeight: '700',
  },

  // 舒壓與解壓互動選單 Modal 樣式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 20, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 15,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  modalIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#CDE1F8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A2151',
    letterSpacing: 0.3,
  },

  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(155, 138, 193, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 18,
    lineHeight: 18,
    fontWeight: '500',
  },

  modalOptionsContainer: {
    gap: 12,
  },

  optionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 110, 0.25)',
    backgroundColor: '#d9faee',
    shadowColor: '#2E7D6E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  optionCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },

  optionPureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: '#d9faee',
  },

  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },

  optionContent: {
    flex: 1,
  },

  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A2151',
  },

  badgeGuide: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  badgeGuideText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2E7D6E',
  },

  badgeGame: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  badgeGameText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2E7D6E',
  },

  badgeTreehole: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  badgeTreeholeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2E7D6E',
  },

  optionDesc: {
    fontSize: 11,
    color: '#2A5248',
    lineHeight: 15,
    fontWeight: '500',
  },
});