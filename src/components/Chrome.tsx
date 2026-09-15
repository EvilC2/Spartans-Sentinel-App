// Spartans — shared chrome: brand mark, the standard header, section headers,
// the pulsing "now" dot, a grid helper, and the tab bar.
// Ported from home-bits.jsx; reworked for the Spartans structure:
//   • every screen uses <Header/> — brand left, bell + avatar right, no search
//   • five tabs: Home · Buzz · Calendar · Social · More
//   • Contacts, Homework and Me are still screens, just not tabs

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, Image,
  LayoutChangeEvent, StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Icon, IconName } from './Icon';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, G135 } from '../theme';

// ────────────────────────────────────────────────────────────────
// Brand — "Spartans" with a helmet mark. The helmet is a placeholder until
// the real Spartans logo files land (see SCOPE-v3.md, Rebrand).
// ────────────────────────────────────────────────────────────────
export const SpartanMark = ({ size = 22, color, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  const col = color || c.navy700;
  const light = col === '#fff' || col === '#FFFFFF' || col === 'white';
  return (
    <View style={[{
      width: size + 10, height: size + 10, borderRadius: (size + 10) * 0.32,
      backgroundColor: col, alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Icon name="helmet" size={size} stroke={1.9} color={light ? c.navy900 : '#fff'} />
    </View>
  );
};

export const BrandMark = ({ light = false }: { light?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <SpartanMark size={16} color={light ? '#fff' : c.navy700} />
      <Text style={{ fontFamily: fonts.serif, fontSize: 20, letterSpacing: -0.3, color: light ? '#fff' : c.ink }}>
        Spartans
      </Text>
    </View>
  );
};
// Old name, kept so nothing else has to change at once.
export const SentinelMark = BrandMark;

// ────────────────────────────────────────────────────────────────
// Header bits
// ────────────────────────────────────────────────────────────────
export const IconBtn = ({
  name, badge = false, onPress, accessibilityLabel,
}: { name: IconName; badge?: boolean; onPress?: () => void; accessibilityLabel?: string }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: c.surface,
        borderWidth: 1, borderColor: c.line,
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      }, shadow.sm]}
    >
      <Icon name={name} size={18} stroke={1.8} color={c.ink2} />
      {badge && (
        <View style={{
          position: 'absolute', top: 8, right: 8,
          width: 7, height: 7, borderRadius: 4,
          backgroundColor: c.crimson,
          borderWidth: 1.5, borderColor: c.surface,
        }} />
      )}
    </Pressable>
  );
};

export const Avatar = ({ initials = '?', uri, onPress }: { initials?: string; uri?: string; onPress?: () => void }) => (
  <Pressable onPress={onPress} accessibilityLabel="Profile" style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
    {uri ? (
      <Image source={{ uri }} style={[{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#14304E' }, shadow.sm]} />
    ) : (
    <LinearGradient
      colors={['#2A5687', '#14304E']}
      start={G135.start}
      end={G135.end}
      style={[{
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
      }, shadow.sm]}
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.4 }}>
        {initials}
      </Text>
    </LinearGradient>
    )}
  </Pressable>
);

// The one header every screen shows: brand · bell · avatar.
// `onBack` swaps the brand for a back button + title on sub-screens.
export const Header = ({
  topInset, initials, photoUri, onBell, onProfile, unread = false, title, onBack,
}: {
  topInset: number; initials?: string; photoUri?: string;
  onBell?: () => void; onProfile?: () => void; unread?: boolean;
  title?: string; onBack?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingTop: Math.max(topInset, 20) + 20 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 4, paddingHorizontal: 20,
      }}>
        {onBack ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <IconBtn name="chev-l" onPress={onBack} accessibilityLabel="Back" />
            {!!title && <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 20, color: c.ink, letterSpacing: -0.3, flexShrink: 1 }}>{title}</Text>}
          </View>
        ) : <BrandMark />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBtn name="bell" badge={unread} onPress={onBell} accessibilityLabel="Notifications" />
          <Avatar initials={initials} uri={photoUri} onPress={onProfile} />
        </View>
      </View>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Section header — used everywhere
// ────────────────────────────────────────────────────────────────
export const SectionHeader = ({
  title, trailing, onTrailing,
}: { title: string; trailing?: string; onTrailing?: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
      paddingTop: 24, paddingHorizontal: 20, paddingBottom: 12,
    }}>
      <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.4, color: c.ink }}>
        {title}
      </Text>
      {!!trailing && (
        <Pressable onPress={onTrailing} disabled={!onTrailing} hitSlop={8}>
          <Text style={{ fontSize: 14, color: c.navy700, fontWeight: '500' }}>{trailing}</Text>
        </Pressable>
      )}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// "Now" dot — the CSS @keyframes nowPulse animated an expanding box-shadow
// ring. RN has no animatable shadow spread, so the ring is a real View that
// scales out and fades, which reads the same.
// ────────────────────────────────────────────────────────────────
export const NowDot = ({ size = 8, color = '#5B7A4E' }: { size?: number; color?: string }) => {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 2.5, 2.5] });
  const opacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Grid — stands in for CSS `grid-template-columns: repeat(n, 1fr)` with a gap.
// Percentage widths and gaps don't compose in RN, so the row measures itself
// once and hands each child an exact pixel width.
// ────────────────────────────────────────────────────────────────
export const Grid = ({
  cols, gap, children, style,
}: {
  cols: number;
  gap: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (Math.abs(next - w) > 0.5) setW(next);
  };
  const cell = w > 0 ? (w - gap * (cols - 1)) / cols : 0;

  return (
    <View onLayout={onLayout} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {w > 0 &&
        React.Children.map(children, (child, i) => (
          <View key={i} style={{ width: cell }}>{child}</View>
        ))}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Hairline divider (.hairline)
// ────────────────────────────────────────────────────────────────
export const Hairline = () => {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
};

// ────────────────────────────────────────────────────────────────
// Tab bar — five tabs. Other ids are screens reached from More, the header
// or Quick links, never from the bar.
// ────────────────────────────────────────────────────────────────
export type TabId =
  | 'home' | 'buzz' | 'calendar' | 'social' | 'more'
  | 'contacts' | 'homework' | 'me' | 'dayview' | 'news';

// Which bar tab lights up for a given screen.
export const tabFor = (t: TabId): TabId =>
  t === 'news' ? 'buzz'
  : t === 'me' ? 'home'
  : t === 'contacts' || t === 'homework' || t === 'dayview' ? 'more'
  : t;

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'buzz', label: 'Buzz', icon: 'sparkle' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'social', label: 'Social', icon: 'users' },
  { id: 'more', label: 'More', icon: 'grid' },
];

export const TabBar = ({
  active, onNavigate, bottomInset = 0,
}: { active: TabId; onNavigate: (t: TabId) => void; bottomInset?: number }) => {
  const { c } = useTheme();
  const lit = tabFor(active);
  return (
    <BlurView
      intensity={60}
      tint={c.blurTint}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingTop: 8, paddingHorizontal: 4,
        paddingBottom: Math.max(bottomInset, 12) + 12,
        backgroundColor: c.tabBarBg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.line,
        flexDirection: 'row', justifyContent: 'space-around',
      }}
    >
      {TABS.map(tab => {
        const on = tab.id === lit;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onNavigate(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              alignItems: 'center', gap: 3,
              paddingVertical: 6, paddingHorizontal: 2, minWidth: 62,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name={tab.icon} size={23} stroke={on ? 2 : 1.6} color={on ? c.navy700 : c.ink4} />
            <Text numberOfLines={1} style={{
              fontSize: 10,
              fontWeight: on ? '600' : '500',
              letterSpacing: 0.1,
              color: on ? c.navy700 : c.ink4,
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </BlurView>
  );
};
