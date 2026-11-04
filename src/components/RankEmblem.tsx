// Spartans — rank emblem. A hex shield in the rank's tier colours with the
// level number in the middle. Used big in the XP sheet hero, small on the
// rank road and next to the Home XP bar.
//   ring    0–1: draws a progress ring round the shield (progress to next level)
//   locked  grey, with no number: a rank not reached yet

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';
import { tnum } from '../theme';
import type { Rank } from '../xp';

// Pointy-top hexagon with softened corners, in a 100 × 100 box.
const HEX = 'M50 4 C53 4 55 5 57.5 6.4 L87 23.4 C92 26.3 94 29.5 94 35 L94 65 C94 70.5 92 73.7 87 76.6 L57.5 93.6 C55 95 53 96 50 96 C47 96 45 95 42.5 93.6 L13 76.6 C8 73.7 6 70.5 6 65 L6 35 C6 29.5 8 26.3 13 23.4 L42.5 6.4 C45 5 47 4 50 4 Z';
const INNER = 'M50 14 L83 33 L83 67 L50 86 L17 67 L17 33 Z';
const LOCKED: [string, string] = ['#C9CDD3', '#8A929C'];

let uid = 0;

export const RankEmblem = ({ rank, level, size = 64, ring, locked = false, track = 'rgba(255,255,255,0.16)' }: {
  rank: Rank; level?: number; size?: number; ring?: number; locked?: boolean; track?: string;
}) => {
  const id = React.useMemo(() => `re${uid++}`, []);
  const [a, b] = locked ? LOCKED : rank.colors;
  const pad = ring != null ? size * 0.14 : 0;
  const box = size + pad * 2;
  const r = box / 2 - Math.max(2, size * 0.035);
  const circ = 2 * Math.PI * r;
  const label = level ?? rank.level;
  const digits = String(label).length;

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {ring != null && (
        <Svg width={box} height={box} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={rank.colors[0]} />
              <Stop offset="1" stopColor={rank.glow} />
            </LinearGradient>
          </Defs>
          <Circle cx={box / 2} cy={box / 2} r={r} stroke={track} strokeWidth={Math.max(3, size * 0.06)} fill="none" />
          <Circle
            cx={box / 2} cy={box / 2} r={r}
            stroke={`url(#${id}r)`} strokeWidth={Math.max(3, size * 0.06)} fill="none" strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - Math.min(1, Math.max(0.02, ring)))}
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
          />
        </Svg>
      )}
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`${id}a`} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={a} />
            <Stop offset="1" stopColor={b} />
          </LinearGradient>
          <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0.55} />
            <Stop offset="0.5" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={HEX} fill={`url(#${id}a)`} />
        <Path d={INNER} fill="rgba(0,0,0,0.16)" stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
        <Path d={HEX} fill={`url(#${id}b)`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {locked ? (
          <Svg width={size * 0.3} height={size * 0.3} viewBox="0 0 24 24">
            <Path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <Path d="M5 11h14v9H5z" fill="#fff" />
          </Svg>
        ) : (
          <Text style={[{
            fontSize: size * (digits >= 3 ? 0.3 : 0.38), fontWeight: '900', color: '#fff', letterSpacing: -0.5,
            textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
          }, tnum]}>{label}</Text>
        )}
      </View>
    </View>
  );
};
