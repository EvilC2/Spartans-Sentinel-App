// Spartans — shared chrome: brand mark, the standard header, section headers,
// the pulsing "now" dot, a grid helper, and the tab bar.
// Ported from home-bits.jsx; reworked for the Spartans structure:
//   • every screen uses <Header/> — brand left, bell + App Club + avatar right, no search
//   • six tabs: Home · Programs · Calendar · Announcements · Social · More
//   • Contacts, Homework, Me and Program pages are still screens, just not tabs

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, Image,
  LayoutChangeEvent, StyleProp, ViewStyle, ImageStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Icon, IconName } from './Icon';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, G135 } from '../theme';

// ────────────────────────────────────────────────────────────────
// Brand — the Spartans logo. Real art from ~/Desktop/SentinelApp/App icons:
//   • app-icon.png         glossy blue tile with the silver Spartan (the app icon)
//   • spartan-head-*.png   flat Spartan head: navy / blue / white
//   • spartan-roundel.png  navy ring helmet
// SpartanMark keeps its old props: `color` white → white head (on dark),
// anything else → navy head. `tile` shows the glossy app icon instead.
// BrandMark (the header's top-left) uses the Spartan head from the sign-in
// screen, not the app icon: navy on light paper, silver on dark.
// ────────────────────────────────────────────────────────────────
export const BRAND = {
  tile: require('../../assets/brand/app-icon.png'),
  navy: require('../../assets/brand/spartan-head-navy.png'),
  blue: require('../../assets/brand/spartan-head-blue.png'),
  white: require('../../assets/brand/spartan-head-white.png'),
  roundel: require('../../assets/brand/spartan-roundel.png'),
};

export const SpartanMark = ({ size = 22, color, tile = false, style }: { size?: number; color?: string; tile?: boolean; style?: StyleProp<ImageStyle> }) => {
  const light = color === '#fff' || color === '#FFFFFF' || color === 'white';
  const src = tile ? BRAND.tile : light ? BRAND.white : BRAND.navy;
  return (
    <Image
      source={src}
      accessibilityLabel="Spartans"
      style={[{ width: size, height: size, borderRadius: tile ? size * 0.22 : 0 }, style]}
      resizeMode="contain"
    />
  );
};

export const BrandMark = ({ light = false }: { light?: boolean }) => {
  const { mode } = useTheme();
  const onDark = light || mode === 'dark';
  return (
    <Image
      source={onDark ? BRAND.white : BRAND.navy}
      accessibilityLabel="Spartans"
      resizeMode="contain"
      style={[{ width: 44, height: 44 }, onDark && { tintColor: '#CFD3DA' }]}
    />
  );
};
// Old name, kept so nothing else has to change at once.
export const SentinelMark = BrandMark;

// ────────────────────────────────────────────────────────────────
// Header bits
// ────────────────────────────────────────────────────────────────
// `badge`: true = a dot; a number = a count pill (hidden at 0).
export const IconBtn = ({
  name, badge = false, onPress, accessibilityLabel,
}: { name: IconName; badge?: boolean | number; onPress?: () => void; accessibilityLabel?: string }) => {
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
      {badge === true && (
        <View style={{
          position: 'absolute', top: 8, right: 8,
          width: 7, height: 7, borderRadius: 4,
          backgroundColor: c.crimson,
          borderWidth: 1.5, borderColor: c.surface,
        }} />
      )}
      {typeof badge === 'number' && badge > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -5,
          minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
          backgroundColor: c.crimson, alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: c.paper,
        }}>
          <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
};

export const Avatar = ({ initials = '?', uri, onPress }: { initials?: string; uri?: string; onPress?: () => void }) => {
  const { c } = useTheme();
  return (
  <Pressable onPress={onPress} accessibilityLabel="Profile" style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
    {uri ? (
      // your photo, outlined so it reads as a button on any background
      <View style={[{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: c.sky, padding: 1.5, backgroundColor: c.surface }, shadow.sm]}>
        <Image source={{ uri }} style={{ flex: 1, borderRadius: 16, backgroundColor: '#14304E' }} />
      </View>
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
};

// The club's mark: a struck gold coin with the Spartan on it. The header button
// and the App Club card in Settings both use it.
export const ClubCoin = ({ size = 38 }: { size?: number }) => (
  <LinearGradient colors={['#F0D699', '#D2A654', '#A97B2E']} start={G135.start} end={G135.end}
    style={{ width: size, height: size, borderRadius: size / 2, padding: Math.round(size * 0.07) }}>
    <LinearGradient colors={['#B98A3B', '#D9B061']} start={G135.start} end={G135.end}
      style={{ flex: 1, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={BRAND.navy} resizeMode="contain" accessibilityIgnoresInvertColors
        style={{ width: size * 0.64, height: size * 0.64, tintColor: '#14243A' }} />
    </LinearGradient>
  </LinearGradient>
);

export const ClubBtn = ({ onPress }: { onPress?: () => void }) => (
  <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel="App Club"
    style={({ pressed }) => [{ borderRadius: 19, transform: [{ scale: pressed ? 0.94 : 1 }] }, shadow.sm]}>
    <ClubCoin />
  </Pressable>
);

// The one header every screen shows: brand · title · count … bell · club · avatar.
// `title` sits right of the Spartan head; `count` (a screen's tally) right of
// the title. `onBack` puts a back button where the brand goes on sub-screens
// (never both). `club` replaces the App Club bubble (App Club uses that spot
// for its view switcher; null hides it).
export const Header = ({
  topInset, initials, photoUri, onBell, onClub, onProfile, unread = false, title, count, onBack, club,
}: {
  topInset: number; initials?: string; photoUri?: string;
  onBell?: () => void; onClub?: () => void; onProfile?: () => void; unread?: boolean | number;
  title?: string; count?: React.ReactNode; onBack?: () => void; club?: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingTop: Math.max(topInset, 20) + 20 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 4, paddingHorizontal: 20, gap: 10,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {onBack ? <IconBtn name="chev-l" onPress={onBack} accessibilityLabel="Back" /> : <BrandMark />}
          {!!title && (
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} accessibilityRole="header"
              style={{ fontFamily: fonts.serif, fontSize: 23, lineHeight: 28, color: c.ink, letterSpacing: -0.5, flexShrink: 1 }}>
              {title}
            </Text>
          )}
          {!!count && <View style={{ flexShrink: 0 }}>{count}</View>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBtn name="bell" badge={unread} onPress={onBell}
            accessibilityLabel={typeof unread === 'number' && unread > 0 ? `Notifications, ${unread} new` : 'Notifications'} />
          {club !== undefined ? club : <ClubBtn onPress={onClub} />}
          <Avatar initials={initials} uri={photoUri} onPress={onProfile} />
        </View>
      </View>
    </View>
  );
};

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
          <Text style={{ fontSize: 14, color: c.link, fontWeight: '500' }}>{trailing}</Text>
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
// Tab bar — six tabs. Other ids are screens reached from More, the header,
// Quick links or a program row, never from the bar.
// ────────────────────────────────────────────────────────────────
export type TabId =
  | 'home' | 'programs' | 'calendar' | 'announcements' | 'social' | 'more'
  | 'contacts' | 'homework' | 'me' | 'dayview' | 'lunch' | 'map' | 'admin';

// Which bar tab lights up for a given screen.
export const tabFor = (t: TabId): TabId =>
  t === 'me' || t === 'admin' ? 'home'
  : t === 'contacts' || t === 'homework' || t === 'dayview' || t === 'lunch' || t === 'map' ? 'more'
  : t;

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'programs', label: 'Programs', icon: 'book' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'announcements', label: 'Announcements', icon: 'news' },
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
        paddingTop: 8, paddingHorizontal: 0,
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
              paddingVertical: 6, paddingHorizontal: 2,
              flex: tab.label.length > 9 ? 1.4 : 1,   // "Announcements" gets a wider slot
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name={tab.icon} size={23} stroke={on ? 2 : 1.6} color={on ? c.link : c.ink4} />
            <Text numberOfLines={1} style={{
              fontSize: tab.label.length > 9 ? 9 : 9.5,
              fontWeight: on ? '600' : '500',
              letterSpacing: 0,
              color: on ? c.link : c.ink4,
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </BlurView>
  );
};
