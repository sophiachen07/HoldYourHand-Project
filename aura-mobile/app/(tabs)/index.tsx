import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Mail, Lock, User, Eye, EyeOff, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GoogleSignInButton from '../../components/GoogleSignInButton';
import { AuraColors } from '../../constants/auraTheme';
import { useUser } from '../../contexts/UserContext';
import {
  isNativeGoogleAvailable,
  nativeGoogleSignIn,
  NATIVE_GOOGLE_UNAVAILABLE_MESSAGE,
} from '../../services/nativeGoogle';
import { userApi } from '../../services/userApi';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function LoginScreen() {
  // 切換模式：'login' (登入) 或 'register' (建立新帳號)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // 表單欄位
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const {
    hasCompletedOnboarding,
    isReady,
    account,
    isGuest,
    registerWithPassword,
    loginWithPassword,
    loginWithGoogle,
    loginWithGoogleNative,
    loginAsGuest,
  } = useUser();



  // 已登入帳號且完成初次設定：開啟時直接進入儀表板主頁（裝置由背景無感秒連）
  useEffect(() => {
    if (isReady && hasCompletedOnboarding && (account || isGuest)) {
      router.replace('/dashboard');
    }
  }, [isReady, hasCompletedOnboarding, account, isGuest]);

  // 訪客登入：不需要 email，資料只存在這台裝置、不寫入資料庫
  async function handleGuestLogin() {
    const result = await loginAsGuest();
    if (result.onboardingCompleted) {
      router.replace('/dashboard');
    } else {
      router.push('/profile');
    }
  }

  // 不連資料庫，直接以本機資料使用（後端沒開時的備案）
  function continueOffline() {
    if (!hasCompletedOnboarding) {
      router.push('/profile');
    } else {
      router.replace('/dashboard');
    }
  }

  // Google 登入成功後的導頁（網頁版與手機版共用）
  function goAfterGoogleLogin(result: Awaited<ReturnType<typeof loginWithGoogle>>) {
    if (result.onboardingCompleted) {
      router.replace('/dashboard');
      return;
    }
    const g = result.googleProfile;
    const missing = [!g?.age && '年齡', !g?.gender && '性別'].filter(Boolean);
    router.push('/profile');
    if (missing.length > 0) {
      notify(
        '部分資料需手動填寫',
        `你的 Google 帳號沒有提供${missing.join('、')}（可能未填寫或未公開），請在設定頁補上。`
      );
    }
  }

  // 手機版 Google 登入（開發版／正式版 App）
  async function handleNativeGoogle() {
    if (!isNativeGoogleAvailable()) {
      notify('Google 登入', NATIVE_GOOGLE_UNAVAILABLE_MESSAGE);
      return;
    }

    setIsLoggingIn(true);
    try {
      const { googleClientId } = await userApi.getConfig();
      if (!googleClientId) {
        notify('Google 登入', '後端尚未設定 GOOGLE_CLIENT_ID，暫時無法使用 Google 登入。');
        return;
      }
      const tokens = await nativeGoogleSignIn(googleClientId);
      if (!tokens) return; // 使用者取消
      goAfterGoogleLogin(await loginWithGoogleNative(tokens.idToken, tokens.accessToken));
    } catch (err: any) {
      notify('Google 登入失敗', err?.message || '請稍後再試。');
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleGoogleAccessToken(accessToken: string) {
    setIsLoggingIn(true);
    try {
      goAfterGoogleLogin(await loginWithGoogle(accessToken));
    } catch (err: any) {
      notify('Google 登入失敗', err?.message || '請稍後再試。');
    } finally {
      setIsLoggingIn(false);
    }
  }

  // 密碼登入處理
  async function handlePasswordLogin() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      notify('提示', '請輸入有效的電子信箱');
      return;
    }

    if (!trimmedPassword) {
      notify('提示', '請輸入密碼');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await loginWithPassword(trimmedEmail, trimmedPassword);
      if (result.onboardingCompleted) {
        router.replace('/dashboard');
      } else {
        router.push('/profile');
      }
    } catch (err: any) {
      const reason = err?.message || '登入失敗，請確認信箱與密碼。';
      if (Platform.OS === 'web') {
        if (window.confirm(`登入失敗\n\n${reason}\n\n要先離線使用嗎？`)) {
          continueOffline();
        }
      } else {
        Alert.alert('登入失敗', reason, [
          { text: '確定', style: 'default' },
          { text: '先離線使用', onPress: continueOffline },
        ]);
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  // 建立新帳號處理
  async function handleRegister() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();
    const trimmedName = registerName.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      notify('提示', '請輸入有效的電子信箱');
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      notify('提示', '密碼長度至少需要 6 個字元');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      notify('提示', '兩次輸入的密碼不一致，請重新檢查');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await registerWithPassword(trimmedEmail, trimmedPassword, trimmedName);
      notify('註冊成功', `歡迎您加入 HoldYourHand！${trimmedName ? `${trimmedName}，` : ''}讓我們一起守護身心健康。`);
      if (result.onboardingCompleted) {
        router.replace('/dashboard');
      } else {
        router.push('/profile');
      }
    } catch (err: any) {
      const reason = err?.message || '建立帳號失敗，請稍後再試。';
      notify('建立帳號失敗', reason);
    } finally {
      setIsLoggingIn(false);
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
                  歡迎使用 · 守護身心健康
                </Text>
              </View>
            )}
          </View>

          <View style={styles.form}>
            {/* 1. 登入 / 建立新帳號 切換標籤 */}
            <View style={styles.tabContainer}>
              <Pressable
                style={[
                  styles.tabButton,
                  authMode === 'login' && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setAuthMode('login');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    authMode === 'login' && styles.tabButtonTextActive,
                  ]}
                >
                  登入
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.tabButton,
                  authMode === 'register' && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setAuthMode('register');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    authMode === 'register' && styles.tabButtonTextActive,
                  ]}
                >
                  建立新帳號
                </Text>
              </Pressable>
            </View>

            {/* 2. 建立新帳號：稱呼欄位 (選填) */}
            {authMode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>稱呼 / 暱稱 (選填)</Text>
                <View style={styles.inputWithIconRow}>
                  <View style={styles.inputIconPrefix}>
                    <User size={16} color={AuraColors.mutedDark} />
                  </View>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={registerName}
                    onChangeText={setRegisterName}
                    placeholder="您希望我們怎麼稱呼您？"
                    placeholderTextColor={AuraColors.mutedDark}
                    selectionColor={AuraColors.purple}
                  />
                </View>
              </View>
            )}

            {/* 3. 電子信箱欄位 (共用) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>電子信箱</Text>
              <View style={styles.inputWithIconRow}>
                <View style={styles.inputIconPrefix}>
                  <Mail size={16} color={AuraColors.mutedDark} />
                </View>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
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
            </View>

            {/* 4. 密碼欄位 (共用) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {authMode === 'register' ? '設定密碼 (至少 6 碼)' : '登入密碼'}
              </Text>
              <View style={styles.inputWithIconRow}>
                <View style={styles.inputIconPrefix}>
                  <Lock size={16} color={AuraColors.mutedDark} />
                </View>
                <TextInput
                  style={[styles.input, styles.inputFlex, { paddingRight: 44 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={authMode === 'register' ? '請設定 6 位數以上密碼' : '請輸入密碼'}
                  placeholderTextColor={AuraColors.mutedDark}
                  secureTextEntry={!showPassword}
                  selectionColor={AuraColors.purple}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={8}
                >
                  {showPassword ? (
                    <EyeOff size={17} color={AuraColors.mutedDark} />
                  ) : (
                    <Eye size={17} color={AuraColors.mutedDark} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* 5. 建立新帳號：確認密碼 */}
            {authMode === 'register' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>確認密碼</Text>
                <View style={styles.inputWithIconRow}>
                  <View style={styles.inputIconPrefix}>
                    <Lock size={16} color={AuraColors.mutedDark} />
                  </View>
                  <TextInput
                    style={[styles.input, styles.inputFlex, { paddingRight: 44 }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="請再次輸入相同密碼"
                    placeholderTextColor={AuraColors.mutedDark}
                    secureTextEntry={!showConfirmPassword}
                    selectionColor={AuraColors.purple}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    hitSlop={8}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={17} color={AuraColors.mutedDark} />
                    ) : (
                      <Eye size={17} color={AuraColors.mutedDark} />
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* 6. 主操作按鈕 (登入 或 建立帳號) */}
            <Pressable
              onPress={authMode === 'register' ? handleRegister : handlePasswordLogin}
              disabled={isLoggingIn}
              style={({ pressed }) => [
                styles.loginButtonWrapper,
                pressed && styles.loginButtonPressed,
              ]}
            >
              <View style={styles.loginButton}>
                {isLoggingIn && <ActivityIndicator size="small" color="#2E7D6E" />}
                <Text style={styles.loginButtonText}>
                  {isLoggingIn
                    ? authMode === 'register' ? '建立帳號中…' : '登入中…'
                    : authMode === 'register' ? '立即建立新帳號' : '帳號密碼登入'}
                </Text>

                <ArrowRight
                  size={17}
                  strokeWidth={2.3}
                  color="#2E7D6E"
                />
              </View>
            </Pressable>

            {/* 7. 切換登入 / 建立帳號 文字捷徑 */}
            <Pressable
              onPress={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setPassword('');
                setConfirmPassword('');
              }}
              style={styles.switchModeRow}
            >
              <Text style={styles.switchModeText}>
                {authMode === 'login' ? '還沒有帳號？' : '已經擁有帳號？'}
                <Text style={styles.switchModeLink}>
                  {authMode === 'login' ? '立即建立帳號' : '點此前往登入'}
                </Text>
              </Text>
            </Pressable>

            {/* 8. 其他登入方式分隔線 */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>其他快速登入</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 9. Google 與第三方登入（完全保留組員建置之功能） */}
            {Platform.OS === 'web' ? (
              <GoogleSignInButton
                onAccessToken={handleGoogleAccessToken}
                disabled={isLoggingIn}
              />
            ) : (
            <View style={styles.socialRow}>
              <Pressable
                onPress={handleNativeGoogle}
                disabled={isLoggingIn}
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
            )}

            {/* 10. 訪客身分體驗（完全保留） */}
            <Pressable
              onPress={handleGuestLogin}
              disabled={isLoggingIn}
              style={({ pressed }) => [styles.guestButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.guestButtonText}>以訪客身分體驗</Text>
              <Text style={styles.guestHintText}>資料只會存在這台裝置，不會上傳雲端</Text>
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

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1ECF7',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(215, 203, 234, 0.65)',
  },

  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },

  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },

  tabButtonText: {
    color: '#8A8598',
    fontSize: 13,
    fontWeight: '700',
  },

  tabButtonTextActive: {
    color: '#2E7D6E',
    fontWeight: '800',
  },

  inputGroup: {
    marginBottom: 16,
  },

  label: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  inputWithButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },

  inputIconPrefix: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },

  eyeButton: {
    position: 'absolute',
    right: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 2,
  },

  inputFlex: {
    flex: 1,
    paddingLeft: 40,
  },

  input: {
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(215, 203, 234, 0.95)',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#333333',
    fontSize: 14,
  },

  switchModeRow: {
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },

  switchModeText: {
    color: '#7E7889',
    fontSize: 12,
    fontWeight: '500',
  },

  switchModeLink: {
    color: '#2E7D6E',
    fontWeight: '800',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(215, 203, 234, 0.6)',
  },

  dividerText: {
    color: '#9C96A6',
    fontSize: 11,
    fontWeight: '600',
  },

  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 20,
  },

  socialButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(215, 203, 234, 0.95)',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  socialButtonText: {
    color: '#555555',
    fontSize: 13,
    fontWeight: '700',
  },

  loginButtonWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  loginButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#C0EDE2',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2E7D6E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },

  loginButtonText: {
    color: '#2E7D6E',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  loginButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  guestButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  guestButtonText: {
    color: '#2E7D6E',
    fontSize: 13,
    fontWeight: '700',
  },

  guestHintText: {
    color: '#8A8A8A',
    fontSize: 11,
    marginTop: 3,
  },
});