// Spartans — social avatar. Friends see your profile photo when you have
// one (shared with friends and with anyone who looks up your friend code,
// Clive's call 2026-10-15). Without a photo: a colour and, if the student
// picks one, an emoji.
//
// Stored as { tone, glyph? } on the profile (profiles.avatar, migration
// 0014). Anything off-list from the server is dropped by avatarOf(), so a
// friend's card can only ever show one of these tones and glyphs.

import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type AvatarSpec = { tone: number; glyph?: string };

// Light → dark pairs. `wash` is the light end at low strength, for card tints.
export const AVATAR_TONES: { name: string; colors: [string, string] }[] = [
  { name: 'Spartan', colors: ['#3B8BD9', '#1A3A5C'] },
  { name: 'Crimson', colors: ['#E0716B', '#8E2B2B'] },
  { name: 'Gold', colors: ['#F2C46B', '#A8742A'] },
  { name: 'Forest', colors: ['#8CC97A', '#3E6B35'] },
  { name: 'Teal', colors: ['#5FD0C8', '#1F6E78'] },
  { name: 'Violet', colors: ['#B795F5', '#5B33A3'] },
  { name: 'Sunset', colors: ['#FFB077', '#D2456B'] },
  { name: 'Slate', colors: ['#9AA7B8', '#3C4757'] },
  { name: 'Berry', colors: ['#F28BC0', '#8C2F6B'] },
  { name: 'Ocean', colors: ['#7FD4FF', '#2847A8'] },
];

export const AVATAR_GLYPHS = [
  '🦁', '🐺', '🦊', '🐻', '🐼', '🐯', '🦅', '🐉', '🦈', '🐙',
  '⚡', '🔥', '⭐', '🌙', '🌊', '🍀', '🎮', '🎨', '🎸', '🎧',
  '🏀', '⚽', '🏐', '🏒', '📚', '🧪', '🚀', '🎭', '🍕',
];

const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

// Clean a stored value; fall back to a stable tone from the name.
export const avatarOf = (raw: unknown, seed = ''): AvatarSpec => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { tone?: unknown; glyph?: unknown };
  const tone = typeof r.tone === 'number' && r.tone >= 0 && r.tone < AVATAR_TONES.length ? Math.floor(r.tone) : hash(seed) % AVATAR_TONES.length;
  const glyph = typeof r.glyph === 'string' && AVATAR_GLYPHS.includes(r.glyph) ? r.glyph : undefined;
  return glyph ? { tone, glyph } : { tone };
};

export const toneOf = (a: AvatarSpec) => AVATAR_TONES[a.tone] || AVATAR_TONES[0];
// Hex + alpha, for washes behind a card.
export const wash = (a: AvatarSpec, alpha = '22') => toneOf(a).colors[0] + alpha;

export const Avatar = ({ spec, uri, initials, size = 44, onPress, label, ring }: {
  spec: AvatarSpec; uri?: string; initials: string; size?: number; onPress?: () => void; label?: string; ring?: string;
}) => {
  const [a, b] = toneOf(spec).colors;
  const pad = ring ? Math.max(2, Math.round(size * 0.05)) : 0;
  const body = (
    <View style={{ width: size + pad * 2, height: size + pad * 2, borderRadius: (size + pad * 2) / 2, padding: pad, backgroundColor: ring }}>
      {uri ? (
        // the tone shows while the photo loads
        <Image source={{ uri }} resizeMode="cover" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: b }} />
      ) : (
      <LinearGradient colors={[a, b]} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* soft top light so it reads as a token, not a flat dot */}
        <View style={{ position: 'absolute', top: -size * 0.35, left: -size * 0.1, width: size * 1.2, height: size * 0.7, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.12)' }} />
        {spec.glyph
          ? <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62, textAlign: 'center' }}>{spec.glyph}</Text>
          : <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700', letterSpacing: 0.3 }}>{initials}</Text>}
      </LinearGradient>
      )}
    </View>
  );
  if (!onPress) return <View accessibilityLabel={label}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {body}
    </Pressable>
  );
};
