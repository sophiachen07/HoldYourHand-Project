import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  Heart,
  MessageCircle,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  User,
} from 'lucide-react-native';

import { AuraColors } from '../constants/auraTheme';
import { getApiBaseUrl } from '../constants/apiConfig';
import {
  getProfileDrivers,
  getProfileTypes,
  useUser,
} from '../contexts/UserContext';

// 預設保底安撫文字
const FALLBACK_REPLY =
  '我現在有點累在休息，但我會一直陪著你，我們一起深呼吸好嗎？';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

const QUICK_PROMPTS = [
  '我剛剛手又忍不住一直摳，覺得好挫折...',
  '現在突然感到一陣強烈的焦慮感。',
  '可以陪我一起做個深呼吸嗎？',
  '今天我有成功克制住衝動喔！',
];

export default function TreeholeChatScreen() {
  const { profile, todayRecord, behaviorStats } = useUser();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: '你好呀！我是守把手陪伴小助手 🌱\n\n無論你現在感到焦慮、緊張，或是剛剛又忍不住動手了，我都一直在這裡陪著你。想聊些什麼呢？',
      timestamp: formatTime(new Date()),
    },
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const abortControllerRef = useRef<AbortController | null>(null);

  // 呼吸光點動畫（思考中提示）
  useEffect(() => {
    if (isTyping) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTyping, pulseAnim]);

  // 元件卸載時中斷未完成的網路請求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 當訊息更新或載入狀態變更時，自動平滑捲動到底部
  const scrollToBottom = useCallback((animated: boolean = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 120);
  }, []);

  // -------------------------------------------------------------
  // 發送訊息核心邏輯
  // -------------------------------------------------------------
  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputMessage).trim();
      if (!text || isTyping) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        sender: 'user',
        text,
        timestamp: formatTime(new Date()),
      };

      // 1. 立即將使用者訊息推入畫面
      setMessages((prev) => [...prev, userMsg]);
      setInputMessage('');
      setIsTyping(true);
      scrollToBottom(true);

      // 2. 準備使用者的 BFRB 背景數據
      const drivers = getProfileDrivers(profile);
      const types = getProfileTypes(profile);
      const selectedType = types[0] || '摳皮膚';
      const todayCount =
        behaviorStats[selectedType]?.todayCount ??
        todayRecord?.occurred ??
        0;

      const userDataPayload = {
        age: profile.age || '21',
        gender: profile.gender || '男性',
        bfrbType: types.join('、') || '摳皮膚',
        innerDriver: drivers.join('、') || '壓力與焦慮驅動',
        statusAndCount: `今日發生 ${todayCount} 次`,
      };

      // 3. 建立 15 秒超時 AbortController
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            userData: userDataPayload,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let replyText = FALLBACK_REPLY;

        if (response.ok) {
          const data = await response.json();
          replyText = data.reply || FALLBACK_REPLY;
        } else {
          // 若收到後端 500 或非 200 錯誤，使用保底訊息
          console.warn('[Treehole] 後端回傳非 200 狀態碼:', response.status);
          try {
            const errData = await response.json();
            replyText = errData.reply || FALLBACK_REPLY;
          } catch (e) {
            replyText = FALLBACK_REPLY;
          }
        }

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          timestamp: formatTime(new Date()),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (error: any) {
        clearTimeout(timeoutId);
        console.warn('[Treehole] 發送請求發生例外或超時:', error.message);

        // 4. 保底機制：網路斷線、超時或異常
        const fallbackMsg: ChatMessage = {
          id: `fallback-${Date.now()}`,
          sender: 'assistant',
          text: FALLBACK_REPLY,
          timestamp: formatTime(new Date()),
          isError: true,
        };

        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsTyping(false);
        abortControllerRef.current = null;
        scrollToBottom(true);
      }
    },
    [
      inputMessage,
      isTyping,
      profile,
      todayRecord,
      behaviorStats,
      scrollToBottom,
    ]
  );

  // 清除對話紀錄回到初始狀態
  const handleResetChat = useCallback(() => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: '對話已重新整理。無論有什麼話想說，我隨時都在這裡聆聽。🌱',
        timestamp: formatTime(new Date()),
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 沉浸式背景與光暈 */}
      <View style={styles.background}>
        <View style={styles.pinkGlow} />
        <View style={styles.purpleGlow} />
      </View>

      {/* 頂部導航列 */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/dashboard' as any);
            }
          }}
          hitSlop={10}
        >
          <ChevronLeft size={20} color={AuraColors.white} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>守把手小樹洞</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>陪伴中</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>專屬你的溫暖傾聽空間</Text>
        </View>

        <Pressable
          style={styles.resetButton}
          onPress={handleResetChat}
          hitSlop={8}
        >
          <RefreshCw size={16} color={AuraColors.muted} />
        </Pressable>
      </View>

      {/* 鍵盤避讓容器 */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {/* 對話清單 */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(false)}
          renderItem={({ item }) => (
            <MessageBubble message={item} />
          )}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingContainer}>
                <View style={styles.assistantAvatar}>
                  <Text style={styles.avatarEmoji}>🌱</Text>
                </View>
                <View style={styles.typingBubble}>
                  <Animated.View
                    style={[styles.typingDot, { opacity: pulseAnim }]}
                  />
                  <Text style={styles.typingText}>小助手思考中...</Text>
                </View>
              </View>
            ) : null
          }
        />

        {/* 快速提示標籤 (Quick Prompts) */}
        <View style={styles.quickPromptsSection}>
          <FlatList
            horizontal
            data={QUICK_PROMPTS}
            keyExtractor={(_, index) => `prompt-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickPromptsList}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.quickPromptChip,
                  pressed && styles.quickPromptChipPressed,
                ]}
                onPress={() => handleSendMessage(item)}
                disabled={isTyping}
              >
                <Text style={styles.quickPromptText}>{item}</Text>
              </Pressable>
            )}
          />
        </View>

        {/* 底部輸入列 */}
        <View style={styles.inputBarContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="傾訴你的感受與想法..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
              maxLength={300}
              editable={!isTyping}
            />
            <Pressable
              style={({ pressed }) => [
                styles.sendButton,
                (!inputMessage.trim() || isTyping) && styles.sendButtonDisabled,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isTyping}
            >
              <LinearGradient
                colors={
                  inputMessage.trim() && !isTyping
                    ? [AuraColors.pink, AuraColors.purple]
                    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                }
                style={styles.sendButtonGradient}
              >
                {isTyping ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Send size={16} color="#ffffff" />
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* 免責提醒 */}
          <Text style={styles.disclaimerText}>
            🌿 陪伴小助手僅供心理舒緩與情緒引導，不提供醫療診斷或處方。
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// 子元件：單則訊息氣泡
// -------------------------------------------------------------
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === 'user';

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant,
      ]}
    >
      {!isUser && (
        <View style={styles.assistantAvatar}>
          <Text style={styles.avatarEmoji}>🌱</Text>
        </View>
      )}

      <View style={styles.bubbleContent}>
        {isUser ? (
          <LinearGradient
            colors={['#ec4899', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userBubbleGradient}
          >
            <Text style={styles.userMessageText}>{message.text}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.assistantBubbleCard}>
            <Text style={styles.assistantMessageText}>{message.text}</Text>
          </View>
        )}

        <Text
          style={[
            styles.timestampText,
            isUser ? styles.timestampRight : styles.timestampLeft,
          ]}
        >
          {message.timestamp}
        </Text>
      </View>

      {isUser && (
        <View style={styles.userAvatar}>
          <User size={15} color="#ffffff" />
        </View>
      )}
    </View>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// -------------------------------------------------------------
// 樣式表 (StyleSheet)
// -------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AuraColors.backgroundDeep,
  },

  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },

  pinkGlow: {
    position: 'absolute',
    top: 80,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(236,72,153,0.08)',
  },

  purpleGlow: {
    position: 'absolute',
    bottom: 120,
    left: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(139,92,246,0.08)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  headerTitleContainer: {
    alignItems: 'center',
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AuraColors.white,
  },

  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#14b8a6',
  },

  onlineText: {
    fontSize: 10,
    color: '#14b8a6',
    fontWeight: '700',
  },

  headerSubtitle: {
    fontSize: 11,
    color: AuraColors.muted,
    marginTop: 2,
  },

  resetButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  chatContainer: {
    flex: 1,
  },

  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
    gap: 8,
  },

  bubbleRowUser: {
    justifyContent: 'flex-end',
  },

  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },

  assistantAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(236,72,153,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  avatarEmoji: {
    fontSize: 16,
  },

  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(139,92,246,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  bubbleContent: {
    maxWidth: '74%',
  },

  userBubbleGradient: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },

  userMessageText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  assistantBubbleCard: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  assistantMessageText: {
    color: AuraColors.white,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },

  timestampText: {
    fontSize: 10,
    color: AuraColors.mutedDark,
    marginTop: 4,
  },

  timestampLeft: {
    textAlign: 'left',
    marginLeft: 4,
  },

  timestampRight: {
    textAlign: 'right',
    marginRight: 4,
  },

  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },

  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },

  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ec4899',
  },

  typingText: {
    fontSize: 12,
    color: AuraColors.muted,
  },

  quickPromptsSection: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },

  quickPromptsList: {
    paddingHorizontal: 16,
    gap: 8,
  },

  quickPromptChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  quickPromptChipPressed: {
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderColor: 'rgba(236,72,153,0.3)',
  },

  quickPromptText: {
    fontSize: 12,
    color: AuraColors.muted,
    fontWeight: '500',
  },

  inputBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: AuraColors.backgroundDeep,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },

  textInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 90,
    color: AuraColors.white,
    fontSize: 14,
    lineHeight: 18,
    paddingVertical: 6,
  },

  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    opacity: 0.4,
  },

  sendButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disclaimerText: {
    textAlign: 'center',
    fontSize: 10,
    color: AuraColors.mutedDark,
    marginTop: 8,
  },
});
