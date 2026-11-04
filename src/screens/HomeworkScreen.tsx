// Spartans — Homework (from More, Quick links, a class card or a program page).
// Same look as the Cafeteria Menu: a gradient "up next" card, an Uber-Eats-
// style row of program icons to filter by, then one card per section:
// Unsorted first (homework with no program), then every program the student
// is in, each with its Fluent 3D icon (src/programIcons.ts).
//
// A row: tick circle (the only way to complete it) · title (tap to rename in
// place) · due pill (tap for the date + time popup) · edit button (bottom
// sheet: title, notes, program, date, time, delete). A ticked item stays put
// for the rest of the day it was ticked, then moves to the Completed part at
// the bottom of its section.
//
// Items are sample data (src/data.ts) plus the student's own; state lives in
// HomeworkProvider (src/stores.tsx) and every due date is a calendar event.

import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Image, Modal, Animated, Easing,
  Platform, useWindowDimensions, ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G155 } from '../theme';
import { Icon, Check } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { ProgramIcon, wash } from '../components/ProgramIcon';
import { useProfile, teacherShort } from '../ProfileContext';
import { useHomework, classKey, HomeworkPatch } from '../stores';
import { useNow } from '../useToday';
import { useKeyboardHeight, sheetHeight } from '../useKeyboard';
import { toISO, fromISO, MONTH_NAMES } from '../calendar';
import { fmt12 } from '../bell';
import { programsFor, groupPrograms, HomeworkItem, Program, ProgramKind, KIND_ONE } from '../programs';
import type { ScreenProps } from '../../App';

const ART = {
  inbox: require('../../assets/homework/inbox.png'),
  alarm: require('../../assets/homework/alarm.png'),
  party: require('../../assets/homework/party.png'),
  notepad: require('../../assets/homework/notepad.png'),
  check: require('../../assets/homework/checkmark.png'),
  fire: require('../../assets/homework/fire.png'),
};

const UNSORTED = 'unsorted';
const UNSORTED_COLOR = '#5C6470';

// A section is Unsorted or one program.
type Section = { id: string; name: string; sub: string; color: string; kind?: ProgramKind; program: string };

// ── Dates ───────────────────────────────────────────────────────
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const addDays = (iso: string, n: number) => { const d = fromISO(iso); return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
const shortDate = (iso: string) => { const d = fromISO(iso); return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };

const dayLabel = (iso: string, todayIso: string) => {
  const diff = daysBetween(todayIso, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return DOW3[fromISO(iso).getDay()];
  return shortDate(iso);
};
const longDay = (iso: string, todayIso: string) => {
  const d = fromISO(iso);
  const rel = dayLabel(iso, todayIso);
  const full = `${DOW3[d.getDay()]} ${shortDate(iso)}`;
  return rel === 'Today' || rel === 'Tomorrow' || rel === 'Yesterday' ? `${rel}, ${full}` : full;
};

type Tone = 'late' | 'soon' | 'later' | 'done';
const toneOf = (h: HomeworkItem, todayIso: string): Tone =>
  h.done ? 'done' : h.due < todayIso ? 'late' : daysBetween(todayIso, h.due) <= 1 ? 'soon' : 'later';

const byDue = (a: HomeworkItem, b: HomeworkItem) => a.due.localeCompare(b.due) || (a.time || '99').localeCompare(b.time || '99');

// ────────────────────────────────────────────────────────────────
export default function HomeworkScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const hw = useHomework();
  const todayIso = toISO(useNow());

  const [filter, setFilter] = useState<string>('all');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [timeFor, setTimeFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ id?: string; program: string } | null>(null);
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});
  const [quick, setQuick] = useState('');

  // Every program, in Programs-tab order, after Unsorted.
  const programs = useMemo(() => groupPrograms(programsFor(profile)).flatMap(g => g.items), [profile]);
  const sections = useMemo<Section[]>(() => [
    { id: UNSORTED, name: 'Unsorted', sub: 'Not in a program yet', color: UNSORTED_COLOR, program: '' },
    ...programs.map(p => ({
      id: p.id, name: p.name, color: p.color, kind: p.kind, program: p.name,
      sub: p.kind === 'class'
        ? [`Block ${p.slots.join(', ')}`, teacherShort(p.teacher || '')].filter(Boolean).join(' · ')
        : [KIND_ONE[p.kind], teacherShort(p.teacher || '')].filter(Boolean).join(' · '),
    })),
  ], [programs]);

  const sectionOf = (h: HomeworkItem): string => {
    let p: Program | undefined;
    if (h.program) p = programs.find(x => classKey(x.name) === classKey(h.program!));
    else if (h.slot) p = programs.find(x => x.slots.includes(h.slot!));
    return p ? p.id : UNSORTED;
  };

  // Done today stays in the list; done before today goes to Completed.
  const bySection = useMemo(() => {
    const out: Record<string, { list: HomeworkItem[]; completed: HomeworkItem[]; open: number }> = {};
    for (const s of sections) out[s.id] = { list: [], completed: [], open: 0 };
    for (const h of hw.items) {
      const b = out[sectionOf(h)] || out[UNSORTED];
      if (h.done && h.doneOn !== todayIso) b.completed.push(h);
      else { b.list.push(h); if (!h.done) b.open++; }
    }
    for (const b of Object.values(out)) { b.list.sort(byDue); b.completed.sort((a, z) => (z.doneOn || '').localeCompare(a.doneOn || '') || byDue(z, a)); }
    return out;
  }, [hw.items, sections, todayIso]);

  const open = hw.items.filter(h => !h.done).sort(byDue);
  const late = open.filter(h => h.due < todayIso).length;
  const today = open.filter(h => h.due === todayIso).length;
  const week = open.filter(h => h.due > todayIso && daysBetween(todayIso, h.due) <= 7).length;
  const doneToday = hw.items.filter(h => h.done && h.doneOn === todayIso).length;
  const next = open.find(h => h.due >= todayIso) || open[0];
  const nextSection = next ? sections.find(s => s.id === sectionOf(next)) : undefined;

  const visible = filter === 'all' ? sections : sections.filter(s => s.id === filter);
  const target = sections.find(s => s.id === filter) || sections[0];

  const addQuick = () => {
    if (!quick.trim()) return;
    hw.add(target.program, quick, addDays(todayIso, 1));
    setQuick('');
  };

  const timeItem = timeFor ? hw.items.find(h => h.id === timeFor) : undefined;
  const sheetItem = sheet?.id ? hw.items.find(h => h.id === sheet.id) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <AppHeader topInset={topInset} title="Homework" back />

        {/* ── New ───────────────────────────────────────────── */}
        <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
          <Pressable onPress={() => setSheet({ program: target.program })} accessibilityRole="button" accessibilityLabel="New homework" style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.navy700, opacity: pressed ? 0.8 : 1,
          })}>
            <Icon name="plus" size={14} stroke={2.4} color="#fff" />
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#fff', letterSpacing: -0.2 }}>New</Text>
          </Pressable>
        </View>

        {/* ── Up next ───────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={[{ borderRadius: 24, overflow: 'hidden' }, shadow.md]}>
            <LinearGradient colors={[c.sky, c.sky600, c.navy700]} {...G155} style={{ padding: 18 }}>
              <Blob size={240} style={{ top: -120, right: -80, opacity: 0.16 }} />
              <Blob size={140} style={{ bottom: -70, left: 10, opacity: 0.12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>
                    {open.length ? 'Up next' : 'Homework'}
                  </Text>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.7, marginTop: 4, lineHeight: 30 }}>
                    {open.length === 0 ? 'All caught up' : `${open.length} to do`}
                  </Text>
                  {next ? (
                    <Text numberOfLines={2} style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 18, fontWeight: '500' }}>
                      {next.title} · {nextSection?.name} · {longDay(next.due, todayIso)}{next.time ? `, ${fmt12(next.time, true)}` : ''}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 4, fontWeight: '500' }}>Nothing open. Enjoy it.</Text>
                  )}
                </View>
                <Floaty><Image source={open.length ? ART.notepad : ART.party} style={{ width: 76, height: 76 }} /></Floaty>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
                <StatPill art={ART.fire} n={late} label="Late" />
                <StatPill art={ART.alarm} n={today} label="Today" />
                <StatPill art={ART.notepad} n={week} label="This week" />
                <StatPill art={ART.check} n={doneToday} label="Done" />
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* ── Programs row (Uber Eats style) ───────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 22, gap: 2 }}>
          <StripTile label="All" on={filter === 'all'} count={open.length} onPress={() => setFilter('all')}>
            <ArtTile art={ART.notepad} color={c.sky} size={58} />
          </StripTile>
          {sections.map(s => (
            <StripTile key={s.id} label={s.id === UNSORTED ? 'Unsorted' : stripName(s.name)} on={filter === s.id} count={bySection[s.id]?.open || 0} onPress={() => setFilter(filter === s.id ? 'all' : s.id)}>
              <SectionIcon s={s} size={58} />
            </StripTile>
          ))}
        </ScrollView>

        {/* ── Quick add ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 18, paddingLeft: 14, paddingRight: 6, height: 52 }, shadow.sm]}>
            <Icon name="plus" size={16} stroke={2.2} color={c.ink3} />
            <TextInput
              value={quick}
              onChangeText={setQuick}
              onSubmitEditing={addQuick}
              returnKeyType="done"
              placeholder={`Add to ${target.name}, due tomorrow`}
              placeholderTextColor={c.ink4}
              style={{ flex: 1, fontSize: 15, color: c.ink, paddingVertical: 10, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
            />
            {!!quick.trim() && (
              <Pressable onPress={addQuick} accessibilityRole="button" accessibilityLabel="Add" style={({ pressed }) => ({ height: 40, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.sky, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#fff' }}>Add</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Sections ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 12 }}>
          {visible.filter(s => filter !== 'all' || bySection[s.id].list.length || bySection[s.id].completed.length).map(s => {
            const b = bySection[s.id];
            return (
              <SectionCard
                key={s.id}
                s={s}
                list={b.list}
                completed={b.completed}
                open={b.open}
                todayIso={todayIso}
                compact={false}
                showDone={!!showDone[s.id]}
                onToggleDone={() => setShowDone(m => ({ ...m, [s.id]: !m[s.id] }))}
                onAdd={() => setSheet({ program: s.program })}
                renaming={renaming}
                onRename={setRenaming}
                onCheck={id => hw.toggle(id, todayIso)}
                onSaveTitle={(id, title) => hw.update(id, { title })}
                onTime={setTimeFor}
                onEdit={id => setSheet({ id, program: s.program })}
              />
            );
          })}
        </View>

        {filter === 'all' && (() => {
          const quiet = sections.filter(s => !bySection[s.id].list.length && !bySection[s.id].completed.length && s.id !== UNSORTED);
          return quiet.length ? (
            <Text style={{ paddingTop: 16, paddingHorizontal: 24, fontSize: 12.5, color: c.ink4, lineHeight: 18 }}>
              Nothing due in {quiet.map(s => stripName(s.name)).join(', ')}. Tap one above to add something.
            </Text>
          ) : null;
        })()}
        <Text style={{ paddingTop: 20, paddingHorizontal: 20, textAlign: 'center', fontSize: 12, color: c.ink4, letterSpacing: 0.2, lineHeight: 17 }}>
          Ticked items move to Completed tomorrow.
        </Text>
      </ScrollView>

      <DuePopup
        item={timeItem}
        todayIso={todayIso}
        onClose={() => setTimeFor(null)}
        onSave={(due, time) => { if (timeItem) hw.update(timeItem.id, { due, time }); setTimeFor(null); }}
      />
      <EditSheet
        visible={!!sheet}
        item={sheetItem}
        startProgram={sheet?.program || ''}
        sections={sections}
        sectionOf={sectionOf}
        todayIso={todayIso}
        onClose={() => setSheet(null)}
        onSave={(patch) => {
          if (sheetItem) hw.update(sheetItem.id, patch);
          else hw.add(patch.program || '', patch.title || '', patch.due || addDays(todayIso, 1), { time: patch.time, notes: patch.notes });
          setSheet(null);
        }}
        onDelete={() => { if (sheetItem) hw.remove(sheetItem.id); setSheet(null); }}
      />
    </View>
  );
}

// Short label under a strip icon: "Chemistry 11" → "Chemistry", "Sr. Boys
// Rugby" → "Rugby", "Physical and Health Education 10" → "PHE".
const stripName = (name: string) => {
  const base = name.replace(/\(.*?\)/g, '').replace(/\b\d{1,2}[AB]?(\/\d{1,2})*\b/g, '').replace(/\b(sr\.?|jr\.?|boys|girls)\s+/gi, '').replace(/\s+/g, ' ').trim();
  const words = base.split(' ').filter(w => !/^(and|&|of|the)$/i.test(w));
  return base.length > 20 && words.length >= 3 ? words.map(w => w[0].toUpperCase()).join('') : base;
};

// ────────────────────────────────────────────────────────────────
// Section card
// ────────────────────────────────────────────────────────────────
const SectionCard = ({
  s, list, completed, open, todayIso, compact, showDone, onToggleDone, onAdd,
  renaming, onRename, onCheck, onSaveTitle, onTime, onEdit,
}: {
  s: Section; list: HomeworkItem[]; completed: HomeworkItem[]; open: number; todayIso: string; compact: boolean;
  showDone: boolean; onToggleDone: () => void; onAdd: () => void;
  renaming: string | null; onRename: (id: string | null) => void;
  onCheck: (id: string) => void; onSaveTitle: (id: string, title: string) => void;
  onTime: (id: string) => void; onEdit: (id: string) => void;
}) => {
  const { c, mode } = useTheme();
  const rowProps = { todayIso, accent: s.color, renaming, onRename, onCheck, onSaveTitle, onTime, onEdit };
  // The whole card wears the program's colour (same as the Programs tab);
  // the list sits on plain surface inside it. No outlines anywhere.
  return (
    <View style={[{ backgroundColor: wash(s.color, mode === 'dark' ? 0.24 : 0.11), borderRadius: 22, overflow: 'hidden' }, shadow.sm]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, paddingRight: 12, paddingVertical: compact ? 8 : 10 }}>
        <SectionIcon s={s} size={compact ? 40 : 48} bare />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: compact ? 14.5 : 16, fontWeight: '700', color: compact ? c.ink2 : c.ink, letterSpacing: -0.3 }}>{s.name}</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: c.ink3, marginTop: 1 }}>
            {compact ? 'Nothing due' : open ? `${open} to do` : 'All done'}{s.sub ? <Text style={{ color: s.color, fontWeight: '600' }}>  {s.sub}</Text> : null}
          </Text>
        </View>
        <Pressable onPress={onAdd} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Add homework to ${s.name}`} style={({ pressed }) => ({
          width: 34, height: 34, borderRadius: 17, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
        })}>
          <Icon name="plus" size={15} stroke={2.6} color="#fff" />
        </Pressable>
      </View>

      {!compact && (list.length > 0 || completed.length > 0) && (
      <View style={{ backgroundColor: c.surface, marginHorizontal: 4, marginBottom: 4, borderRadius: 18, overflow: 'hidden' }}>
      {list.length === 0 && (
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={ART.party} style={{ width: 22, height: 22 }} />
          <Text style={{ fontSize: 13, color: c.ink3 }}>Everything here is done.</Text>
        </View>
      )}

      {list.map((h, i) => <Row key={h.id} h={h} first={i === 0} {...rowProps} />)}

      {completed.length > 0 && (
        <>
          <Pressable onPress={onToggleDone} accessibilityRole="button" accessibilityState={{ expanded: showDone }} style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 16,
            borderTopWidth: list.length ? 1 : 0, borderTopColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent',
          })}>
            <Image source={ART.check} style={{ width: 16, height: 16 }} />
            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: c.ink3, letterSpacing: 0.2 }}>Completed · {completed.length}</Text>
            <View style={{ transform: [{ rotate: showDone ? '180deg' : '0deg' }] }}>
              <Icon name="chev-d" size={14} stroke={2} color={c.ink4} />
            </View>
          </Pressable>
          {showDone && completed.map(h => <Row key={h.id} h={h} {...rowProps} muted />)}
        </>
      )}
      </View>
      )}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Row: tick · title (tap to rename) · due pill · edit
// ────────────────────────────────────────────────────────────────
const Row = ({
  h, todayIso, accent, renaming, onRename, onCheck, onSaveTitle, onTime, onEdit, muted, first,
}: {
  h: HomeworkItem; todayIso: string; accent: string; renaming: string | null; onRename: (id: string | null) => void;
  onCheck: (id: string) => void; onSaveTitle: (id: string, title: string) => void;
  onTime: (id: string) => void; onEdit: (id: string) => void; muted?: boolean; first?: boolean;
}) => {
  const { c } = useTheme();
  const editing = renaming === h.id;
  const [draft, setDraft] = useState(h.title);
  const tone = toneOf(h, todayIso);
  const pill = {
    late: { bg: c.crimsonTint, ink: c.crimson },
    soon: { bg: c.goldTint, ink: c.gold },
    later: { bg: c.paper2, ink: c.ink2 },
    done: { bg: c.paper2, ink: c.ink4 },
  }[tone];
  const longLate = tone === 'late' && daysBetween(h.due, todayIso) > 1;

  const pop = useRef(new Animated.Value(1)).current;
  const check = () => {
    if (!h.done) {
      pop.setValue(0.7);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();
    }
    onCheck(h.id);
  };

  const commit = () => {
    const t = draft.trim();
    if (t && t !== h.title) onSaveTitle(h.id, t);
    else setDraft(h.title);
    onRename(null);
  };

  return (
    <Pressable
      onPress={() => { if (!editing) { setDraft(h.title); onRename(h.id); } }}
      accessibilityLabel={`${h.title}. Tap to rename`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 14, paddingRight: 6,
        borderTopWidth: first ? 0 : 1, borderTopColor: c.line2, backgroundColor: pressed && !editing ? c.paper2 : 'transparent',
      })}
    >
      <Pressable onPress={check} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: h.done }} accessibilityLabel={`Done: ${h.title}`}>
        <Animated.View style={{
          width: 26, height: 26, borderRadius: 13, borderWidth: 2,
          borderColor: h.done ? accent : c.ink4, backgroundColor: h.done ? accent : 'transparent',
          alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }],
        }}>
          {h.done && <Check size={13} color="#fff" width={3.5} />}
        </Animated.View>
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            onBlur={commit}
            autoFocus
            returnKeyType="done"
            selectTextOnFocus
            style={{
              fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2, paddingVertical: 4, paddingHorizontal: 8, marginLeft: -8,
              borderRadius: 8, backgroundColor: c.paper2,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
        ) : (
          <Text numberOfLines={2} style={{
            fontSize: 15, fontWeight: '600', letterSpacing: -0.2, lineHeight: 19,
            color: h.done ? c.ink4 : c.ink, textDecorationLine: h.done ? 'line-through' : 'none',
          }}>{h.title}</Text>
        )}
        {!!h.notes && !editing && (
          <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3, marginTop: 2 }}>{h.notes}</Text>
        )}
        {muted && !!h.doneOn && (
          <Text style={{ fontSize: 11.5, color: c.ink4, marginTop: 2 }}>Done {shortDate(h.doneOn)}</Text>
        )}
      </View>

      <Pressable onPress={() => onTime(h.id)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Due ${longDay(h.due, todayIso)}${h.time ? ' at ' + fmt12(h.time, true) : ''}. Change`} style={({ pressed }) => ({
        minWidth: 68, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: pill.bg, opacity: pressed ? 0.7 : 1,
      })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="clock" size={11} stroke={2.2} color={pill.ink} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: pill.ink, letterSpacing: -0.1 }}>{longLate ? 'Late' : dayLabel(h.due, todayIso)}</Text>
        </View>
        <Text style={[{ fontSize: 10.5, fontWeight: '600', color: pill.ink, opacity: 0.8, marginTop: 1 }, tnum]}>
          {h.time ? fmt12(h.time, true) : longLate ? shortDate(h.due) : 'Any time'}
        </Text>
      </Pressable>

      <Pressable onPress={() => onEdit(h.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Edit ${h.title}`} style={({ pressed }) => ({
        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.paper2 : 'transparent',
      })}>
        <Icon name="more" size={16} stroke={1.9} color={c.ink4} />
      </Pressable>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Due popup: date + time, from the pill on a row
// ────────────────────────────────────────────────────────────────
const DuePopup = ({ item, todayIso, onClose, onSave }: {
  item?: HomeworkItem; todayIso: string; onClose: () => void; onSave: (due: string, time: string | undefined) => void;
}) => {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const [due, setDue] = useState('');
  const [time, setTime] = useState<string | undefined>();
  const [forId, setForId] = useState<string | null>(null);
  // Load the item's values each time the popup opens for it; keep the last
  // title while it fades out.
  const last = useRef<HomeworkItem | undefined>(undefined);
  if (item) last.current = item;
  if (item && forId !== item.id) { setForId(item.id); setDue(item.due); setTime(item.time); }
  if (!item && forId) setForId(null);

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,34,56,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 }} accessibilityLabel="Close">
        <Pressable onPress={() => {}} style={[{ width: Math.min(width - 40, 380), maxHeight: height - 80, backgroundColor: c.paper, borderRadius: 26, overflow: 'hidden' }, shadow.lg]}>
          <ScrollView contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={ART.alarm} style={{ width: 34, height: 34 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: c.ink, letterSpacing: -0.4 }}>Due</Text>
                <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3 }}>{last.current?.title}</Text>
              </View>
            </View>
            {!!due && <DateTimeFields due={due} time={time} todayIso={todayIso} onDue={setDue} onTime={setTime} />}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <SheetButton label="Cancel" onPress={onClose} />
              <SheetButton label="Save" primary onPress={() => onSave(due, time)} />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ────────────────────────────────────────────────────────────────
// Edit sheet: title, notes, program, date, time, delete
// ────────────────────────────────────────────────────────────────
const EditSheet = ({ visible, item, startProgram, sections, sectionOf, todayIso, onClose, onSave, onDelete }: {
  visible: boolean; item?: HomeworkItem; startProgram: string; sections: Section[]; sectionOf: (h: HomeworkItem) => string;
  todayIso: string; onClose: () => void; onSave: (p: HomeworkPatch) => void; onDelete: () => void;
}) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const kb = useKeyboardHeight();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [section, setSection] = useState(UNSORTED);
  const [due, setDue] = useState('');
  const [time, setTime] = useState<string | undefined>();
  const [err, setErr] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Load fresh values each time the sheet opens.
  const key = visible ? (item?.id || 'new:' + startProgram) : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setTitle(item?.title || '');
      setNotes(item?.notes || '');
      setSection(item ? sectionOf(item) : (sections.find(s => s.program && classKey(s.program) === classKey(startProgram))?.id || UNSORTED));
      setDue(item?.due || addDays(todayIso, 1));
      setTime(item?.time);
      setErr('');
      setConfirmDelete(false);
    }
  }

  const save = () => {
    if (!title.trim()) { setErr('Give it a name.'); return; }
    const s = sections.find(x => x.id === section) || sections[0];
    const patch: HomeworkPatch = { title: title.trim(), notes: notes.trim(), due, time };
    // Only move it when the program changed, so sample items keep their block.
    if (!item || sectionOf(item) !== section) patch.program = s.program;
    onSave(patch);
  };

  const input = { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.ink, backgroundColor: c.paper2, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) } as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,34,56,0.35)' }} accessibilityLabel="Close" />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: kb }}>
        <View style={[{ height: sheetHeight(height, kb, 0.9), backgroundColor: c.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }, shadow.lg]}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          </View>
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ flex: 1, fontFamily: fonts.serif, fontSize: 24, letterSpacing: -0.5, color: c.ink }}>{item ? 'Edit homework' : 'New homework'}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => ({
              width: 32, height: 32, borderRadius: 16, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
            })}>
              <Icon name="close" size={16} stroke={2} color={c.ink2} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Label>Title</Label>
            <TextInput value={title} onChangeText={t => { setTitle(t); setErr(''); }} placeholder="Problem set 9.4" placeholderTextColor={c.ink4} style={[input, { fontWeight: '600' }]} autoFocus={!item} returnKeyType="done" />

            <Label>Notes</Label>
            <TextInput value={notes} onChangeText={setNotes} placeholder="Pages, links, who to ask" placeholderTextColor={c.ink4} style={[input, { minHeight: 84, textAlignVertical: 'top' }]} multiline />

            <Label>Program</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} keyboardShouldPersistTaps="always" style={{ marginHorizontal: -20 }}>
              {sections.map(s => {
                const on = section === s.id;
                return (
                  <Pressable key={s.id} onPress={() => setSection(s.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 5, paddingRight: 12, height: 40, borderRadius: 999,
                    backgroundColor: on ? s.color : wash(s.color, 0.12), opacity: pressed ? 0.75 : 1,
                  })}>
                    <SectionIcon s={s} size={30} bare />
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : c.ink, letterSpacing: -0.2, maxWidth: 170 }}>{s.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Label>Due</Label>
            {!!due && <DateTimeFields due={due} time={time} todayIso={todayIso} onDue={setDue} onTime={setTime} bare />}

            {!!err && <Text style={{ color: c.crimson, marginTop: 12, fontSize: 13, fontWeight: '600' }}>{err}</Text>}

            {item && (
              <Pressable onPress={() => confirmDelete ? onDelete() : setConfirmDelete(true)} accessibilityRole="button" style={({ pressed }) => ({
                marginTop: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
                backgroundColor: confirmDelete ? c.crimson : 'transparent', opacity: pressed ? 0.7 : 1,
              })}>
                <Icon name="trash" size={14} stroke={2} color={confirmDelete ? '#fff' : c.crimson} />
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: confirmDelete ? '#fff' : c.crimson }}>{confirmDelete ? 'Tap again to delete' : 'Delete homework'}</Text>
              </Pressable>
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: kb ? 10 : Platform.OS === 'ios' ? 34 : 18 }}>
            <SheetButton label="Cancel" onPress={onClose} />
            <SheetButton label={item ? 'Save' : 'Add'} primary onPress={save} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ────────────────────────────────────────────────────────────────
// Date + time picker (plain RN, so it works in Expo Go and on web)
// ────────────────────────────────────────────────────────────────
const TIME_PRESETS = ['08:00', '15:00', '18:00', '21:00', '23:59'];

const DateTimeFields = ({ due, time, todayIso, onDue, onTime, bare }: {
  due: string; time?: string; todayIso: string; onDue: (iso: string) => void; onTime: (t: string | undefined) => void; bare?: boolean;
}) => {
  const { c } = useTheme();
  // The Monday after this one, for "Next Mon".
  const nextMon = addDays(todayIso, ((8 - fromISO(todayIso).getDay()) % 7) || 7);
  const quick: [string, string][] = [['Today', todayIso], ['Tomorrow', addDays(todayIso, 1)], ['Next Mon', nextMon]];

  const [h, m] = (time || '15:00').split(':').map(Number);
  const setMins = (total: number) => { const t = ((total % 1440) + 1440) % 1440; onTime(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`); };

  return (
    <View style={{ marginTop: bare ? 0 : 14 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {quick.map(([label, iso]) => (
          <SmallChip key={label} label={label} on={due === iso} onPress={() => onDue(iso)} grow />
        ))}
      </View>

      <MiniCal iso={due} todayIso={todayIso} onPick={onDue} />

      <Text style={{ fontSize: 12, fontWeight: '700', color: c.ink3, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>Time</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <SmallChip label="Any time" on={!time} onPress={() => onTime(undefined)} />
        {TIME_PRESETS.map(t => <SmallChip key={t} label={fmt12(t, true)} on={time === t} onPress={() => onTime(t)} />)}
      </View>
      {!!time && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Stepper value={String(((h + 11) % 12) + 1)} onMinus={() => setMins(h * 60 + m - 60)} onPlus={() => setMins(h * 60 + m + 60)} label="hour" />
          <Text style={{ fontSize: 20, fontWeight: '800', color: c.ink }}>:</Text>
          <Stepper value={String(m).padStart(2, '0')} onMinus={() => setMins(h * 60 + m - (m % 5 || 5))} onPlus={() => setMins(h * 60 + m + 5 - (m % 5))} label="minutes" />
          <View style={{ flexDirection: 'row', marginLeft: 'auto', borderRadius: 12, backgroundColor: c.paper2, overflow: 'hidden' }}>
            {(['AM', 'PM'] as const).map(p => {
              const on = (h < 12) === (p === 'AM');
              return (
                <Pressable key={p} onPress={() => { if (!on) setMins(h * 60 + m + (p === 'AM' ? -720 : 720)); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 12, height: 40, justifyContent: 'center', borderRadius: 12, backgroundColor: on ? c.navy700 : 'transparent' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#fff' : c.ink2 }}>{p}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const MiniCal = ({ iso, todayIso, onPick }: { iso: string; todayIso: string; onPick: (iso: string) => void }) => {
  const { c } = useTheme();
  const start = fromISO(iso || todayIso);
  const [ym, setYm] = useState<[number, number]>([start.getFullYear(), start.getMonth()]);
  // Follow the quick chips when they jump to another month.
  const [lastIso, setLastIso] = useState(iso);
  if (iso !== lastIso) { setLastIso(iso); const d = fromISO(iso); if (d.getFullYear() !== ym[0] || d.getMonth() !== ym[1]) setYm([d.getFullYear(), d.getMonth()]); }

  const [y, mo] = ym;
  const lead = new Date(y, mo, 1).getDay();
  const count = new Date(y, mo + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => { const d = new Date(y, mo + n, 1); setYm([d.getFullYear(), d.getMonth()]); };

  return (
    <View style={{ marginTop: 12, backgroundColor: c.paper2, borderRadius: 18, padding: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6 }}>
        <Pressable onPress={() => shift(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month" style={{ padding: 6 }}>
          <Icon name="chev-l" size={16} stroke={2.2} color={c.ink2} />
        </Pressable>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>{MONTH_NAMES[mo]} {y}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next month" style={{ padding: 6 }}>
          <Icon name="chev-r" size={16} stroke={2.2} color={c.ink2} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: c.ink4, paddingVertical: 4 }}>{d}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 38 }} />;
          const cellIso = toISO(new Date(y, mo, d));
          const on = cellIso === iso;
          const isToday = cellIso === todayIso;
          const past = cellIso < todayIso;
          return (
            <Pressable key={i} onPress={() => onPick(cellIso)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={longDay(cellIso, todayIso)} style={{ width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? c.sky : 'transparent', borderWidth: isToday && !on ? 1.5 : 0, borderColor: c.sky,
              }}>
                <Text style={[{ fontSize: 14, fontWeight: on || isToday ? '800' : '500', color: on ? '#fff' : past ? c.ink4 : c.ink }, tnum]}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ── Bits ────────────────────────────────────────────────────────
const SectionIcon = ({ s, size, bare }: { s: Section; size: number; bare?: boolean }) =>
  s.id === UNSORTED ? <ArtTile art={ART.inbox} color={UNSORTED_COLOR} size={size} bare={bare} /> : <ProgramIcon bare={bare} name={s.name} kind={s.kind} color={s.color} size={size} />;

// Same tile shape as ProgramIcon, for art that is not a program.
const ArtTile = ({ art, color, size, bare }: { art: ImageSourcePropType; color: string; size: number; bare?: boolean }) => {
  const { mode } = useTheme();
  return (
    <View style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), alignItems: 'center', justifyContent: 'center',
      backgroundColor: bare ? 'transparent' : wash(color, mode === 'dark' ? 0.28 : 0.13),
    }}>
      <Image source={art} style={{ width: size * (bare ? 0.8 : 0.66), height: size * (bare ? 0.8 : 0.66) }} resizeMode="contain" />
    </View>
  );
};

const StripTile = ({ label, on, count, onPress, children }: { label: string; on: boolean; count: number; onPress: () => void; children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${label}, ${count} to do`} style={({ pressed }) => ({ alignItems: 'center', width: 80, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ padding: 3, borderRadius: 22, borderWidth: 2, borderColor: on ? c.sky : 'transparent' }}>
        {children}
        {count > 0 && (
          <View style={{ position: 'absolute', top: -4, right: -6, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: c.crimson, borderWidth: 2, borderColor: c.paper, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[{ fontSize: 11, fontWeight: '800', color: '#fff' }, tnum]}>{count}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 14, textAlign: 'center', fontWeight: on ? '700' : '500', color: on ? c.navy700 : c.ink2, marginTop: 5, letterSpacing: -0.2, maxWidth: 76 }}>{label}</Text>
    </Pressable>
  );
};

const StatPill = ({ art, n, label }: { art: ImageSourcePropType; n: number; label: string }) => (
  <View style={{ flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingVertical: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Image source={art} style={{ width: 16, height: 16 }} />
      <Text style={[{ fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.4 }, tnum]}>{n}</Text>
    </View>
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginTop: 1 }}>{label}</Text>
  </View>
);

const SmallChip = ({ label, on, onPress, grow }: { label: string; on: boolean; onPress: () => void; grow?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({
      flexGrow: grow ? 1 : 0, alignItems: 'center', justifyContent: 'center', height: 36, paddingHorizontal: 12, borderRadius: 999,
      backgroundColor: on ? c.navy700 : c.paper2, opacity: pressed ? 0.75 : 1,
    })}>
      <Text style={[{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : c.ink, letterSpacing: -0.2 }, tnum]}>{label}</Text>
    </Pressable>
  );
};

const Stepper = ({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label: string }) => {
  const { c } = useTheme();
  const btn = { width: 32, height: 40, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: c.paper2 }}>
      <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel={`Earlier ${label}`} style={btn}><Icon name="minus" size={13} stroke={2.4} color={c.ink2} /></Pressable>
      <Text style={[{ fontSize: 17, fontWeight: '800', color: c.ink, minWidth: 26, textAlign: 'center' }, tnum]}>{value}</Text>
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel={`Later ${label}`} style={btn}><Icon name="plus" size={13} stroke={2.4} color={c.ink2} /></Pressable>
    </View>
  );
};

const SheetButton = ({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({
      flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
      backgroundColor: primary ? c.navy700 : c.paper2, opacity: pressed ? 0.75 : 1,
    })}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: primary ? '#fff' : c.ink }}>{label}</Text>
    </Pressable>
  );
};

const Label = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', color: c.ink3, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>{children}</Text>;
};

const Blob = ({ size, style }: { size: number; style: any }) => (
  <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' }, style]} />
);

const Floaty = ({ children }: { children: React.ReactNode }) => {
  const y = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -6, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
};
