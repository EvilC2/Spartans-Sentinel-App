// Sentinel — the real school crest (navy shield, three laurel wreaths, lamp of
// knowledge, "Summis cum animis" banner), from the school's 2025 logo update.
// assets/crest.png is the official navy artwork; assets/crest-white.png is a
// white-on-transparent cut of the same shape for navy backgrounds.

import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const CREST_NAVY = require('../../assets/crest.png');
const CREST_WHITE = require('../../assets/crest-white.png');
export const WORDMARK = require('../../assets/wordmark.png');

// Trimmed artwork is 448 × 657.
export const CREST_RATIO = 657 / 448;
export const WORDMARK_RATIO = 429 / 1413;

const isLight = (color: string) => {
  const c = color.trim().toLowerCase();
  if (c === 'white' || c === '#fff' || c === '#ffffff') return true;
  const m = c.match(/^#([0-9a-f]{6})$/);
  if (!m) return c.startsWith('rgba(255') || c.startsWith('rgb(255');
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6;
};

type Props = { size?: number; color?: string; style?: StyleProp<ImageStyle> };

// `size` is the crest's width; height follows the artwork's aspect ratio.
// `color` picks the variant: light colours → white crest, anything else → navy.
export const SentinelCrest = ({ size = 28, color = '#143B68', style }: Props) => (
  <Image
    source={isLight(color) ? CREST_WHITE : CREST_NAVY}
    resizeMode="contain"
    style={[{ width: size, height: size * CREST_RATIO }, style]}
    accessibilityLabel="Sentinel Secondary crest"
  />
);

// Large variant — same artwork; used for the hero watermark, the student ID
// card and the splash. Defaults to white for navy backgrounds.
export const SentinelCrestLarge = ({ size = 160, color = '#fff', style }: Props) => (
  <SentinelCrest size={size} color={color} style={style} />
);

// Horizontal lockup: crest + "SENTINEL · Sentinel Secondary · École Secondaire".
export const SentinelWordmark = ({ width = 200, style }: { width?: number; style?: StyleProp<ImageStyle> }) => (
  <Image
    source={WORDMARK}
    resizeMode="contain"
    style={[{ width, height: width * WORDMARK_RATIO }, style]}
    accessibilityLabel="Sentinel Secondary"
  />
);
