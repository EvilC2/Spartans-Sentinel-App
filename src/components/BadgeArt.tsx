// Sentinel — placeholder badge art.
// A bevelled hexagon in the rarity colour with the badge's initial inside.
// When real assets arrive, `badge.art` is rendered instead (same box).

import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, PanResponder, Platform } from 'react-native';
import { LinearGradient as Gradient } from 'expo-linear-gradient';
import Svg, { Polygon, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Badge, RARITY } from '../badges';
import { fonts } from '../theme';

const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

export const BadgeArt = ({ badge, size = 96, locked = false }: { badge: Badge; size?: number; locked?: boolean }) => {
  const r = RARITY[badge.rarity];
  const uid = badge.id.replace(/[^a-z0-9]/g, '');
  const glyph = badge.title.replace(/[^A-Za-z0-9#?]/g, '').charAt(0).toUpperCase() || '?';

  if (badge.art) {
    return <Image source={badge.art} style={{ width: size, height: size, opacity: locked ? 0.35 : 1 }} resizeMode="contain" />;
  }

  const rim = locked
    ? ['#C8CCD2', '#9AA0A8', '#6E747C']
    : r.chrome ? ['#FFFFFF', '#C9CFD6', '#7E868F', '#E9EDF1'] : [r.light, r.color, r.dark];
  const face = locked ? '#7A8089' : r.dark;

  return (
    <View style={{ width: size, height: size, opacity: locked ? 0.55 : 1 }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            {rim.map((col, i) => <Stop key={i} offset={i / (rim.length - 1)} stopColor={col} />)}
          </LinearGradient>
          <LinearGradient id={`face-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={locked ? '#8A9098' : r.color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={face} />
          </LinearGradient>
        </Defs>
        <Polygon points={hex(50, 52, 47)} fill={locked ? '#6E747C' : r.dark} opacity={0.35} />
        <Polygon points={hex(50, 50, 46)} fill={`url(#rim-${uid})`} />
        <Polygon points={hex(50, 50, 37)} fill={`url(#face-${uid})`} />
        <Polygon points={hex(50, 50, 37)} fill="none" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={1.2} />
        <SvgText
          x="50" y="50" fill="#FFFFFF" fontSize="38" fontWeight="600"
          textAnchor="middle" alignmentBaseline="central"
          fontFamily={fonts.serif}
        >
          {glyph}
        </SvgText>
      </Svg>
    </View>
  );
};

// Rarity chip: filled in the rarity colour, white text, soft glow in the same
// colour. Exotic gets a chromatic (holographic) gradient instead of a flat
// fill. Used on the detail sheet and as the group heading on the list.
const CHROME = ['#7AD7F0', '#B48CFF', '#FF9AD5', '#FFD98A', '#9AF0C8'] as const;

export const RarityPill = ({ rarity, small = false }: { rarity: Badge['rarity']; small?: boolean }) => {
  const r = RARITY[rarity];
  const pad = { paddingVertical: small ? 3 : 5, paddingHorizontal: small ? 9 : 13 };
  const label = (
    <Text style={{
      fontSize: small ? 11 : 12.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#FFFFFF',
      textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
    }}>
      {r.label}
    </Text>
  );
  const glow = {
    shadowColor: r.chrome ? '#B48CFF' : r.color, shadowOpacity: 0.55, shadowRadius: small ? 6 : 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  };
  if (r.chrome) {
    return (
      <View style={[{ alignSelf: 'flex-start', borderRadius: 999 }, glow]}>
        <Gradient colors={CHROME} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[pad, { borderRadius: 999 }]}>
          {label}
        </Gradient>
      </View>
    );
  }
  return (
    <View style={[{ alignSelf: 'flex-start', borderRadius: 999, backgroundColor: r.color }, pad, glow]}>
      {label}
    </View>
  );
};

// Detail-sheet art: sits in 3D and tilts with the phone. Device motion drives
// the pose (gyro-style parallax); a finger drag still nudges it and it springs
// back on release. Web / no sensor: rest lean only.
export const TiltBadge = ({ badge, size, locked }: { badge: Badge; size: number; locked: boolean }) => {
  const rx = useRef(new Animated.Value(0)).current;
  const ry = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const MAX = 22;
  const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | undefined;
    let base: { beta: number; gamma: number } | null = null;
    try {
      // Lazy: native module is absent on web.
      const { DeviceMotion } = require('expo-sensors') as typeof import('expo-sensors');
      DeviceMotion.setUpdateInterval(33);
      sub = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        const beta = (rotation.beta * 180) / Math.PI;   // front/back
        const gamma = (rotation.gamma * 180) / Math.PI; // left/right
        if (!base) base = { beta, gamma };              // pose when the sheet opened = neutral
        rx.setValue(clamp((beta - base.beta) * 0.6));
        ry.setValue(clamp((gamma - base.gamma) * 0.6));
      });
    } catch { /* no sensors: stay still */ }
    return () => sub?.remove();
  }, [rx, ry]);

  const settle = () => Animated.parallel([
    Animated.spring(rx, { toValue: 0, friction: 5, tension: 60, useNativeDriver: true }),
    Animated.spring(ry, { toValue: 0, friction: 5, tension: 60, useNativeDriver: true }),
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
  ]).start();

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => Animated.spring(scale, { toValue: 1.04, useNativeDriver: true }).start(),
    onPanResponderMove: (_, g) => { ry.setValue(clamp(g.dx / 4)); rx.setValue(clamp(-g.dy / 4)); },
    onPanResponderRelease: settle,
    onPanResponderTerminate: settle,
  })).current;

  const deg = (v: Animated.Value, offset = 0) =>
    Animated.add(v, new Animated.Value(offset)).interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] });

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{
        width: size, height: size,
        transform: [{ perspective: 700 }, { rotateX: deg(rx, 8) }, { rotateY: deg(ry) }, { scale }],
      }}
    >
      <BadgeArt badge={badge} size={size} locked={locked} />
    </Animated.View>
  );
};
