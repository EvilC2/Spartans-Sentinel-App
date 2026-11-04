// Sentinel — design tokens, ported from styles.css.
// CSS custom properties became two plain objects (light / dark) read through
// useTheme(). Every `var(--ink)` in the web build is now `c.ink`.

import { Platform, ViewStyle } from 'react-native';

export type Mode = 'light' | 'dark';

const brand = {
  navy900: '#0E2238',
  navy800: '#14304E',
  navy700: '#1A3A5C',
  navy600: '#2A5687',
  gold: '#B68842',
  crimson: '#A23E3E',
  moss: '#5B7A4E',
  silver: '#C0C0C0',
  // Spartans rebrand: a lighter, more playful blue for The Buzz and other fun
  // surfaces, plus a vibrant white for tiles that sit on it.
  sky: '#3B8BD9',
  sky600: '#2E74BD',
  white: '#FFFFFF',
};

const light = {
  ...brand,
  navy50: '#EEF2F7',
  ink: '#0F1419',
  ink2: '#2C3239',
  ink3: '#5C6470',
  ink4: '#8A93A0',
  line: '#E7E4DD',
  line2: '#EFECE5',
  paper: '#FAF9F5',
  paper2: '#F4F1EA',
  surface: '#FFFFFF',
  goldTint: '#F6EBD3',
  crimsonTint: '#F4E3E0',
  mossTint: '#E6EFDF',
  skyTint: '#E4F1FC',
  // text links, filled action buttons and warnings; brighter twins in dark
  link: '#1A3A5C',
  action: '#1A3A5C',
  danger: '#A23E3E',
  // outside the 430px frame, on tablets / web
  backdrop: '#F0EEE9',
  hatch: 'rgba(14,34,56,0.06)',
  tabBarBg: 'rgba(250,249,245,0.85)',
  blurTint: 'light' as 'light' | 'dark',
};

const dark: typeof light = {
  ...brand,
  navy50: '#1A2434',
  ink: '#F4F2EC',
  ink2: '#D7D2C5',
  ink3: '#9A9588',
  ink4: '#6B6759',
  line: '#2A2F35',
  line2: '#1F242A',
  paper: '#0C1117',
  paper2: '#131922',
  surface: '#161D26',
  goldTint: '#2A2415',
  crimsonTint: '#2A1717',
  mossTint: '#17241A',
  skyTint: '#12263A',
  link: '#8FBDF0',
  action: '#2F6FB8',
  danger: '#EF8A8A',
  backdrop: '#06090D',
  hatch: 'rgba(255,255,255,0.07)',
  tabBarBg: 'rgba(12,17,23,0.85)',
  blurTint: 'dark' as 'light' | 'dark',
};

export type Palette = typeof light;

export const colors: Record<Mode, Palette> = { light, dark };

// --sans / --serif / --mono. `sans: undefined` lets the platform pick its own
// UI face — SF on iOS, Roboto on Android — which is what the CSS stack did.
export const fonts = {
  sans: undefined as string | undefined,
  serif: 'Newsreader_500Medium',
  serifRegular: 'Newsreader_400Regular',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

export const radii = { sm: 10, md: 14, lg: 20, xl: 26 };

// Shadow that follows a PNG's shape, not its box. iOS draws layer shadows
// from the pixels when the view has no background; Android and web need a
// drop-shadow filter. PNG_SHADOW is the deep one for badges on Social.
export const pngShadow = (y: number, blur: number, alpha: number) => Platform.select<ViewStyle>({
  ios: { shadowColor: '#06121F', shadowOffset: { width: 0, height: y }, shadowOpacity: alpha, shadowRadius: blur },
  android: { filter: [{ dropShadow: { offsetX: 0, offsetY: y, standardDeviation: blur, color: `rgba(6,18,31,${alpha})` } }] } as ViewStyle,
  default: { filter: `drop-shadow(0px ${y}px ${blur}px rgba(6,18,31,${alpha}))` } as unknown as ViewStyle,
});
export const PNG_SHADOW = pngShadow(10, 11, 0.6);

// CSS box-shadows → RN shadow* (iOS) + elevation (Android). The web build
// layered two shadows per token; RN takes one, so opacity is nudged up to
// compensate for the dropped inner layer.
export const shadow = {
  sm: {
    shadowColor: '#0E2238',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0E2238',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0E2238',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  none: {},
} as const;

// font-variant-numeric: tabular-nums → the .tnum class, now a style object.
export const tnum = { fontVariant: ['tabular-nums' as const] };

// Phone-width column, matching .app-frame max-width.
export const FRAME_MAX_WIDTH = 430;

// CSS `linear-gradient(<deg>, …)` → LinearGradient start/end fractions.
// CSS 0deg points up; RN's y axis points down.
export function angleToVector(deg: number) {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  return {
    start: { x: 0.5 - dx / 2, y: 0.5 - dy / 2 },
    end: { x: 0.5 + dx / 2, y: 0.5 + dy / 2 },
  };
}

export const G165 = angleToVector(165);
export const G155 = angleToVector(155);
export const G135 = angleToVector(135);
export const G90 = angleToVector(90);
