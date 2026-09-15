// Spartans — Calendar screen
// Month view of the real 2026–2027 school calendar plus a scrolling 5-day
// week view. Month cells show the day number and the rotation code; Pro-D and
// breaks are hatched, holidays navy-tinted, AP-exam days carry a crimson top
// rule, today is a filled circle on the number, and a single centred dot
// marks days with events (school or your own). Week view centres on today
// and draws each day as a time-blocked column; swipe sideways for other
// weeks. The + button adds a personal event (stored on this phone).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Easing, Modal, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { NowDot } from '../components/Chrome';
import { AppHeader } from '../components/AppHeader';
import {
  YEAR_MONTHS, MONTH_NAMES, monthGrid, GridCell, CalDay, fromISO, CALENDAR, SCHOOL_YEAR,
} from '../calendar';
import { buildDayPlan, fmt12 } from '../bell';
import { useProfile, shortName, roomShort } from '../ProfileContext';
import { useNow } from '../useToday';
import { toISO } from '../calendar';
import { useEvents, PersonalEvent } from '../stores';
import { useClassSheet } from '../components/ClassCard';
import { DayColumn } from './DayViewScreen';
import type { ScreenProps } from '../../App';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthIndexFor = (iso: string) => {
  const d = fromISO(iso);
  const i = YEAR_MONTHS.findIndex(([y, m]) => y === d.getFullYear() && m === d.getMonth());
  return i === -1 ? 0 : i;
};

type Mode = 'month' | 'week';

export default function CalendarScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const now = useNow();
  const todayIso = toISO(now);
  const [mode, setMode] = useState<Mode>('month');
  const [mi, setMi] = useState(() => monthIndexFor(todayIso));
  const [selected, setSelected] = useState(todayIso);
  const [gridW, setGridW] = useState(0);
  const [adding, setAdding] = useState<PersonalEvent | 'new' | null>(null);
  const { eventsOn } = useEvents();

  const [year, month] = YEAR_MONTHS[mi];
  const cells = monthGrid(year, month);
  const gap = 4;
  // onLayout reports the padded width (12 + 12); floor so 7 cells never wrap.
  const cell = gridW > 0 ? Math.floor((gridW - 24 - gap * 6) / 7) : 0;

  const goToday = () => { setMi(monthIndexFor(todayIso)); setSelected(todayIso); };
  const step = (d: number) => setMi(i => Math.min(YEAR_MONTHS.length - 1, Math.max(0, i + d)));

  const sel = cells.find(x => x.iso === selected) || cellFor(selected);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} />

      {/* ── Title + mode toggle + prev/today/next ──────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 20, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.7, color: c.ink }}>
            {mode === 'month' ? MONTH_NAMES[month] : 'Week'}
          </Text>
          <Text style={{ fontSize: 18, fontFamily: fonts.serifRegular, color: c.ink3, letterSpacing: -0.3 }}>
            {mode === 'month' ? year : SCHOOL_YEAR.label}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <NavBtn name="plus" onPress={() => setAdding('new')} label="Add an event" />
          {mode === 'month' && <NavBtn name="chev-l" onPress={() => step(-1)} disabled={mi === 0} label="Previous month" />}
          <Pressable
            onPress={goToday}
            style={({ pressed }) => ({ backgroundColor: c.navy50, borderRadius: 16, paddingHorizontal: 12, height: 32, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: c.navy700, fontSize: 12.5, fontWeight: '600', letterSpacing: -0.1 }}>Today</Text>
          </Pressable>
          {mode === 'month' && <NavBtn name="chev-r" onPress={() => step(1)} disabled={mi === YEAR_MONTHS.length - 1} label="Next month" />}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 3, gap: 2, maxWidth: 200 }}>
          {(['month', 'week'] as Mode[]).map(k => {
            const on = mode === k;
            return (
              <Pressable key={k} onPress={() => setMode(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[{ flex: 1, borderRadius: 9, paddingVertical: 7, alignItems: 'center', backgroundColor: on ? c.surface : 'transparent' }, on ? shadow.sm : shadow.none]}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? c.ink : c.ink3 }}>{k === 'month' ? 'Month' : 'Week'}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === 'month' ? (
        <>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 }}>
            {WEEKDAYS.map((d, i) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', paddingVertical: 4, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: i >= 5 ? c.ink4 : c.ink3 }}>
                {d}
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
                  hasEvents={!d.padding && (!!d.cal?.events?.filter(ev => !ROUTINE.test(ev)).length || eventsOn(d.iso).length > 0)}
                  onPress={() => !d.padding && setSelected(d.iso)}
                />
              </View>
            ))}
          </View>
        </>
      ) : (
        <WeekView todayIso={todayIso} selected={selected} onSelect={setSelected} />
      )}

      <DaySheet key={selected} d={sel} isToday={selected === todayIso} onEditEvent={e => setAdding(e)} />

      {mode === 'month' && <MonthEvents cells={cells} month={month} selected={selected} todayIso={todayIso} onSelect={setSelected} />}

      <EventEditor
        visible={adding !== null}
        initial={adding === 'new' ? { iso: selected } : adding || undefined}
        onClose={() => setAdding(null)}
      />
    </ScrollView>
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
const DayCell = ({ d, isToday, selected, hasEvents, onPress }: { d: GridCell; isToday: boolean; selected: boolean; hasEvents: boolean; onPress: () => void }) => {
  const { c } = useTheme();

  if (d.padding) {
    return (
      <View style={{ flex: 1, paddingTop: 4, paddingLeft: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: c.ink4, opacity: 0.4 }}>{d.day}</Text>
      </View>
    );
  }

  const cal = d.cal;
  const kind = cal?.kind || 'noclass';
  const isWeekend = kind === 'weekend';
  const isHoliday = kind === 'holiday';
  const isOff = kind === 'prod' || kind === 'break' || kind === 'noclass';
  const isExam = !!cal?.exam;

  const bg = selected ? c.navy700 : isHoliday ? c.navy50 : isOff ? c.paper2 : c.surface;
  const textColor = selected ? '#fff' : isWeekend ? c.ink4 : c.ink;
  const codeColor = selected ? 'rgba(255,255,255,0.85)' : c.ink3;
  const chip = isHoliday ? 'Holiday'
    : kind === 'prod' ? 'Pro-D'
    : kind === 'break' ? (cal?.label?.includes('Reading') ? 'Reading' : 'Break')
    : kind === 'noclass' ? (cal?.label?.includes('Completion') ? 'Compl.' : cal?.label?.includes('First') ? 'Opens' : cal?.label?.includes('Reading') ? 'Reading' : cal?.label ? 'No class' : '')
    : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${d.day}${isToday ? ', today' : ''}${cal?.code ? `, ${cal.code}` : ''}${hasEvents ? ', has events' : ''}`}
      style={[{
        flex: 1, backgroundColor: bg, borderWidth: 1, borderColor: selected ? c.navy700 : c.line,
        borderRadius: 10, paddingTop: 4, paddingHorizontal: 4, paddingBottom: 4, overflow: 'hidden',
      }, selected ? shadow.md : shadow.none]}
    >
      {isOff && !selected && <Hatch color={c.hatch} />}
      {isExam && !selected && (
        <View style={{ position: 'absolute', top: 0, left: 6, right: 6, height: 2, backgroundColor: c.crimson }} />
      )}
      {/* day number: today gets a filled circle instead of a corner dot */}
      <View style={{ alignSelf: 'flex-start', minWidth: 20, height: 20, paddingHorizontal: 3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? (selected ? '#fff' : c.navy700) : 'transparent' }}>
        <Text style={[{ fontSize: 12.5, fontWeight: isToday ? '700' : '600', letterSpacing: -0.2, color: isToday ? (selected ? c.navy700 : '#fff') : textColor }, tnum]}>
          {d.day}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {!!cal?.code && <DayCodeInline code={cal.code} color={codeColor} selected={selected} />}
        {!!chip && <Chip text={chip} tone={selected ? 'onNavy' : isHoliday ? 'navy' : 'muted'} />}
      </View>
      {hasEvents && !isHoliday && !isOff && (
        <View style={{ position: 'absolute', bottom: 2, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: selected ? 'rgba(255,255,255,0.85)' : c.moss }} />
        </View>
      )}
    </Pressable>
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

const DayCodeInline = ({ code, color, selected }: { code: string; color: string; selected: boolean }) => {
  const { c } = useTheme();
  const [day, blocks] = code.split('-');
  return (
    <Text numberOfLines={1} style={[{ fontSize: 8.5, fontWeight: '600', color, lineHeight: 10, fontFamily: fonts.mono, marginBottom: 4 }, tnum]}>
      <Text style={{ opacity: selected ? 0.7 : 0.55 }}>{day}·</Text>
      {[...blocks].map((ch, i) => (
        <Text key={i} style={{ color: ch === 'F' ? (selected ? '#F0D78F' : c.gold) : color, fontWeight: ch === 'F' ? '700' : '600' }}>
          {ch}
        </Text>
      ))}
    </Text>
  );
};

const Chip = ({ text, tone }: { text: string; tone: 'navy' | 'onNavy' | 'muted' }) => {
  const { c } = useTheme();
  const fg = { navy: c.navy700, onNavy: 'rgba(255,255,255,0.9)', muted: c.ink3 }[tone];
  return (
    <Text numberOfLines={1} style={{ fontSize: 8.5, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase', color: fg, lineHeight: 10, marginBottom: 4 }}>
      {text}
    </Text>
  );
};

const NavBtn = ({ name, onPress, disabled, label }: { name: IconName; onPress: () => void; disabled?: boolean; label?: string }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{
        width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      }, shadow.sm]}
    >
      <Icon name={name} size={18} stroke={1.8} color={c.ink2} />
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

const WeekView = ({ todayIso, selected, onSelect }: { todayIso: string; selected: string; onSelect: (iso: string) => void }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { profile } = useProfile();
  const { eventsOn } = useEvents();
  const sheet = useClassSheet();
  const now = useNow();
  const scroll = useRef<ScrollView>(null);
  const BEFORE = 10, AFTER = 15;
  const days = useMemo(() => weekdaysAround(todayIso, BEFORE, AFTER), [todayIso]);
  const colW = Math.floor((Math.min(width, 430) - 40) / 3);
  const gapW = 8;

  useEffect(() => {
    // centre today on first layout
    const t = setTimeout(() => scroll.current?.scrollTo({ x: Math.max(0, BEFORE * (colW + gapW) - (Math.min(width, 430) - 40 - colW) / 2), animated: false }), 30);
    return () => clearTimeout(t);
  }, [colW, width]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={colW + gapW}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 20, gap: gapW, paddingBottom: 4 }}
    >
      {days.map(iso => {
        const d = fromISO(iso);
        const cal = CALENDAR[iso];
        const plan = buildDayPlan(cal, profile?.courses || []);
        const isToday = iso === todayIso;
        const isSel = iso === selected;
        const mine = eventsOn(iso);
        return (
          <View key={iso} style={{ width: colW }}>
            <Pressable
              onPress={() => onSelect(iso)}
              accessibilityRole="button"
              accessibilityLabel={`${DOW3[d.getDay()]} ${d.getDate()}${isToday ? ', today' : ''}`}
              style={({ pressed }) => ({
                alignItems: 'center', paddingVertical: 6, borderRadius: 12, marginBottom: 6,
                backgroundColor: isSel ? c.navy700 : isToday ? c.navy50 : 'transparent', opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: isSel ? 'rgba(255,255,255,0.8)' : c.ink3 }}>{DOW3[d.getDay()]}</Text>
              <Text style={[{ fontSize: 18, fontWeight: '700', color: isSel ? '#fff' : isToday ? c.navy700 : c.ink, letterSpacing: -0.4 }, tnum]}>{d.getDate()}</Text>
              <Text numberOfLines={1} style={[{ fontSize: 9, fontFamily: fonts.mono, color: isSel ? 'rgba(255,255,255,0.75)' : c.ink4, marginTop: 1 }, tnum]}>{cal?.code || (cal?.label ? cal.label.slice(0, 10) : '—')}</Text>
            </Pressable>
            {plan ? (
              <DayColumn plan={plan} now={isToday ? now : null} compact pxPerMin={1.15} onBlock={p => p.course && sheet.openCourse(p.course)} />
            ) : (
              <View style={{ height: 120, borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                <Text numberOfLines={3} style={{ fontSize: 11, color: c.ink3, textAlign: 'center' }}>{cal?.label || 'No classes'}</Text>
              </View>
            )}
            {mine.length > 0 && (
              <View style={{ marginTop: 6, gap: 4 }}>
                {mine.slice(0, 3).map(e => (
                  <View key={e.id} style={{ borderRadius: 8, backgroundColor: c.goldTint, paddingVertical: 4, paddingHorizontal: 6 }}>
                    <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '600', color: c.gold }}>{e.time ? `${fmt12(e.time)} ` : ''}{e.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

// ────────────────────────────────────────────────────────────────
// Detail sheet for the selected day
// ────────────────────────────────────────────────────────────────
const DaySheet = ({ d, isToday, onEditEvent }: { d?: GridCell; isToday: boolean; onEditEvent: (e: PersonalEvent) => void }) => {
  const { c } = useTheme();
  const { profile } = useProfile();
  const { eventsOn, remove } = useEvents();
  const sheet = useClassSheet();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 280, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true }).start();
  }, [a]);

  if (!d) return null;
  const cal: CalDay | undefined = d.cal;
  const plan = buildDayPlan(cal, profile?.courses || []);
  const date = fromISO(d.iso);
  const dateLabel = `${DOW3[date.getDay()]} ${MONTH_NAMES[d.month].slice(0, 3)} ${d.day}`;
  const mine = eventsOn(d.iso);

  const headline = plan ? `Day ${plan.dayNum}`
    : cal?.label ? `${cal.label}`
    : cal?.kind === 'weekend' ? 'Weekend'
    : 'No classes';

  const sub = plan
    ? [
        plan.bellName,
        plan.bell === 'fit' ? 'FIT block included' : null,
        cal?.exam ? 'AP exam period' : null,
        cal?.sync ? 'Day 1 / Day 2 sync' : null,
        plan.early ? `Early dismissal ${fmt12(plan.early, true)}` : null,
        cal?.projected ? 'Rotation projected' : null,
      ].filter(Boolean).join(' · ')
    : cal?.kind === 'holiday' ? 'Statutory holiday · no school'
    : cal?.kind === 'prod' ? 'No classes for students'
    : cal?.kind === 'break' ? 'No school'
    : '';

  return (
    <Animated.View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 12, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 20, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16 }, shadow.md]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isToday && <NowDot size={6} color={c.moss} />}
              <Text style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700', color: isToday ? c.moss : c.ink3 }}>
                {isToday ? `Today · ${dateLabel}` : dateLabel}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.serif, fontSize: 22, marginTop: 2, letterSpacing: -0.3, color: c.ink, lineHeight: 25 }}>
              {headline}
            </Text>
            {!!sub && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>{sub}</Text>}
          </View>
        </View>

        {/* Block sequence */}
        {plan && (
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 6 }}>
            {plan.blocks.map((p, i) =>
              p.kind === 'fit'
                ? <MiniBlock key={'f' + i} label="FIT" sub={fmt12(p.start)} gold />
                : <MiniBlock key={i} label={`Block ${p.slot}`} sub={p.course?.name ? shortName(p.course.name) : '—'} time={fmt12(p.start)} onPress={p.course && !p.course.spare && p.course.name ? () => sheet.openCourse(p.course!) : undefined} />
            )}
          </View>
        )}

        {/* Full timetable */}
        {plan && (
          <View style={{ marginTop: 12 }}>
            {plan.periods.map((p, i) => {
              const tappable = p.kind === 'block' && p.course && !p.course.spare && !!p.course.name;
              return (
                <Pressable key={i} onPress={tappable ? () => sheet.openCourse(p.course!) : undefined} disabled={!tappable} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={[{ width: 92, fontSize: 12, color: c.ink3 }, tnum]}>{fmt12(p.start)}–{fmt12(p.end)}</Text>
                  <Text style={{ flex: 1, fontSize: 13.5, color: p.kind === 'block' || p.kind === 'fit' ? c.ink : c.ink3, fontWeight: p.kind === 'block' ? '500' : '400' }}>
                    {p.kind === 'block'
                      ? `${p.course?.name || p.label}${p.course?.room ? ` · ${roomShort(p.course.room)}` : ''}`
                      : p.label}
                  </Text>
                  {tappable && <Icon name="chev-r" size={14} stroke={1.8} color={c.ink4} />}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Events — school ones as outlined badges, yours as editable rows */}
        {(!!cal?.events?.length || mine.length > 0) && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line }}>
            <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: c.ink3, marginBottom: 10 }}>
              Events
            </Text>
            {!!cal?.events?.length && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {cal.events.map((ev, i) => <EventBadge key={i} text={ev} />)}
              </View>
            )}
            {mine.length > 0 && (
              <View style={{ gap: 6, marginTop: cal?.events?.length ? 10 : 0 }}>
                {mine.map(e => (
                  <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.goldTint, borderWidth: 1, borderColor: '#E7D2A0' }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.gold }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{e.title}</Text>
                      <Text numberOfLines={1} style={[{ fontSize: 11.5, color: c.ink3, marginTop: 1 }, tnum]}>{[e.time ? fmt12(e.time, true) : 'All day', e.className].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <Pressable onPress={() => onEditEvent(e)} hitSlop={8} accessibilityLabel={`Edit ${e.title}`}><Icon name="edit" size={16} stroke={1.8} color={c.ink3} /></Pressable>
                    <Pressable onPress={() => remove(e.id)} hitSlop={8} accessibilityLabel={`Delete ${e.title}`}><Icon name="trash" size={16} stroke={1.8} color={c.crimson} /></Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const MiniBlock = ({ label, sub, time, gold, onPress }: { label: string; sub: string; time?: string; gold?: boolean; onPress?: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flex: 1, backgroundColor: gold ? c.goldTint : c.paper2, borderWidth: 1, borderColor: gold ? '#E7D2A0' : c.line, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.6, color: gold ? c.gold : c.ink3, textTransform: 'uppercase' }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: c.ink2, marginTop: 2, fontWeight: '500' }}>{sub}</Text>
      {!!time && <Text style={[{ fontSize: 9.5, color: c.ink4, marginTop: 1 }, tnum]}>{time}</Text>}
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Event badges — outlined pills, colour-coded like the day cells
// ────────────────────────────────────────────────────────────────
export const eventTone = (ev: string, c: ReturnType<typeof useTheme>['c']) =>
  /no school|Holiday/i.test(ev) ? c.navy700
  : /Professional|Pro-D/i.test(ev) ? c.ink4
  : /^FIT/.test(ev) ? c.gold
  : /Break$|^Winter|^Spring/.test(ev) ? c.ink4
  : c.moss;

const EventBadge = ({ text, prefix, onPress, active, tone: toneOverride }: { text: string; prefix?: string; onPress?: () => void; active?: boolean; tone?: string }) => {
  const { c } = useTheme();
  const tone = toneOverride || eventTone(text, c);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingVertical: 9, paddingHorizontal: 13,
        borderRadius: 14, borderWidth: 1.5,
        borderColor: active ? c.navy700 : tone,
        backgroundColor: active ? c.navy700 : c.surface,
        opacity: pressed ? 0.7 : 1,
        maxWidth: '100%',
      })}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: active ? '#fff' : tone }} />
      {!!prefix && (
        <Text numberOfLines={1} style={[{ fontSize: 12, fontWeight: '700', color: active ? 'rgba(255,255,255,0.8)' : tone, letterSpacing: 0.2, flexShrink: 0 }, tnum]}>{prefix}</Text>
      )}
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: active ? '#fff' : c.ink, letterSpacing: -0.2, flexShrink: 1 }}>{text}</Text>
    </Pressable>
  );
};

// Everything on the visible month, listed under the day sheet: school events
// plus your own. Skips the per-day FIT reminder (every Mon/Thu) so the list
// stays about real events.
const ROUTINE = /^FIT 11:05/;
const MonthEvents = ({
  cells, month, selected, todayIso, onSelect,
}: { cells: GridCell[]; month: number; selected: string; todayIso: string; onSelect: (iso: string) => void }) => {
  const { c } = useTheme();
  const { events } = useEvents();
  const school = cells
    .filter(d => !d.padding && d.month === month && d.cal?.events?.length)
    .flatMap(d => (d.cal!.events || []).filter(ev => !ROUTINE.test(ev)).map(ev => ({ iso: d.iso, day: d.day, ev, mine: false })));
  const mine = events
    .filter(e => { const d = fromISO(e.iso); return d.getMonth() === month && cells.some(x => x.iso === e.iso); })
    .map(e => ({ iso: e.iso, day: fromISO(e.iso).getDate(), ev: e.time ? `${fmt12(e.time)} ${e.title}` : e.title, mine: true }));
  const items = [...school, ...mine].sort((a, b) => a.iso.localeCompare(b.iso));
  if (!items.length) return null;
  const upcoming = items.filter(x => x.iso >= todayIso).length;
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.4, color: c.ink }}>
          {MONTH_NAMES[month]} events
        </Text>
        <Text style={{ fontSize: 12, color: c.ink3, fontWeight: '500' }}>
          {upcoming ? `${upcoming} coming up` : 'All past'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((x, i) => (
          <EventBadge
            key={x.iso + i}
            prefix={`${DOW3[fromISO(x.iso).getDay()]} ${x.day}`}
            text={x.ev}
            active={x.iso === selected}
            tone={x.mine ? c.gold : undefined}
            onPress={() => onSelect(x.iso)}
          />
        ))}
      </View>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Add / edit a personal event. Title, date (YYYY-MM-DD), optional time and
// class tag. Deliberately plain: function over looks.
// ────────────────────────────────────────────────────────────────
const EventEditor = ({ visible, initial, onClose }: { visible: boolean; initial?: Partial<PersonalEvent>; onClose: () => void }) => {
  const { c } = useTheme();
  const { add, update } = useEvents();
  const { profile } = useProfile();
  const [title, setTitle] = useState('');
  const [iso, setIso] = useState('');
  const [time, setTime] = useState('');
  const [cls, setCls] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(initial?.title || '');
    setIso(initial?.iso || '');
    setTime(initial?.time || '');
    setCls(initial?.className || '');
    setErr(null);
  }, [visible, initial]);

  const classes = Array.from(new Set((profile?.courses || []).filter(k => !k.spare && k.name.trim()).map(k => k.name)));

  const save = () => {
    if (!title.trim()) { setErr('Give the event a name.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || isNaN(fromISO(iso).getTime())) { setErr('Date should look like 2026-09-17.'); return; }
    const t = time.trim();
    if (t && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) { setErr('Time should be 24-hour, like 15:30. Leave it blank for all day.'); return; }
    const norm = t ? t.padStart(5, '0') : undefined;
    if (initial?.id) update(initial.id, { title: title.trim(), iso, time: norm, className: cls || undefined });
    else add({ title: title.trim(), iso, time: norm, className: cls || undefined });
    onClose();
  };

  const input = { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: c.ink, backgroundColor: c.surface } as const;
  const label = { fontSize: 12, fontWeight: '600' as const, color: c.ink3, marginBottom: 6, marginTop: 14, letterSpacing: 0.3, textTransform: 'uppercase' as const };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,34,56,0.35)' }} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View style={[{ backgroundColor: c.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 20 }, shadow.lg]}>
          <View style={{ alignItems: 'center', paddingBottom: 6 }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} /></View>
          <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: c.ink, letterSpacing: -0.4 }}>{initial?.id ? 'Edit event' : 'New event'}</Text>

          <Text style={label}>What</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Chem test" placeholderTextColor={c.ink4} style={input} autoFocus />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={label}>Date</Text>
              <TextInput value={iso} onChangeText={v => setIso(v.replace(/[^0-9-]/g, '').slice(0, 10))} placeholder="2026-09-17" placeholderTextColor={c.ink4} style={[input, tnum]} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={label}>Time (optional)</Text>
              <TextInput value={time} onChangeText={v => setTime(v.replace(/[^0-9:]/g, '').slice(0, 5))} placeholder="15:30" placeholderTextColor={c.ink4} style={[input, tnum]} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          {classes.length > 0 && (
            <>
              <Text style={label}>Class (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="always">
                {classes.map(k => {
                  const on = cls === k;
                  return (
                    <Pressable key={k} onPress={() => setCls(on ? '' : k)} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? c.navy700 : c.line, backgroundColor: on ? c.navy700 : c.surface }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{shortName(k)} · {k}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
          {!!err && <Text style={{ color: c.crimson, marginTop: 12, fontSize: 13, fontWeight: '500' }}>{err}</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable onPress={onClose} style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: c.ink, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: c.navy700, borderWidth: 1, borderColor: c.navy700, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
