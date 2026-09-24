import { router, type Href } from 'expo-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
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
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';

import {
  Activity,
  BarChart2,
  Compass,
  Droplet,
  Flower2,
  Heart,
  Settings,
  Zap,
} from 'lucide-react-native';

import { useSensor } from '../contexts/SensorContext';
import { AuraColors } from '../constants/auraTheme';
import { useAlert } from '../contexts/AlertContext';

type DashboardTab = 'realtime' | 'statistics';

const GAUGE_RADIUS = 60;
const GAUGE_CIRCUMFERENCE =
  2 * Math.PI * GAUGE_RADIUS;

export default function DashboardScreen() {
  const { isPicking, ignoredCurrentEvent } = useAlert();
  const [activeTab, setActiveTab] =
    useState<DashboardTab>('realtime');

  const {
    status,
    sensorData,
    lastMessageAt,
  } = useSensor();

  const hasData = sensorData !== null;

  const heartRate =
    sensorData?.heartRate ?? 0;

  const spo2 =
    sensorData?.spo2 ?? 0;

  const distance = sensorData?.distance ?? 9999;
  const angularVelocity = sensorData?.angularVelocity ?? 0;
  const motorStatus = sensorData?.motorStatus ?? false;
  const squeezeForceN = 0;
  const imuX = 0;
  const imuY = 0;
  const imuZ = 1;
  const battery = 100;

  // 壓力狀態：目前只用現有的生理資料「心率」做簡化模擬。
  // 按壓力道與 IMU 不再直接算進心理壓力。
  const isStressed =
    hasData &&
    heartRate > 85;

  // 模擬壓力指數：目前依心率估算。
  // 60 BPM 附近偏低，100 BPM 附近接近高壓。
  const stressScore = useMemo(() => {
    if (!hasData) {
      return 0;
    }
  
    const heartRatePart =
      ((heartRate - 60) / 40) * 100;

    return Math.min(
      100,
      Math.max(
        12,
        Math.round(heartRatePart)
      )
    );
  }, [
    hasData,
    heartRate,
  ]);

  const forcePercent = Math.min(
    100,
    Math.max(
      0,
      (squeezeForceN / 20) * 100
    )
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
      ? AuraColors.normal
      : status === 'connecting'
        ? AuraColors.caution
        : AuraColors.warning;

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
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
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
              onPress={() => 
                router.push('/relax' as Href)}
            >
              <Flower2
                size={16}
                color="#c084fc"
              />
            </RoundIconButton>

            <RoundIconButton
              onPress={() => 
                router.push('/settings' as Href)}
            >
              <Settings
                size={16}
                color={AuraColors.white}
              />
            </RoundIconButton>
          </View>
        </View>

        <View style={styles.profileHeader}>
          <LinearGradient
            colors={[
              AuraColors.purple,
              AuraColors.pink,
            ]}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              宇
            </Text>
          </LinearGradient>

          <View style={styles.profileInformation}>
            <Text style={styles.profileName}>
              宇航
            </Text>

            <Text style={styles.profileDescription}>
              21 歲 · 男性
            </Text>
          </View>

          <View
            style={[
              styles.connectionBadge,
              {
                backgroundColor:
                  `${connectionColor}18`,
                borderColor:
                  `${connectionColor}45`,
              },
            ]}
          >
            <View
              style={[
                styles.connectionDot,
                {
                  backgroundColor:
                    connectionColor,
                },
              ]}
            />

            <Text
              style={[
                styles.connectionBadgeText,
                {
                  color: connectionColor,
                },
              ]}
            >
              {connectionText}
            </Text>
          </View>
        </View>

        <View style={styles.tabs}>
          <DashboardTabButton
            active={
              activeTab === 'realtime'
            }
            icon={
              <Activity size={14} />
            }
            label="即時數據"
            onPress={() =>
              setActiveTab('realtime')
            }
          />

          <DashboardTabButton
            active={
              activeTab === 'statistics'
            }
            icon={
              <BarChart2 size={14} />
            }
            label="統計分析"
            onPress={() =>
              setActiveTab('statistics')
            }
          />
        </View>

        {activeTab === 'realtime' ? (
          <View>
            <View style={styles.thresholdBanner}>
              <Text style={styles.thresholdIcon}>
                💡
              </Text>

              <Text style={styles.thresholdText}>
                壓力警示：心率 ＞ 85 BPM。
                疑似摳抓：手指施力 ＞ 7 N，
                且 IMU 加速度 ＞ 2.5 g
              </Text>
            </View>

            <View style={styles.stressCard}>
              <Text style={styles.sectionLabel}>
                即時壓力指數
              </Text>

              <View style={styles.gaugeContainer}>
                <Svg
                  width={150}
                  height={150}
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
                        stopColor={
                          AuraColors.cyan
                        }
                      />

                      <Stop
                        offset="100%"
                        stopColor={
                          AuraColors.purple
                        }
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
                        stopColor={
                          AuraColors.warning
                        }
                      />

                      <Stop
                        offset="100%"
                        stopColor={
                          AuraColors.pink
                        }
                      />
                    </SvgLinearGradient>
                  </Defs>

                  <Circle
                    cx="70"
                    cy="70"
                    r={GAUGE_RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.04)"
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
                <Text style={styles.stressStatusText}>
                  {stressPresentation.label}
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              <MetricCard
                label="心率"
                value={
                  hasData
                    ? String(heartRate)
                    : '--'
                }
                unit="BPM"
                status={
                  !hasData
                    ? '等待資料'
                    : heartRate > 85
                      ? '偏高／緊繃'
                      : '平穩'
                }
                warning={
                  hasData &&
                  heartRate > 85
                }
                icon={
                  <Heart
                    size={16}
                    color={
                      heartRate > 85
                        ? AuraColors.warning
                        : AuraColors.cyan
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
                    color={AuraColors.cyan}
                  />
                }
              />
            </View>

            <View
              style={[
                styles.largeMetricCard,
                isPicking &&
                  styles.warningCard,
              ]}
            >
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>
                  手指施力
                </Text>

                <Zap
                  size={16}
                  color={AuraColors.caution}
                />
              </View>

              <View style={styles.valueRow}>
                <Text style={styles.largeMetricValue}>
                  {hasData
                    ? squeezeForceN.toFixed(1)
                    : '--'}
                </Text>

                <Text style={styles.metricUnit}>
                  N
                </Text>
              </View>

              <View style={styles.forceTrack}>
                <LinearGradient
                  colors={
                    isPicking
                      ? [
                          AuraColors.warning,
                          AuraColors.pink,
                        ]
                      : [
                          AuraColors.purple,
                          AuraColors.cyan,
                        ]
                  }
                  style={[
                    styles.forceFill,
                    {
                      width:
                        `${forcePercent}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <View
              style={[
                styles.imuCard,
                isPicking &&
                  styles.warningCard,
              ]}
            >
              <View style={styles.metricHeader}>
                <View>
                  <Text style={styles.metricLabel}>
                    摳抓行為偵測
                  </Text>

                  <Text style={styles.metricDescription}>
                    IMU 三軸加速度 + 手指施力
                  </Text>
                </View>

                <Compass
                  size={17}
                  color={AuraColors.purple}
                />
              </View>

              <View style={styles.imuGrid}>
                <ImuAxis
                  label="X 軸"
                  subtitle="側向"
                  value={imuX}
                  hasData={hasData}
                />

                <ImuAxis
                  label="Y 軸"
                  subtitle="前後"
                  value={imuY}
                  hasData={hasData}
                />

                <ImuAxis
                  label="Z 軸"
                  subtitle="垂直"
                  value={imuZ}
                  hasData={hasData}
                />
              </View>

              {isPicking ? (
                <Text style={styles.warningMessage}>
                  IMU 與手指施力同時超過門檻，疑似摳抓行為
                </Text>
              ) : null}
            </View>

            <View style={styles.deviceInformation}>
              <InformationRow
                label="裝置"
                value={
                  sensorData?.deviceId ??
                  '等待裝置'
                }
              />

              <InformationRow
                label="電量"
                value={
                  hasData
                    ? `${battery}%`
                    : '--'
                }
              />

              <InformationRow
                label="最新資料"
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
          <StatisticsContent
            todayCount={
              isPicking && !ignoredCurrentEvent
                ? 4
                : 3
            }
          />
        )}
      </ScrollView>
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
              ? AuraColors.warning
              : AuraColors.normal,
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
            color: AuraColors.warning,
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

function StatisticsContent({
  todayCount,
}: {
  todayCount: number;
}) {
  const weeklyData = [
    2, 5, 1, 4, 3, 2, todayCount,
  ];

  return (
    <View style={styles.statisticsContainer}>
      <View style={styles.historyCard}>
        <Text style={styles.historyTitle}>
          BFRB 行為歷史日誌紀錄
        </Text>

        <HistoryItem
          icon="🖐️"
          title="摳皮行為"
          description="高發情境：任務瓶頸焦慮、缺乏刺激時。"
          count="累計 12 次"
        />

        <HistoryItem
          icon="💇"
          title="拉扯皮／拔毛傾向"
          description="高發情境：深夜放空思考時。"
          count="累計 4 次"
        />

        <HistoryItem
          icon="🦷"
          title="咬指甲／啃咬指肉"
          description="高發情境：視覺或觸覺不適。"
          count="累計 8 次"
          last
        />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryText}>
          <Text style={styles.summaryTitle}>
            行為壓力事件分析
          </Text>

          <Text style={styles.summaryDescription}>
            以 IMU 與手指施力辨識疑似摳抓，
            並另外參考心率觀察壓力狀態。
          </Text>
        </View>

        <View style={styles.summaryCircle}>
          <Text style={styles.summaryCount}>
            {todayCount}
          </Text>

          <Text style={styles.summaryCountLabel}>
            今日觸發
          </Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>
          每週事件次數趨勢
        </Text>

        <View style={styles.barChart}>
          {weeklyData.map(
            (value, index) => (
              <View
                key={index}
                style={styles.barColumn}
              >
                <View
                  style={[
                    styles.chartBar,
                    {
                      height:
                        18 + value * 12,
                    },
                  ]}
                />

                <Text style={styles.dayLabel}>
                  {[
                    '一',
                    '二',
                    '三',
                    '四',
                    '五',
                    '六',
                    '日',
                  ][index]}
                </Text>
              </View>
            )
          )}
        </View>
      </View>
    </View>
  );
}

function HistoryItem({
  icon,
  title,
  description,
  count,
  last = false,
}: {
  icon: string;
  title: string;
  description: string;
  count: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.historyItem,
        last && {
          borderBottomWidth: 0,
        },
      ]}
    >
      <Text style={styles.historyIcon}>
        {icon}
      </Text>

      <View style={styles.historyContent}>
        <View style={styles.historyItemHeader}>
          <Text style={styles.historyItemTitle}>
            {title}
          </Text>

          <Text style={styles.historyCount}>
            {count}
          </Text>
        </View>

        <Text style={styles.historyDescription}>
          {description}
        </Text>
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
      color: AuraColors.mutedDark,
    };
  }

  if (isStressed || score > 75) {
    return {
      label: '狀態：高壓警戒',
      color: AuraColors.warning,
    };
  }

  if (score > 40) {
    return {
      label: '狀態：輕度緊繃',
      color: AuraColors.caution,
    };
  }

  return {
    label: '狀態：平靜放鬆',
    color: AuraColors.normal,
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      AuraColors.background,
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255,255,255,0.05)',
  },

  navigationTitle: {
    color: AuraColors.white,
    fontSize: 16,
    fontWeight: '800',
  },

  navigationSubtitle: {
    color: AuraColors.muted,
    fontSize: 10,
    marginTop: 3,
  },

  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },

  roundIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AuraColors.border,
    backgroundColor: AuraColors.cardStrong,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
  },

  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },

  avatarText: {
    color: AuraColors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  profileInformation: {
    flex: 1,
    marginLeft: 10,
  },

  profileName: {
    color: AuraColors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  profileDescription: {
    color: AuraColors.muted,
    fontSize: 10,
    marginTop: 3,
  },

  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 9,
  },

  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  connectionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },

  tabs: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 12,
    backgroundColor:
      'rgba(255,255,255,0.02)',
  },

  tabButton: {
    flex: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
  },

  tabButtonActive: {
    borderWidth: 1,
    borderColor:
      'rgba(6,182,212,0.22)',
    backgroundColor:
      'rgba(6,182,212,0.10)',
  },

  tabText: {
    color: AuraColors.muted,
    fontSize: 12,
    fontWeight: '700',
  },

  tabTextActive: {
    color: AuraColors.white,
  },

  thresholdBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 11,
    marginBottom: 14,
    borderWidth: 1,
    borderColor:
      'rgba(139,92,246,0.35)',
    borderRadius: 12,
    backgroundColor:
      'rgba(18,14,36,0.60)',
  },

  thresholdIcon: {
    marginRight: 7,
    fontSize: 12,
  },

  thresholdText: {
    flex: 1,
    color: AuraColors.white,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '600',
  },

  stressCard: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 20,
    backgroundColor: AuraColors.card,
  },

  sectionLabel: {
    alignSelf: 'flex-start',
    color: AuraColors.muted,
    fontSize: 11,
    fontWeight: '600',
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
    color: AuraColors.white,
    fontSize: 34,
    fontWeight: '800',
  },

  stressScoreLabel: {
    color: AuraColors.muted,
    fontSize: 9,
    marginTop: 2,
  },

  stressStatus: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
  },

  stressStatusText: {
    color: '#07100e',
    fontSize: 10,
    fontWeight: '800',
  },

  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },

  metricCard: {
    flex: 1,
    padding: 13,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 16,
    backgroundColor: AuraColors.card,
  },

  largeMetricCard: {
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 16,
    backgroundColor: AuraColors.card,
  },

  warningCard: {
    borderColor:
      'rgba(239,68,68,0.45)',
    backgroundColor:
      'rgba(239,68,68,0.045)',
  },

  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  metricLabel: {
    color: AuraColors.muted,
    fontSize: 11,
    fontWeight: '600',
  },

  metricDescription: {
    color: AuraColors.mutedDark,
    fontSize: 9,
    marginTop: 3,
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 7,
  },

  metricValue: {
    color: AuraColors.white,
    fontSize: 23,
    fontWeight: '800',
  },

  largeMetricValue: {
    color: AuraColors.white,
    fontSize: 23,
    fontWeight: '800',
  },

  metricUnit: {
    color: AuraColors.muted,
    fontSize: 10,
    marginLeft: 5,
  },

  metricStatus: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 5,
  },

  forceTrack: {
    height: 6,
    marginTop: 9,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor:
      'rgba(255,255,255,0.06)',
  },

  forceFill: {
    height: '100%',
    borderRadius: 3,
  },

  imuCard: {
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 16,
    backgroundColor: AuraColors.card,
  },

  imuGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },

  imuAxis: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.05)',
    borderRadius: 10,
    backgroundColor:
      'rgba(255,255,255,0.02)',
  },

  imuAxisLabel: {
    color: AuraColors.muted,
    fontSize: 10,
    fontWeight: '700',
  },

  imuAxisSubtitle: {
    color: AuraColors.mutedDark,
    fontSize: 8,
    marginTop: 2,
  },

  imuAxisValue: {
    color: AuraColors.white,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 5,
  },

  warningMessage: {
    color: AuraColors.warning,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 9,
  },






  deviceInformation: {
    padding: 14,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 16,
    backgroundColor: AuraColors.card,
  },

  informationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  informationLabel: {
    color: AuraColors.muted,
    fontSize: 10,
  },

  informationValue: {
    maxWidth: '65%',
    color: AuraColors.white,
    fontSize: 10,
    fontWeight: '600',
  },

  statisticsContainer: {
    gap: 12,
  },

  historyCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 20,
    backgroundColor: AuraColors.card,
  },

  historyTitle: {
    color: AuraColors.white,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },

  historyItem: {
    flexDirection: 'row',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255,255,255,0.05)',
  },

  historyIcon: {
    fontSize: 18,
    marginRight: 10,
  },

  historyContent: {
    flex: 1,
  },

  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  historyItemTitle: {
    flex: 1,
    color: AuraColors.white,
    fontSize: 11,
    fontWeight: '700',
  },

  historyCount: {
    color: AuraColors.cyan,
    fontSize: 9,
    fontWeight: '700',
  },

  historyDescription: {
    color: AuraColors.muted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 20,
    backgroundColor: AuraColors.card,
  },

  summaryText: {
    flex: 1,
    paddingRight: 12,
  },

  summaryTitle: {
    color: AuraColors.white,
    fontSize: 13,
    fontWeight: '800',
  },

  summaryDescription: {
    color: AuraColors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },

  summaryCircle: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor:
      'rgba(6,182,212,0.35)',
    borderRadius: 37,
    backgroundColor:
      'rgba(6,182,212,0.08)',
  },

  summaryCount: {
    color: AuraColors.cyan,
    fontSize: 22,
    fontWeight: '800',
  },

  summaryCountLabel: {
    color: AuraColors.muted,
    fontSize: 8,
  },

  chartCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 20,
    backgroundColor: AuraColors.card,
  },

  chartTitle: {
    color: AuraColors.muted,
    fontSize: 11,
    fontWeight: '700',
  },

  barChart: {
    height: 130,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  chartBar: {
    width: 18,
    maxHeight: 104,
    borderRadius: 5,
    backgroundColor: AuraColors.cyan,
  },

  dayLabel: {
    color: AuraColors.muted,
    fontSize: 8,
    marginTop: 6,
  },
});