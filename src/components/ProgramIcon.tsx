// Spartans — the icon tile for a class or program: its Fluent 3D emoji
// (src/programIcons.ts) on a soft wash of the program's colour.
// `bare` drops the tile: just the emoji, for rows that wear the wash themselves.

import React from 'react';
import { View, Image } from 'react-native';
import { useTheme } from '../ThemeContext';
import { subjectImage } from '../programIcons';
import type { ProgramKind } from '../programs';

// '#1A3A5C' → rgba at `a`. Anything else passes through.
export const wash = (hex: string, a: number) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Program colours are deep (navy, plum, brown) and vanish on the dark theme.
// In dark mode lift them to a bright, slightly richer version of the same hue;
// light mode passes them through. Use for text, bars, badges and washes.
export const glow = (hex: string, mode: 'light' | 'dark') => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (mode !== 'dark' || !m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const l0 = (max + min) / 2;
  const s0 = d ? d / (1 - Math.abs(2 * l0 - 1)) : 0;
  const l = Math.max(l0, 0.7), s = Math.min(0.85, s0 * 1.2 + 0.15);
  const k = (x: number) => (x + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (x: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(x) - 3, 9 - k(x), 1))));
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('');
};
// Text or icon colour that reads on top of a glow()ed fill.
export const onGlow = (mode: 'light' | 'dark') => mode === 'dark' ? '#0C1117' : '#FFFFFF';

export const ProgramIcon = ({ name, kind, color, size = 44, bare = false }: { name: string; kind?: ProgramKind; color: string; size?: number; bare?: boolean }) => {
  const { mode } = useTheme();
  if (bare) return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={subjectImage(name, kind)} style={{ width: size * 0.8, height: size * 0.8 }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
  return (
    <View style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      backgroundColor: wash(glow(color, mode), mode === 'dark' ? 0.2 : 0.13),
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Image source={subjectImage(name, kind)} style={{ width: size * 0.66, height: size * 0.66 }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
};
