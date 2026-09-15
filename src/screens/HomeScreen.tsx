// Spartans — Home screen
// Standard header, greeting with the badge button, the hero "Day" card with
// the live block rotation (real 2026–2027 calendar + bell schedule + the
// student's own courses), a mm:ss countdown, live weather and the in-progress
// row. Then "The Buzz" (a tall window rotating banner news / trivia / polls),
// Programs (every class and extra, tap for the class card), the map tile and
// Quick links (whatever is pinned on More).
//
// TEMPORARY: the small play button in the bottom-right corner of the hero
// opens a time-of-day scrubber (src/PreviewTime.tsx) beneath the card so the
// live card can be checked at any hour.

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import S from '../data';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G165, G90 } from '../theme';
import { Icon, Check } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { SpartanMark, SectionHeader, NowDot, Grid } from '../components/Chrome';
import { QuickLink } from '../components/Cards';
import { Buzz, BuzzSlide } from '../components/Buzz';
import { useProfile, shortName, teacherShort, roomLabel, roomShort, Course } from '../ProfileContext';
import { useToday, fmtLong, fmtClock, greeting, TodayState } from '../useToday';
import { fmt12, fmtCountdown, PlanPeriod } from '../bell';
import { usePreviewTime } from '../PreviewTime';
import { useWeather, describeWeather } from '../weather';
import { useClassSheet } from '../components/ClassCard';
import { usePins } from '../stores';
import { PAGES, Page } from '../pages';
import { BadgesSheet, unlockedCount } from './BadgesScreen';
import { levelState } from '../xp';
import type { ScreenProps } from '../../App';

// Top of the completion bar's gradient — the "gold" the end time is set in.
const BAR_GOLD = '#E8D8AE';

export default function HomeScreen({ onNavigate, topInset, onEditProfile }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const courses = profile?.courses || [];
  const t = useToday(courses);
  const [scrub, setScrub] = useState(false);
  const [badges, setBadges] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const { pins } = usePins();
  const sheet = useClassSheet();

  const openPage = (p: Page) => {
    if (p.go) onNavigate(p.go);
    else if (p.action === 'badges') setBadges(true);
    else if (p.soon) { setSoon(`${p.label} is coming in ${p.soon.toLowerCase()}.`); setTimeout(() => setSoon(null), 2200); }
  };
  const pinned = pins.map(id => PAGES.find(p => p.id === id)).filter(Boolean) as Page[];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} />

      {/* ── Greeting + badge button ───────────────────────────── */}
      <View style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 13, color: c.ink3, letterSpacing: 0.4,
            textTransform: 'uppercase', fontWeight: '600',
          }}>
            {fmtLong(t.now)}{t.isDemo ? ' · demo date' : ''}{t.isPreview ? ` · previewing ${fmtClock(t.now)}` : ''}
          </Text>
          <Text style={{
            fontSize: 28, lineHeight: 32, marginTop: 4,
            fontWeight: '600', color: c.ink, letterSpacing: -0.5,
          }}>
            {greeting(t.now)}, {profile?.firstName || 'there'}.
          </Text>
        </View>
        <BadgeButton onPress={() => setBadges(true)} />
      </View>

      {/* ── Hero day card (rotation + in-progress row) ────────── */}
      <DayHeroCard t={t} scrubOpen={scrub} onToggleScrub={() => setScrub(s => !s)} onCourse={sheet.openCourse} />
      {scrub && <TimeScrubber now={t.now} />}

      {/* ── The Buzz — banner news, trivia, polls ─────────────── */}
      <SectionHeader title="The Buzz" trailing="Open the Buzz" onTrailing={() => onNavigate('buzz')} />
      <Buzz slides={buzzSlides()} onNews={() => onNavigate('buzz')} aspect={1.22} />

      {/* ── Programs — your classes and extras ────────────────── */}
      <SectionHeader title="Programs" trailing="Edit" onTrailing={onEditProfile} />
      <View style={{ paddingHorizontal: 20 }}>
        <ProgramsList courses={courses} extras={profile?.extraCourses || []} onCourse={sheet.openCourse} onExtra={x => sheet.open({ name: x.name, teacher: x.teacher, kind: 'extra' })} />
      </View>

      {/* ── Map tile ──────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <MapTile onPress={() => openPage(PAGES.find(p => p.id === 'map')!)} />
      </View>

      {/* ── Quick links: pinned pages from More ───────────────── */}
      <SectionHeader title="Quick links" trailing="More" onTrailing={() => onNavigate('more')} />
      <View style={{ paddingHorizontal: 20 }}>
        {pinned.length === 0 ? (
          <Text style={{ fontSize: 13, color: c.ink3, lineHeight: 18 }}>Nothing pinned. Open More and tap the pin on any page.</Text>
        ) : (
          <Grid cols={3} gap={10}>
            {pinned.map(p => <QuickLink key={p.id} q={p} onPress={() => openPage(p)} />)}
          </Grid>
        )}
        {!!soon && <Text style={{ fontSize: 12.5, color: c.navy700, fontWeight: '600', marginTop: 10, textAlign: 'center' }}>{soon}</Text>}
      </View>

      <BadgesSheet visible={badges} onClose={() => setBadges(false)} />
    </ScrollView>
  );
}

// Badge menu button — where the temp preview button used to sit. Shows the
// level and how many badges are unlocked.
const BadgeButton = ({ onPress }: { onPress: () => void }) => {
  const { c } = useTheme();
  const lv = levelState();
  const n = unlockedCount();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={`Badges, level ${lv.level}, ${n} unlocked`}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        height: 38, paddingLeft: 8, paddingRight: 12, borderRadius: 19,
        backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
        marginBottom: 2, opacity: pressed ? 0.6 : 1,
      }, shadow.sm]}
    >
      <Icon name="badge" size={20} stroke={1.8} color={c.gold} />
      <View>
        <Text style={[{ fontSize: 12, fontWeight: '700', color: c.ink, letterSpacing: -0.1, lineHeight: 14 }, tnum]}>Lv {lv.level}</Text>
        <Text style={[{ fontSize: 10, color: c.ink3, lineHeight: 12 }, tnum]}>{n} badges</Text>
      </View>
    </Pressable>
  );
};

// Slides for The Buzz: the pinned announcement leads as banner news, then the
// fun stuff from data.ts, then any other announcement as a plain news slide.
const buzzSlides = (): BuzzSlide[] => {
  const news = (a: any): BuzzSlide => ({ id: a.id, kind: 'news', tag: a.tag, title: a.title, body: a.body, author: a.author });
  const pinned = S.announcements.filter(a => a.pinned).map(news);
  const rest = S.announcements.filter(a => !a.pinned).slice(0, 1).map(news);
  return [...pinned, ...(S.buzz as BuzzSlide[]), ...rest];
};

// ────────────────────────────────────────────────────────────────
// Programs list — every class (deduped by name) then the extras.
// ────────────────────────────────────────────────────────────────
const ProgramsList = ({ courses, extras, onCourse, onExtra }: {
  courses: Course[]; extras: { name: string; teacher: string }[];
  onCourse: (k: Course) => void; onExtra: (x: { name: string; teacher: string }) => void;
}) => {
  const { c } = useTheme();
  const seen = new Set<string>();
  const classes = courses.filter(k => {
    if (k.spare || !k.name.trim()) return false;
    const key = k.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rows = [
    ...classes.map(k => ({ key: 'c:' + k.slot, title: k.name, sub: [k.slot ? `Block ${courses.filter(x => x.name === k.name && !x.spare).map(x => x.slot).join(', ')}` : '', teacherShort(k.teacher), k.room ? roomShort(k.room) : ''].filter(Boolean).join(' · '), color: k.color, onPress: () => onCourse(k) })),
    ...extras.filter(x => x.name.trim()).map((x, i) => ({ key: 'x:' + i, title: x.name, sub: [teacherShort(x.teacher), 'Outside the timetable'].filter(Boolean).join(' · '), color: c.sky, onPress: () => onExtra(x) })),
  ];
  if (!rows.length) {
    return <Text style={{ fontSize: 13, color: c.ink3, lineHeight: 18 }}>No classes yet. Tap Edit to add your timetable.</Text>;
  }
  return (
    <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
      {rows.map((r, i) => (
        <Pressable
          key={r.key}
          onPress={r.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${r.title}. Open class card`}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14,
            borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: c.line2,
            backgroundColor: pressed ? c.paper2 : 'transparent',
          })}
        >
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: r.color, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 }}>{shortName(r.title)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{r.title}</Text>
            {!!r.sub && <Text numberOfLines={1} style={{ fontSize: 12, color: c.ink3, marginTop: 2 }}>{r.sub}</Text>}
          </View>
          <Icon name="chev-r" size={16} stroke={1.8} color={c.ink4} />
        </Pressable>
      ))}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Map tile — a small rectangle above Quick links that opens the map.
// ────────────────────────────────────────────────────────────────
const MapTile = ({ onPress }: { onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="School map"
      style={({ pressed }) => [{
        height: 92, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.line,
        backgroundColor: c.skyTint, opacity: pressed ? 0.85 : 1, justifyContent: 'center', paddingHorizontal: 16,
      }, shadow.sm]}
    >
      {/* faint contour lines */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -20, right: -20, top: 0, bottom: 0, opacity: 0.14 }}>
        {[14, 34, 54, 74].map(y => <View key={y} style={{ position: 'absolute', top: y, left: 0, right: 0, height: 1, backgroundColor: c.sky }} />)}
        {[60, 140, 220, 300, 380].map(x => <View key={x} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, backgroundColor: c.sky }} />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line }}>
          <Icon name="map" size={24} stroke={1.7} color={c.sky600} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>School map</Text>
          <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 2 }}>Tap a class, get the route from the front doors</Text>
        </View>
        <Icon name="chev-r" size={16} stroke={1.8} color={c.ink4} />
      </View>
    </Pressable>
  );
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

  const headline = plan ? `Day ${plan.dayNum}` : (cal?.label || 'No school');
  const subline = plan
    ? `${plan.bellName}${plan.early ? ` · early dismissal ${fmt12(plan.early)}` : ''}\n${plan.blocks.length} blocks${plan.fitStart ? ` · FIT ${fmt12(plan.fitStart)}` : ' · no FIT'}${cal?.projected ? '\nrotation projected' : ''}`
    : cal?.kind === 'weekend' ? 'Weekend\nEnjoy it' : 'No classes today';

  // Countdown target: end of the current period, or the first bell before school.
  const target = t.phase === 'during' ? t.current : t.phase === 'before' ? plan?.periods[0] || null : null;
  const caption = (() => {
    if (!plan) return null;
    if (t.phase === 'before') return `until ${plan.periods[0].label} starts`;
    if (t.phase === 'after') return "School's out for today";
    const cur = t.current!;
    const nxt = t.nextBlock;
    return `left in ${cur.label}${nxt ? ` · next ${nxt.label} at ${fmt12(nxt.start)}` : ' · last block'}`;
  })();

  const wx = weather ? describeWeather(weather.code, weather.isDay) : null;

  // Accent: moss while a class/FIT is on, gold in the gaps (break, lunch,
  // transition, before first bell), grey when school is off or done.
  const inClass = !!t.current && (t.current.kind === 'block' || t.current.kind === 'fit');
  const off = !plan || t.phase === 'after';
  const accent = off ? 'rgba(255,255,255,0.45)' : inClass ? c.moss : c.gold;

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
        <View style={{ position: 'absolute', right: -6, top: -6, opacity: 0.1, pointerEvents: 'none' }}>
          <SpartanMark size={90} color="#fff" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{
            fontSize: 11.5, letterSpacing: 1.4, textTransform: 'uppercase',
            fontWeight: '600', color: 'rgba(255,255,255,0.7)',
          }}>
            Today's rotation{plan ? ` · ${plan.code}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={wx ? `${wx.label}, ${Math.round(weather!.temp)} degrees` : 'Weather loading'}>
            <Icon name={wx ? wx.icon : 'cloud'} size={15} stroke={1.8} color="rgba(255,255,255,0.8)" />
            <Text style={[{ fontSize: 11.5, letterSpacing: 1.4, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }, tnum]}>
              {weather ? `${Math.round(weather.temp)}°` : '—'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14, marginTop: 6, marginBottom: 18 }}>
          <Text style={{
            fontFamily: fonts.serif, fontSize: plan ? 64 : 34, lineHeight: plan ? 64 : 40,
            letterSpacing: -1.5, color: '#fff', flexShrink: 1,
          }}>
            {headline}
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', letterSpacing: -0.1, fontWeight: '500', lineHeight: 17 }}>
            {subline}
          </Text>
        </View>

        {plan && (
          <Grid cols={plan.blocks.length} gap={8}>
            {plan.blocks.map((b, i) => {
              const idx = plan.periods.indexOf(b);
              const state = t.phase === 'after' || idx < t.currentIndex ? 'done'
                : idx === t.currentIndex ? 'now' : 'next';
              return <BlockTile key={i} p={b} state={state} accent={accent} onPress={b.course ? () => onCourse(b.course!) : undefined} />;
            })}
          </Grid>
        )}

        {plan && t.phase !== 'after' && target && (
          <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <NowDot size={8} color={accent} />
              <Text style={[{ fontSize: 24, lineHeight: 28, fontWeight: '700', letterSpacing: -0.6, color: accent }, tnum]}>
                {fmtCountdown(t.secsToChange || 0)}
              </Text>
            </View>
            <Text style={[{ fontSize: 15, fontWeight: '600', letterSpacing: -0.2, color: BAR_GOLD }, tnum]}>
              {fmt12(t.phase === 'before' ? target.start : target.end)}
            </Text>
          </View>
        )}

        {plan && (
          <View style={{ marginTop: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
            <LinearGradient
              colors={inClass ? [BAR_GOLD, c.gold] : [accent, accent]}
              start={G90.start}
              end={G90.end}
              style={{ height: '100%', width: `${Math.round(Math.min(1, Math.max(0, t.progress)) * 100)}%`, borderRadius: 2 }}
            />
          </View>
        )}

        {/* caption + TEMP scrubber button share the bottom row; the button sits in the corner */}
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 12.5, color: off ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.7)' }}>{caption || ' '}</Text>
          {!inClass && <TimeScrubButton open={scrubOpen} active={t.isPreview} onPress={onToggleScrub} />}
        </View>

        {inClass && <NowRow t={t} accent={accent} scrubOpen={scrubOpen} onToggleScrub={onToggleScrub} onPress={t.current?.course ? () => onCourse(t.current!.course!) : undefined} />}

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
        {isFit ? 'FIT' : `BLK ${p.slot}`}
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

// ────────────────────────────────────────────────────────────────
// In-progress row — sits at the bottom of the hero, only while a class or
// FIT is actually on. Collapses (renders nothing) otherwise. Tap for the
// class card. The TEMP scrubber button lives in its corner while it shows.
// ────────────────────────────────────────────────────────────────
const NowRow = ({ t, accent, scrubOpen, onToggleScrub, onPress }: { t: TodayState; accent: string; scrubOpen: boolean; onToggleScrub: () => void; onPress?: () => void }) => {
  const cur = t.current;
  if (!cur) return null;

  const title = cur.kind === 'block'
    ? (cur.course?.name || `Block ${cur.block}`)
    : cur.label;
  const sub = cur.kind === 'block'
    ? [cur.course?.room ? roomLabel(cur.course.room) : null, cur.course?.teacher ? teacherShort(cur.course.teacher) : null].filter(Boolean).join(' · ') || `Block ${cur.block}`
    : cur.kind === 'fit' ? 'Flexible instructional time' : '';

  return (
    <View style={{
      marginTop: 16, paddingTop: 14,
      borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
      flexDirection: 'row', gap: 12, alignItems: 'center',
    }}>
      <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.7 : 1 })} accessibilityRole={onPress ? 'button' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NowDot size={6} color={accent} />
          <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: accent, fontWeight: '700' }}>
            In progress
          </Text>
        </View>
        <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '600', marginTop: 4, letterSpacing: -0.3, color: '#fff' }}>{title}</Text>
        {!!sub && <Text numberOfLines={1} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{sub}</Text>}
      </Pressable>

      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={[{ fontSize: 14, fontWeight: '600', color: '#fff', letterSpacing: -0.2 }, tnum]}>
          {fmt12(cur.start)}<Text style={{ color: 'rgba(255,255,255,0.45)' }}> – </Text>{fmt12(cur.end)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {!!t.next && (
            <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.1 }}>Next · {t.next.label}</Text>
          )}
          <TimeScrubButton open={scrubOpen} active={t.isPreview} onPress={onToggleScrub} />
        </View>
      </View>
    </View>
  );
};
