// Spartans — the XP button. Level, a progress bar to the next level, and how
// far there is to go. Tap for the XP sheet. No box around it, so it sits on
// any surface: Home under the greeting, Profile under the name.
//   compact  just "Lv 23", for places with no room for a bar
//   rank     adds the rank title after the level
//   inside   Home, under the greeting: "Level 3" and "40 XP to level 4" as a
//            line of text, the same bold-then-quiet as the date line above it,
//            over a thin bar like the one on the day card. The rank emblem
//            stays in the XP sheet, one tap away.

import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { tnum, G90 } from '../theme';
import { levelState, levelTitle, useXpVersion } from '../xp';
import { useEarnedVersion } from '../earned';

export const XP_GOLD = '#E8D8AE';   // light end of the XP bar gradient

export const XpBar = ({ onPress, compact = false, rank = false, inside = false, style }: { onPress?: () => void; compact?: boolean; rank?: boolean; inside?: boolean; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  useXpVersion(); useEarnedVersion();
  const lv = levelState();
  const label = `Level ${lv.level}, ${levelTitle(lv.level)}. ${lv.toNext} XP to level ${lv.level + 1}. Open XP and levels`;

  if (inside) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={label}
        style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, style]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <Text numberOfLines={1} style={[{ fontSize: 14, fontWeight: '700', color: c.ink, letterSpacing: -0.1 }, tnum]}>
            Level {lv.level}
          </Text>
          <Text numberOfLines={1} style={[{ flexShrink: 1, fontSize: 13, color: c.ink3, letterSpacing: -0.1 }, tnum]}>
            {lv.toNext.toLocaleString()} XP to level {lv.level + 1}
          </Text>
        </View>
        {/* Empty at 0 XP: no token fill, the line above says what's needed. */}
        <View style={{ marginTop: 6, height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
          {lv.progress > 0 && (
            <View style={{ width: `${lv.progress * 100}%`, minWidth: 4, height: '100%', borderRadius: 2, backgroundColor: c.gold }} />
          )}
        </View>
      </Pressable>
    );
  }

  const level = (
    <Text style={[{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }, tnum]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.ink3, letterSpacing: 0.6 }}>LV </Text>
      {lv.level}
      {rank && <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.ink3, letterSpacing: -0.1 }}>  {levelTitle(lv.level)}</Text>}
    </Text>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={10}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 }, style]}
    >
      {level}
      {!compact && (
        <>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
            <LinearGradient
              colors={[XP_GOLD, c.gold]}
              start={G90.start}
              end={G90.end}
              style={{ width: `${Math.max(3, Math.round(lv.progress * 100))}%`, height: '100%', borderRadius: 3 }}
            />
          </View>
          <Text style={[{ fontSize: 11.5, color: c.ink3, fontWeight: '500' }, tnum]}>{lv.toNext.toLocaleString()} XP to {lv.level + 1}</Text>
        </>
      )}
    </Pressable>
  );
};
