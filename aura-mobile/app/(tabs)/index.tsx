import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';

import {
  Activity,
  ArrowRight,
  Sparkles,
} from 'lucide-react-native';

import { FontAwesome } from '@expo/vector-icons';

import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AuraColors } from '../../constants/auraTheme';
import { useUser } from '../../contexts/UserContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('demo@holdyourhand.io');
  const [password, setPassword] = useState('');
  const { hasCompletedOnboarding, isReady } = useUser();

  // 若使用者已完成初次設定，開啟時若已就緒可直接導航至 dashboard
  useEffect(() => {
    if (isReady && hasCompletedOnboarding) {
      router.replace('/dashboard');
    }
  }, [isReady, hasCompletedOnboarding]);

  function handleLogin() {
    // 依據初次使用狀態決定導航目標：
    // 初次使用 -> 強制進入個人基本資料設定 (Profile)
    // 已完成過設定 -> 直接進入主儀表板 (Dashboard)
    if (!hasCompletedOnboarding) {
      router.push('/profile');
    } else {
      router.replace('/dashboard');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.background}>
        <View style={styles.purpleGlow} />
        <View style={styles.cyanGlow} />
        <View style={styles.pinkGlow} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandContainer}>
            <LinearGradient
              colors={[
                AuraColors.purple,
                AuraColors.cyan,
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logo}
            >
              <Activity
                size={38}
                strokeWidth={2.2}
                color="#ffffff"
              />
            </LinearGradient>

            <Text style={styles.brandName}>
              Hold your hand
            </Text>

            <Text style={styles.slogan}>
              BIO-STRESS MONITOR
            </Text>

            {!hasCompletedOnboarding && isReady && (
              <View style={styles.onboardingBadge}>
                <Sparkles size={12} color="#06b6d4" />
                <Text style={styles.onboardingBadgeText}>
                  歡迎使用 · 初次快速設定引導
                </Text>
              </View>
            )}
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                電子信箱／使用者帳號
              </Text>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="user@example.com"
                placeholderTextColor={AuraColors.mutedDark}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={AuraColors.cyan}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                密碼
              </Text>

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="輸入您的密碼"
                placeholderTextColor={AuraColors.mutedDark}
                secureTextEntry
                selectionColor={AuraColors.cyan}
              />
            </View>

            <View style={styles.socialRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <FontAwesome
                  name="google"
                  size={16}
                  color="#ea4335"
                />

                <Text style={styles.socialButtonText}>
                  Google
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <FontAwesome
                  name="apple"
                  size={18}
                  color="#ffffff"
                />

                <Text style={styles.socialButtonText}>
                  Apple
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButtonWrapper,
                pressed && styles.loginButtonPressed,
              ]}
            >
              <LinearGradient
                colors={[
                  AuraColors.purple,
                  AuraColors.cyan,
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>
                  {hasCompletedOnboarding ? '登入帳號' : '登入並開始初次設定'}
                </Text>

                <ArrowRight
                  size={17}
                  strokeWidth={2.3}
                  color="#ffffff"
                />
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AuraColors.backgroundDeep,
  },

  keyboardView: {
    flex: 1,
  },

  background: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: AuraColors.backgroundDeep,
  },

  purpleGlow: {
    position: 'absolute',
    top: 80,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(139,92,246,0.12)',
    shadowColor: AuraColors.purple,
    shadowOpacity: 0.35,
    shadowRadius: 80,
  },

  cyanGlow: {
    position: 'absolute',
    right: -120,
    bottom: 80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(6,182,212,0.10)',
    shadowColor: AuraColors.cyan,
    shadowOpacity: 0.3,
    shadowRadius: 90,
  },

  pinkGlow: {
    position: 'absolute',
    top: '48%',
    left: '35%',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(236,72,153,0.05)',
  },

  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingTop: 42,
    paddingBottom: 32,
  },

  brandContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },

  logo: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
    borderRadius: 21,

    shadowColor: AuraColors.purple,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.35,
    shadowRadius: 20,

    elevation: 10,
  },

  brandName: {
    color: AuraColors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  slogan: {
    color: AuraColors.cyan,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginTop: 5,
  },

  onboardingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.3)',
    backgroundColor: 'rgba(6,182,212,0.08)',
  },

  onboardingBadgeText: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '700',
  },

  form: {
    width: '100%',
  },

  inputGroup: {
    marginBottom: 20,
  },

  label: {
    color: AuraColors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 8,
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 13,
    backgroundColor: AuraColors.card,
    color: AuraColors.white,
    fontSize: 14,
  },

  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 1,
    marginBottom: 20,
  },

  socialButton: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 12,
    backgroundColor: AuraColors.card,
  },

  socialButtonText: {
    color: AuraColors.white,
    fontSize: 12,
    fontWeight: '600',
  },

  buttonPressed: {
    opacity: 0.65,
    backgroundColor: AuraColors.cardStrong,
  },

  loginButtonWrapper: {
    width: '100%',
    borderRadius: 14,

    shadowColor: AuraColors.purple,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.32,
    shadowRadius: 16,

    elevation: 8,
  },

  loginButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },

  loginButton: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
  },

  loginButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});