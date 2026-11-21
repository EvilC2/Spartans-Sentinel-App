// Spartans — Homework (from More, Quick links, a class card or a program page).
// A clean paper list: one heading per class, the tasks in the order the student
// wants them, and a line to write on at the bottom of every class. No cards, no
// art, no popups; the tasks are the loudest thing on the page.
//
// Sections: every program the student is in, in Programs-tab order, then
// Unsorted (homework with no program). Empty ones still show, with their line.
//
// The rows themselves live in src/components/HomeworkList.tsx, shared with a
// program's Homework tab. A ticked item moves straight to the class's
// Completed list under its tasks (folded until opened; still editable).
//
// State lives in HomeworkProvider (src/stores.tsx) and every due date is a
// calendar event. Order is the store's array order, so it persists with the list.

import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts } from '../theme';
import { AppHeader } from '../components/AppHeader';
import { glow, wash } from '../components/ProgramIcon';
import { ClassHomework, ScrollerCtx, Section, UNSORTED, splitDone, useHomeworkScroller, useHomeworkSections } from '../components/HomeworkList';
import { useHomework, classKey } from '../stores';
import { useNow } from '../useToday';
import { toISO } from '../calendar';
import { HomeworkItem, Program } from '../programs';
import type { ScreenProps } from '../../App';

const GUTTER = 20;

// ────────────────────────────────────────────────────────────────
export default function HomeworkScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const hw = useHomework();
  const todayIso = toISO(useNow());
  const { scroller, kb, rootProps, scrollProps } = useHomeworkScroller(topInset);

  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});

  const { programs, sections } = useHomeworkSections();

  // Open tasks keep the store's order; done ones go to Completed, newest first.
  const bySection = useMemo(() => {
    const sectionOf = (h: HomeworkItem): string => {
      let p: Program | undefined;
      if (h.program) p = programs.find(x => classKey(x.name) === classKey(h.program!));
      else if (h.slot) p = programs.find(x => x.slots.includes(h.slot!));
      return p ? p.id : UNSORTED;
    };
    const all: Record<string, HomeworkItem[]> = {};
    for (const s of sections) all[s.id] = [];
    for (const h of hw.items) (all[sectionOf(h)] || all[UNSORTED]).push(h);
    const out: Record<string, { list: HomeworkItem[]; completed: HomeworkItem[] }> = {};
    for (const id of Object.keys(all)) out[id] = splitDone(all[id]);
    return out;
  }, [hw.items, sections, programs]);

  return (
    <ScrollerCtx.Provider value={scroller}>
      <View {...rootProps} style={{ flex: 1, backgroundColor: c.paper }}>
        <ScrollView
          {...scrollProps}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: kb ? kb + 40 : 130 }}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader topInset={topInset} title="Homework" back />

          {sections.map((s, i) => (
            <ClassBlock
              key={s.id}
              s={s}
              first={i === 0}
              list={bySection[s.id].list}
              completed={bySection[s.id].completed}
              sections={sections}
              todayIso={todayIso}
              openId={openId}
              setOpenId={setOpenId}
              showDone={!!showDone[s.id]}
              onToggleDone={() => setShowDone(m => ({ ...m, [s.id]: !m[s.id] }))}
            />
          ))}
        </ScrollView>
      </View>
    </ScrollerCtx.Provider>
  );
}

// ────────────────────────────────────────────────────────────────
// One class: heading, then its tasks and the line to write on.
// ────────────────────────────────────────────────────────────────
const ClassBlock = ({ s, first, list, completed, sections, todayIso, openId, setOpenId, showDone, onToggleDone }: {
  s: Section; first: boolean; list: HomeworkItem[]; completed: HomeworkItem[]; sections: Section[]; todayIso: string;
  openId: string | null; setOpenId: (id: string | null) => void; showDone: boolean; onToggleDone: () => void;
}) => {
  const { c, mode } = useTheme();
  return (
    <View style={{ paddingTop: first ? 14 : 28 }}>
      {/* A faint wash of the class's colour behind its heading, so each class
          reads as its own group without a hard box. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 8, marginBottom: 4, paddingLeft: GUTTER - 8, paddingRight: 8, paddingTop: 10, paddingBottom: 9, borderRadius: 14, backgroundColor: s.color && /^#[0-9a-f]{6}$/i.test(s.color) ? wash(glow(s.color, mode), mode === 'dark' ? 0.1 : 0.06) : mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(14,34,56,0.025)' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 23, lineHeight: 29, letterSpacing: -0.3, color: c.ink }}>{s.name}</Text>
          {!!s.sub && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 }}>
              {!!s.color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: glow(s.color, mode) }} />}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13.5, lineHeight: 18, color: c.ink3 }}>{s.sub}</Text>
            </View>
          )}
        </View>
      </View>

      <ClassHomework s={s} list={list} completed={completed} sections={sections} todayIso={todayIso} openId={openId} setOpenId={setOpenId} showDone={showDone} onToggleDone={onToggleDone} />
    </View>
  );
};
