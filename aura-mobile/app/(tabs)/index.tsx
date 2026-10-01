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
  Image,
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
    if (!hasCompletedOnboarding) {
      router.push('/profile');
    } else {
      router.replace('/dashboard');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {/* 柔和粉紫到鼠尾草薄荷綠的無壓力背景 */}
      <LinearGradient
        colors={['#EDE5F8', '#DEEEF8', '#E5F4EE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

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
            <View style={styles.logo}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.brandName}>
              Hold your hand
            </Text>

            <Text style={styles.slogan}>
              守把手
            </Text>

            {!hasCompletedOnboarding && isReady && (
              <View style={styles.onboardingBadge}>
                <Sparkles size={12} color="#2E7D6E" />
                <Text style={styles.onboardingBadgeText}>
                  歡迎使用 · 快速設定引導
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
                selectionColor={AuraColors.purple}
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
                selectionColor={AuraColors.purple}
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
                  color="#333333"
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
              <View style={styles.loginButton}>
                <Text style={styles.loginButtonText}>
                  {hasCompletedOnboarding ? '登入帳號' : '登入並開始設定'}
                </Text>

                <ArrowRight
                  size={17}
                  strokeWidth={2.3}
                  color="#2E7D6E"
                />
              </View>
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
    backgroundColor: '#EDE5F8',
  },

  keyboardView: {
    flex: 1,
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
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
    borderRadius: 22,
    backgroundColor: '#FFE4E6',
    shadowColor: '#F5C0C0',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 22,
  },

  brandName: {
    color: '#333333',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  slogan: {
    color: '#9B8AC1',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
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
    borderColor: 'rgba(192, 237, 226, 0.95)',
    backgroundColor: 'rgba(192, 237, 226, 0.45)',
  },

  onboardingBadgeText: {
    color: '#2E7D6E',
    fontSize: 11,
    fontWeight: '700',
  },

  form: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  input: {
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#1A2151',
    fontSize: 14,
  },

  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
    marginBottom: 18,
  },

  socialButton: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  socialButtonText: {
    color: '#1A2151',
    fontSize: 12,
    fontWeight: '600',
  },

  buttonPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
  },

  loginButtonWrapper: {
    width: '100%',
    borderRadius: 14,
    shadowColor: '#c0ede2',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },

  loginButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  loginButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    backgroundColor: '#c0ede2',
  },

  loginButtonText: {
    color: '#2E7D6E',
    fontSize: 14,
    fontWeight: '700',
  },
});