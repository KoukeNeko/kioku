import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0B0C10',
    backgroundElement: '#1C1D22',
    backgroundSelected: '#2E3135',
    textSecondary: '#8E8F94',
    // Kioku Accents
    primaryOrange: '#FF6B35', // Action buttons like "学習する"
    ratingAgain: '#FF4A4A', // <1m (Red)
    ratingHard: '#FF9E4A',  // 8m (Orange)
    ratingGood: '#4CAF50',  // 4日 (Green)
    ratingEasy: '#4DA6FF',  // 9日 (Blue)
    pitchLine: '#4DA6FF',   // Blue graph line
    pitchNode: '#4DA6FF',
    pitchNodeFill: '#0B0C10',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'SourceHanSerif-Regular',
    serifBold: 'SourceHanSerif-Bold',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'SourceHanSerif-Regular',
    serifBold: 'SourceHanSerif-Bold',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  seven: 128,
  eight: 256,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};
