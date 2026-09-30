import type { ReactNode } from 'react';
import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import {
  CheckCircle,
  ChevronLeft,
  CloudRain,
  Music,
  Pause,
  Play,
  Sun,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react-native';

import { AuraColors } from '../constants/auraTheme';

type BreathPhase = 'inhale' | 'exhale';

export type NoiseType = 'mind' | 'ocean' | 'rain';

// -------------------------------------------------------------
// 1. 本機無版權 (Royalty-free) 音訊設定
// 載入專案內 assets/musics/ 音檔
// -------------------------------------------------------------
export const NOISE_TRACKS: Record<
  NoiseType,
  {
    id: NoiseType;
    name: string;
    description: string;
    source: any;
  }
> = {
  mind: {
    id: 'mind',
    name: '正念靜心',
    description: '深沉冥想與頌缽頻率',
    source: require('../assets/musics/mindsound.mp3'),
  },
  ocean: {
    id: 'ocean',
    name: '海浪撫慰',
    description: '潮起潮落的自然節奏',
    source: require('../assets/musics/oceansound.mp3'),
  },
  rain: {
    id: 'rain',
    name: '雨聲綿綿',
    description: '細雨滴落的舒緩白噪音',
    source: require('../assets/musics/rainsound.mp3'),
  },
};

export default function RelaxScreen() {
  // 呼吸引導狀態
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale');
  const [secondsRemaining, setSecondsRemaining] = useState(5);

  // 音訊與播放狀態 (expo-audio 現代播放器)
  const [selectedNoise, setSelectedNoise] = useState<NoiseType | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.5);
  const playerRef = useRef<AudioPlayer | null>(null);

  // 動畫相關參考
  const breathScale = useRef(new Animated.Value(0.85)).current;
  const breathOpacity = useRef(new Animated.Value(0.65)).current;
  const rippleOne = useRef(new Animated.Value(0)).current;
  const rippleTwo = useRef(new Animated.Value(0)).current;
  const rippleThree = useRef(new Animated.Value(0)).current;

  // -------------------------------------------------------------
  // 音訊環境初始化與清理（靜音模式下依然可播放音樂）
  // -------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
      } catch (err) {
        console.warn('音訊模式設定略過或不支援:', err);
      }
    })();

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch (e) {
          // 清理忽略
        }
        playerRef.current = null;
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 呼吸計時器
  // -------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((previousSeconds) => {
        if (previousSeconds <= 1) {
          setBreathPhase((previousPhase) =>
            previousPhase === 'inhale' ? 'exhale' : 'inhale'
          );
          return 5;
        }
        return previousSeconds - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // -------------------------------------------------------------
  // 呼吸縮放動畫
  // -------------------------------------------------------------
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(breathScale, {
        toValue: breathPhase === 'inhale' ? 1.32 : 0.88,
        duration: 5000,
        useNativeDriver: true,
      }),
      Animated.timing(breathOpacity, {
        toValue: breathPhase === 'inhale' ? 0.95 : 0.65,
        duration: 5000,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [breathPhase, breathOpacity, breathScale]);

  // -------------------------------------------------------------
  // 水波紋動畫
  // -------------------------------------------------------------
  useEffect(() => {
    function createRippleAnimation(value: Animated.Value, delay: number) {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 5000,
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ),
      ]);
    }

    const animations = [
      createRippleAnimation(rippleOne, 0),
      createRippleAnimation(rippleTwo, 1650),
      createRippleAnimation(rippleThree, 3300),
    ];

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [rippleOne, rippleTwo, rippleThree]);

  // -------------------------------------------------------------
  // 1. 音訊播放與切換邏輯 (expo-audio)
  // -------------------------------------------------------------
  const handleSelectNoise = async (noiseType: NoiseType) => {
    try {
      setIsLoadingAudio(true);

      // 若點選的是當前正在播放的情境，則切換暫停/繼續播放
      if (selectedNoise === noiseType) {
        if (isPlaying) {
          if (playerRef.current) {
            try {
              playerRef.current.pause();
            } catch (e) {}
          }
          setIsPlaying(false);
        } else {
          if (playerRef.current) {
            try {
              playerRef.current.play();
            } catch (e) {}
          }
          setIsPlaying(true);
        }
        return;
      }

      // 切換新曲目：先停止並釋放前一個播放器
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch (e) {}
        playerRef.current = null;
      }

      const track = NOISE_TRACKS[noiseType];
      if (!track) return;

      try {
        const player = createAudioPlayer(track.source, {
          updateInterval: 500,
          downloadFirst: false,
        });

        player.loop = true;
        player.volume = volume;
        player.play();
        playerRef.current = player;
      } catch (nativeErr) {
        console.warn('Expo Audio 播放器建立或啟動提示:', nativeErr);
      }

      setSelectedNoise(noiseType);
      setIsPlaying(true);
    } catch (error) {
      console.warn('音訊切換錯誤:', error);
      if (selectedNoise === noiseType) {
        setIsPlaying(!isPlaying);
      } else {
        setSelectedNoise(noiseType);
        setIsPlaying(true);
      }
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // -------------------------------------------------------------
  // 2. 音量控制拉霸（即時連動音量狀態）
  // -------------------------------------------------------------
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (playerRef.current) {
      try {
        playerRef.current.volume = newVolume;
      } catch (e) {}
    }
  };

  // -------------------------------------------------------------
  // 3. 完成練習與離開機制
  // -------------------------------------------------------------
  const handleCompletePractice = () => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch (e) {}
      playerRef.current = null;
    }
    setIsPlaying(false);
    setSelectedNoise(null);
    router.push('/dashboard');
  };

  // 取得對應音量圖示
  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX size={16} color={AuraColors.muted} />;
    if (volume < 0.35) return <Volume size={16} color={AuraColors.cyan} />;
    if (volume < 0.75) return <Volume1 size={16} color={AuraColors.cyan} />;
    return <Volume2 size={16} color={AuraColors.cyan} />;
  };

  const isInhaling = breathPhase === 'inhale';
  const breathColors: [string, string] = isInhaling
    ? ['#81D4FA', '#29B6F6'] // 吸氣：清透淺水藍 ➔ 海洋天藍
    : ['#5C6BC0', '#3949AB']; // 吐氣：沉靜海軍藍 ➔ 深海寧靜藍
  const breathTitle = isInhaling ? '吸氣' : '吐氣';
  const breathDescription = isInhaling
    ? '深深吸氣，感覺清涼海風灌注全身...'
    : '緩緩吐氣，隨著潮汐釋放內心緊繃...';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 沉浸海洋柔和藍漸層背景 */}
      <LinearGradient
        colors={['#E1F5FE', '#E0F7FA', '#E8EAF6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* 頂部導覽列 */}
        <View style={styles.navigation}>
          <Pressable
            style={styles.backButton}
            onPress={handleCompletePractice}
            hitSlop={10}
          >
            <ChevronLeft size={18} color="#333333" />
          </Pressable>
          <Text style={styles.navigationTitle}>舒壓引導專區</Text>
        </View>

        <Text style={styles.subtitle}>
          跟隨深呼吸節奏，選擇適合您的放鬆聲音，以緩和身心壓力。
        </Text>

        {/* 呼吸引導區塊 */}
        <View style={styles.breathSection}>
          <View style={styles.breathOuterCircle}>
            <Ripple value={rippleOne} borderColor="rgba(129, 212, 250, 0.75)" />
            <Ripple value={rippleTwo} borderColor="rgba(41, 182, 246, 0.55)" />
            <Ripple value={rippleThree} borderColor="rgba(92, 107, 192, 0.45)" />

            <Animated.View
              style={[
                styles.breathCircleAnimated,
                {
                  opacity: breathOpacity,
                  transform: [{ scale: breathScale }],
                },
              ]}
            >
              <LinearGradient
                colors={breathColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.breathCircleGradient}
              >
                <Text style={styles.breathWord}>{breathTitle}</Text>
                <Text style={styles.breathTime}>{secondsRemaining} 秒</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          <Text style={styles.breathDescription}>{breathDescription}</Text>

          <View style={styles.phaseIndicator}>
            <View
              style={[
                styles.phaseDot,
                isInhaling && styles.phaseDotActive,
              ]}
            />
            <Text style={styles.phaseLabel}>吸氣 5 秒</Text>
            <View
              style={[
                styles.phaseDot,
                !isInhaling && styles.phaseDotActive,
              ]}
            />
            <Text style={styles.phaseLabel}>吐氣 5 秒</Text>
          </View>
        </View>

        {/* 1. 音樂與情境切換專區 */}
        <View style={styles.noiseSection}>
          <View style={styles.noiseTitleRow}>
            <Music size={16} color="#0288D1" />
            <Text style={styles.noiseTitle}>正念放鬆白噪音</Text>
            {isLoadingAudio && (
              <ActivityIndicator
                size="small"
                color="#0288D1"
                style={{ marginLeft: 6 }}
              />
            )}
          </View>

          <View style={styles.noiseGrid}>
            {/* 情境 1: 正念靜心 */}
            <NoiseButton
              label={NOISE_TRACKS.mind.name}
              subLabel="頌缽冥想"
              active={selectedNoise === 'mind'}
              isPlaying={selectedNoise === 'mind' && isPlaying}
              icon={
                <Sun
                  size={20}
                  color={
                    selectedNoise === 'mind'
                      ? '#0288D1'
                      : '#7E7889'
                  }
                />
              }
              onPress={() => handleSelectNoise('mind')}
            />

            {/* 情境 2: 海浪撫慰 */}
            <NoiseButton
              label={NOISE_TRACKS.ocean.name}
              subLabel="自然海潮"
              active={selectedNoise === 'ocean'}
              isPlaying={selectedNoise === 'ocean' && isPlaying}
              icon={
                <Waves
                  size={20}
                  color={
                    selectedNoise === 'ocean'
                      ? '#0288D1'
                      : '#7E7889'
                  }
                />
              }
              onPress={() => handleSelectNoise('ocean')}
            />

            {/* 情境 3: 雨聲綿綿 */}
            <NoiseButton
              label={NOISE_TRACKS.rain.name}
              subLabel="舒緩雨滴"
              active={selectedNoise === 'rain'}
              isPlaying={selectedNoise === 'rain' && isPlaying}
              icon={
                <CloudRain
                  size={20}
                  color={
                    selectedNoise === 'rain'
                      ? '#0288D1'
                      : '#7E7889'
                  }
                />
              }
              onPress={() => handleSelectNoise('rain')}
            />
          </View>

          {/* 2. 音量控制拉霸（Slider） */}
          <View style={styles.playerControl}>
            <View style={styles.volumeArea}>
              {getVolumeIcon()}
              <Slider
                style={styles.volumeSlider}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                value={volume}
                onValueChange={handleVolumeChange}
                minimumTrackTintColor="#0288D1"
                maximumTrackTintColor="rgba(226, 232, 240, 0.8)"
                thumbTintColor="#0288D1"
              />
              <Text style={styles.volumePercentText}>
                {Math.round(volume * 100)}%
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  selectedNoise && isPlaying && styles.statusDotActive,
                ]}
              />
              <Text
                style={[
                  styles.playerState,
                  selectedNoise && { color: '#0288D1' },
                ]}
              >
                {selectedNoise
                  ? `${NOISE_TRACKS[selectedNoise].name} ${isPlaying ? '播放中' : '載入中'}`
                  : '已暫停'}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. 完成練習與離開按鈕 */}
        <Pressable
          style={({ pressed }) => [
            styles.completeButtonWrapper,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleCompletePractice}
        >
          <LinearGradient
            colors={['#29B6F6', '#3949AB']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.completeButton}
          >
            <Text style={styles.completeButtonText}>完成練習並返回儀表板</Text>
            <CheckCircle size={18} color="#ffffff" />
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// 子元件：漣漪擴散動畫
// -------------------------------------------------------------
function Ripple({
  value,
  borderColor,
}: {
  value: Animated.Value;
  borderColor: string;
}) {
  const scale = value.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.15],
  });

  const opacity = value.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.6, 0.16, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          borderColor,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

// -------------------------------------------------------------
// 子元件：情境音訊按鈕
// -------------------------------------------------------------
function NoiseButton({
  label,
  subLabel,
  active,
  isPlaying,
  icon,
  onPress,
}: {
  label: string;
  subLabel: string;
  active: boolean;
  isPlaying: boolean;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.noiseButton,
        active && styles.noiseButtonActive,
        pressed && { opacity: 0.8 },
      ]}
      onPress={onPress}
    >
      <View style={styles.noiseIconWrapper}>{icon}</View>

      <Text
        style={[
          styles.noiseButtonText,
          active && styles.noiseButtonTextActive,
        ]}
      >
        {label}
      </Text>

      <Text style={styles.noiseSubText}>{subLabel}</Text>

      {/* 動態音波狀態條 */}
      <View style={styles.waveBars}>
        {[4, 11, 7, 13].map((height, index) => (
          <View
            key={index}
            style={[
              styles.waveBar,
              {
                height: active && isPlaying ? height : 3,
                opacity: active ? 1 : 0.25,
                backgroundColor: active ? '#29B6F6' : AuraColors.muted,
              },
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
}

// -------------------------------------------------------------
// 樣式表 (StyleSheet)
// -------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E1F5FE',
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41, 182, 246, 0.15)',
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(41, 182, 246, 0.3)',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  navigationTitle: {
    color: '#1A2151',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 12,
  },

  subtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },

  breathSection: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
    paddingTop: 16,
  },

  breathOuterCircle: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(129, 212, 250, 0.8)',
    borderRadius: 85,
    backgroundColor: 'rgba(129, 212, 250, 0.15)',
  },

  ripple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderWidth: 1.5,
    borderRadius: 80,
  },

  breathCircleAnimated: {
    width: 108,
    height: 108,
    overflow: 'hidden',
    borderRadius: 54,
    elevation: 8,
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },

  breathCircleGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 54,
  },

  breathWord: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },

  breathTime: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },

  breathDescription: {
    height: 22,
    color: '#0288D1',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },

  phaseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  phaseDot: {
    width: 7,
    height: 7,
    marginRight: 5,
    borderRadius: 3.5,
    backgroundColor: 'rgba(226, 232, 240, 0.9)',
  },

  phaseDotActive: {
    backgroundColor: '#0288D1',
  },

  phaseLabel: {
    color: '#5A5A5A',
    fontSize: 11,
    marginRight: 14,
    fontWeight: '600',
  },

  noiseSection: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    shadowColor: '#81D4FA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  noiseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },

  noiseTitle: {
    color: '#1A2151',
    fontSize: 14,
    fontWeight: '800',
  },

  noiseGrid: {
    flexDirection: 'row',
    gap: 8,
  },

  noiseButton: {
    flex: 1,
    minHeight: 106,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  noiseButtonActive: {
    borderColor: 'rgba(41, 182, 246, 0.85)',
    backgroundColor: 'rgba(225, 245, 254, 0.85)',
    borderWidth: 1.5,
  },

  noiseIconWrapper: {
    marginBottom: 4,
  },

  noiseButtonText: {
    color: '#7E7889',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },

  noiseButtonTextActive: {
    color: '#0288D1',
    fontWeight: '800',
  },

  noiseSubText: {
    color: '#9C96A6',
    fontSize: 9,
    marginTop: 2,
  },

  waveBars: {
    height: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    marginTop: 6,
  },

  waveBar: {
    width: 2.5,
    borderRadius: 1.5,
  },

  playerControl: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  volumeArea: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
  },

  volumeSlider: {
    flex: 1,
    height: 36,
    marginHorizontal: 6,
  },

  volumePercentText: {
    color: '#5A5A5A',
    fontSize: 10,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(226, 232, 240, 0.8)',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9C96A6',
    marginRight: 6,
  },

  statusDotActive: {
    backgroundColor: '#0288D1',
  },

  playerState: {
    color: '#5A5A5A',
    fontSize: 10,
    fontWeight: '700',
  },

  completeButtonWrapper: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#29B6F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  completeButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
  },

  completeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
});
