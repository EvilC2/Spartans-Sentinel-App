// Sentinel — placeholder badge art.
// A bevelled hexagon in the rarity colour with the badge's initial inside.
// When real assets arrive, `badge.art` is rendered instead (same box).

import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, PanResponder, Platform } from 'react-native';
import { LinearGradient as Gradient } from 'expo-linear-gradient';
import Svg, { Polygon, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Badge, RARITY, SEASON, SEASON_ORDER, Rarity, Season, Tint, tintOf } from '../badges';
import { fonts } from '../theme';

const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

export const BadgeArt = ({ badge, size = 96, locked = false }: { badge: Badge; size?: number; locked?: boolean }) => {
  const r = tintOf(badge);
  const uid = badge.id.replace(/[^a-z0-9]/g, '');
  const glyph = badge.title.replace(/[^A-Za-z0-9#?]/g, '').charAt(0).toUpperCase() || '?';

  if (badge.art) {
    return <Image source={badge.art} style={{ width: size, height: size, opacity: locked ? 0.35 : 1 }} resizeMode="contain" />;
  }
  if (badge.custom && badge.custom.mode !== 'original') return <CustomBadge badge={badge} size={size} locked={locked} />;

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

// ── Badge team art ──────────────────────────────────────────────
// The rarity template: a glossy bevelled hexagon after the "rare" template
// (App Badge Ideas/rare.png), drawn in SVG so every rarity gets its colour
// and it stays sharp at any size. `empty` is the seasonal slot: dashed, no
// fill, waiting for art.
export const BadgeTemplate = ({ tint, size, empty = false, locked = false, id = 'tpl' }: {
  tint: Tint; size: number; empty?: boolean; locked?: boolean; id?: string;
}) => {
  const uid = id.replace(/[^a-zA-Z0-9]/g, '');
  if (empty) {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points={hex(50, 50, 44)} fill={tint.color} fillOpacity={0.08} stroke={tint.color} strokeOpacity={0.7} strokeWidth={1.6} strokeDasharray="4 3" strokeLinejoin="round" />
      </Svg>
    );
  }
  const rim = locked ? ['#C8CCD2', '#9AA0A8', '#6E747C', '#9AA0A8']
    : tint.chrome ? ['#FFFFFF', '#C9CFD6', '#7E868F', '#E9EDF1'] : [tint.light, tint.color, tint.dark, tint.color];
  const face = locked ? ['#8A9098', '#5E646C'] : [tint.color, tint.dark];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`trim-${uid}`} x1="0.1" y1="0" x2="0.9" y2="1">
          {rim.map((col, i) => <Stop key={i} offset={i / (rim.length - 1)} stopColor={col} />)}
        </LinearGradient>
        <LinearGradient id={`tface-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={face[0]} />
          <Stop offset="1" stopColor={face[1]} />
        </LinearGradient>
        <LinearGradient id={`tsheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Polygon points={hex(50, 50, 47.5)} fill={locked ? '#9AA0A8' : tint.light} opacity={0.28} />
      <Polygon points={hex(50, 50, 44)} fill={`url(#trim-${uid})`} />
      <Polygon points={hex(50, 50, 44)} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={0.9} strokeLinejoin="round" />
      <Polygon points={hex(50, 50, 37.5)} fill={locked ? '#4D535B' : tint.dark} />
      <Polygon points={hex(50, 50, 35.5)} fill={`url(#tface-${uid})`} />
      <Polygon points="22,34 60,15 78,60 40,86" fill={`url(#tsheen-${uid})`} />
      <Polygon points={hex(50, 50, 35.5)} fill="none" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.8} strokeLinejoin="round" />
    </Svg>
  );
};

// Placement of an icon on the template, in points inside a `size` box.
export const iconBox = (a: { x: number; y: number; scale: number }, size: number) => {
  const w = a.scale * size;
  return { left: size / 2 + a.x * size - w / 2, top: size / 2 + a.y * size - w / 2, width: w, height: w };
};

const CustomBadge = ({ badge, size, locked }: { badge: Badge; size: number; locked: boolean }) => {
  const a = badge.custom!;
  if (a.mode === 'original') return null;
  if (a.mode === 'image') {
    return <Image source={{ uri: a.uri }} style={{ width: size, height: size, opacity: locked ? 0.35 : 1 }} resizeMode="contain" />;
  }
  const tint = tintOf(badge);
  // Seasonal with no art stays an empty slot; with an icon it sits on a
  // template in the season's colour.
  const empty = a.mode === 'template' && badge.rarity === 'seasonal';
  return (
    <View style={{ width: size, height: size, opacity: locked ? (a.mode === 'icon' ? 0.45 : 0.6) : 1 }}>
      <BadgeTemplate tint={tint} size={size} empty={empty} locked={locked} id={badge.id} />
      {a.mode === 'icon' && <Image source={{ uri: a.uri }} style={{ position: 'absolute', ...iconBox(a, size) }} resizeMode="contain" />}
    </View>
  );
};

// The badges glyph (silver star shield): Home level pill, Me badges button,
// Badges page header.
const BADGE_ICON = require('../../assets/brand/badge-icon.png');
export const BadgeIcon = ({ size = 22 }: { size?: number }) => (
  <Image source={BADGE_ICON} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Badges" />
);

// Rarity chip: filled in the rarity colour, white text, soft glow in the same
// colour. Exotic gets a chromatic (holographic) gradient instead of a flat
// fill. Used on the detail sheet and as the group heading on the list.
const CHROME = ['#7AD7F0', '#B48CFF', '#FF9AD5', '#FFD98A', '#9AF0C8'] as const;

const SEASON_CHROME = SEASON_ORDER.map(k => SEASON[k].color) as unknown as readonly [string, string, ...string[]];

export const RarityPill = ({ rarity, season, tint, small = false }: { rarity: Rarity; season?: Season; tint?: Tint; small?: boolean }) => {
  // A seasonal badge's own outline colour wins over the season's.
  const r = tint ?? (season ? SEASON[season] : RARITY[rarity]);
  // Seasonal with no specific season (the group heading) rotates through all four.
  const gradient = r.chrome ? CHROME : rarity === 'seasonal' && !season ? SEASON_CHROME : null;
  const pad = { paddingVertical: small ? 3 : 5, paddingHorizontal: small ? 9 : 13 };
  const label = (
    <Text style={{
      fontSize: small ? 11 : 12.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#FFFFFF',
      textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
    }}>
      {season ? `${SEASON[season].label} · Seasonal` : r.label}
    </Text>
  );
  const glow = {
    shadowColor: r.chrome ? '#B48CFF' : r.color, shadowOpacity: 0.55, shadowRadius: small ? 6 : 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  };
  if (gradient) {
    return (
      <View style={[{ alignSelf: 'flex-start', borderRadius: 999 }, glow]}>
        <Gradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[pad, { borderRadius: 999 }]}>
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
