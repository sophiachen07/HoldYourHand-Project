import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Award,
  Flame,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react-native';

import { AuraColors } from '../constants/auraTheme';

// -------------------------------------------------------------
// 幾何粒子定義
// -------------------------------------------------------------
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'circle' | 'square' | 'diamond';
  rotation: number;
  rotSpeed: number;
  opacity: number;
  life: number;
}

type ShapeType = 'circle' | 'square';
type GameResult = 'idle' | 'growing' | 'perfect' | 'good' | 'fail';

const MIN_RADIUS = 10;
const DEFAULT_TARGET_RADIUS = 110;
const GROW_SPEED = 115; // 像素/秒

export default function LimitProgressGameScreen() {
  // 遊戲狀態
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [shapeType, setShapeType] = useState<ShapeType>('circle');

  // 目標外框尺寸與當前半徑
  const [targetRadius, setTargetRadius] = useState<number>(DEFAULT_TARGET_RADIUS);
  const [currentRadius, setCurrentRadius] = useState<number>(MIN_RADIUS);
  const [gameState, setGameState] = useState<GameResult>('idle');
  const [matchPercent, setMatchPercent] = useState<number | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  // 引用與動畫控制
  const isPressingRef = useRef<boolean>(false);
  const currentRadiusRef = useRef<number>(MIN_RADIUS);
  const targetRadiusRef = useRef<number>(DEFAULT_TARGET_RADIUS);
  const gameStateRef = useRef<GameResult>('idle');
  const lastTimeRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);
  const particleFrameIdRef = useRef<number | null>(null);

  // 螢幕震動動畫 (Screen Shake)
  const shakeAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // 紅幕警示閃爍動畫
  const flashAnim = useRef(new Animated.Value(0)).current;
  // 成功光暈波紋
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // 結果文字彈出動畫
  const resultScaleAnim = useRef(new Animated.Value(0)).current;

  // Web Audio 合成器（免外部音檔，跨端清脆音效）
  const audioCtxRef = useRef<any>(null);

  useEffect(() => {
    targetRadiusRef.current = targetRadius;
  }, [targetRadius]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // 初始化音訊合成器 (Web 或原生)
  const getAudioContext = useCallback(() => {
    if (typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContextClass();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
      }
    }
    return null;
  }, []);

  // -------------------------------------------------------------
  // 清脆音效播放 Function (純程式碼合成音效)
  // -------------------------------------------------------------
  const playChimeSound = useCallback(
    (type: 'perfect' | 'good' | 'fail') => {
      if (!soundEnabled) return;

      // 嘗試觸發觸覺反饋
      try {
        if (type === 'perfect') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === 'good') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } catch {
        // Haptics 不支援時靜默略過
      }

      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === 'perfect') {
        // 雙音清脆高八度 Chime (C6 -> G6 -> C7)
        const notes = [1046.5, 1567.98, 2093.0];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.07);

          gain.gain.setValueAtTime(0.28, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.5);
        });
      } else if (type === 'good') {
        // 單音清亮音符 (E5 -> A5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'fail') {
        // 低沉挫敗音 (G3 -> Eb3)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(196.0, now);
        osc.frequency.linearRampToValueAtTime(140.0, now + 0.25);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.32);
      }
    },
    [soundEnabled, getAudioContext]
  );

  // -------------------------------------------------------------
  // 螢幕震動動畫 (Screen Shake)
  // -------------------------------------------------------------
  const triggerScreenShake = useCallback(() => {
    shakeAnim.setValue({ x: 0, y: 0 });
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: { x: -8, y: 5 },
        duration: 35,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: { x: 7, y: -6 },
        duration: 35,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: { x: -5, y: 4 },
        duration: 35,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: { x: 4, y: -3 },
        duration: 35,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: { x: -2, y: 1 },
        duration: 30,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: { x: 0, y: 0 },
        duration: 30,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  // -------------------------------------------------------------
  // 紅色閃爍 (Fail Flash)
  // -------------------------------------------------------------
  const triggerFlash = useCallback(() => {
    flashAnim.setValue(0.7);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [flashAnim]);

  // -------------------------------------------------------------
  // 幾何碎屑粒子噴發特效 (Confetti Particles)
  // -------------------------------------------------------------
  const spawnParticles = useCallback((count = 36) => {
    const colors = [
      '#f59e0b',
      '#ec4899',
      '#8b5cf6',
      '#06b6d4',
      '#10b981',
      '#fbbf24',
      '#ffffff',
    ];
    const shapes: ('circle' | 'square' | 'diamond')[] = [
      'circle',
      'square',
      'diamond',
    ];
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 4 + Math.random() * 7;
      newParticles.push({
        id: Math.random() + i,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // 向上微噴
        size: 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 16,
        opacity: 1,
        life: 1,
      });
    }

    setParticles(newParticles);
  }, []);

  // 粒子物理更新循環
  useEffect(() => {
    if (particles.length === 0) return;

    let frameId: number;
    const updateParticles = () => {
      setParticles((prev) => {
        const next = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.18, // 重力
            vx: p.vx * 0.98, // 空氣阻力
            rotation: p.rotation + p.rotSpeed,
            opacity: p.opacity - 0.024,
            life: p.life - 0.024,
          }))
          .filter((p) => p.opacity > 0);

        if (next.length > 0) {
          frameId = requestAnimationFrame(updateParticles);
        }
        return next;
      });
    };

    frameId = requestAnimationFrame(updateParticles);
    return () => cancelAnimationFrame(frameId);
  }, [particles.length]);

  // -------------------------------------------------------------
  // 生長循環 (requestAnimationFrame)
  // -------------------------------------------------------------
  const startGrowingLoop = useCallback(() => {
    lastTimeRef.current = performance.now();

    const grow = (now: number) => {
      if (!isPressingRef.current) return;

      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      // 膨脹半徑增加
      currentRadiusRef.current += GROW_SPEED * dt;

      // 當超過目標半徑 1.25 倍時自動判定為破殼超限
      if (currentRadiusRef.current > targetRadiusRef.current * 1.3) {
        handleRelease();
        return;
      }

      setCurrentRadius(currentRadiusRef.current);
      animFrameIdRef.current = requestAnimationFrame(grow);
    };

    animFrameIdRef.current = requestAnimationFrame(grow);
  }, []);

  // -------------------------------------------------------------
  // 核心長按事件：開始長按 (PointerDown / PressIn)
  // -------------------------------------------------------------
  const handlePressIn = useCallback(() => {
    if (gameStateRef.current === 'growing') return;

    // 若上一局剛結束，重置並立即開始
    if (
      gameStateRef.current === 'perfect' ||
      gameStateRef.current === 'good' ||
      gameStateRef.current === 'fail'
    ) {
      resetRound();
    }

    isPressingRef.current = true;
    gameStateRef.current = 'growing';
    setGameState('growing');
    setMatchPercent(null);

    // 啟動波紋動畫
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.98,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();

    startGrowingLoop();
  }, [pulseAnim, startGrowingLoop]);

  // -------------------------------------------------------------
  // 核心鬆手事件：判定 (PointerUp / PressOut)
  // -------------------------------------------------------------
  const handleRelease = useCallback(() => {
    if (!isPressingRef.current) return;

    isPressingRef.current = false;
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);

    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    const currentR = currentRadiusRef.current;
    const targetR = targetRadiusRef.current;

    // 計算重合百分比
    const ratio = currentR / targetR;
    const exactPercent = ratio * 100;
    setMatchPercent(exactPercent);

    // 結果彈出動畫
    resultScaleAnim.setValue(0.3);
    Animated.spring(resultScaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();

    // 判定機制
    if (ratio > 1.0) {
      // 超出界線破殼 -> Fail
      setGameState('fail');
      gameStateRef.current = 'fail';
      setCombo(0);
      playChimeSound('fail');
      triggerScreenShake();
      triggerFlash();
    } else if (ratio >= 0.99 && ratio <= 1.0) {
      // Perfect (99% - 100%)
      setGameState('perfect');
      gameStateRef.current = 'perfect';
      const newCombo = combo + 1;
      const roundScore = 100 + newCombo * 20;
      const newScore = score + roundScore;

      setCombo(newCombo);
      setMaxCombo((prev) => Math.max(prev, newCombo));
      setScore(newScore);
      setHighScore((prev) => Math.max(prev, newScore));

      playChimeSound('perfect');
      triggerScreenShake();
      spawnParticles(42);
    } else if (ratio >= 0.90 && ratio < 0.99) {
      // Good (90% - 98.9%)
      setGameState('good');
      gameStateRef.current = 'good';
      const newCombo = combo + 1;
      const roundScore = 50 + newCombo * 10;
      const newScore = score + roundScore;

      setCombo(newCombo);
      setMaxCombo((prev) => Math.max(prev, newCombo));
      setScore(newScore);
      setHighScore((prev) => Math.max(prev, newScore));

      playChimeSound('good');
    } else {
      // 小於 90% -> Fail (萎縮過小)
      setGameState('fail');
      gameStateRef.current = 'fail';
      setCombo(0);
      playChimeSound('fail');
      triggerFlash();
    }
  }, [
    combo,
    score,
    pulseAnim,
    resultScaleAnim,
    playChimeSound,
    triggerScreenShake,
    triggerFlash,
    spawnParticles,
  ]);

  // -------------------------------------------------------------
  // 重置關卡 / 再來一局
  // 每次重置時微調目標外框尺寸，增加難度與隨機性
  // -------------------------------------------------------------
  const resetRound = useCallback(() => {
    isPressingRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    currentRadiusRef.current = MIN_RADIUS;
    setCurrentRadius(MIN_RADIUS);
    setGameState('idle');
    gameStateRef.current = 'idle';
    setMatchPercent(null);

    // 隨機微調目標尺寸：80px ~ 135px 之間
    const randomTarget = Math.floor(85 + Math.random() * 50);
    setTargetRadius(randomTarget);
    targetRadiusRef.current = randomTarget;
    setRound((r) => r + 1);
  }, []);

  // 完全重置遊戲（重置分數）
  const resetGameFully = useCallback(() => {
    setScore(0);
    setCombo(0);
    setRound(1);
    resetRound();
  }, [resetRound]);

  // 切換幾何形狀
  const toggleShape = () => {
    setShapeType((prev) => (prev === 'circle' ? 'square' : 'circle'));
    resetRound();
  };

  // 取得實心圖形目前顏色與樣式
  const getFilledStyle = () => {
    const isSquare = shapeType === 'square';
    const borderRadius = isSquare ? 12 : currentRadius;

    if (gameState === 'perfect') {
      return {
        backgroundColor: '#fbbf24',
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 24,
        elevation: 15,
        borderRadius,
      };
    }
    if (gameState === 'good') {
      return {
        backgroundColor: '#10b981',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 16,
        elevation: 10,
        borderRadius,
      };
    }
    if (gameState === 'fail') {
      return {
        backgroundColor: '#ef4444',
        opacity: 0.75,
        borderRadius,
      };
    }
    if (gameState === 'growing') {
      return {
        backgroundColor: '#8b5cf6',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 14,
        elevation: 8,
        borderRadius,
      };
    }
    return {
      backgroundColor: '#a855f7',
      borderRadius,
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 紅幕警示閃爍遮罩 */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flashOverlay,
          {
            opacity: flashAnim,
          },
        ]}
      />

      {/* 震動外框容器 (Screen Shake) */}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateX: shakeAnim.x },
              { translateY: shakeAnim.y },
            ],
          },
        ]}
      >
        {/* 頂部導航列 */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.navBtn,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color={AuraColors.white} />
          </Pressable>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>好玩互動遊戲</Text>
            <Text style={styles.headerSubtitle}>極限進度條 · 專注與精準挑戰</Text>
          </View>

          {/* 右側平衡寬度佔位 */}
          <View style={styles.headerPlaceholder} />
        </View>

        {/* 成績看板 */}
        <View style={styles.scoreBoard}>
          <View style={styles.scoreCard}>
            <View style={styles.scoreLabelRow}>
              <Trophy size={13} color="#eab308" />
              <Text style={styles.scoreLabel}>得分</Text>
            </View>
            <Text style={styles.scoreValue}>{score}</Text>
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreLabelRow}>
              <Flame size={13} color="#f97316" />
              <Text style={styles.scoreLabel}>連擊 Combo</Text>
            </View>
            <View style={styles.comboRow}>
              <Text
                style={[
                  styles.scoreValue,
                  combo > 0 && { color: '#f97316', fontWeight: '800' },
                ]}
              >
                {combo}
              </Text>
              {combo >= 3 && (
                <View style={styles.comboTag}>
                  <Text style={styles.comboTagText}>HOT</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreLabelRow}>
              <Award size={13} color="#8b5cf6" />
              <Text style={styles.scoreLabel}>最高得分</Text>
            </View>
            <Text style={styles.scoreValue}>{highScore}</Text>
          </View>
        </View>

        {/* 遊戲主互動區（可長按整個區域） */}
        <Pressable
          style={styles.gameArea}
          onPressIn={handlePressIn}
          onPressOut={handleRelease}
          // 針對 Web 平台的 Pointer 事件支援
          {...(Platform.OS === 'web'
            ? {
                onPointerDown: handlePressIn,
                onPointerUp: handleRelease,
              }
            : {})}
        >
          {/* 粒子噴發特效渲染層 */}
          <View pointerEvents="none" style={styles.particleContainer}>
            {particles.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.particle,
                  {
                    left: '50%',
                    top: '50%',
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    borderRadius:
                      p.shape === 'circle' ? p.size / 2 : p.shape === 'diamond' ? 2 : 3,
                    opacity: p.opacity,
                    transform: [
                      { translateX: p.x },
                      { translateY: p.y },
                      { rotate: `${p.rotation}deg` },
                    ],
                  },
                ]}
              />
            ))}
          </View>

          {/* 虛線目標外框 */}
          <Animated.View
            style={[
              styles.targetFrame,
              {
                width: targetRadius * 2,
                height: targetRadius * 2,
                borderRadius: shapeType === 'square' ? 16 : targetRadius,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            {/* 實心生長圖形 */}
            <View
              style={[
                styles.filledShape,
                getFilledStyle(),
                {
                  width: currentRadius * 2,
                  height: currentRadius * 2,
                },
              ]}
            />
          </Animated.View>

          {/* 結果判定浮層 */}
          {gameState !== 'idle' && gameState !== 'growing' && (
            <Animated.View
              style={[
                styles.resultBadge,
                {
                  transform: [{ scale: resultScaleAnim }],
                },
              ]}
            >
              {gameState === 'perfect' && (
                <LinearGradient
                  colors={['#f59e0b', '#d97706']}
                  style={styles.resultBadgeGradient}
                >
                  <Sparkles size={20} color="#fff" />
                  <Text style={styles.resultTitle}>PERFECT!!</Text>
                  <Text style={styles.resultSubtitle}>
                    重合度 {matchPercent?.toFixed(1)}% (+{100 + combo * 20})
                  </Text>
                </LinearGradient>
              )}

              {gameState === 'good' && (
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.resultBadgeGradient}
                >
                  <Zap size={20} color="#fff" />
                  <Text style={styles.resultTitle}>GOOD!</Text>
                  <Text style={styles.resultSubtitle}>
                    重合度 {matchPercent?.toFixed(1)}% (+{50 + combo * 10})
                  </Text>
                </LinearGradient>
              )}

              {gameState === 'fail' && (
                <LinearGradient
                  colors={['#ef4444', '#b91c1c']}
                  style={styles.resultBadgeGradient}
                >
                  <Text style={styles.resultTitle}>
                    {matchPercent && matchPercent > 100
                      ? 'FAIL! 破殼超出'
                      : 'FAIL! 尺寸不足'}
                  </Text>
                  <Text style={styles.resultSubtitle}>
                    重合度 {matchPercent?.toFixed(1)}% (連擊中斷)
                  </Text>
                </LinearGradient>
              )}
            </Animated.View>
          )}

          {/* 互動提示字樣 */}
          <View style={styles.tipBox}>
            {gameState === 'idle' && (
              <Text style={styles.tipText}>長按任意處生長，在完全重合時鬆手</Text>
            )}
            {gameState === 'growing' && (
              <Text style={[styles.tipText, { color: '#c084fc' }]}>
                蓄力生長中... 剛好填滿時鬆手！
              </Text>
            )}
            {(gameState === 'perfect' ||
              gameState === 'good' ||
              gameState === 'fail') && (
              <Text style={styles.tipText}>長按或點擊下方按鈕開始下一局</Text>
            )}
          </View>
        </Pressable>

        {/* 底部控制按鈕列 */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonSecondary,
              pressed && { opacity: 0.7 },
            ]}
            onPress={resetGameFully}
          >
            <RotateCcw size={15} color={AuraColors.muted} />
            <Text style={styles.actionButtonSecondaryText}>重設分數</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonPrimary,
              pressed && { opacity: 0.8 },
            ]}
            onPress={resetRound}
          >
            <Zap size={15} color="#fff" />
            <Text style={styles.actionButtonPrimaryText}>下一局 (微調外框)</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0c0915',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(239, 68, 68, 0.45)',
    zIndex: 99,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AuraColors.white,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: AuraColors.muted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerPlaceholder: {
    width: 36,
    height: 36,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBoard: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  scoreLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 11,
    color: AuraColors.muted,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '700',
    color: AuraColors.white,
  },
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comboTag: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  comboTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f97316',
  },
  gameArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    position: 'relative',
    userSelect: 'none',
  },
  particleContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  particle: {
    position: 'absolute',
  },
  targetFrame: {
    borderWidth: 2.5,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.02)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  filledShape: {
    position: 'absolute',
  },
  resultBadge: {
    position: 'absolute',
    top: 24,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 12,
  },
  resultBadgeGradient: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  resultSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    marginTop: 2,
  },
  tipBox: {
    position: 'absolute',
    bottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tipText: {
    fontSize: 12,
    color: AuraColors.muted,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
  },
  actionButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  actionButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: AuraColors.muted,
  },
  actionButtonPrimary: {
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
