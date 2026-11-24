// Spartans — Home screen
// Standard header, then the greeting: date, "Good morning, …", then a row
// with level and progress (→ XP & levels) and the badge count (→ Badges). Then the hero "Day" card with the
// live block rotation (real 2026–2027 calendar + bell schedule + the student's
// own courses), live weather, and one "now" panel: the class that is on (or up
// next), the mm:ss countdown, when it ends and what follows. Then "The Buzz" (a tall window rotating banner news / trivia / polls;
// Home is its only home, it is not a tab), the map tile and Quick links
// (whatever is pinned on More). Programs live on their own tab.
//
// TEMPORARY: the small play button in the bottom-right corner of the hero
// opens a time-of-day scrubber (src/PreviewTime.tsx) beneath the card so the
// live card can be checked at any hour.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G165, G90, G155 } from '../theme';
import { Icon, Check } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { SpartanMark, SectionHeader, NowDot, Grid } from '../components/Chrome';
import { QuickLink } from '../components/Cards';
import { Buzz, postToSlide } from '../components/Buzz';
import { useProfile, shortName, teacherShort, roomLabel, Course } from '../ProfileContext';
import { useSocial, togetherLabel } from '../social';
import { useToday, fmtWeekday, fmtMonthDay, fmtClock, greeting, nextSchoolDay, TodayState } from '../useToday';
import { fmt12, fmtCountdown, gapEyebrow, PlanPeriod } from '../bell';
import { usePreviewTime } from '../PreviewTime';
import { useWeather, describeWeather } from '../weather';
import { useClassSheet } from '../components/ClassCard';
import { usePins } from '../stores';
import { useNav, useFocus } from '../nav';
import { findTarget } from '../map/data';
import { MAP_ART } from '../map/art';
import { PAGES, Page } from '../pages';
import { BadgesSheet, unlockedCount } from './BadgesScreen';
import { BadgeIcon } from '../components/BadgeArt';
import { useEarnedVersion } from '../earned';
import { XpSheet } from '../components/XpSheet';
import { XpBar } from '../components/XpBar';
import { useContent } from '../content';
import type { ScreenProps } from '../../App';

const PIN_ART = require('../../assets/pages/pin.png');

// Top of the completion bar's gradient — the "gold" the end time is set in.
const BAR_GOLD = '#E8D8AE';

export default function HomeScreen({ onNavigate, topInset }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const courses = profile?.courses || [];
  const t = useToday(courses);
  const [scrub, setScrub] = useState(false);
  const { tools: tempTools } = usePreviewTime();   // TEMP controls, switched on in App Club → Developer tools
  const [badges, setBadges] = useState(false);
  const [xp, setXp] = useState(false);
  const { inPlace } = useContent();
  const [soon, setSoon] = useState<string | null>(null);
  const { pins } = usePins();
  const sheet = useClassSheet();
  const nav = useNav();

  // From a notification: that slide in The Buzz, scrolled to and held.
  const slides = useMemo(() => inPlace('buzz').map(postToSlide), [inPlace]);
  const scroll = useRef<ScrollView>(null);
  const buzzY = useRef(0);
  const [buzzFocus, setBuzzFocus] = useState<{ id: string; at: number } | null>(null);
  useFocus('buzz', f => {
    if (!slides.some(s => s.id === f.id)) return false;
    setBuzzFocus({ id: f.id, at: Date.now() });
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, buzzY.current - 70), animated: true }), 300);
    return true;
  }, [slides]);

  const openPage = (p: Page) => {
    if (p.go) onNavigate(p.go);
    else if (p.action === 'badges') setBadges(true);
    else if (p.soon) { setSoon(`${p.label} is coming in ${p.soon.toLowerCase()}.`); setTimeout(() => setSoon(null), 2200); }
  };
  // Pages still marked `soon` can't be pinned on More any more; skip old pins.
  const pinned = pins.map(id => PAGES.find(p => p.id === id)).filter(p => p && !p.soon) as Page[];

  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} title="Home" />

      {/* ── Greeting: date, name, level and badges ────────────── */}
      <View style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, color: c.ink3, letterSpacing: -0.1 }}>
          <Text style={{ color: c.ink, fontWeight: '700' }}>{fmtWeekday(t.now)}</Text>
          {'  '}{fmtMonthDay(t.now)}
          {(t.isDemo || t.isPreview) && (
            <Text style={{ fontSize: 12, color: c.ink4 }}>
              {t.isDemo ? '  · demo date' : ''}{t.isPreview ? `  · previewing ${fmtClock(t.now)}` : ''}
            </Text>
          )}
        </Text>
        <Text style={{
          fontFamily: fonts.serif, fontSize: 31, lineHeight: 36, marginTop: 2,
          color: c.ink, letterSpacing: -0.8,
        }}>
          {greeting(t.now)}, {profile?.firstName || 'there'}.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
          <XpBar inside onPress={() => setXp(true)} style={{ flex: 1, minWidth: 0 }} />
          <View style={{ width: 1, height: 26, marginLeft: 14, backgroundColor: c.line }} />
          <BadgeButton onPress={() => setBadges(true)} />
        </View>
      </View>

      {/* ── Hero day card (rotation + in-progress row) ────────── */}
      <DayHeroCard t={t} scrubOpen={scrub} onToggleScrub={() => setScrub(s => !s)} onCourse={sheet.openCourse} />
      {scrub && tempTools && <TimeScrubber now={t.now} />}

      {/* ── The Buzz — banner news, trivia, polls ─────────────── */}
      <View onLayout={e => { buzzY.current = e.nativeEvent.layout.y; }}>
      <SectionHeader title="The Buzz" trailing="Announcements" onTrailing={() => onNavigate('announcements')} />
      <Buzz
        slides={slides}
        focus={buzzFocus}
        onOpen={s => {
          if (s.kind === 'menu') nav.open('lunch', { kind: 'menu', id: s.id });
          else if (s.kind === 'event') nav.open('calendar', { kind: 'day', iso: s.date, event: s.id });
          else nav.open('announcements', { kind: 'news', id: s.id });
        }}
        aspect={1.22}
      />
      </View>

      {/* ── Map tile ──────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <MapTile
          next={t.nextBlock?.course}
          onPress={() => openPage(PAGES.find(p => p.id === 'map')!)}
          onRoute={room => nav.openMap({ to: room })}
        />
      </View>

      {/* ── Quick links: pinned pages from More ───────────────── */}
      <SectionHeader title="Quick links" trailing="More" onTrailing={() => onNavigate('more')} />
      <View style={{ paddingHorizontal: 20 }}>
        {pinned.length === 0 ? (
          <Pressable
            onPress={() => onNavigate('more')}
            accessibilityRole="button"
            accessibilityLabel="Nothing pinned. Open More to pin pages."
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: c.goldTint, transform: [{ scale: pressed ? 0.98 : 1 }] })}
          >
            <Image source={PIN_ART} style={{ width: 44, height: 44 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: c.ink, letterSpacing: -0.3 }}>Nothing pinned yet</Text>
              <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 1, lineHeight: 17 }}>Open More and tap the pin on any page.</Text>
            </View>
            <Icon name="chev-r" size={14} stroke={2.4} color={c.ink3} />
          </Pressable>
        ) : (
          // Two columns of wide rows for 2 or 4 pins (no orphan tile), three
          // columns of square tiles otherwise.
          <Grid cols={pinned.length % 2 === 0 ? 2 : 3} gap={10}>
            {pinned.map(p => <QuickLink key={p.id} q={p} wide={pinned.length % 2 === 0} onPress={() => openPage(p)} />)}
          </Grid>
        )}
        {!!soon && <Text style={{ fontSize: 12.5, color: c.navy700, fontWeight: '600', marginTop: 10, textAlign: 'center' }}>{soon}</Text>}
      </View>

      <BadgesSheet visible={badges} onClose={() => setBadges(false)} />
      <XpSheet visible={xp} onClose={() => setXp(false)} />
    </ScrollView>
  );
}

// Badge button: the badge icon and how many you have, closing the row XpBar
// starts. Tap for Badges. Faded until the first badge is earned, like a locked
// badge on the Badges sheet.
const BadgeButton = ({ onPress }: { onPress: () => void }) => {
  const { c } = useTheme();
  useEarnedVersion();
  const count = unlockedCount();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Badges, ${count} unlocked`}
      style={({ pressed }) => ({
        minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ opacity: count ? 1 : 0.55 }}>
        <BadgeIcon size={30} />
      </View>
      <Text style={[{ fontSize: 14, fontWeight: '700', color: count ? c.ink : c.ink3, letterSpacing: -0.1 }, tnum]}>{count}</Text>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Map tile — the rotation card's navy, easing to a lighter blue, white
// blobs, the 3D folded map bobbing on the right. Tap anywhere for the map.
// If the next class has a room the map knows, a white pill under the title
// opens the map with the route to it already drawn.
// ────────────────────────────────────────────────────────────────
const MapTile = ({ next, onPress, onRoute }: { next: Course | null | undefined; onPress: () => void; onRoute: (room: string) => void }) => {
  const { c } = useTheme();
  const nextRoom = next && !next.spare && next.room && findTarget(next.room) ? next.room : null;
  // The whole card opens the map (a press layer under the content); the pill
  // is its own button on top, so the two never nest.
  return (
    <View style={[{ borderRadius: 24, overflow: 'hidden' }, shadow.md]}>
      <LinearGradient colors={[c.navy900, c.navy700, c.navy600]} locations={[0, 0.55, 1]} {...G155} style={{ paddingVertical: 16, paddingLeft: 18, paddingRight: 12, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="School map"
          style={({ pressed }) => ({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: pressed ? 'rgba(0,0,0,0.08)' : 'transparent' })}
        />
        <Blob size={200} style={{ top: -110, right: -50, opacity: 0.16 }} />
        <Blob size={120} style={{ bottom: -70, left: -20, opacity: 0.1 }} />
        <View pointerEvents="box-none" style={{ flex: 1, minWidth: 0 }}>
          <Text pointerEvents="none" style={{ fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.4 }}>School map</Text>
          <Text pointerEvents="none" style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 3, lineHeight: 17 }}>Every room on every floor, with the way there.</Text>
          <Pressable
            onPress={() => nextRoom ? onRoute(nextRoom) : onPress()}
            accessibilityRole="button"
            accessibilityLabel={nextRoom ? `Route to ${shortName(next!.name)}, ${roomLabel(nextRoom)}` : 'Find a room'}
            style={({ pressed }) => ({
              alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: '#fff', borderRadius: 999, paddingLeft: 8, paddingRight: 12, paddingVertical: 7, maxWidth: '100%',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Image source={nextRoom ? MAP_ART.walk : MAP_ART.pin} style={{ width: 18, height: 18 }} />
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: c.navy700, letterSpacing: -0.2, flexShrink: 1 }}>
              {nextRoom ? `Next: ${shortName(next!.name)} · ${roomLabel(nextRoom)}` : 'Find a room'}
            </Text>
            <Icon name="chev-r" size={12} stroke={2.4} color={c.navy700} />
          </Pressable>
        </View>
        <View pointerEvents="none">
          <Floaty>
            <Image source={MAP_ART.map} style={{ width: 84, height: 84 }} accessibilityIgnoresInvertColors />
          </Floaty>
        </View>
      </LinearGradient>
    </View>
  );
};

const Blob = ({ size, style }: { size: number; style: any }) => (
  <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' }, style]} />
);

// Gentle bob so the map art feels like it is hovering (same as the caf gift card).
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
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
};

// ────────────────────────────────────────────────────────────────
// TEMPORARY — time-of-day scrubber. Small play button in the hero's corner
// + a chip row beneath the card. Delete this block (and src/PreviewTime.tsx)
// once the live card is signed off.
// ────────────────────────────────────────────────────────────────
const TimeScrubButton = ({ open, active, onPress }: { open: boolean; active: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel="Temporary: preview a time of day"
      style={({ pressed }) => ({
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: active ? c.gold : 'rgba(255,255,255,0.12)',
        borderWidth: 1, borderColor: active ? c.gold : 'rgba(255,255,255,0.35)',
        borderStyle: active ? 'solid' : 'dashed',
        alignItems: 'center', justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={open ? 'close' : 'play'} size={13} stroke={2} color="#fff" />
      <View style={{ position: 'absolute', top: -7, right: -8, backgroundColor: c.crimson, borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1 }}>
        <Text style={{ fontSize: 6.5, fontWeight: '800', color: '#fff', letterSpacing: 0.4 }}>TEMP</Text>
      </View>
    </Pressable>
  );
};

const PRESETS: [string, number, number][] = [
  ['8:00', 8, 0], ['8:45', 8, 45], ['9:45', 9, 45], ['10:30', 10, 30], ['11:15', 11, 15],
  ['12:00', 12, 0], ['13:10', 13, 10], ['14:00', 14, 0], ['15:30', 15, 30],
];

const TimeScrubber = ({ now }: { now: Date }) => {
  const { c } = useTheme();
  const { active, setTimeOfDay, shiftMinutes, clear } = usePreviewTime();
  const Chip = ({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 11, height: 30, borderRadius: 15, justifyContent: 'center',
        backgroundColor: on ? c.navy700 : c.surface, borderWidth: 1, borderColor: on ? c.navy700 : c.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={[{ fontSize: 12.5, fontWeight: '600', color: on ? '#fff' : c.ink2 }, tnum]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginHorizontal: 20, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: c.crimson }}>
          Temp · preview time of day
        </Text>
        <Text style={[{ fontSize: 12.5, fontWeight: '600', color: c.ink }, tnum]}>{fmtClock(now)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <Chip label="Live" on={!active} onPress={clear} />
        <Chip label="−15" onPress={() => shiftMinutes(-15)} />
        <Chip label="+15" onPress={() => shiftMinutes(15)} />
        {PRESETS.map(([l, h, m]) => <Chip key={l} label={l} onPress={() => setTimeOfDay(h, m)} />)}
      </ScrollView>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Hero day card — the #1 thing students check
// ────────────────────────────────────────────────────────────────
const DayHeroCard = ({ t, scrubOpen, onToggleScrub, onCourse }: { t: TodayState; scrubOpen: boolean; onToggleScrub: () => void; onCourse: (k: Course) => void }) => {
  const { c } = useTheme();
  const { plan, cal } = t;
  const weather = useWeather();
  const { tools: tempTools } = usePreviewTime();

  // With today's classes done (or none today), the card looks ahead, but only
  // the day before: Sunday night shows Monday's rotation, Monday evening shows
  // Tuesday's. Any further out (Friday evening, Saturday, a break) it rests:
  // no tiles, no rotation, one line and when school is back.
  const { profile } = useProfile();
  const courses = profile?.courses || [];
  const offNow = !plan || t.phase === 'after';
  const nextDay = useMemo(
    () => (offNow ? nextSchoolDay(t.now, courses) : null),
    [t.iso, offNow, courses],   // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ahead = nextDay?.days === 1 ? nextDay : null;
  const aheadPlan = ahead?.t.plan || null;
  const first = aheadPlan?.blocks[0] || null;
  const rest = offNow && !aheadPlan;
  const weekend = cal?.kind === 'weekend' || (!plan && !cal?.label);
  // Friday after the bell, or the last day before a break.
  const restHeadline = plan ? (nextDay && nextDay.days <= 3 ? "That's the week." : 'Done for now.')
    : weekend ? 'Weekend.' : (cal?.label || 'No school');
  const back = !nextDay ? ''
    : nextDay.days < 7 ? `Back ${nextDay.date.toLocaleDateString('en-US', { weekday: 'long' })}`
    : `Back ${nextDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`;

  const headline = rest ? restHeadline : aheadPlan ? `Day ${aheadPlan.dayNum}` : plan ? `Day ${plan.dayNum}` : (cal?.label || 'No school');
  const cardLabel = rest ? (plan ? "School's out" : weekend ? 'No school today' : 'Day off')
    : aheadPlan ? `${ahead!.when}'s rotation · ${aheadPlan.code}`
    : `Today's rotation${plan ? ` · ${plan.code}` : ''}`;

  // Countdown target: end of the current period, or the first bell before school.
  const target = t.phase === 'during' ? t.current : t.phase === 'before' ? plan?.periods[0] || null : null;

  const wx = weather ? describeWeather(weather.code, weather.isDay) : null;

  // Accent: moss while a class/FIT is on, gold in the gaps (break, lunch,
  // transition, before first bell), grey when school is off or done.
  const inClass = !!t.current && (t.current.kind === 'block' || t.current.kind === 'fit');
  const off = !plan || t.phase === 'after';
  const accent = off ? 'rgba(255,255,255,0.45)' : inClass ? c.moss : c.gold;

  // The "now" panel shows one class: the one that is on, or the one coming up
  // during a break, lunch or before the first bell.
  const focus = inClass ? t.current : t.nextBlock;
  // In a gap the panel shows the class that comes after it: "Next up · after
  // lunch", never "Lunch · up next" (that read as lunch being next).
  const eyebrow = inClass ? 'In progress' : t.phase === 'before' ? 'First up' : gapEyebrow(t.current);
  const title = !focus ? (t.current?.label || '')
    : focus.kind === 'fit' ? 'FIT'
    : focus.course?.name || `Block ${focus.slot || focus.block}`;
  const sub = !focus ? ''
    : focus.kind === 'fit' ? 'Flexible instructional time'
    : [focus.course?.room ? roomLabel(focus.course.room) : null, focus.course?.teacher ? teacherShort(focus.course.teacher) : null].filter(Boolean).join(' · ');
  // What follows the class that is on. Empty in the gaps: the panel already
  // shows what is next.
  const after = !inClass || !plan ? ''
    : !t.next ? 'Last block of the day'
    : `Next · ${t.next.kind === 'block' ? shortName(t.next.course?.name || '') || `Block ${t.next.slot}` : t.next.label} at ${fmt12(t.next.start)}`;
  const footer = rest ? back
    : aheadPlan ? (plan ? "School's out for today" : cal?.label ? `Today · ${cal.label}` : 'No school today')
    : !plan ? '' : after;
  const openFocus = focus?.course ? () => onCourse(focus.course!) : undefined;
  // Friends in the block on now (or up next): "with Alex", and a spare you
  // both have reads "Spare with Alex" — it counts as a block together.
  const { friends } = useSocial();
  const together = aheadPlan ? togetherLabel(first, courses, friends)
    : plan && t.phase !== 'after' ? togetherLabel(focus, courses, friends) : '';

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <LinearGradient
        colors={[c.navy700, c.navy900]}
        start={G165.start}
        end={G165.end}
        style={[{
          borderRadius: 24,
          paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22,
          overflow: 'hidden',
        }, shadow.md]}
      >
        <View style={{ position: 'absolute', right: -10, top: -8, opacity: 0.12, pointerEvents: 'none' }}>
          <SpartanMark size={120} color="#fff" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{
            fontSize: 11.5, letterSpacing: 1.4, textTransform: 'uppercase',
            fontWeight: '600', color: 'rgba(255,255,255,0.7)',
          }}>
            {cardLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={wx ? `${wx.label}, ${Math.round(weather!.temp)} degrees` : 'Weather loading'}>
            <Icon name={wx ? wx.icon : 'cloud'} size={15} stroke={1.8} color="rgba(255,255,255,0.8)" />
            <Text style={[{ fontSize: 11.5, letterSpacing: 1.4, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }, tnum]}>
              {weather ? `${Math.round(weather.temp)}°` : '—'}
            </Text>
          </View>
        </View>

        {rest ? (
          // Resting: a tick, one line, and when school is back. Nothing else.
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, marginBottom: 6 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(232,216,174,0.14)', borderWidth: 1.5, borderColor: 'rgba(232,216,174,0.5)' }}>
              <Check size={18} color={BAR_GOLD} width={3} />
            </View>
            <Text style={{ fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, color: '#fff', flexShrink: 1 }}>{headline}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 6, marginBottom: 18 }}>
            <Text style={{
              fontFamily: fonts.serif, fontSize: plan || aheadPlan ? 64 : 34, lineHeight: plan || aheadPlan ? 64 : 40,
              letterSpacing: -1.5, color: '#fff', flexShrink: 1,
            }}>
              {headline}
            </Text>
          </View>
        )}

        {aheadPlan && (
          <Grid cols={aheadPlan.blocks.length} gap={8}>
            {aheadPlan.blocks.map((b, i) => (
              <BlockTile key={i} p={b} state="next" accent={accent} onPress={b.course ? () => onCourse(b.course!) : undefined} />
            ))}
          </Grid>
        )}

        {/* First class of the next school day, with its time in place of a countdown. */}
        {aheadPlan && first && (
          <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <Pressable onPress={first.course ? () => onCourse(first.course!) : undefined} disabled={!first.course} accessibilityRole={first.course ? 'button' : undefined} style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.7 : 1 })}>
              <Text numberOfLines={1} style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: c.gold, fontWeight: '700' }}>
                First up{ahead!.days === 1 ? ' tomorrow' : ''}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: '600', marginTop: 5, letterSpacing: -0.4, color: '#fff' }}>
                {first.kind === 'fit' ? 'FIT' : first.course?.name || `Block ${first.slot || first.block}`}
              </Text>
              {!!first.course && (
                <Text numberOfLines={1} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  {[first.course.room ? roomLabel(first.course.room) : null, first.course.teacher ? teacherShort(first.course.teacher) : null].filter(Boolean).join(' · ')}
                </Text>
              )}
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8, color: '#fff' }, tnum]}>{fmt12(first.start)}</Text>
              <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>first bell</Text>
            </View>
          </View>
        )}

        {plan && !aheadPlan && !rest && (
          <Grid cols={plan.blocks.length} gap={8}>
            {plan.blocks.map((b, i) => {
              const idx = plan.periods.indexOf(b);
              const state = t.phase === 'after' || idx < t.currentIndex ? 'done'
                : idx === t.currentIndex ? 'now' : 'next';
              return <BlockTile key={i} p={b} state={state} accent={accent} onPress={b.course ? () => onCourse(b.course!) : undefined} />;
            })}
          </Grid>
        )}

        {/* Now panel: class + countdown, one bar, one line for what follows. */}
        {plan && t.phase !== 'after' && target && (
          <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
            <Pressable onPress={openFocus} disabled={!openFocus} accessibilityRole={openFocus ? 'button' : undefined} style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <NowDot size={7} color={accent} />
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, fontWeight: '700' }}>
                  {eyebrow}
                </Text>
              </View>
              <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: '600', marginTop: 5, letterSpacing: -0.4, color: '#fff' }}>{title}</Text>
              {!!sub && <Text numberOfLines={1} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{sub}</Text>}
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[{ fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8, color: '#fff' }, tnum]}>
                {fmtCountdown(t.secsToChange || 0)}
              </Text>
              <Text style={[{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }, tnum]}>
                until <Text style={{ color: BAR_GOLD, fontWeight: '600' }}>{fmt12(t.phase === 'before' ? target.start : target.end)}</Text>
              </Text>
            </View>
          </View>
        )}

        {plan && !aheadPlan && !rest && (
          <View style={{ marginTop: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
            <LinearGradient
              colors={inClass ? [BAR_GOLD, c.gold] : [accent, accent]}
              start={G90.start}
              end={G90.end}
              style={{ height: '100%', width: `${Math.round(Math.min(1, Math.max(0, t.progress)) * 100)}%`, borderRadius: 2 }}
            />
          </View>
        )}

        {/* what follows + the TEMP scrubber button in the corner */}
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text numberOfLines={1} style={[{ flex: 1, fontSize: 12.5, color: off ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.7)' }, tnum]}>{footer || ' '}</Text>
          {!!together && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }} accessibilityLabel={together}>
              <Icon name="users" size={13} stroke={2} color={c.moss} />
              <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '700', color: c.moss, flexShrink: 1 }}>{together}</Text>
            </View>
          )}
          {tempTools && <TimeScrubButton open={scrubOpen} active={t.isPreview} onPress={onToggleScrub} />}
        </View>

        {!!cal?.events?.length && (
          <Text style={{ marginTop: 12, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', lineHeight: 17 }}>
            {cal.events.slice(0, 2).join(' · ')}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
};

const BlockTile = ({ p, state, accent, onPress }: { p: PlanPeriod; state: 'now' | 'next' | 'done'; accent: string; onPress?: () => void }) => {
  const { c } = useTheme();
  const s = {
    now: { bg: '#fff', color: c.navy900, sub: c.ink3, border: 'transparent' },
    next: { bg: 'rgba(255,255,255,0.08)', color: '#fff', sub: 'rgba(255,255,255,0.55)', border: 'transparent' },
    done: { bg: 'rgba(0,0,0,0.18)', color: 'rgba(255,255,255,0.38)', sub: 'rgba(255,255,255,0.28)', border: 'rgba(255,255,255,0.08)' },
  }[state];
  const isFit = p.kind === 'fit';
  const done = state === 'done';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={isFit ? 'FIT' : `${p.course?.name || p.label}, ${fmt12(p.start)}`}
      style={({ pressed }) => ({
        backgroundColor: s.bg, borderWidth: 1, borderColor: s.border, borderRadius: 14,
        paddingTop: 10, paddingHorizontal: 6, paddingBottom: 9, alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 10, letterSpacing: 1, fontWeight: '600', color: isFit && state !== 'now' && !done ? '#E8D8AE' : s.sub, textTransform: 'uppercase', marginBottom: 1 }}>
        {isFit ? 'Flex' : p.slot}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', letterSpacing: -0.3, color: s.color, textDecorationLine: done ? 'line-through' : 'none' }}>
        {isFit ? 'FIT' : shortName(p.course?.name || '')}
      </Text>
      <Text style={[{ fontSize: 11, marginTop: 2, color: s.sub, fontWeight: '500' }, tnum]}>
        {fmt12(p.start)}
      </Text>
      {state === 'now' && (
        <View style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      )}
      {done && (
        <View style={{ position: 'absolute', top: 5, right: 5, width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={8} color="rgba(255,255,255,0.85)" width={4} />
        </View>
      )}
    </Pressable>
  );
};
