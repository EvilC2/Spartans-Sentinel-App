// Spartans — the class card. One sheet, opened from anywhere a class is
// tapped: rotation tiles, the timetable table, the calendar day sheet, the
// Programs list, extras, clubs and teams.
//
//   Top third   name · teacher · room · which blocks · next time you have it ·
//               one-line description that expands
//   The rest    grades, term by term, editable (stored on this phone)
//
// useClassSheet().open({ name, teacher, room, slot }) from any screen; the
// provider renders the modal once at the app root.

import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, TextInput, useWindowDimensions, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon } from './Icon';
import { useProfile, Slot, SLOT_COLORS, teacherShort, shortName, roomLabel, Course } from '../ProfileContext';
import { CALENDAR, toISO, fromISO, MONTH_NAMES } from '../calendar';
import { buildDayPlan, fmt12 } from '../bell';
import { describeCourse } from '../descriptions';
import { useGrades, TERMS, Term, termAverage } from '../stores';
import { resolveNow } from '../useToday';
import { usePreviewTime } from '../PreviewTime';

export type ClassRef = {
  name: string;
  teacher?: string;
  room?: string;
  slot?: Slot;
  kind?: 'course' | 'extra';   // extras have no block
};

type Ctx = { open: (ref: ClassRef) => void; openCourse: (k: Course) => void; close: () => void };
const SheetCtx = createContext<Ctx>({ open: () => {}, openCourse: () => {}, close: () => {} });

export const ClassSheetProvider = ({ children }: { children: React.ReactNode }) => {
  const [ref, setRef] = useState<ClassRef | null>(null);
  const value = useMemo<Ctx>(() => ({
    open: r => setRef(r),
    openCourse: k => { if (!k.spare && k.name.trim()) setRef({ name: k.name, teacher: k.teacher, room: k.room, slot: k.slot, kind: 'course' }); },
    close: () => setRef(null),
  }), []);
  return (
    <SheetCtx.Provider value={value}>
      {children}
      <ClassSheet item={ref} onClose={() => setRef(null)} />
    </SheetCtx.Provider>
  );
};

export const useClassSheet = () => useContext(SheetCtx);

// Next calendar day (from today, up to 40 days out) whose plan has this slot.
const nextOccurrence = (slot: Slot | undefined, now: Date) => {
  if (!slot) return null;
  for (let i = 0; i < 40; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const cal = CALENDAR[toISO(d)];
    const plan = buildDayPlan(cal, []);
    if (!plan) continue;
    const p = plan.periods.find(x => x.slot === slot);
    if (!p) continue;
    if (i === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const [h, m] = p.end.split(':').map(Number);
      if (nowMin >= h * 60 + m) continue;   // already happened today
    }
    return { date: d, start: p.start, end: p.end, today: i === 0, tomorrow: i === 1 };
  }
  return null;
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ClassSheet = ({ item: ref, onClose }: { item: ClassRef | null; onClose: () => void }) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const { profile } = useProfile();
  const { gradesFor, setGrade } = useGrades();
  const { offsetMs } = usePreviewTime();
  const [expanded, setExpanded] = useState(false);

  if (!ref) return null;
  const color = ref.slot ? SLOT_COLORS[ref.slot] : c.navy700;
  const now = resolveNow(new Date(), offsetMs);
  const next = nextOccurrence(ref.slot, now);
  const desc = describeCourse(ref.name);
  const grades = gradesFor(ref.name);
  const avg = termAverage(grades);

  // Every slot this course name is taught in (a linear course can sit in two).
  const slots = (profile?.courses || []).filter(k => !k.spare && k.name.trim().toLowerCase() === ref.name.trim().toLowerCase()).map(k => k.slot);
  const whenLine = ref.kind === 'extra'
    ? 'Outside the timetable'
    : slots.length ? `Block ${slots.join(' and ')}` : ref.slot ? `Block ${ref.slot}` : '';

  const nextLine = next
    ? `${next.today ? 'Today' : next.tomorrow ? 'Tomorrow' : `${DOW[next.date.getDay()]} ${MONTH_NAMES[next.date.getMonth()].slice(0, 3)} ${next.date.getDate()}`} · ${fmt12(next.start, true)} – ${fmt12(next.end, true)}`
    : ref.kind === 'extra' ? '' : 'Not in the next few weeks';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,34,56,0.35)' }} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View style={[{
          height: Math.round(height * 0.86), backgroundColor: c.paper,
          borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden',
        }, shadow.lg]}>
          {/* colour rail + grabber */}
          <View style={{ height: 5, backgroundColor: color }} />
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close class card" style={({ pressed }) => ({
            position: 'absolute', top: 18, right: 16, width: 32, height: 32, borderRadius: 16, zIndex: 3, elevation: 3,
            backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
          })}>
            <Icon name="close" size={16} stroke={2} color={c.ink2} />
          </Pressable>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* ── Top third: what, who, where, when ─────────────── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: color }}>
                <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 }}>{shortName(ref.name)}</Text>
              </View>
              {!!whenLine && <Text style={{ fontSize: 12, fontWeight: '600', color: c.ink3, letterSpacing: 0.3, textTransform: 'uppercase' }}>{whenLine}</Text>}
            </View>
            <Text style={{ fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, color: c.ink, letterSpacing: -0.6, marginTop: 8, paddingRight: 36 }}>
              {ref.name}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {!!ref.teacher && <Fact icon="me" text={teacherShort(ref.teacher)} />}
              {!!ref.room && <Fact icon="map" text={roomLabel(ref.room)} />}
              {!!nextLine && <Fact icon="clock" text={nextLine} strong={!!next?.today} />}
            </View>

            <Pressable onPress={() => setExpanded(v => !v)} style={{ marginTop: 14 }} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse description' : 'Expand description'}>
              <Text numberOfLines={expanded ? undefined : 1} style={{ fontSize: 14, lineHeight: 20, color: c.ink2 }}>{desc}</Text>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.navy700, marginTop: 4 }}>{expanded ? 'Less' : 'More'}</Text>
            </Pressable>

            {/* ── Grades ────────────────────────────────────────── */}
            <View style={{ marginTop: 22, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.4, color: c.ink }}>Grades</Text>
              <Text style={[{ fontSize: 13, color: avg === null ? c.ink4 : c.ink2, fontWeight: '600' }, tnum]}>
                {avg === null ? 'No marks yet' : `Average ${avg}%`}
              </Text>
            </View>
            <View style={[{ marginTop: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
              {TERMS.map((t, i) => (
                <GradeRow key={t} term={t} value={grades[t] || ''} onChange={v => setGrade(ref.name, t, v)} isLast={i === TERMS.length - 1} accent={color} />
              ))}
            </View>
            <Text style={{ fontSize: 11.5, color: c.ink4, marginTop: 8, lineHeight: 16 }}>
              Marks stay on this phone. MyEdBC is still the official record.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const Fact = ({ icon, text, strong }: { icon: 'me' | 'map' | 'clock'; text: string; strong?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: strong ? c.navy50 : c.paper2, borderWidth: 1, borderColor: strong ? c.navy700 + '55' : c.line }}>
      <Icon name={icon} size={14} stroke={1.8} color={strong ? c.navy700 : c.ink3} />
      <Text style={[{ fontSize: 13, fontWeight: '500', color: strong ? c.navy700 : c.ink2 }, tnum]}>{text}</Text>
    </View>
  );
};

const GradeRow = ({ term, value, onChange, isLast, accent }: { term: Term; value: string; onChange: (v: string) => void; isLast: boolean; accent: string }) => {
  const { c } = useTheme();
  const n = Number(value);
  const tone = !value ? c.ink4 : n >= 86 ? c.moss : n >= 73 ? c.navy700 : n >= 60 ? c.gold : c.crimson;
  const letter = !value ? '' : n >= 86 ? 'A' : n >= 73 ? 'B' : n >= 67 ? 'C+' : n >= 60 ? 'C' : n >= 50 ? 'C−' : 'F';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: isLast ? 0 : 1, borderBottomColor: c.line2 }}>
      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: term === 'Final' ? accent : c.line }} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: term === 'Final' ? '700' : '500', color: c.ink }}>{term}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: tone, width: 22, textAlign: 'right' }}>{letter}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 9, backgroundColor: c.paper, paddingHorizontal: 8 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="—"
          placeholderTextColor={c.ink4}
          keyboardType="decimal-pad"
          maxLength={5}
          style={[{ width: 48, textAlign: 'right', fontSize: 15, fontWeight: '600', color: tone, paddingVertical: 6 }, tnum]}
          accessibilityLabel={`${term} mark`}
        />
        <Text style={{ fontSize: 13, color: c.ink4, marginLeft: 2 }}>%</Text>
      </View>
    </View>
  );
};

void fromISO;
