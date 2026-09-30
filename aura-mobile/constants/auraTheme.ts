export const AuraColors = {
  background: '#EDE5F8',
  backgroundDeep: '#DEEEF8',

  card: 'rgba(255, 255, 255, 0.82)',
  cardPure: '#FFFFFF',
  cardStrong: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(255, 255, 255, 0.95)',
  borderFocus: '#9B8AC1',

  textPrimary: '#1A2151',
  textSecondary: '#64748B',
  white: '#333333', // 保持相容舊版 white 指標為主要深色文字
  textWhite: '#FFFFFF', // 真正用於深色按鈕上的白字
  muted: '#7E7889',
  mutedDark: '#9C96A6',

  // 核心主題配色
  purple: '#9B8AC1',
  cyan: '#CDE1F8',
  softBlue: '#CDE1F8',
  pink: '#F5C0C0',
  mint: '#CAE7E0',

  // 狀態與生理指標色
  normal: '#CAE7E0',
  normalDark: '#2E7D6E',
  warning: '#F5C0C0',
  warningDark: '#D9534F',
  caution: '#F9D99A',
  cautionDark: '#B8860B',
} as const;