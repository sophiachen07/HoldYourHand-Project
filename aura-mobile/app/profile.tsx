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
          {/* 頂部導航 */}
          <View style={styles.navigation}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ChevronLeft size={20} color="#333333" />
            </Pressable>

            <Text style={styles.navigationTitle}>
              {hasCompletedOnboarding ? '編輯個人基本資料' : '初次使用引導設定'}
            </Text>
          </View>

          {/* 標題區域 */}
          <View style={styles.headerArea}>
            <View style={styles.badgeRow}>
              <View style={styles.stepBadge}>
                <Sparkles size={12} color="#2E7D6E" />
                <Text style={styles.stepBadgeText}>
                  {hasCompletedOnboarding ? '個人設定' : '第 1 / 2 步 · 建立檔案'}
                </Text>
              </View>
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
              <User size={16} color="#9B8AC1" />
              <Text style={styles.cardTitle}>基本生理資料</Text>
            </View>

            <Text style={styles.label}>姓名／暱稱</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="請輸入姓名或暱稱"
              placeholderTextColor="#9C96A6"
            />

            <Text style={styles.label}>年齡</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="請輸入年齡 (例如：21)"
              placeholderTextColor="#9C96A6"
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
              <Brain size={16} color="#9B8AC1" />
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
                        <CheckCircle2 size={18} color="#9B8AC1" />
                      ) : (
                        <Circle size={18} color="#9C96A6" />
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
                        <CheckCircle2 size={18} color="#2E7D6E" />
                      ) : (
                        <Circle size={18} color="#9C96A6" />
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
              <Fingerprint size={16} color="#2E7D6E" />
              <Text style={styles.cardTitle}>身體集中重複行為類型</Text>
              <View style={[styles.multiBadge, { backgroundColor: 'rgba(202,231,224,0.4)', borderColor: 'rgba(202,231,224,0.8)' }]}>
                <Text style={[styles.multiBadgeText, { color: '#2E7D6E' }]}>可複選</Text>
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
                        <Check size={14} color="#2E7D6E" />
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
            <View style={styles.continueButton}>
              <Text style={styles.continueButtonText}>
                {hasCompletedOnboarding
                  ? '儲存修改並返回'
                  : '完成設定並連接裝置'}
              </Text>
              {hasCompletedOnboarding ? (
                <Check size={18} color="#2E7D6E" />
              ) : (
                <ArrowRight size={18} color="#2E7D6E" />
              )}
            </View>
          </Pressable>
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
    borderBottomColor: 'rgba(155, 138, 193, 0.12)',
  },

  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(155,138,193,0.3)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  navigationTitle: {
    color: '#333333',
    fontSize: 15,
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
    backgroundColor: '#c0ede2',
  },

  stepBadgeText: {
    color: '#2E7D6E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  title: {
    color: '#1A2151',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  description: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  card: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    shadowColor: '#9B8AC1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },

  cardTitle: {
    color: '#1A2151',
    fontSize: 15,
    fontWeight: '800',
  },

  multiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 192, 192, 0.4)',
    borderWidth: 1,
    borderColor: '#F5C0C0',
    marginLeft: 4,
  },

  multiBadgeText: {
    color: '#D9534F',
    fontSize: 10,
    fontWeight: '700',
  },

  cardSubtitle: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },

  label: {
    color: '#5A5A5A',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },

  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#1A2151',
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
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },

  genderButtonSelected: {
    borderColor: 'rgba(202,231,224,0.9)',
    backgroundColor: 'rgba(202,231,224,0.35)',
    borderWidth: 1.5,
  },

  genderButtonText: {
    color: '#7E7889',
    fontSize: 12,
    fontWeight: '600',
  },

  genderButtonTextSelected: {
    color: '#2E7D6E',
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
    backgroundColor: 'rgba(245, 192, 192, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F5C0C0',
  },

  categoryTagTextUnconscious: {
    color: '#D9534F',
    fontSize: 11,
    fontWeight: '700',
  },

  categoryTagConscious: {
    backgroundColor: 'rgba(202, 231, 224, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(202, 231, 224, 0.9)',
  },

  categoryTagTextConscious: {
    color: '#2E7D6E',
    fontSize: 11,
    fontWeight: '700',
  },

  categoryHint: {
    color: '#9C96A6',
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
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  optionCardSelected: {
    borderColor: 'rgba(155, 138, 193, 0.8)',
    backgroundColor: 'rgba(155, 138, 193, 0.12)',
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
    backgroundColor: 'rgba(226, 232, 240, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionIndexText: {
    color: '#7E7889',
    fontSize: 10,
    fontWeight: '700',
  },

  optionText: {
    color: '#5A5A5A',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  optionTextSelected: {
    color: '#1A2151',
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
    borderColor: 'rgba(226, 232, 240, 0.8)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  typeButtonSelected: {
    borderColor: 'rgba(202,231,224,0.9)',
    backgroundColor: 'rgba(202,231,224,0.35)',
    borderWidth: 1.5,
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
    color: '#5A5A5A',
    fontSize: 13,
    fontWeight: '600',
  },

  typeTextSelected: {
    color: '#2E7D6E',
    fontWeight: '700',
  },

  continueButtonWrapper: {
    marginTop: 10,
    borderRadius: 15,
    shadowColor: '#c0ede2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },

  continueButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    backgroundColor: '#c0ede2',
  },

  continueButtonText: {
    color: '#2E7D6E',
    fontSize: 14,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
});