// Spartans — event-day banner. Shows once when you open the app on a big day
// (Collab Day, Pro-D, snow day, multicultural lunch…). A tall card in the
// day's colours over a dimmed app, with drifting particles (snow, confetti,
// sparkles, bubbles), the day's 3D art, and one button.
//
// If the day carries a badge you don't have yet, the button says "Claim
// badge" and closing it plays the badge unlock (NotifyProvider does that).
// Secret badges stay a surprise: the button just says "Got it".
//
// Plain Animated, native driver. UI copy: no em dashes.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Animated, Easing, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, G155 } from '../theme';
import { Icon } from './Icon';
import { BADGES, UNLOCKED } from '../badges';
import { fromISO } from '../calendar';
import type { EventDay, Particle } from '../notify/eventDays';
import type { TabId } from './Chrome';

const COUNT = 18;

// Deterministic "random" so particles don't jump between renders.
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
};

const ParticleView = ({ kind, color, size }: { kind: Particle; color: string; size: number }) => {
  if (kind === 'sparkle') return <Icon name="sparkle" size={size * 1.6} stroke={1.6} color={color} />;
  if (kind === 'confetti') return <View style={{ width: size * 0.7, height: size * 1.4, borderRadius: 2, backgroundColor: color }} />;
  if (kind === 'bubble') return <View style={{ width: size * 1.4, height: size * 1.4, borderRadius: size, borderWidth: 1.5, borderColor: color, opacity: 0.8 }} />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.9 }} />;
};

// Snow and confetti fall; sparkles and bubbles rise.
const Particles = ({ kind, colors, w, h }: { kind: Particle; colors: string[]; w: number; h: number }) => {
  const vals = useRef(Array.from({ length: COUNT }, () => new Animated.Value(0))).current;
  const falls = kind === 'snow' || kind === 'confetti';
  useEffect(() => {
    const loops = vals.map((v, i) => {
      v.setValue(rand(i, 1));   // start spread out, not all at the top
      const dur = 5200 + rand(i, 2) * 5200;
      const first = Animated.timing(v, { toValue: 1, duration: dur * (1 - rand(i, 1)), easing: Easing.linear, useNativeDriver: true });
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
      ]));
      Animated.sequence([first, loop]).start();
      return v;
    });
    return () => loops.forEach(v => v.stopAnimation());
  }, [kind]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, overflow: 'hidden' }}>
      {vals.map((v, i) => {
        const size = 4 + rand(i, 3) * 6;
        const x = rand(i, 4) * w;
        const sway = 10 + rand(i, 5) * 18;
        const [a, b] = falls ? [-20, h + 20] : [h + 20, -20];
        return (
          <Animated.View key={i} style={{
            position: 'absolute', left: x, top: 0,
            opacity: 0.35 + rand(i, 6) * 0.55,
            transform: [
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [a, b] }) },
              { translateX: v.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, sway, 0, -sway, 0] }) },
              { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(rand(i, 7) > 0.5 ? 1 : -1) * 360}deg`] }) },
            ],
          }}>
            <ParticleView kind={kind} color={colors[i % colors.length]} size={size} />
          </Animated.View>
        );
      })}
    </View>
  );
};

export const EventBanner = ({ day, preview, onClose, onAction }: {
  day: EventDay | null; preview?: boolean; onClose: () => void; onAction: (tab: TabId) => void;
}) => {
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState<EventDay | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!day) return;
    setShown(day);
    fade.setValue(0); rise.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
    const b = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, [day]);

  const leave = (then: () => void) => {
    Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => { setShown(null); then(); });
  };

  const d = shown;
  const badge = useMemo(() => (d?.badge ? BADGES.find(b => b.id === d.badge) : undefined), [d]);
  if (!d) return null;

  const t = d.template;
  const claim = !!badge && !(badge.id in UNLOCKED) && badge.rarity !== 'secret' && !preview;
  const cardW = Math.min(width - 32, 400);
  const cardH = Math.min(height - 120, 600);
  const dateLine = fromISO(d.iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const dark = t.colors[t.colors.length - 1];

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => leave(onClose)} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(6,12,20,0.62)', opacity: fade, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => leave(onClose)} accessibilityLabel="Close" />
        <Animated.View
          accessibilityViewIsModal
          style={{
            width: cardW, height: cardH, borderRadius: 30, overflow: 'hidden',
            shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 20,
            opacity: fade,
            transform: [
              { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
              { scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          }}
        >
          <LinearGradient colors={t.colors as [string, string, ...string[]]} start={G155.start} end={G155.end} style={{ flex: 1 }}>
            {!!d.image && (
              <>
                <Image source={{ uri: d.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <LinearGradient colors={['rgba(8,16,28,0.25)', 'rgba(8,16,28,0.55)', 'rgba(8,16,28,0.85)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
              </>
            )}
            <Particles kind={t.particle} colors={t.accents} w={cardW} h={cardH} />

            {/* Soft glow behind the art */}
            <View pointerEvents="none" style={{
              position: 'absolute', top: cardH * 0.12, alignSelf: 'center',
              width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.16)',
            }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  {preview ? 'Preview' : `Today · ${dateLine}`}
                </Text>
              </View>
              <Pressable onPress={() => leave(onClose)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
                style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                <Icon name="close" size={16} stroke={2.2} color="#fff" />
              </Pressable>
            </View>

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 }}>
              <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}>
                <Image source={t.art} style={{ width: 150, height: 150 }} resizeMode="contain" />
              </Animated.View>
              <Text accessibilityRole="header" style={{
                fontFamily: fonts.serif, fontSize: 38, lineHeight: 42, color: '#fff', textAlign: 'center', marginTop: 18, letterSpacing: -0.4,
                textShadowColor: 'rgba(0,0,0,0.18)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 },
              }}>{d.title}</Text>
              {!!d.body && (
                <Text style={{ fontSize: 16, lineHeight: 22, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: 10 }}>{d.body}</Text>
              )}
              {d.chips.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  {d.chips.map(c => (
                    <View key={c} style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={{ padding: 18, paddingTop: 0, gap: 10 }}>
              <Pressable onPress={() => leave(onClose)} accessibilityRole="button"
                style={({ pressed }) => ({
                  backgroundColor: '#fff', borderRadius: 16, paddingVertical: 15, flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.85 : 1,
                })}>
                {claim && <Icon name="badge" size={18} stroke={2} color={dark} />}
                <Text style={{ color: dark, fontSize: 16, fontWeight: '700' }}>{claim ? 'Claim badge' : 'Got it'}</Text>
              </Pressable>
              {!!t.cta && (
                <Pressable onPress={() => leave(() => onAction(t.cta!.go))} accessibilityRole="button" hitSlop={6}
                  style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{t.cta.label}</Text>
                </Pressable>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};
