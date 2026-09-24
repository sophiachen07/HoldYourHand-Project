import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Alert,
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

import {
  Activity,
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Fingerprint,
  Sparkles,
  User,
} from 'lucide-react-native';

import { AuraColors } from '../constants/auraTheme';
import {
  BFRB_BEHAVIOR_TYPES,
  BFRB_DRIVERS,
  getProfileDrivers,
  getProfileTypes,
  useUser,
} from '../contexts/UserContext';

export default function ProfileScreen() {
  const { profile, hasCompletedOnboarding, updateProfile, completeOnboarding } =
    useUser();

  const [name, setName] = useState(profile.name || '宇航');
  const [age, setAge] = useState(profile.age || '21');
  const [gender, setGender] = useState(profile.gender || '男性');
  const [bfrbDrivers, setBfrbDrivers] = useState<string[]>(() =>
    getProfileDrivers(profile)
  );
  const [bfrbTypes, setBfrbTypes] = useState<string[]>(() =>
    getProfileTypes(profile)
  );

  // 若 Context 中的 profile 更新則同步至本機表單
  useEffect(() => {
    setName(profile.name);
    setAge(profile.age);
    setGender(profile.gender);
    setBfrbDrivers(getProfileDrivers(profile));
    setBfrbTypes(getProfileTypes(profile));
  }, [profile]);

  function toggleDriver(driver: string) {
    setBfrbDrivers((prev) => {
      if (prev.includes(driver)) {
        if (prev.length <= 1) {
          Alert.alert('提示', '請至少保留一個內在驅動因素');
          return prev;
        }
        return prev.filter((d) => d !== driver);
      } else {
        return [...prev, driver];
      }
    });
  }

  function toggleType(type: string) {
    setBfrbTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length <= 1) {
          Alert.alert('提示', '請至少保留一個重複行為類型');
          return prev;
        }
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  }

  async function handleSaveOrContinue() {
    if (!name.trim()) {
      Alert.alert('提示', '請輸入姓名或暱稱');
      return;
    }

    if (!age || Number(age) <= 0 || Number(age) > 120) {
      Alert.alert('提示', '請輸入有效年齡');
      return;
    }

    const updatedData = {
      name: name.trim(),
      age: age.trim(),
      gender,
      bfrbDrivers,
      bfrbTypes,
      bfrbDriver: bfrbDrivers.join('、'),
      bfrbType: bfrbTypes.join('、'),
    };

    if (!hasCompletedOnboarding) {
      // 初次使用流程：完成設定並標記 Onboarding 為完成
      await completeOnboarding(updatedData);
      router.push('/device');
    } else {
      // 偏好設定修改流程：儲存後返回上一頁
      await updateProfile(updatedData);
      router.back();
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        <View style={styles.purpleGlow} />
        <View style={styles.cyanGlow} />
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
          {/* 頂部導航 */}
          <View style={styles.navigation}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ChevronLeft size={20} color={AuraColors.white} />
            </Pressable>

            <Text style={styles.navigationTitle}>
              {hasCompletedOnboarding ? '編輯個人基本資料' : '初次使用引導設定'}
            </Text>
          </View>

          {/* 標題區域 */}
          <View style={styles.headerArea}>
            <View style={styles.badgeRow}>
              <LinearGradient
                colors={[AuraColors.purple, AuraColors.cyan]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stepBadge}
              >
                <Sparkles size={12} color="#ffffff" />
                <Text style={styles.stepBadgeText}>
                  {hasCompletedOnboarding ? '個人設定' : '第 1 / 2 步 · 建立檔案'}
                </Text>
              </LinearGradient>
            </View>

            <Text style={styles.title}>個人基本資料</Text>

            <Text style={styles.description}>
              建立精準的個人生理基線與 BFRB
              行為特徵模型，提供專屬的防護與舒壓回饋。
            </Text>
          </View>

          {/* 基本資料卡片 */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <User size={16} color={AuraColors.cyan} />
              <Text style={styles.cardTitle}>基本生理資料</Text>
            </View>

            <Text style={styles.label}>姓名／暱稱</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="請輸入姓名或暱稱"
              placeholderTextColor={AuraColors.mutedDark}
            />

            <Text style={styles.label}>年齡</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="請輸入年齡 (例如：21)"
              placeholderTextColor={AuraColors.mutedDark}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>性別</Text>
            <View style={styles.genderRow}>
              {['男性', '女性', '其他'].map((item) => {
                const isSelected = gender === item;
                return (
                  <Pressable
                    key={item}
                    style={[
                      styles.genderButton,
                      isSelected && styles.genderButtonSelected,
                    ]}
                    onPress={() => setGender(item)}
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        isSelected && styles.genderButtonTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 區塊 1：BFRB 內在驅動篩查 (支援複選) */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Brain size={16} color="#c084fc" />
              <Text style={styles.cardTitle}>BFRB 內在驅動篩查</Text>
              <View style={styles.multiBadge}>
                <Text style={styles.multiBadgeText}>可複選</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>
              請選擇最常誘發或觸發您行為的主要內在動機與心理情境（可複選多項）：
            </Text>

            {/* 分類：無意識 */}
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryTagUnconscious}>
                  <Text style={styles.categoryTagTextUnconscious}>
                    【無意識】驅動
                  </Text>
                </View>
                <Text style={styles.categoryHint}>
                  放空、專注或自動化出現
                </Text>
              </View>

              <View style={styles.optionsList}>
                {BFRB_DRIVERS.UNCONSCIOUS.map((driver, index) => {
                  const isSelected = bfrbDrivers.includes(driver);
                  return (
                    <Pressable
                      key={driver}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => toggleDriver(driver)}
                    >
                      <View style={styles.optionContentRow}>
                        <View style={styles.optionIndexBadge}>
                          <Text style={styles.optionIndexText}>{index + 1}</Text>
                        </View>
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.optionTextSelected,
                          ]}
                        >
                          {driver}
                        </Text>
                      </View>
                      {isSelected ? (
                        <CheckCircle2 size={18} color="#c084fc" />
                      ) : (
                        <Circle size={18} color={AuraColors.mutedDark} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 分類：有意識 */}
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryTagConscious}>
                  <Text style={styles.categoryTagTextConscious}>
                    【有意識】驅動
                  </Text>
                </View>
                <Text style={styles.categoryHint}>
                  尋求刺激或消除不適感
                </Text>
              </View>

              <View style={styles.optionsList}>
                {BFRB_DRIVERS.CONSCIOUS.map((driver, index) => {
                  const isSelected = bfrbDrivers.includes(driver);
                  return (
                    <Pressable
                      key={driver}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                      onPress={() => toggleDriver(driver)}
                    >
                      <View style={styles.optionContentRow}>
                        <View style={styles.optionIndexBadge}>
                          <Text style={styles.optionIndexText}>{index + 1}</Text>
                        </View>
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.optionTextSelected,
                          ]}
                        >
                          {driver}
                        </Text>
                      </View>
                      {isSelected ? (
                        <CheckCircle2 size={18} color="#c084fc" />
                      ) : (
                        <Circle size={18} color={AuraColors.mutedDark} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 區塊 2：身體集中重複行為類型 (支援複選) */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Fingerprint size={16} color={AuraColors.cyan} />
              <Text style={styles.cardTitle}>身體集中重複行為類型</Text>
              <View style={[styles.multiBadge, { backgroundColor: 'rgba(6,182,212,0.15)', borderColor: 'rgba(6,182,212,0.35)' }]}>
                <Text style={[styles.multiBadgeText, { color: AuraColors.cyan }]}>可複選</Text>
              </View>
            </View>
            <Text style={styles.cardSubtitle}>
              請選擇手環演算法首要辨識與防護的行為類型（可複選多項）：
            </Text>

            <View style={styles.typesGrid}>
              {BFRB_BEHAVIOR_TYPES.map((type) => {
                const isSelected = bfrbTypes.includes(type);
                return (
                  <Pressable
                    key={type}
                    style={[
                      styles.typeButton,
                      isSelected && styles.typeButtonSelected,
                    ]}
                    onPress={() => toggleType(type)}
                  >
                    <View style={styles.typeIconRow}>
                      <Text style={styles.typeEmoji}>
                        {type === '摳皮膚'
                          ? '🖐️'
                          : type === '拔毛髮'
                          ? '💇'
                          : type === '咬指甲'
                          ? '🦷'
                          : '✨'}
                      </Text>
                      {isSelected && (
                        <Check size={14} color={AuraColors.cyan} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.typeText,
                        isSelected && styles.typeTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 底部操作按鈕 */}
          <Pressable
            style={({ pressed }) => [
              styles.continueButtonWrapper,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSaveOrContinue}
          >
            <LinearGradient
              colors={[AuraColors.purple, AuraColors.cyan]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.continueButton}
            >
              <Text style={styles.continueButtonText}>
                {hasCompletedOnboarding
                  ? '儲存修改並返回'
                  : '完成設定並連接裝置'}
              </Text>
              {hasCompletedOnboarding ? (
                <Check size={18} color="#ffffff" />
              ) : (
                <ArrowRight size={18} color="#ffffff" />
              )}
            </LinearGradient>
          </Pressable>
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
    top: 60,
    left: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(139,92,246,0.10)',
  },

  cyanGlow: {
    position: 'absolute',
    right: -130,
    top: '40%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },

  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: AuraColors.border,
    backgroundColor: AuraColors.card,
  },

  navigationTitle: {
    color: AuraColors.white,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 12,
  },

  headerArea: {
    marginBottom: 20,
  },

  badgeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  stepBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  title: {
    color: AuraColors.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  description: {
    color: AuraColors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },

  card: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AuraColors.border,
    borderRadius: 18,
    backgroundColor: AuraColors.card,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },

  cardTitle: {
    color: AuraColors.white,
    fontSize: 14,
    fontWeight: '800',
  },

  multiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
    marginLeft: 4,
  },

  multiBadgeText: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: '700',
  },

  cardSubtitle: {
    color: AuraColors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },

  label: {
    color: AuraColors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },

  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: AuraColors.white,
    fontSize: 13,
  },

  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },

  genderButton: {
    flex: 1,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  genderButtonSelected: {
    borderColor: AuraColors.cyan,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },

  genderButtonText: {
    color: AuraColors.muted,
    fontSize: 12,
    fontWeight: '600',
  },

  genderButtonTextSelected: {
    color: AuraColors.white,
    fontWeight: '700',
  },

  categorySection: {
    marginTop: 10,
    marginBottom: 10,
  },

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  categoryTagUnconscious: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },

  categoryTagTextUnconscious: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
  },

  categoryTagConscious: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },

  categoryTagTextConscious: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '700',
  },

  categoryHint: {
    color: AuraColors.mutedDark,
    fontSize: 10,
  },

  optionsList: {
    gap: 8,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  optionCardSelected: {
    borderColor: 'rgba(192, 132, 252, 0.5)',
    backgroundColor: 'rgba(139, 92, 246, 0.10)',
  },

  optionContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  optionIndexBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionIndexText: {
    color: AuraColors.muted,
    fontSize: 10,
    fontWeight: '700',
  },

  optionText: {
    color: AuraColors.muted,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  optionTextSelected: {
    color: AuraColors.white,
    fontWeight: '700',
  },

  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  typeButton: {
    width: '48.5%',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  typeButtonSelected: {
    borderColor: AuraColors.cyan,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },

  typeIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  typeEmoji: {
    fontSize: 18,
  },

  typeText: {
    color: AuraColors.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  typeTextSelected: {
    color: AuraColors.white,
    fontWeight: '700',
  },

  continueButtonWrapper: {
    marginTop: 10,
    borderRadius: 15,
    shadowColor: AuraColors.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },

  continueButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
  },

  continueButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
});