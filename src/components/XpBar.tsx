// Spartans — the XP button. Level, a progress bar to the next level, and how
// far there is to go. Tap for the XP sheet. No box around it, so it sits on
// any surface: Home under the greeting, Profile under the name.
//   compact  just "Lv 23", for places with no room for a bar
//   rank     adds the rank title after the level
//   inside   rank emblem (level inside) and a thicker, shorter bar with
//            "into / span XP" written on it

import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { tnum, G90 } from '../theme';
import { levelState, levelTitle, rankFor, useXpVersion } from '../xp';
import { RankEmblem } from './RankEmblem';
import { useEarnedVersion } from '../earned';

export const XP_GOLD = '#E8D8AE';   // light end of the XP bar gradient

export const XpBar = ({ onPress, compact = false, rank = false, inside = false, style }: { onPress?: () => void; compact?: boolean; rank?: boolean; inside?: boolean; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  useXpVersion(); useEarnedVersion();
  const lv = levelState();

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
      accessibilityLabel={`Level ${lv.level}, ${levelTitle(lv.level)}. ${lv.toNext} XP to level ${lv.level + 1}. Open XP and levels`}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 }, style]}
    >
      {inside ? <RankEmblem rank={rankFor(lv.level)} level={lv.level} size={30} /> : level}
      {!compact && inside && (
        <>
          <View style={{ flex: 1, maxWidth: 190, height: 18, borderRadius: 9, backgroundColor: c.line, overflow: 'hidden', justifyContent: 'center' }}>
            <LinearGradient
              colors={[XP_GOLD, c.gold]}
              start={G90.start}
              end={G90.end}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(6, Math.round(lv.progress * 100))}%`, borderRadius: 9 }}
            />
            <Text style={[{ fontSize: 10.5, fontWeight: '700', color: c.ink, textAlign: 'center', letterSpacing: 0.1 }, tnum]}>
              {lv.into.toLocaleString()} / {lv.span.toLocaleString()} XP
            </Text>
          </View>
          {/* the level this bar fills up to; the emblem on the left is the one it's leaving */}
          <Text style={[{ fontSize: 13, fontWeight: '800', color: c.ink2, letterSpacing: -0.2 }, tnum]}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: c.ink3, letterSpacing: 0.6 }}>LV </Text>{lv.level + 1}
          </Text>
        </>
      )}
      {!compact && !inside && (
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
