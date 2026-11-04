// Spartans — "you got a badge" moment.
// Full-screen overlay: dark backdrop, a glowing radial burst in the badge's
// colour with slow-turning rays, sparks flying out, and the badge art
// springing up to fill the middle of the screen. Text lands after the badge.
// Tap anywhere to dismiss.
//
// Plain Animated (no reanimated): everything runs on the native driver.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, useWindowDimensions, Platform } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Polygon, G } from 'react-native-svg';
import { Badge, tintOf } from '../badges';
import { BadgeArt, RarityPill } from './BadgeArt';

const SPARKS = 14;

export const BadgeUnlock = ({ badge, onDone }: { badge: Badge | null; onDone: () => void }) => {
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState<Badge | null>(null);

  // Animation values
  const backdrop = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.2)).current;
  const tilt = useRef(new Animated.Value(-14)).current;
  const artOpacity = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const sparks = useRef(Array.from({ length: SPARKS }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (!badge) return;
    setShown(badge);
    backdrop.setValue(0); glow.setValue(0); pulse.setValue(0); spin.setValue(0);
    scale.setValue(0.2); tilt.setValue(-14); artOpacity.setValue(0); text.setValue(0);
    sparks.forEach(v => v.setValue(0));

    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    Animated.sequence([
      Animated.timing(backdrop, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(artOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 5.5, tension: 42, useNativeDriver: true }),
        Animated.spring(tilt, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.stagger(28, sparks.map(v => Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }))),
      ]),
      Animated.timing(text, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [badge]);

  const close = () => {
    Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setShown(null);
      onDone();
    });
  };

  if (!shown) return null;
  const b = shown;
  const tint = tintOf(b);
  const art = Math.min(width * 0.78, 340);
  const cx = width / 2;
  const cy = height * 0.42;
  const R = Math.max(width, height) * 0.62;
  const rays = Array.from({ length: 18 }, (_, i) => (360 / 18) * i);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={{ flex: 1, opacity: backdrop, backgroundColor: 'rgba(5,12,28,0.94)' }}>
        <Pressable style={{ flex: 1 }} onPress={close}>
          {/* Glow + rays */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2,
            opacity: glow,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }}>
            <Svg width={R * 2} height={R * 2} viewBox="-100 -100 200 200">
              <Defs>
                <RadialGradient id="burst" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={tint.light} stopOpacity={0.95} />
                  <Stop offset="0.28" stopColor={tint.color} stopOpacity={0.7} />
                  <Stop offset="0.6" stopColor={tint.dark} stopOpacity={0.25} />
                  <Stop offset="1" stopColor={tint.dark} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <G>
                {rays.map((a, i) => (
                  <Polygon key={i} points="0,0 -4,-100 4,-100" fill={tint.light} opacity={i % 2 ? 0.16 : 0.09} transform={`rotate(${a})`} />
                ))}
              </G>
              <Circle cx={0} cy={0} r={100} fill="url(#burst)" />
            </Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: cx - R * 0.55, top: cy - R * 0.55, width: R * 1.1, height: R * 1.1,
            opacity: Animated.multiply(glow, pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] })),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }) }],
          }}>
            <Svg width={R * 1.1} height={R * 1.1} viewBox="-100 -100 200 200">
              <Defs>
                <RadialGradient id="core" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
                  <Stop offset="0.35" stopColor={tint.light} stopOpacity={0.5} />
                  <Stop offset="1" stopColor={tint.color} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={0} cy={0} r={100} fill="url(#core)" />
            </Svg>
          </Animated.View>

          {/* Sparks */}
          {sparks.map((v, i) => {
            const a = (Math.PI * 2 * i) / SPARKS + (i % 2 ? 0.2 : 0);
            const dist = art * (0.55 + (i % 3) * 0.14);
            const size = 5 + (i % 4) * 2;
            return (
              <Animated.View key={i} pointerEvents="none" style={{
                position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size, borderRadius: size / 2,
                backgroundColor: i % 3 ? tint.light : '#FFFFFF',
                opacity: v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.9, 0] }),
                transform: [
                  { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * dist] }) },
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * dist] }) },
                  { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.3, 0.6] }) },
                ],
              }} />
            );
          })}

          {/* Badge */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: cx - art / 2, top: cy - art / 2, width: art, height: art,
            opacity: artOpacity,
            transform: [
              { perspective: 800 },
              { scale },
              { rotate: tilt.interpolate({ inputRange: [-14, 0], outputRange: ['-14deg', '0deg'] }) },
              { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
            ],
          }}>
            <BadgeArt badge={b} size={art} />
          </Animated.View>

          {/* Text */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: 28, right: 28, top: cy + art / 2 + 18, alignItems: 'center',
            opacity: text,
            transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
          }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tint.light, letterSpacing: 2, textTransform: 'uppercase' }}>Badge unlocked</Text>
            <Text style={{ fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.9, textAlign: 'center', marginTop: 6, lineHeight: 40,
              textShadowColor: tint.color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 }}>
              {b.title}
            </Text>
            <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.78)', textAlign: 'center', marginTop: 8, lineHeight: 23 }}>{b.desc}</Text>
            <View style={{ marginTop: 14 }}><RarityPill rarity={b.rarity} season={b.season} tint={b.tint} /></View>
            {!!b.flavor && <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', textAlign: 'center', marginTop: 16 }}>{b.flavor}</Text>}
          </Animated.View>

          <Animated.Text style={{
            position: 'absolute', bottom: Platform.OS === 'ios' ? 52 : 32, left: 0, right: 0, textAlign: 'center',
            fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.3, opacity: text,
          }}>
            Tap anywhere to continue
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};
