// Spartans — the class card. One sheet, opened from anywhere a class is
// tapped: rotation tiles, the timetable table, the calendar (day list, week
// strip, Day tab). It shows exactly what the class's card on the Programs tab
// shows: a header in the class colour (icon, name, block, teacher, room) and
// ProgramBody under it (next class, About · Homework · Grades), so the two
// look and work the same.
//
// useClassSheet().open({ name, teacher, room, slot }) from any screen; the
// provider renders the modal once at the app root.

import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, useWindowDimensions, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon } from './Icon';
import { useProfile, Slot, SLOT_COLORS, teacherShort, roomShort, Course } from '../ProfileContext';
import { CALENDAR, toISO } from '../calendar';
import { buildDayPlan } from '../bell';
import { ProgramIcon, glow, wash } from './ProgramIcon';
import { ProgramBody } from './ProgramBody';
import { ScrollerCtx, useHomeworkScroller } from './HomeworkList';
import { Program, programsFor, programId, KIND_ONE } from '../programs';
import { useNav } from '../nav';

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
export const nextOccurrence = (slot: Slot | undefined, now: Date) => {
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

const ClassSheet = ({ item: ref, onClose }: { item: ClassRef | null; onClose: () => void }) => {
  const { c, mode } = useTheme();
  const { height } = useWindowDimensions();
  const { profile } = useProfile();
  const nav = useNav();
  const { scroller, rootProps, scrollProps } = useHomeworkScroller(0);

  if (!ref) return null;
  // The same Program the Programs tab builds, or a stand-in for one it doesn't list.
  const pr: Program = programsFor(profile).find(p => p.id === programId(ref.name)) || {
    id: programId(ref.name), name: ref.name, kind: ref.kind === 'extra' ? 'extra' : 'class',
    teacher: ref.teacher, room: ref.room, slots: ref.slot ? [ref.slot] : [],
    color: ref.slot ? SLOT_COLORS[ref.slot] : c.navy700, removable: false,
  };
  const col = glow(pr.color, mode);
  const lead = pr.kind === 'class' ? pr.slots.join('  ') : KIND_ONE[pr.kind];
  const teacher = teacherShort(pr.teacher || '');
  const room = pr.kind === 'class' && pr.room ? roomShort(pr.room) : '';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,34,56,0.35)' }} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View style={[{
          height: Math.round(height * 0.86), backgroundColor: c.paper,
          borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden',
        }, shadow.lg]}>
          <View style={{ flex: 1, backgroundColor: wash(col, mode === 'dark' ? 0.24 : 0.11) }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: wash(col, 0.4) }} />
          </View>
          {/* Header: same as the class's row on the Programs tab. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 14, paddingLeft: 16, paddingRight: 56 }}>
            <ProgramIcon bare name={pr.name} kind={pr.kind} color={pr.color} size={56} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={{ fontFamily: fonts.serif, fontSize: 24, lineHeight: 28, color: c.ink, letterSpacing: -0.5 }}>{pr.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
                {!!lead && <Text numberOfLines={1} style={[{ fontSize: 13.5, fontWeight: '800', color: col }, tnum]}>{lead}</Text>}
                {!!teacher && <Text numberOfLines={1} style={{ fontSize: 14, color: c.ink2, flexShrink: 1 }}>{teacher}</Text>}
                {!!room && <Text numberOfLines={1} style={[{ fontSize: 14, fontWeight: '500', color: c.ink3 }, tnum]}>{room}</Text>}
              </View>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close class card" style={({ pressed }) => ({
            position: 'absolute', top: 22, right: 16, width: 32, height: 32, borderRadius: 16, zIndex: 3, elevation: 3,
            backgroundColor: wash(col, 0.18), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
          })}>
            <Icon name="close" size={16} stroke={2.2} color={c.ink2} />
          </Pressable>

          <ScrollerCtx.Provider value={scroller}>
            <View {...rootProps} style={{ flex: 1 }}>
              <ScrollView
                {...scrollProps}
                style={{ flex: 1, backgroundColor: mode === 'dark' ? '#1C2531' : c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
              >
                <ProgramBody pr={pr} onNavigate={t => { onClose(); nav.go(t); }} />
              </ScrollView>
            </View>
          </ScrollerCtx.Provider>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
