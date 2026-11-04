// Spartans — More tab (the four-square icon). Same look as the caf menu.
// Top: a sky-to-navy card showing what is pinned to Home. Then the live pages
// as tinted two-column tiles with 3D art; each tile has a pin in its top-right
// corner and pinned pages show as Quick links on Home. Pages planned for a
// later phase sit in their own "Coming soon" card and show a short notice
// instead of opening (they can't be pinned).

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { shadow, tnum, G155 } from '../theme';
import { Icon } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { Grid } from '../components/Chrome';
import { onGlow } from '../components/ProgramIcon';
import { PAGES, Page, pageTone } from '../pages';
import { usePins } from '../stores';
import { BadgesSheet } from './BadgesScreen';
import type { ScreenProps } from '../../App';

const PIN_ART = require('../../assets/pages/pin.png');

export default function MoreScreen({ onNavigate, topInset }: ScreenProps) {
  const { c } = useTheme();
  const { isPinned, toggle, pins } = usePins();
  const [badges, setBadges] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);

  const open = (p: Page) => {
    if (p.go) onNavigate(p.go);
    else if (p.action === 'badges') setBadges(true);
    else if (p.soon) { setSoon(`${p.label} is coming in ${p.soon.toLowerCase()}.`); setTimeout(() => setSoon(null), 2200); }
  };
  const live = PAGES.filter(p => !p.soon);
  const later = PAGES.filter(p => p.soon);
  const pinned = live.filter(p => pins.includes(p.id));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <AppHeader topInset={topInset} title="More" count={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityLabel={`${pinned.length} pinned`}>
          <Icon name="pin" size={14} stroke={2} color={c.ink3} />
          <Text style={[{ fontSize: 12.5, color: c.ink3, fontWeight: '600' }, tnum]}>{pinned.length}</Text>
        </View>
      } />

      {/* ── Pinned to Home ─────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <PinnedCard pinned={pinned} onHome={() => onNavigate('home')} />
      </View>

      {/* ── Pages ──────────────────────────────────────────── */}
      <Text style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10, fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: c.ink }}>Pages</Text>
      <View style={{ paddingHorizontal: 20 }}>
        {/* With an odd count the first page goes full width, so no tile sits alone. */}
        {live.length % 2 === 1 && (
          <View style={{ marginBottom: 12 }}>
            <PageTile wide p={live[0]} pinned={isPinned(live[0].id)} onPress={() => open(live[0])} onPin={() => toggle(live[0].id)} />
          </View>
        )}
        <Grid cols={2} gap={12}>
          {live.slice(live.length % 2).map(p => (
            <PageTile key={p.id} p={p} pinned={isPinned(p.id)} onPress={() => open(p)} onPin={() => toggle(p.id)} />
          ))}
        </Grid>
      </View>

      {/* ── Coming soon ────────────────────────────────────── */}
      <Text style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10, fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: c.ink }}>Coming soon</Text>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={[{ backgroundColor: c.surface, borderRadius: 22, paddingVertical: 6 }, shadow.sm]}>
          {later.map(p => <SoonRow key={p.id} p={p} onPress={() => open(p)} />)}
        </View>
        {!!soon && <Text style={{ fontSize: 13, color: c.link, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>{soon}</Text>}
      </View>

      <BadgesSheet visible={badges} onClose={() => setBadges(false)} />
    </ScrollView>
  );
}

// ── Pinned card ─────────────────────────────────────────────────
// The caf's blue card: gradient, white blobs, the 3D pushpin bobbing. Shows
// the art of each pinned page in white circles, or a hint when none are.
const PinnedCard = ({ pinned, onHome }: { pinned: Page[]; onHome: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={[{ borderRadius: 24, overflow: 'hidden' }, shadow.md]}>
      <LinearGradient colors={[c.sky, c.sky600, c.navy700]} {...G155} style={{ paddingVertical: 16, paddingLeft: 18, paddingRight: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Blob size={200} style={{ top: -110, right: -50, opacity: 0.16 }} />
        <Blob size={120} style={{ bottom: -70, left: -20, opacity: 0.1 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.4 }}>On your Home</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 3, lineHeight: 17 }}>
            {pinned.length ? 'Pinned pages show as Quick links.' : 'Tap the pin on a page to put it on Home.'}
          </Text>
          {pinned.length > 0 && (
            <Pressable
              onPress={onHome}
              accessibilityRole="button"
              accessibilityLabel={`Go to Home, ${pinned.length} pinned`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', marginTop: 12, alignSelf: 'flex-start', opacity: pressed ? 0.8 : 1 })}
            >
              {pinned.map((p, i) => (
                <View key={p.id} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginLeft: i ? -8 : 0 }}>
                  <Image source={p.art} style={{ width: 22, height: 22 }} />
                </View>
              ))}
              <View style={{ marginLeft: 6 }}>
                <Icon name="chev-r" size={14} stroke={2.4} color="#fff" />
              </View>
            </Pressable>
          )}
        </View>
        <Floaty>
          <Image source={PIN_ART} style={{ width: 76, height: 76 }} accessibilityIgnoresInvertColors />
        </Floaty>
      </LinearGradient>
    </View>
  );
};

// ── Page tile ───────────────────────────────────────────────────
// `wide` = full-width row: big art on the left, label and sub beside it.
const PageTile = ({ p, pinned, wide, onPress, onPin }: { p: Page; pinned: boolean; wide?: boolean; onPress: () => void; onPin: () => void }) => {
  const { c, mode } = useTheme();
  const t = pageTone(c, mode, p.tone);
  // The pin is a sibling of the tile button, not a child: nested buttons are
  // invalid on web and awkward for screen readers.
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${p.label}. ${p.sub}`}
        style={({ pressed }) => ({
          minHeight: wide ? 0 : 150, borderRadius: 22, padding: 14,
          backgroundColor: t.bg, justifyContent: 'space-between',
          flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: wide ? 14 : 0,
          transform: [{ scale: pressed ? (wide ? 0.98 : 0.97) : 1 }],
        })}
      >
        <Image source={p.art} style={{ width: wide ? 68 : 52, height: wide ? 68 : 52 }} accessibilityIgnoresInvertColors />
        <View style={wide ? { flex: 1, minWidth: 0, paddingRight: 84 } : { marginTop: 12 }}>
          <Text numberOfLines={1} style={{ fontSize: wide ? 18 : 16, fontWeight: '800', color: c.ink, letterSpacing: -0.3 }}>{p.label}</Text>
          {/* Always two lines tall so one-line subtitles don't make shorter tiles. */}
          <Text numberOfLines={2} style={{ fontSize: 12.5, color: c.ink3, marginTop: 2, lineHeight: 16, minHeight: wide ? 0 : 32 }}>{p.sub}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onPin}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityState={{ selected: pinned }}
        accessibilityLabel={pinned ? `Unpin ${p.label} from Home` : `Pin ${p.label} to Home`}
        style={({ pressed }) => [{
          position: 'absolute', top: 12, right: 12,
          height: 30, borderRadius: 15, paddingHorizontal: pinned ? 10 : 0, width: pinned ? undefined : 30,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
          backgroundColor: pinned ? t.ink : c.surface,
          opacity: pressed ? 0.7 : 1,
        }, pinned ? null : shadow.sm]}
      >
        <Icon name="pin" size={13} stroke={2.2} color={pinned ? onGlow(mode) : c.ink3} />
        {pinned && <Text style={{ fontSize: 11.5, fontWeight: '800', color: onGlow(mode) }}>Home</Text>}
      </Pressable>
    </View>
  );
};

// ── Coming soon row ─────────────────────────────────────────────
const SoonRow = ({ p, onPress }: { p: Page; onPress: () => void }) => {
  const { c, mode } = useTheme();
  const t = pageTone(c, mode, p.tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.label}, coming in ${p.soon}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={p.art} style={{ width: 30, height: 30 }} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>{p.label}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{p.sub}</Text>
      </View>
      <View style={{ backgroundColor: c.paper2, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '700', color: c.ink3 }}>{p.soon}</Text>
      </View>
    </Pressable>
  );
};

const Blob = ({ size, style }: { size: number; style: any }) => (
  <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' }, style]} />
);

// Gentle bob, same as the caf gift card and the Home map tile.
const Floaty = ({ children }: { children: React.ReactNode }) => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -5, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.View pointerEvents="none" style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
};
