import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Feather, Hand, Smile, Sparkles } from 'lucide-react-native';

export type BFRBBehaviorType = '摳皮膚' | '拔毛髮' | '咬指甲' | '其他' | '其它' | string;

interface BFRBIconBadgeProps {
  type: BFRBBehaviorType;
  size?: number;
  iconSize?: number;
  style?: ViewStyle;
}

export function BFRBIconBadge({
  type,
  size = 32,
  iconSize,
  style,
}: BFRBIconBadgeProps) {
  const calculatedIconSize = iconSize || Math.round(size * 0.52);

  let bg = '#F5C0C0'; // 摳皮膚：淡粉色
  let shadow = '#E8A2B6';
  let IconComponent = Hand;

  if (type === '拔毛髮') {
    bg = '#D7CCEB'; // 拔毛髮：淡雅薰衣草紫
    shadow = '#C0B3DB';
    IconComponent = Feather;
  } else if (type === '咬指甲') {
    bg = '#CDE1F8'; // 咬指甲：柔和淡藍色
    shadow = '#A4C8F0';
    IconComponent = Smile;
  } else if (type === '其他' || type === '其它') {
    bg = '#FDE68A'; // 其它：和煦淺黃色
    shadow = '#E2BD4E';
    IconComponent = Sparkles;
  }

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          shadowColor: shadow,
        },
        style,
      ]}
    >
      <IconComponent size={calculatedIconSize} color="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
