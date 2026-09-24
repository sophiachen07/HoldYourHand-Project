import { useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';

import * as Haptics from 'expo-haptics';
import { AlertTriangle, X } from 'lucide-react-native';

import { AuraColors } from '../constants/auraTheme';

type PickingAlertModalProps = {
  visible: boolean;
  onClose: () => void;
  onFalseDetection: () => void;
};

export function PickingAlertModal({
  visible,
  onClose,
  onFalseDetection,
}: PickingAlertModalProps) {
    useEffect(() => {
    if (!visible) {
        return;
    }

    let cancelled = false;

    const wait = (ms: number) =>
        new Promise((resolve) =>
        setTimeout(resolve, ms)
        );

    const vibrate = async () => {
        try {
        // 先重震一下
        await Haptics.impactAsync(
            Haptics.ImpactFeedbackStyle.Heavy
        );

        await wait(80);

        if (cancelled) {
            return;
        }

        if (Platform.OS === 'android') {
            // 震 400ms → 停 120ms → 再震 500ms
            Vibration.vibrate(
            [0, 400, 120, 500],
            false
            );
        } else {
            // iPhone 無法自由指定震動強度，
            // 用多次震動增加提醒感
            Vibration.vibrate();

            await wait(200);

            if (cancelled) {
            return;
            }

            Vibration.vibrate();

            await wait(200);

            if (cancelled) {
            return;
            }

            Vibration.vibrate();
        }

        await wait(200);

        if (cancelled) {
            return;
        }

        await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
        );
        } catch {
        // 不支援震動時不影響 Alert
        }
    };

    vibrate();

    return () => {
        cancelled = true;
        Vibration.cancel();
    };
    }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <AlertTriangle
                size={22}
                color={AuraColors.white}
              />
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="關閉提醒"
            >
              <X
                size={20}
                color={AuraColors.muted}
              />
            </Pressable>
          </View>

          <Text style={styles.title}>
            偵測到摳抓動作
          </Text>

          <Text style={styles.description}>
            請放鬆手部，暫停摳抓。
          </Text>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              我知道了
            </Text>
          </Pressable>

          <Pressable
            onPress={onFalseDetection}
            hitSlop={8}
            style={({ pressed }) => [
              styles.falseDetectionLink,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.falseDetectionText}>
              偵測有誤？不記錄這次
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,

    // 背景遮罩再深一點，讓視線集中到提醒視窗。
    backgroundColor: 'rgba(3, 2, 10, 0.86)',
  },

  modalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.70)',
    borderRadius: 22,

    // 改成接近實色，不再沿用較透明的 cardStrong。
    backgroundColor: '#120e24',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  iconCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: AuraColors.warning,
  },

  closeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  title: {
    marginTop: 18,
    color: AuraColors.white,
    fontSize: 22,
    fontWeight: '900',
  },

  description: {
    marginTop: 8,
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },

  primaryButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: AuraColors.warning,
  },

  primaryButtonText: {
    color: AuraColors.white,
    fontSize: 15,
    fontWeight: '900',
  },

  falseDetectionLink: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginTop: 4,
  },

  falseDetectionText: {
    color: '#aeb8c6',
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  pressed: {
    opacity: 0.68,
  },
});
