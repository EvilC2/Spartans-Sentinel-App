// Spartans — the App Club role card: the top of App Club for every member,
// like a club membership card. "School App Club role", the role in the
// app's serif, your name and photo, and what you're on. Four finishes so
// everyone's card feels good and senior roles look a step better:
//   member     deep navy, silver Spartan
//   developer  near-black with sky details and a build tag
//   manager    navy with a gold edge and gold role name
//   top        gold foil (President, Teacher Sponsor, the owner)
// Senior cards catch the light once when they appear (skipped with Reduce
// Motion). The join page shows a blank one with your name on it.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, AccessibilityInfo, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, shadow, tnum, G135 } from '../theme';
import { BRAND } from '../components/Chrome';
import type { Tier } from '../ranks';

type Finish = { bg: [string, string, string]; ink: string; soft: string; label: string; mark: any; markOpacity: number; edge?: string };
const FINISH: Record<Tier, Finish> = {
  member: { bg: ['#1F4570', '#14304E', '#0E2238'], ink: '#FFFFFF', soft: 'rgba(255,255,255,0.72)', label: '#C9D6E6', mark: BRAND.white, markOpacity: 0.09 },
  developer: { bg: ['#16283D', '#0E1B2A', '#070E17'], ink: '#FFFFFF', soft: 'rgba(214,232,255,0.7)', label: '#8FBDF0', mark: BRAND.white, markOpacity: 0.07 },
  manager: { bg: ['#1F4570', '#14304E', '#0E2238'], ink: '#FFFFFF', soft: 'rgba(255,255,255,0.75)', label: '#E4C27E', mark: BRAND.white, markOpacity: 0.1, edge: '#C9A462' },
  top: { bg: ['#EFD49A', '#C9A15B', '#94692A'], ink: '#14243A', soft: 'rgba(20,36,58,0.72)', label: 'rgba(20,36,58,0.7)', mark: BRAND.navy, markOpacity: 0.13, edge: '#F6E3B4' },
};

export const RoleCard = ({ tier, role, name, sub, foot, photo, initials, tag }: {
  tier: Tier; role: string; name: string; sub?: string; foot?: string; photo?: string; initials: string; tag?: string;
}) => {
  const f = FINISH[tier];
  const [w, setW] = useState(0);
  const sheen = useRef(new Animated.Value(0)).current;
  const shiny = tier === 'top' || tier === 'manager';

  useEffect(() => {
    if (!shiny || !w) return;
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (!on || reduce) return;
      sheen.setValue(0);
      Animated.timing(sheen, { toValue: 1, duration: 1300, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }).catch(() => {});
    return () => { on = false; };
  }, [shiny, w, role]);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="summary" accessibilityLabel={`School App Club role: ${role}. ${name}`}
      style={[{ borderRadius: 22, overflow: 'hidden', borderWidth: f.edge ? 1.5 : 0, borderColor: f.edge }, shadow.lg]}>
      <LinearGradient colors={f.bg} {...G135} style={{ padding: 20, paddingBottom: 18 }}>
        {/* the Spartan, big and faint, bottom right */}
        <Image source={f.mark} resizeMode="contain" style={{ position: 'absolute', right: -34, bottom: -40, width: 210, height: 210, opacity: f.markOpacity }} />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: f.label, letterSpacing: 0.2, fontFamily: tier === 'developer' ? fonts.mono : undefined }}>
              School App Club role
            </Text>
            <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}
              style={{ fontFamily: fonts.serif, fontSize: tier === 'top' ? 38 : 34, lineHeight: tier === 'top' ? 44 : 40, color: tier === 'manager' ? '#F1D9A4' : f.ink, letterSpacing: -0.8, marginTop: 4 }}>
              {role}
            </Text>
          </View>
          <View style={{ width: 54, height: 54, borderRadius: 27, padding: 2, backgroundColor: tier === 'top' ? '#14243A' : f.edge || 'rgba(255,255,255,0.35)' }}>
            {photo ? (
              <Image source={{ uri: photo }} style={{ flex: 1, borderRadius: 25, backgroundColor: '#14304E' }} />
            ) : (
              <View style={{ flex: 1, borderRadius: 25, backgroundColor: tier === 'top' ? '#F6E3B4' : '#2A5687', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: tier === 'top' ? '#14243A' : '#fff' }}>{initials}</Text>
              </View>
            )}
          </View>
        </View>

        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: f.ink, marginTop: 10 }}>{name}</Text>
        {!!sub && <Text numberOfLines={1} style={[{ fontSize: 13.5, color: f.soft, marginTop: 1 }, tnum]}>{sub}</Text>}

        {(!!foot || !!tag) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: tier === 'top' ? 'rgba(20,36,58,0.18)' : 'rgba(255,255,255,0.14)' }}>
            {!!foot && <Text numberOfLines={2} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: f.soft, lineHeight: 18 }}>{foot}</Text>}
            {!!tag && (
              <Text style={[{ fontSize: 11.5, color: f.label, fontFamily: fonts.mono }, tnum]}>{tag}</Text>
            )}
          </View>
        )}

        {/* one sweep of light across senior cards */}
        {shiny && w > 0 && (
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: -40, bottom: -40, width: 90,
            transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-140, w + 60] }) }, { rotate: '18deg' }],
          }}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        )}
      </LinearGradient>
    </View>
  );
};
