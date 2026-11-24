// Spartans — Calendar screen
// Month view of the real 2026–2027 school calendar plus a scrolling 5-day
// week view and a Day tab (the old Day view). Month cells show the day number and one day type (Regular days
// say nothing; FIT, Collab, Pro-D, Holiday, Break, No class get a word and a
// tint). The rotation code lives in the day sheet, not the grid. Today has a
// green ring, a dot in the corner marks days with events. Week view centres
// on today and draws each day as a time-blocked column; scrolling it updates
// the title (This week, Next week, Oct 26 – 30). Day draws one day full width
// with its homework and events; arrows or a sideways swipe step school days.
// Homework is never an event: it has its own list in the day sheet and marks on
// the class blocks, and stays out of the event dots and the month's event list.
// The + button adds homework (or a quiz, test, project) or a personal event,
// and says which is which. Homework days get a grey dot, quiz/test days a diamond.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Easing, TextInput, Keyboard, Platform, useWindowDimensions, PanResponder } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon, IconName, Check } from '../components/Icon';
import { NowDot } from '../components/Chrome';
import { AppHeader } from '../components/AppHeader';
import { BottomSheet } from '../components/BottomSheet';
import {
  YEAR_MONTHS, MONTH_NAMES, monthGrid, GridCell, CalDay, fromISO, CALENDAR, SCHOOL_YEAR,
} from '../calendar';
import { buildDayPlan, fmt12, toMin } from '../bell';
import { useProfile, roomShort, teacherShort } from '../ProfileContext';
import { useNow } from '../useToday';
import { toISO } from '../calendar';
import { useEvents, PersonalEvent, useHomework } from '../stores';
import { usePosted } from '../content';
import { useClassSheet } from '../components/ClassCard';
import { DayColumn, HomeworkMark, blockHomework } from '../components/DayColumn';
import { glow } from '../components/ProgramIcon';
import { useNav, useFocus } from '../nav';
import { Spot, useReveal, useScrollSpot } from '../components/Spot';
import { DueFields, TimeFields, dayLabel, useKindColor, KindChip, KindTag, addDays } from '../components/HomeworkList';
import { guessKind, type HomeworkKind } from '../programs';
import { useKeyboardHeight, sheetHeight } from '../useKeyboard';
import type { ScreenProps } from '../../App';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthIndexFor = (iso: string) => {
  const d = fromISO(iso);
  const i = YEAR_MONTHS.findIndex(([y, m]) => y === d.getFullYear() && m === d.getMonth());
  return i === -1 ? 0 : i;
};

type Mode = 'month' | 'week' | 'day';

// The one word a day gets in the grid. Regular school days get none.
export type DayType = 'regular' | 'fit' | 'collab' | 'prod' | 'holiday' | 'break' | 'noclass' | 'weekend';
export const dayTypeOf = (cal?: CalDay): DayType =>
  !cal ? 'noclass'
  : cal.kind === 'school' ? 'regular'
  : cal.kind;
const typeLabel = (t: DayType, cal?: CalDay) =>
  t === 'fit' ? 'FIT'
  : t === 'collab' ? 'Collab'
  : t === 'prod' ? 'Pro-D'
  : t === 'holiday' ? 'Holiday'
  : t === 'break' ? 'Break'
  : t === 'noclass' ? (cal?.label?.includes('First') ? 'First day' : cal?.label?.includes('Year end') ? 'Last day' : 'No class')
  : t === 'regular' ? 'Regular'
  : '';
// Word colour + cell fill per day type. Accents glow() on the dark theme.
const typeTone = (t: DayType, c: ReturnType<typeof useTheme>['c'], mode: 'light' | 'dark' = 'light') => ({
  regular: { fg: c.ink3, bg: c.surface },
  fit: { fg: glow(c.gold, mode), bg: c.surface },
  collab: { fg: glow(c.sky600, mode), bg: c.skyTint },
  prod: { fg: c.ink3, bg: c.paper2 },
  holiday: { fg: c.link, bg: c.navy50 },
  break: { fg: c.ink3, bg: c.paper2 },
  noclass: { fg: c.ink3, bg: c.paper2 },
  weekend: { fg: c.ink4, bg: 'transparent' },
}[t]);

// The day the week view centres on: today, moved by whole weeks. A weekend
// anchor slides to the Monday after it so the strip always lands on school days.
const weekAnchor = (todayIso: string, off: number) => {
  const d = fromISO(todayIso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate() + off * 7);
  if (off !== 0 || a.getDay() === 0 || a.getDay() === 6) {
    // Monday of that week (off ≠ 0), or the next Monday from a weekend
    const dow = a.getDay();
    const toMon = off === 0 ? (dow === 6 ? 2 : 1) : (dow === 0 ? -6 : 1 - dow);
    return toISO(new Date(a.getFullYear(), a.getMonth(), a.getDate() + toMon));
  }
  return toISO(a);
};
const mondayOf = (iso: string) => { const a = fromISO(iso); return new Date(a.getFullYear(), a.getMonth(), a.getDate() - ((a.getDay() + 6) % 7)); };
// Whole weeks from today's week to the week holding `iso` (0 = this week).
const weeksFrom = (todayIso: string, iso: string) => Math.round((mondayOf(iso).getTime() - mondayOf(todayIso).getTime()) / (7 * 86400000));
// Next school weekday `d` steps away (weekends skipped).
const stepSchoolDay = (iso: string, d: number) => {
  const a = fromISO(iso);
  let x = new Date(a.getFullYear(), a.getMonth(), a.getDate() + d);
  while (x.getDay() === 0 || x.getDay() === 6) x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + d);
  return toISO(x);
};
// "Oct 5 – 9": Monday to Friday of the anchor's week.
const weekLabel = (anchorIso: string) => {
  const a = fromISO(anchorIso);
  const mon = new Date(a.getFullYear(), a.getMonth(), a.getDate() - ((a.getDay() + 6) % 7));
  const fri = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 4);
  const m = (d: Date) => MONTH_NAMES[d.getMonth()].slice(0, 3);
  return mon.getMonth() === fri.getMonth() ? `${m(mon)} ${mon.getDate()} – ${fri.getDate()}` : `${m(mon)} ${mon.getDate()} – ${m(fri)} ${fri.getDate()}`;
};

export default function CalendarScreen({ topInset }: ScreenProps) {
  const { c, mode: scheme } = useTheme();
  const nav = useNav();
  const now = useNow();
  const todayIso = toISO(now);
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('month');
  const [mi, setMi] = useState(() => monthIndexFor(todayIso));
  const [weekOff, setWeekOff] = useState(0);
  const weekIso = weekAnchor(todayIso, weekOff);
  const [selected, setSelected] = useState(todayIso);
  // The week the strip is centred on right now (follows scrolling).
  const [weekShown, setWeekShown] = useState(weekIso);
  const [nonce, setNonce] = useState(0);   // bump to re-centre the week strip on today
  const [gridW, setGridW] = useState(0);
  const [adding, setAdding] = useState<PersonalEvent | 'new' | null>(null);
  // Stable between renders so the sheet doesn't take each clock tick as a reopen.
  const editorInitial = useMemo(() => (adding === 'new' ? { iso: selected } : adding || undefined), [adding, selected]);
  const { eventsOn } = useEvents();
  const club = usePosted('event', 'calendar');
  const hwAll = useHomework();
  // What's still due on each day, for the marks on the month grid.
  const workByDay = useMemo(() => {
    const m: Record<string, DayWork> = {};
    for (const h of hwAll.items) {
      if (h.done) continue;
      const w = m[h.due] || (m[h.due] = { homework: 0, test: null });
      if (h.kind === 'test') w.test = 'test';
      else if (h.kind === 'quiz') w.test = w.test || 'quiz';
      else w.homework++;
    }
    return m;
  }, [hwAll.items]);

  const [year, month] = YEAR_MONTHS[mi];
  const cells = monthGrid(year, month);
  const gap = 4;
  // onLayout reports the padded width (12 + 12); floor so 7 cells never wrap.
  const cell = gridW > 0 ? Math.floor((gridW - 24 - gap * 6) / 7) : 0;

  // Mon-first column of today, lit in the weekday header when today is on screen.
  const todayCol = (now.getDay() + 6) % 7;
  const todayInMonth = cells.some(x => !x.padding && x.iso === todayIso);
  const goToday = () => { setMi(monthIndexFor(todayIso)); setWeekOff(0); setWeekShown(weekAnchor(todayIso, 0)); setNonce(n => n + 1); setSelected(todayIso); };
  const weekRel = weeksFrom(todayIso, weekShown);
  const onToday = mode === 'month' ? selected === todayIso && todayInMonth
    : mode === 'week' ? weekRel === 0
    : selected === todayIso;
  // go('dayview') from Home, Profile or a notification lands here on the Day tab.
  useEffect(() => {
    if (!nav.calMode) return;
    setMode(nav.calMode);
    if (nav.calMode === 'day') goToday();
    nav.clearCalMode();
  }, [nav.calMode]);   // eslint-disable-line react-hooks/exhaustive-deps
  // From a notification: that day, with the event it was about marked.
  const scroll = useScrollSpot();
  const [spot, setSpot] = useState<string | null>(null);
  useFocus('day', f => {
    setMode('day');
    setSelected(f.iso);
    setMi(monthIndexFor(f.iso));
    setSpot(f.event || null);
    if (!f.event) scroll.ref.current?.scrollTo({ y: 0, animated: false });
    return true;
  }, []);
  useEffect(() => {
    if (!spot) return;
    const t = setTimeout(() => setSpot(null), 6000);
    return () => clearTimeout(t);
  }, [spot]);
  const stepDay = (d: number) => {
    const iso = stepSchoolDay(selected, d);
    setSelected(iso);
    setMi(monthIndexFor(iso));
  };
  const step = (d: number) => setMi(i => Math.min(YEAR_MONTHS.length - 1, Math.max(0, i + d)));
  const stepWeek = (d: number) => {
    const next = weekOff + d;
    const iso = weekAnchor(todayIso, next);
    setWeekOff(next);
    setWeekShown(iso);
    setSelected(next === 0 ? todayIso : iso);
  };

  // Month grid: swipe sideways to change month. The grid slides out the way
  // you pushed it, the next month slides in from the other side. The arrows
  // use the same move so both feel alike.
  const frameW = Math.min(width, 430);
  const slide = useRef(new Animated.Value(0)).current;
  const miRef = useRef(mi); miRef.current = mi;
  const animating = useRef(false);
  const settle = () => Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
  const modeRef = useRef(mode); modeRef.current = mode;
  const stepDayRef = useRef(stepDay); stepDayRef.current = stepDay;
  const swipeMonth = (d: number) => {
    const isDay = modeRef.current === 'day';
    const can = isDay || (d > 0 ? miRef.current < YEAR_MONTHS.length - 1 : miRef.current > 0);
    if (!can || animating.current) { settle(); return; }
    animating.current = true;
    Animated.timing(slide, { toValue: -d * frameW, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      if (isDay) stepDayRef.current(d); else step(d);
      slide.setValue(d * frameW);
      Animated.timing(slide, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => { animating.current = false; });
    });
  };
  const swipeRef = useRef(swipeMonth); swipeRef.current = swipeMonth;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderMove: (_, g) => { if (!animating.current) slide.setValue(g.dx * 0.9); },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -48 || g.vx < -0.6) swipeRef.current(1);
      else if (g.dx > 48 || g.vx > 0.6) swipeRef.current(-1);
      else settle();
    },
    onPanResponderTerminate: settle,
    onPanResponderTerminationRequest: () => false,
  })).current;

  const sel = cells.find(x => x.iso === selected) || cellFor(selected);
  const selDate = fromISO(selected);
  const dayRel = Math.round((selDate.getTime() - fromISO(todayIso).getTime()) / 86400000);
  const title = mode === 'month' ? MONTH_NAMES[month]
    : mode === 'week' ? (weekRel === 0 ? 'This week' : weekRel === 1 ? 'Next week' : weekRel === -1 ? 'Last week' : weekLabel(weekShown))
    : dayRel === 0 ? 'Today' : dayRel === 1 ? 'Tomorrow' : dayRel === -1 ? 'Yesterday' : DOW_LONG[selDate.getDay()];
  const subtitle = mode === 'month' ? String(year)
    : mode === 'week' ? (Math.abs(weekRel) <= 1 ? weekLabel(weekShown) : String(fromISO(weekShown).getFullYear()))
    : `${Math.abs(dayRel) <= 1 ? DOW_LONG[selDate.getDay()].slice(0, 3) + ' ' : ''}${MONTH_NAMES[selDate.getMonth()].slice(0, 3)} ${selDate.getDate()}`;

  return (
    <View ref={scroll.frame} collapsable={false} style={{ flex: 1 }}>
    <ScrollView
      ref={scroll.ref}
      onScroll={scroll.onScroll}
      scrollEventThrottle={32}
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} title="Calendar" />

      {/* ── Month name with arrows, then Month/Week, Today and + ──── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: c.ink, flexShrink: 1 }}>
            {title}
          </Text>
          <Text style={[{ fontSize: 15, fontWeight: '600', color: c.ink4 }, tnum]}>
            {subtitle}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          {mode === 'month'
            ? <NavBtn name="chev-l" onPress={() => swipeMonth(-1)} disabled={mi === 0} label="Previous month" />
            : mode === 'week'
            ? <NavBtn name="chev-l" onPress={() => stepWeek(-1)} label="Previous week" />
            : <NavBtn name="chev-l" onPress={() => swipeMonth(-1)} label="Previous day" />}
          {mode === 'month'
            ? <NavBtn name="chev-r" onPress={() => swipeMonth(1)} disabled={mi === YEAR_MONTHS.length - 1} label="Next month" />
            : mode === 'week'
            ? <NavBtn name="chev-r" onPress={() => stepWeek(1)} label="Next week" />
            : <NavBtn name="chev-r" onPress={() => swipeMonth(1)} label="Next day" />}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flexDirection: 'row', backgroundColor: c.paper2, borderRadius: 12, padding: 3, gap: 2, width: 216 }}>
          {(['month', 'week', 'day'] as Mode[]).map(k => {
            const on = mode === k;
            return (
              <Pressable key={k} onPress={() => setMode(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[{ flex: 1, borderRadius: 9, paddingVertical: 7, alignItems: 'center', backgroundColor: on ? c.surface : 'transparent' }, on ? shadow.sm : shadow.none]}>
                <Text style={{ fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink3 }}>{k === 'month' ? 'Month' : k === 'week' ? 'Week' : 'Day'}</Text>
              </Pressable>
            );
          })}
        </View>
        {!onToday && (
          <Pressable onPress={goToday} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to today" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.link }}>Today</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setAdding('new')}
          accessibilityRole="button"
          accessibilityLabel="Add homework, a test or an event"
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
        >
          <Icon name="plus" size={18} stroke={2.4} color="#fff" />
        </Pressable>
      </View>

      {mode === 'month' ? (
        <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: slide }] }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 }}>
            {WEEKDAYS.map((d, i) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', paddingVertical: 4, fontSize: 12, fontWeight: todayCol === i && todayInMonth ? '800' : '600', color: todayCol === i && todayInMonth ? glow(c.moss, scheme) : i >= 5 ? c.ink4 : c.ink3 }}>
                {d.slice(0, 1)}
              </Text>
            ))}
          </View>

          <View
            onLayout={e => setGridW(e.nativeEvent.layout.width)}
            style={{ paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', gap }}
          >
            {cell > 0 && cells.map(d => (
              <View key={d.iso} style={{ width: cell, height: cell }}>
                <DayCell
                  d={d}
                  isToday={d.iso === todayIso}
                  selected={!d.padding && d.iso === selected}
                  hasEvents={!d.padding && (!!d.cal?.events?.filter(ev => !ROUTINE.test(ev)).length || eventsOn(d.iso).some(e => e.source !== 'homework') || club.some(e => e.date === d.iso))}
                  work={d.padding ? undefined : workByDay[d.iso]}
                  onPress={() => !d.padding && setSelected(d.iso)}
                />
              </View>
            ))}
          </View>
          <DotKey />
        </Animated.View>
      ) : mode === 'week' ? (
        <WeekView todayIso={todayIso} anchorIso={weekIso} weekOff={weekOff} nonce={nonce} selected={selected} onSelect={setSelected} onVisible={setWeekShown} />
      ) : null}

      {mode === 'day' ? (
        <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: slide }] }}>
          <DaySheet key={selected} d={sel} isToday={selected === todayIso} onEditEvent={e => setAdding(e)} asDay spot={spot} bring={scroll.bring} />
        </Animated.View>
      ) : (
        <DaySheet key={selected} d={sel} isToday={selected === todayIso} onEditEvent={e => setAdding(e)} />
      )}

      {mode === 'month' && <MonthEvents cells={cells} month={month} selected={selected} todayIso={todayIso} onSelect={setSelected} />}

      <EventEditor
        visible={adding !== null}
        initial={editorInitial}
        onClose={() => setAdding(null)}
      />
    </ScrollView>
    </View>
  );
}

// A GridCell for a date outside the visible month (week view can select one).
const cellFor = (iso: string): GridCell => {
  const d = fromISO(iso);
  return { iso, day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), padding: false, cal: CALENDAR[iso] };
};

// ────────────────────────────────────────────────────────────────
// Day cell
// ────────────────────────────────────────────────────────────────
// Open homework due on a day, and the biggest quiz/test among it.
type DayWork = { homework: number; test: 'test' | 'quiz' | null };

const DayCell = ({ d, isToday, selected, hasEvents, work, onPress }: { d: GridCell; isToday: boolean; selected: boolean; hasEvents: boolean; work?: DayWork; onPress: () => void }) => {
  const { c, mode } = useTheme();
  const today = glow(c.moss, mode);
  const kindColor = useKindColor();

  // Days from the next or last month: a faint number, nothing else.
  if (d.padding) {
    return (
      <View style={{ flex: 1, paddingTop: 6, paddingLeft: 7 }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: c.ink4, opacity: 0.35 }}>{d.day}</Text>
      </View>
    );
  }

  const cal = d.cal;
  const type = dayTypeOf(cal);
  const isWeekend = type === 'weekend';
  const hatched = type === 'prod' || type === 'break';
  const tone = typeTone(type, c, mode);
  const label = type === 'regular' || isWeekend ? '' : typeLabel(type, cal);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${d.day}${isToday ? ', today' : ''}, ${typeLabel(type, cal) || 'weekend'}${hasEvents ? ', has events' : ''}${work?.test ? `, ${work.test} due` : ''}${work?.homework ? `, ${work.homework} homework due` : ''}`}
      style={[{
        flex: 1, borderRadius: 10, overflow: 'hidden', paddingTop: 5, paddingHorizontal: 5, paddingBottom: 5,
        // Dark theme: lift school days off the page so the grid reads brighter.
        backgroundColor: selected ? c.action : isWeekend ? c.paper : mode === 'dark' && tone.bg === c.surface ? '#1E2836' : tone.bg,
        // Every day of the week gets the outline, weekends included.
        borderWidth: isToday ? 2 : 1,
        borderColor: isToday ? today : selected ? c.action : mode === 'dark' ? '#384557' : c.line,
      }, selected ? shadow.md : shadow.none]}
    >
      {hatched && !selected && <Hatch color={c.hatch} />}
      <View style={{ minWidth: 22, height: 22, marginLeft: -2, marginTop: -2, paddingHorizontal: 3, borderRadius: 11, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? (selected ? '#fff' : today) : 'transparent' }}>
        <Text style={[{ fontSize: 14, fontWeight: isToday ? '800' : isWeekend ? '500' : '600', letterSpacing: -0.3, color: isToday ? (selected ? c.action : mode === 'dark' ? '#0C1117' : '#fff') : selected ? '#fff' : isWeekend ? c.ink4 : c.ink }, tnum]}>
          {d.day}
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      {!!label && (
        <Text numberOfLines={1} style={{ fontSize: label.length > 6 ? 9 : 10, fontWeight: '700', letterSpacing: label.length > 6 ? -0.35 : 0, marginHorizontal: -2, color: selected ? 'rgba(255,255,255,0.9)' : tone.fg }}>
          {label}
        </Text>
      )}
      {/* Top-right marks: event (green), homework (grey), quiz/test (gold/red). */}
      {(hasEvents || !!work) && (
        <View style={{ position: 'absolute', top: 6, right: 5, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {hasEvents && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: selected ? '#fff' : today }} />}
          {!!work?.homework && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: selected ? 'rgba(255,255,255,0.7)' : c.ink3 }} />}
          {!!work?.test && <View style={{ width: 7, height: 7, borderRadius: 2, transform: [{ rotate: '45deg' }], backgroundColor: selected ? '#fff' : kindColor(work.test) }} />}
        </View>
      )}
    </Pressable>
  );
};

// What the marks on the month grid mean.
const DotKey = () => {
  const { c, mode } = useTheme();
  const kindColor = useKindColor();
  const item = (mark: React.ReactNode, label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {mark}
      <Text style={{ fontSize: 12, color: c.ink3 }}>{label}</Text>
    </View>
  );
  const dot = (bg: string) => <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bg }} />;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 16, paddingTop: 10 }} accessibilityLabel="Green dot: event. Grey dot: homework due. Diamond: quiz or test.">
      {item(dot(glow(c.moss, mode)), 'Event')}
      {item(dot(c.ink3), 'Homework')}
      {item(<View style={{ width: 7, height: 7, borderRadius: 2, transform: [{ rotate: '45deg' }], backgroundColor: kindColor('test') }} />, 'Quiz or test')}
    </View>
  );
};

const Hatch = ({ color }: { color: string }) => (
  <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
    <Svg width="100%" height="100%" viewBox="0 0 60 60" preserveAspectRatio="none">
      {Array.from({ length: 20 }, (_, i) => (
        <Line key={i} x1={i * 7 - 60} y1={60} x2={i * 7} y2={0} stroke={color} strokeWidth={1} />
      ))}
    </Svg>
  </View>
);

const NavBtn = ({ name, onPress, disabled, label }: { name: IconName; onPress: () => void; disabled?: boolean; label?: string }) => {
  const { c } = useTheme();
  // Arrows: link-coloured so they stay bright on the dark theme.
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 32, height: 32, borderRadius: 16, backgroundColor: pressed ? c.navy50 : 'transparent',
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1,
      })}
    >
      <Icon name={name} size={19} stroke={2.2} color={c.link} />
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Week view — a horizontal strip of school days, three visible, today in the
// middle on open. Each column is a scaled DayColumn. Tap a day header to
// select it (the day sheet below follows), tap a block for the class card.
// ────────────────────────────────────────────────────────────────
const weekdaysAround = (centerIso: string, before: number, after: number) => {
  const out: string[] = [];
  const c0 = fromISO(centerIso);
  // walk back `before` school days and forward `after`, skipping weekends
  const push = (d: Date) => { const dow = d.getDay(); if (dow !== 0 && dow !== 6) out.push(toISO(d)); };
  let d = new Date(c0);
  const back: string[] = [];
  while (back.length < before) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) back.unshift(toISO(d)); }
  out.push(...back);
  push(c0.getDay() === 0 ? new Date(c0.getFullYear(), c0.getMonth(), c0.getDate() + 1) : c0.getDay() === 6 ? new Date(c0.getFullYear(), c0.getMonth(), c0.getDate() + 2) : c0);
  d = fromISO(out[out.length - 1]);
  let n = 0;
  while (n < after) { d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) { out.push(toISO(d)); n++; } }
  return out;
};

const WeekView = ({ todayIso, anchorIso, weekOff, nonce, selected, onSelect, onVisible }: {
  todayIso: string; anchorIso: string; weekOff: number; nonce: number; selected: string; onSelect: (iso: string) => void; onVisible: (iso: string) => void;
}) => {
  const { c, mode } = useTheme();
  const { items: homework } = useHomework();
  const { width } = useWindowDimensions();
  const { profile } = useProfile();
  const { eventsOn } = useEvents();
  const sheet = useClassSheet();
  const now = useNow();
  const scroll = useRef<ScrollView>(null);
  const BEFORE = 10, AFTER = 15;
  const days = useMemo(() => weekdaysAround(anchorIso, BEFORE, AFTER), [anchorIso]);
  const frame = Math.min(width, 430);
  const colW = Math.floor((frame - 40) / 3);
  const gapW = 8;
  // Which day sits in the middle of the strip: drives the "This week" title.
  const shown = useRef('');
  const onScroll = (x: number) => {
    const i = Math.max(0, Math.min(days.length - 1, Math.floor((x + frame / 2 - 20) / (colW + gapW))));
    if (days[i] && days[i] !== shown.current) { shown.current = days[i]; onVisible(days[i]); }
  };

  // Centre the anchor (today, or the Monday of the week you stepped to).
  // Stepping a week slides the strip in from the side it came from.
  const enter = useRef(new Animated.Value(0)).current;
  const lastOff = useRef(weekOff);
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollTo({ x: Math.max(0, BEFORE * (colW + gapW) - (Math.min(width, 430) - 40 - colW) / 2), animated: false }), 30);
    const dir = Math.sign(weekOff - lastOff.current);
    lastOff.current = weekOff;
    if (dir) {
      enter.setValue(dir * 60);
      Animated.spring(enter, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
    }
    return () => clearTimeout(t);
  }, [colW, width, anchorIso, nonce]);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ transform: [{ translateX: enter }] }}>
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={colW + gapW}
      decelerationRate="fast"
      scrollEventThrottle={32}
      onScroll={e => onScroll(e.nativeEvent.contentOffset.x)}
      contentContainerStyle={{ paddingHorizontal: 20, gap: gapW, paddingBottom: 4 }}
    >
      {days.map(iso => {
        const d = fromISO(iso);
        const cal = CALENDAR[iso];
        const plan = buildDayPlan(cal, profile?.courses || []);
        const isToday = iso === todayIso;
        const isSel = iso === selected;
        // Homework shows as notepads on the class blocks, so only real events here.
        const mine = eventsOn(iso).filter(e => e.source !== 'homework');
        return (
          <View key={iso} style={{ width: colW }}>
            <Pressable
              onPress={() => onSelect(iso)}
              accessibilityRole="button"
              accessibilityLabel={`${DOW3[d.getDay()]} ${d.getDate()}${isToday ? ', today' : ''}`}
              style={({ pressed }) => ({
                alignItems: 'center', paddingVertical: 6, borderRadius: 12, marginBottom: 6,
                backgroundColor: isSel ? c.action : isToday ? c.mossTint : 'transparent', opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: isSel ? 'rgba(255,255,255,0.8)' : c.ink3 }}>{DOW3[d.getDay()]}</Text>
              <Text style={[{ fontSize: 20, fontWeight: '800', color: isSel ? '#fff' : isToday ? glow(c.moss, mode) : c.ink, letterSpacing: -0.5 }, tnum]}>{d.getDate()}</Text>
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: isSel ? 'rgba(255,255,255,0.85)' : typeTone(dayTypeOf(cal), c, mode).fg, marginTop: 1 }}>{dayTypeOf(cal) === 'regular' ? ' ' : typeLabel(dayTypeOf(cal), cal)}</Text>
            </Pressable>
            {plan ? (
              <DayColumn plan={plan} iso={iso} homework={homework} now={isToday ? now : null} compact pxPerMin={1.15} onBlock={p => p.course && sheet.openCourse(p.course)} />
            ) : (
              <View style={{ height: 120, borderRadius: 10, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                <Text numberOfLines={3} style={{ fontSize: 13, fontWeight: '600', color: c.ink3, textAlign: 'center' }}>{cal?.label || 'No classes'}</Text>
              </View>
            )}
            {mine.length > 0 && (
              <View style={{ marginTop: 6, gap: 4 }}>
                {mine.slice(0, 3).map(e => (
                  <View key={e.id} style={{ borderRadius: 8, backgroundColor: c.goldTint, paddingVertical: 5, paddingHorizontal: 7 }}>
                    {!!e.time && <Text style={[{ fontSize: 11, fontWeight: '800', color: glow(c.gold, mode) }, tnum]}>{fmt12(e.time)}</Text>}
                    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: c.ink }}>{e.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
    </Animated.View>
  );
};

// ────────────────────────────────────────────────────────────────
// Detail sheet for the selected day
// ────────────────────────────────────────────────────────────────
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DaySheet = ({ d, isToday, onEditEvent, asDay = false, spot, bring }: { d?: GridCell; isToday: boolean; onEditEvent: (e: PersonalEvent) => void; asDay?: boolean; spot?: string | null; bring?: (n: View | null) => void }) => {
  const { c, mode } = useTheme();
  const { profile } = useProfile();
  const { eventsOn, remove } = useEvents();
  const hw = useHomework();
  const club = usePosted('event', 'calendar');
  const sheet = useClassSheet();
  const now = useNow();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 280, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true }).start();
  }, [a]);

  if (!d) return null;
  const cal: CalDay | undefined = d.cal;
  const plan = buildDayPlan(cal, profile?.courses || []);
  const date = fromISO(d.iso);
  const type = dayTypeOf(cal);
  const tone = typeTone(type, c, mode);
  const todayTone = glow(c.moss, mode);
  // Homework gets its own tickable list below; events are everything else.
  const mine = eventsOn(d.iso).filter(e => e.source !== 'homework');
  const ours = club.filter(e => e.date === d.iso);
  const due = hw.items.filter(h => h.due === d.iso).sort((x, y) => Number(x.done) - Number(y.done) || (x.time || '99').localeCompare(y.time || '99'));
  const classOf = (h: typeof due[number]) => {
    const k = h.slot ? profile?.courses.find(x => x.slot === h.slot) : profile?.courses.find(x => !!h.program && x.name.trim().toLowerCase() === h.program.trim().toLowerCase());
    return { name: h.program || k?.name || 'Quick type', color: glow(k?.color || c.ink4, mode) };
  };
  // The FIT reminder is already in the timetable, so it's not an "event".
  const school = (cal?.events || []).filter(ev => !ROUTINE.test(ev));

  const headline = plan ? `Day ${plan.dayNum}`
    : cal?.label ? cal.label
    : type === 'weekend' ? 'Weekend'
    : 'No classes';
  const pill = type === 'weekend' || (cal?.label && cal.label.startsWith(typeLabel(type, cal))) ? '' : typeLabel(type, cal);
  // Only the notes that change your day.
  const notes = [
    cal?.sync ? 'Day 1 / Day 2 sync' : null,
    plan?.early ? `Out early at ${fmt12(plan.early, true)}` : null,
    cal?.exam ? 'AP exam period' : null,
    cal?.projected ? 'Rotation not confirmed by the school yet' : null,
    !plan && type === 'holiday' ? 'No school' : null,
    !plan && type === 'prod' ? 'No classes for students' : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <Animated.View style={{ paddingTop: asDay ? 0 : 16, paddingHorizontal: 20, paddingBottom: 12, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <View style={[{ backgroundColor: mode === 'dark' ? '#1C2531' : c.surface, borderRadius: 22, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 }, shadow.md]}>
        {/* The Day tab's title already says the date. */}
        {!asDay && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isToday && <NowDot size={6} color={todayTone} />}
            {isToday && <Text style={{ fontSize: 14, fontWeight: '800', color: todayTone }}>Today</Text>}
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.ink3 }}>{DOW_LONG[date.getDay()]}, {MONTH_NAMES[d.month]} {d.day}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: asDay ? 0 : 4, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: c.ink }}>{headline}</Text>
          {!!pill && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: type === 'regular' || type === 'fit' ? (type === 'fit' ? c.goldTint : c.paper2) : tone.bg }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: tone.fg }}>{type === 'fit' ? 'FIT day' : type === 'regular' ? 'Regular day' : pill}</Text>
            </View>
          )}
        </View>
        {!!notes && <Text style={{ fontSize: 13.5, color: c.ink3, marginTop: 6, lineHeight: 19 }}>{notes}</Text>}

        {/* Day tab: the day drawn to scale. */}
        {plan && asDay && (
          <View style={{ marginTop: 16 }}>
            <DayColumn plan={plan} iso={d.iso} homework={hw.items} now={isToday ? now : null} onBlock={p => p.course && sheet.openCourse(p.course)} />
          </View>
        )}

        {/* Month and Week: the day as a list. Start time big and bold, end time
            under it at a readable size; breaks show their length, not a time. */}
        {plan && !asDay && (
          <View style={{ marginTop: 14 }}>
            {plan.periods.map((p, i) => {
              const isClass = p.kind === 'block';
              const isFit = p.kind === 'fit';
              if (!isClass && !isFit) {
                const mins = toMin(p.end) - toMin(p.start);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 2 }}>
                    <View style={{ width: 54 }} />
                    <Text style={{ fontSize: 13.5, color: c.ink4, fontStyle: 'italic', paddingLeft: 18 }}>{p.label}  ·  {mins} min</Text>
                  </View>
                );
              }
              const k = p.course;
              const spare = !!k?.spare;
              const tappable = isClass && !!k && !spare && !!k.name;
              const bar = glow(isFit ? c.gold : !k || spare ? c.line : k.color, mode);
              const sub = isFit ? 'Flexible instructional time'
                : [k?.room ? roomShort(k.room) : null, k?.teacher ? teacherShort(k.teacher) : null, `Block ${p.slot}`].filter(Boolean).join('  ·  ');
              const work = blockHomework(hw.items, d.iso, p);
              return (
                <Pressable key={i} onPress={tappable ? () => sheet.openCourse(k!) : undefined} disabled={!tappable} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 54 }}>
                    <Text style={[{ fontSize: 17, fontWeight: '800', color: c.ink, letterSpacing: -0.4 }, tnum]}>{fmt12(p.start)}</Text>
                    <Text style={[{ fontSize: 14, fontWeight: '500', color: c.ink3, marginTop: 1 }, tnum]}>{fmt12(p.end)}</Text>
                  </View>
                  <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: bar }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: isFit ? bar : spare ? c.ink3 : c.ink, letterSpacing: -0.3 }}>
                      {isFit ? 'FIT' : k?.name || p.label}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>{sub}</Text>
                  </View>
                  {work.length > 0 && <HomeworkMark open={work.filter(x => !x.done).length} total={work.length} color={bar} compact={false} />}
                  {tappable && <Icon name="chev-r" size={15} stroke={1.8} color={c.ink4} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {due.length > 0 && (
          <View style={{ marginTop: 14, marginHorizontal: -6, paddingTop: 12, paddingBottom: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: c.paper2 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginBottom: 4 }}>Homework due</Text>
            {due.map(h => {
              const k = classOf(h);
              return (
                <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  {/* Only the tick completes it, same as everywhere else. */}
                  <Pressable onPress={() => hw.toggle(h.id, toISO(now))} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: h.done }} accessibilityLabel={`Done: ${h.title}`}
                    style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: h.done ? k.color : c.ink4, backgroundColor: h.done ? k.color : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {h.done && <Check size={12} color={mode === 'dark' ? '#0C1117' : '#fff'} width={3.5} />}
                  </Pressable>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: h.done ? c.ink4 : c.ink, letterSpacing: -0.2, lineHeight: 20, textDecorationLine: h.done ? 'line-through' : 'none' }}>{h.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {!!h.kind && <KindTag kind={h.kind} dim={h.done} />}
                      <Text numberOfLines={1} style={[{ flexShrink: 1, fontSize: 13, fontWeight: '700', color: k.color }, tnum]}>
                        {k.name}{h.time ? <Text style={{ fontWeight: '500', color: c.ink3 }}>{`  ${fmt12(h.time, true)}`}</Text> : null}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {(school.length > 0 || mine.length > 0 || ours.length > 0) && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line2 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginBottom: 4 }}>Happening</Text>
            {school.map((ev, i) => {
              const [title, detail] = splitEvent(ev);
              return <EventRow key={'s' + i} tone={glow(eventTone(ev, c), mode)} title={title} detail={detail} />;
            })}
            {ours.map(e => (
              <EventRow key={e.id} spot={spot === e.id} bring={bring} tone={glow(c.sky, mode)} time={e.time ? fmt12(e.time, true) : undefined} title={e.title} detail={e.place} tag="Club" />
            ))}
            {mine.map(e => (
              <EventRow
                key={e.id}
                spot={spot === e.id}
                bring={bring}
                tone={glow(c.gold, mode)}
                time={e.time ? fmt12(e.time, true) : undefined}
                title={e.title}
                detail={e.className}
                actions={(
                  <>
                    <Pressable onPress={() => onEditEvent(e)} hitSlop={8} accessibilityLabel={`Edit ${e.title}`}><Icon name="edit" size={17} stroke={1.8} color={c.ink3} /></Pressable>
                    <Pressable onPress={() => remove(e.id)} hitSlop={8} accessibilityLabel={`Delete ${e.title}`}><Icon name="trash" size={17} stroke={1.8} color={c.danger} /></Pressable>
                  </>
                )}
              />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// One event line: colour bar, bold time on top (when there is one), title, detail.
const EventRow = ({ tone, time, title, detail, tag, faded, actions, spot = false, bring }: { spot?: boolean; bring?: (n: View | null) => void; tone: string; time?: string; title: string; detail?: string; tag?: string; faded?: boolean; actions?: React.ReactNode }) => {
  const { c } = useTheme();
  const ref = useRef<View>(null);
  useReveal(spot, ref, n => bring?.(n), 420);
  return (
    <View ref={ref} collapsable={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: faded ? 0.55 : 1 }}>
      <Spot on={spot} radius={12} inset={-8} />
      <View style={{ width: 4, alignSelf: 'stretch', minHeight: 20, borderRadius: 2, backgroundColor: tone }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {!!time && <Text style={[{ fontSize: 12.5, fontWeight: '800', color: tone, marginBottom: 1 }, tnum]}>{time}</Text>}
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2, lineHeight: 20 }}>{title}</Text>
        {!!detail && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 18 }}>{detail}</Text>}
      </View>
      {!!tag && <Text style={{ fontSize: 12.5, fontWeight: '700', color: tone }}>{tag}</Text>}
      {actions}
    </View>
  );
};

// Colour for a school calendar event line.
export const eventTone = (ev: string, c: ReturnType<typeof useTheme>['c']) =>
  /no school|Holiday/i.test(ev) ? c.navy700
  : /Professional|Pro-D/i.test(ev) ? c.ink4
  : /^FIT/.test(ev) ? c.gold
  : /^Collaboration/.test(ev) ? c.sky
  : /Break$|^Winter|^Spring/.test(ev) ? c.ink4
  : c.moss;

// Everything on the visible month, listed under the day sheet: school events
// plus your own. Skips the per-day FIT reminder (every Mon/Thu) so the list
// stays about real events.
const ROUTINE = /^FIT 11:05/;
type MonthItem = { iso: string; title: string; detail?: string; time?: string; tone: string };
const MonthEvents = ({
  cells, month, selected, todayIso, onSelect,
}: { cells: GridCell[]; month: number; selected: string; todayIso: string; onSelect: (iso: string) => void }) => {
  const { c, mode } = useTheme();
  const { events } = useEvents();
  const posted = usePosted('event', 'calendar');
  const school: MonthItem[] = cells
    .filter(d => !d.padding && d.month === month && d.cal?.events?.length)
    .flatMap(d => (d.cal!.events || []).filter(ev => !ROUTINE.test(ev)).map(ev => {
      const [title, detail] = splitEvent(ev);
      return { iso: d.iso, title, detail, tone: glow(eventTone(ev, c), mode) };
    }));
  const inMonth = (iso: string) => fromISO(iso).getMonth() === month && cells.some(x => x.iso === iso);
  const club: MonthItem[] = posted
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && inMonth(e.date))
    .map(e => ({ iso: e.date, title: e.title, detail: e.place, time: e.time ? fmt12(e.time, true) : undefined, tone: glow(c.sky, mode) }));
  const mine: MonthItem[] = events
    .filter(e => inMonth(e.iso) && e.source !== 'homework')
    .map(e => ({ iso: e.iso, title: e.title, detail: e.className, time: e.time ? fmt12(e.time, true) : undefined, tone: glow(c.gold, mode) }));
  const items = [...school, ...club, ...mine].sort((a, b) => a.iso.localeCompare(b.iso));
  if (!items.length) return null;
  const upcoming = items.filter(x => x.iso >= todayIso).length;
  // One row per date, events stacked inside it.
  const days: { iso: string; items: MonthItem[] }[] = [];
  for (const x of items) {
    const last = days[days.length - 1];
    if (last && last.iso === x.iso) last.items.push(x); else days.push({ iso: x.iso, items: [x] });
  }
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 12 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 24, letterSpacing: -0.5, color: c.ink }}>
          {MONTH_NAMES[month]} events
        </Text>
        <Text style={[{ fontSize: 13, color: c.ink3, fontWeight: '600' }, tnum]}>
          {upcoming ? `${upcoming} coming up` : 'All past'}
        </Text>
      </View>
      <View style={[{ backgroundColor: mode === 'dark' ? '#1C2531' : c.surface, borderRadius: 20, overflow: 'hidden' }, shadow.sm]}>
        {days.map((g, gi) => {
          const date = fromISO(g.iso);
          const isSel = g.iso === selected;
          const isToday = g.iso === todayIso;
          const past = g.iso < todayIso;
          return (
            <Pressable
              key={g.iso}
              onPress={() => onSelect(g.iso)}
              accessibilityRole="button"
              accessibilityLabel={`${DOW3[date.getDay()]} ${date.getDate()}: ${g.items.map(x => x.title).join(', ')}`}
              style={({ pressed }) => ({
                flexDirection: 'row', gap: 14, paddingVertical: 14, paddingHorizontal: 16,
                backgroundColor: isSel ? c.navy50 : pressed ? c.paper2 : 'transparent',
                borderTopWidth: gi === 0 ? 0 : 1, borderTopColor: c.line2,
              })}
            >
              <View style={{ width: 38, alignItems: 'center', opacity: past && !isSel ? 0.45 : 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isToday ? glow(c.moss, mode) : c.ink3 }}>{isToday ? 'Today' : DOW3[date.getDay()]}</Text>
                <Text style={[{ fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, color: isToday ? glow(c.moss, mode) : c.ink, letterSpacing: -0.5 }, tnum]}>{date.getDate()}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 10, justifyContent: 'center', opacity: past && !isSel ? 0.5 : 1 }}>
                {g.items.map((x, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ width: 4, alignSelf: 'stretch', minHeight: 18, borderRadius: 2, backgroundColor: x.tone }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {!!x.time && <Text style={[{ fontSize: 12, fontWeight: '800', color: x.tone }, tnum]}>{x.time}</Text>}
                      <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2, lineHeight: 20 }}>{x.title}</Text>
                      {!!x.detail && <Text numberOfLines={2} style={{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 18 }}>{x.detail}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// "Collaboration Day · students start 9:25" → title + detail line.
const splitEvent = (ev: string): [string, string] => {
  // Only a single " · " is a title/detail pair; lists like "Gr 8 8:30 · Gr 9 9:00 · …" stay whole.
  const parts = ev.split(' · ');
  return parts.length === 2 ? [parts[0], parts[1]] : [ev, ''];
};

// ────────────────────────────────────────────────────────────────
// The + sheet: a small composer that sits on the keyboard.
//   Top:    Homework | Event, and a close button.
//   Middle: one line to type on, and a round button that saves.
//   Bottom: a row of pills (when, time, type, class). Tapping one opens a
//           single strip of choices under it, so the keyboard stays up and
//           nothing is ever hidden behind it. Only "More dates" and "Other
//           time" put the keyboard away, to make room for the full pickers.
// Homework lands on the Homework page under its class (or in Quick type) and
// gets reminders; events only live on the calendar. The type is guessed from
// the name ("chem test" → Test) until the chip is tapped.
// ────────────────────────────────────────────────────────────────
type AddWhat = 'homework' | 'event';
type Strip = 'date' | 'time' | 'class' | 'dateFull' | 'timeFull' | null;
const QUICK_TIMES = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:59'];
const DOW2 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EventEditor = ({ visible, initial, onClose }: { visible: boolean; initial?: Partial<PersonalEvent>; onClose: () => void }) => {
  const { c } = useTheme();
  const { add, update } = useEvents();
  const hw = useHomework();
  const { profile } = useProfile();
  const now = useNow();
  const todayIso = toISO(now);
  const kb = useKeyboardHeight();
  const { height: screenH } = useWindowDimensions();
  const editing = !!initial?.id;
  const [what, setWhat] = useState<AddWhat>('homework');
  const [title, setTitle] = useState('');
  const [iso, setIso] = useState('');
  const [time, setTime] = useState<string | undefined>(undefined);
  const [cls, setCls] = useState('');
  const [kind, setKind] = useState<HomeworkKind | undefined>(undefined);
  const [kindPicked, setKindPicked] = useState(false);
  const [strip, setStrip] = useState<Strip>(null);
  const [err, setErr] = useState(false);

  // Reset the form only when the sheet opens. This screen re-renders every
  // second (the clock), and `initial` used to arrive as a new object each
  // time, which wiped whatever was being typed: the "won't let me type" bug.
  const wasVisible = useRef(false);
  useEffect(() => {
    const opening = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!opening) return;
    setWhat(editing ? 'event' : 'homework');
    setTitle(initial?.title || '');
    // New homework is due tomorrow unless a later day is selected.
    setIso(initial?.iso && (editing || initial.iso > todayIso) ? initial.iso : editing ? todayIso : addDays(todayIso, 1));
    setTime(initial?.time || undefined);
    setCls(initial?.className || '');
    setKind(undefined);
    setKindPicked(false);
    setStrip(null);
    setErr(false);
  }, [visible]);   // eslint-disable-line react-hooks/exhaustive-deps

  const classes = Array.from(new Set((profile?.courses || []).filter(k => !k.spare && k.name.trim()).map(k => k.name)));
  const isHw = what === 'homework';
  const day = iso || todayIso;
  const shownKind = kindPicked ? kind : guessKind(title);

  const save = () => {
    if (!title.trim()) { setErr(true); return; }
    if (isHw) hw.add(cls, title.trim(), day, { time, ...(kindPicked ? { kind: kind ?? null } : {}) });
    else if (editing) update(initial!.id!, { title: title.trim(), iso: day, time, className: cls || undefined });
    else add({ title: title.trim(), iso: day, time, className: cls || undefined });
    onClose();
  };

  const toggle = (k: Strip) => setStrip(cur => (cur === k || (k === 'date' && cur === 'dateFull') || (k === 'time' && cur === 'timeFull') ? null : k));
  const full = (k: 'dateFull' | 'timeFull') => { Keyboard.dismiss(); setStrip(k); };
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayIso, i));
  const ready = !!title.trim();

  const pill = (k: 'date' | 'time' | 'class', icon: IconName, label: string, set: boolean) => {
    const on = strip === k || strip === `${k}Full`;
    return (
      <Pressable key={k} onPress={() => toggle(k)} accessibilityRole="button" accessibilityState={{ expanded: on }}
        style={({ pressed }) => ({ height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 18, backgroundColor: on ? c.action : c.paper2, opacity: pressed ? 0.7 : 1 })}>
        <Icon name={icon} size={14} stroke={2} color={on ? '#fff' : set ? c.ink : c.ink3} />
        <Text numberOfLines={1} style={[{ maxWidth: 150, fontSize: 14, fontWeight: set ? '600' : '500', color: on ? '#fff' : set ? c.ink : c.ink3 }, tnum]}>{label}</Text>
      </Pressable>
    );
  };
  const choice = (key: string, label: string, on: boolean, onPress: () => void, sub?: string) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ minWidth: sub ? 50 : 0, height: sub ? 52 : 40, paddingHorizontal: sub ? 8 : 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.action : c.paper2, opacity: pressed ? 0.7 : 1 })}>
      {!!sub && <Text style={{ fontSize: 11, fontWeight: '600', color: on ? 'rgba(255,255,255,0.8)' : c.ink3 }}>{sub}</Text>}
      <Text style={[{ fontSize: sub ? 17 : 14, fontWeight: '600', color: on ? '#fff' : c.ink }, tnum]}>{label}</Text>
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} bottom={kb} style={[{ maxHeight: sheetHeight(screenH, kb), backgroundColor: c.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: kb ? 10 : Platform.OS === 'ios' ? 30 : 16 }, shadow.lg]}>
        {/* Homework | Event */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          {editing ? (
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.ink }}>Edit event</Text>
          ) : (
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: c.paper2 }}>
              {([['homework', 'Homework'], ['event', 'Event']] as [AddWhat, string][]).map(([k, l]) => {
                const on = what === k;
                return (
                  <Pressable key={k} onPress={() => { setWhat(k); if (k === 'event' && strip === 'class') setStrip(null); }} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={[{ height: 32, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: on ? c.surface : 'transparent' }, on ? shadow.sm : shadow.none]}>
                    <Text style={{ fontSize: 14, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink3 }}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
            style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper2, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="close" size={14} stroke={2.4} color={c.ink2} />
          </Pressable>
        </View>

        {/* The line, and the button that saves it */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 14, paddingTop: 8 }}>
          <TextInput
            value={title}
            onChangeText={v => { setTitle(v); if (err) setErr(false); }}
            placeholder={err ? 'Give it a name first' : isHw ? 'What’s due?' : 'What’s happening?'}
            placeholderTextColor={err ? c.danger : c.ink4}
            autoFocus={!editing}
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel={isHw ? 'Homework' : 'Event'}
            style={[{ flex: 1, fontSize: 21, fontWeight: '500', letterSpacing: -0.3, color: c.ink, paddingVertical: 12 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          />
          <Pressable onPress={save} accessibilityRole="button" accessibilityLabel={isHw ? 'Add homework' : 'Save event'}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: ready ? c.action : c.paper2, opacity: pressed ? 0.75 : 1 })}>
            <Check size={18} color={ready ? '#fff' : c.ink4} width={3} />
          </Pressable>
        </View>

        {/* Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, alignItems: 'center' }}>
          {pill('date', 'calendar', dayLabel(day, todayIso), true)}
          {pill('time', 'clock', time ? fmt12(time, true) : isHw ? 'Any time' : 'All day', !!time)}
          {isHw && <KindChip kind={shownKind} onKind={k => { setKind(k ?? undefined); setKindPicked(true); }} />}
          {classes.length > 0 && pill('class', 'book', cls || (isHw ? 'Quick type' : 'No class'), !!cls)}
        </ScrollView>

        {/* One strip of choices for the open pill */}
        {strip === 'date' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}>
            {days.map((d, i) => choice(d, String(fromISO(d).getDate()), d === day, () => setIso(d), i === 0 ? 'Today' : DOW2[fromISO(d).getDay()]))}
            {choice('more', 'More', false, () => full('dateFull'))}
          </ScrollView>
        )}
        {strip === 'time' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}>
            {choice('any', isHw ? 'Any time' : 'All day', !time, () => setTime(undefined))}
            {QUICK_TIMES.map(t => choice(t, fmt12(t, true), time === t, () => setTime(t)))}
            {choice('other', 'Other', !!time && !QUICK_TIMES.includes(time), () => full('timeFull'))}
          </ScrollView>
        )}
        {strip === 'class' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}>
            {choice('none', isHw ? 'Quick type' : 'No class', !cls, () => setCls(''))}
            {classes.map(k => choice(k, k, cls === k, () => setCls(k)))}
          </ScrollView>
        )}
        {strip === 'dateFull' && <View style={{ paddingHorizontal: 16 }}><DueFields due={day} todayIso={todayIso} onDue={setIso} /></View>}
        {strip === 'timeFull' && <View style={{ paddingHorizontal: 16, paddingTop: 6 }}><TimeFields time={time} onTime={setTime} /></View>}
    </BottomSheet>
  );
};
