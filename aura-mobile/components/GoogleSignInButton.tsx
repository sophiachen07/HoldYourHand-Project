// ==========================================
// Google 登入按鈕（僅網頁版）
// 使用 Google Identity Services 的 OAuth 授權：
// 取得 Access Token 後交給後端驗證，並讀取姓名、大頭貼、生日、性別
// ==========================================
import { FontAwesome } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { userApi } from '../services/userApi';

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/user.birthday.read',
  'https://www.googleapis.com/auth/user.gender.read',
].join(' ');

type Props = {
  onAccessToken: (accessToken: string) => void;
  disabled?: boolean;
};

let scriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('無法載入 Google 登入元件，請檢查網路'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function GoogleSignInButton({ onAccessToken, disabled }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const tokenClientRef = useRef<any>(null);
  const callbackRef = useRef(onAccessToken);
  callbackRef.current = onAccessToken;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;

    async function setup() {
      try {
        const { googleClientId } = await userApi.getConfig();
        if (cancelled) return;
        if (!googleClientId) {
          setMessage('後端尚未設定 GOOGLE_CLIENT_ID，暫時無法使用 Google 登入');
          return;
        }

        await loadGoogleScript();
        if (cancelled) return;

        tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: GOOGLE_SCOPES,
          callback: (response: { access_token?: string; error?: string }) => {
            if (response?.access_token) {
              callbackRef.current(response.access_token);
            } else if (response?.error) {
              setMessage('Google 授權未完成，請再試一次');
            }
          },
        });
        setIsReady(true);
        setMessage(null);
      } catch (err: any) {
        if (!cancelled) setMessage(err?.message || 'Google 登入初始化失敗');
      }
    }

    setup();
    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  function handlePress() {
    setMessage(null);
    // 必須在點擊事件中呼叫，瀏覽器才不會擋掉 Google 的彈出視窗
    tokenClientRef.current?.requestAccessToken();
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        disabled={!isReady || disabled}
        style={({ pressed }) => [
          styles.button,
          (!isReady || disabled) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        {isReady ? (
          <FontAwesome name="google" size={17} color="#ea4335" />
        ) : (
          <ActivityIndicator size="small" color="#999999" />
        )}
        <Text style={styles.buttonText}>使用 Google 帳戶登入</Text>
      </Pressable>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'stretch',
    marginBottom: 14,
  },
  button: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#3C4043',
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    marginTop: 6,
    color: '#9B6B6B',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default GoogleSignInButton;
