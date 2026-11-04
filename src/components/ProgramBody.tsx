// Spartans — what a program shows when it is opened on the Programs tab.
// The row itself (icon, name, blocks) stays on top; this is everything under it:
//   Next class    when you have it next, and the room on the map
//   Tabs          Homework · Grades · About for real courses (classes, outside
//                 timetable, online). The tab labels carry the live numbers
//                 (open homework, current mark) so the three read as one place.
//   About         course-book text as headings and bullets, school
//                 events and announcements that mention it
//   Homework      tick-only rows, add your own (stored on this phone)
//   Grades        Term 1 / Term 2 / Final, big current mark on top
// Clubs, teams and ensembles have no coursework: they show About only.

import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Platform } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, tnum } from '../theme';
import { Icon, Check } from './Icon';
import { nextOccurrence, useClassSheet } from './ClassCard';
import { glow, onGlow } from './ProgramIcon';
import { useProfile } from '../ProfileContext';
import { useHomework, useGrades, TERMS, Term, termAverage } from '../stores';
import { useNow, resolveNow } from '../useToday';
import { usePreviewTime } from '../PreviewTime';
import { useNav } from '../nav';
import { findTarget } from '../map/data';
import { courseInfo } from '../descriptions';
import { fmt12 } from '../bell';
import { toISO, fromISO, MONTH_NAMES } from '../calendar';
import { Program, programHomework, programNews, programSchoolEvents, hasCoursework } from '../programs';
import { tagColor } from './Cards';
import type { TabId } from './Chrome';

const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Tab = 'about' | 'homework' | 'grades';

// onFadeEnd: how far down (in this view) the card's colour fade should run —
// the top of the tabs, or the end of the Next class line when there are none.
export const ProgramBody = ({ pr: raw, onNavigate, onEditTimetable, onFadeEnd }: { pr: Program; onNavigate: (t: TabId) => void; onEditTimetable?: () => void; onFadeEnd?: (y: number) => void }) => {
  const { c, mode } = useTheme();
  // Everything below draws in the program colour, brightened on the dark theme.
  const pr = { ...raw, color: glow(raw.color, mode) };
  const on = onGlow(mode);
  const { profile, save } = useProfile();
  const todayIso = toISO(useNow());
  const hw = useHomework();
  const { gradesFor } = useGrades();
  const coursework = hasCoursework(pr);
  const [tab, setTab] = useState<Tab>(coursework ? 'homework' : 'about');

  const homework = programHomework(pr, hw.items);
  const open = homework.filter(h => !h.done);
  const mark = currentMark(gradesFor(pr.name));

  const remove = () => {
    if (!profile) return;
    const doIt = async () => {
      const next = { ...profile, extraCourses: profile.extraCourses.filter(x => x.name.trim().toLowerCase() !== pr.name.toLowerCase()) };
      try { await save(next); } catch {}
    };
    // RN-web has no Alert; confirm() keeps the web preview honest.
    if (Platform.OS === 'web') { if ((globalThis as any).confirm?.(`Remove ${pr.name} from your programs?`)) doIt(); return; }
    Alert.alert(`Remove ${pr.name}?`, 'It comes off your Programs list. You can add it back any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      <View onLayout={coursework ? undefined : e => onFadeEnd?.(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
        <NextClass pr={pr} />
      </View>

      {coursework && (
        <View onLayout={e => onFadeEnd?.(e.nativeEvent.layout.y)} style={{ flexDirection: 'row', gap: 22, marginTop: 16, borderBottomWidth: 1, borderBottomColor: c.line2 }}>
          <TabBtn label="Homework" on={tab === 'homework'} color={pr.color} onPress={() => setTab('homework')}
            badge={open.length ? (
              <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: pr.color, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ fontSize: 11.5, fontWeight: '800', color: on }, tnum]}>{open.length}</Text>
              </View>
            ) : undefined}
          />
          <TabBtn label="Grades" on={tab === 'grades'} color={pr.color} onPress={() => setTab('grades')}
            badge={mark ? <Text style={[{ fontSize: 14, fontWeight: '800', color: pr.color }, tnum]}>{mark.value}%</Text> : undefined}
          />
          <TabBtn label="About" on={tab === 'about'} color={pr.color} onPress={() => setTab('about')} />
        </View>
      )}

      {coursework && tab === 'homework' && (
        <View style={{ marginTop: 6 }}>
          {homework.map(h => (
            <View key={h.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.line2 }}>
              {/* Only the tick completes it, same as the Homework page. */}
              <Pressable onPress={() => hw.toggle(h.id, todayIso)} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: h.done }} accessibilityLabel={`Done: ${h.title}`} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: h.done ? pr.color : c.ink4, backgroundColor: h.done ? pr.color : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {h.done && <Check size={12} color={on} width={3.5} />}
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: h.done ? c.ink4 : c.ink, letterSpacing: -0.2, lineHeight: 20, textDecorationLine: h.done ? 'line-through' : 'none' }}>{h.title}</Text>
                <Text style={[{ fontSize: 13, fontWeight: '700', marginTop: 2, color: h.done ? c.ink4 : dueColor(h.due, todayIso, h.priority, c) }, tnum]}>
                  {dueLabel(h.due, todayIso)}{h.time ? <Text style={{ fontWeight: '500', color: c.ink3 }}>{`  ${fmt12(h.time, true)}`}</Text> : null}
                </Text>
              </View>
              {h.own && (
                <Pressable onPress={() => hw.remove(h.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${h.title}`}>
                  <Icon name="close" size={14} stroke={2} color={c.ink4} />
                </Pressable>
              )}
            </View>
          ))}
          <AddHomework accent={pr.color} todayIso={todayIso} empty={!homework.length} onAdd={(title, due) => hw.add(pr.name, title, due)} />
          <TextLink label="Open the Homework page" onPress={() => onNavigate('homework')} />
        </View>
      )}

      {coursework && tab === 'grades' && <Grades pr={pr} />}

      {(!coursework || tab === 'about') && <About pr={pr} todayIso={todayIso} onNavigate={onNavigate} />}

      {(pr.kind === 'class' && onEditTimetable) || pr.removable ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 18 }}>
          {pr.kind === 'class' && onEditTimetable && (
            <Pressable onPress={onEditTimetable} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.ink3 }}>Edit timetable</Text>
            </Pressable>
          )}
          {pr.removable && (
            <Pressable onPress={remove} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.danger }}>Remove from my programs</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
};

// ── Next class ──────────────────────────────────────────────────
// "Tomorrow  10:00 – 11:20 AM" with the day bold and the time in the class
// colour, and the map as a plain link (no chip).
const NextClass = ({ pr }: { pr: Program }) => {
  const { c } = useTheme();
  const { offsetMs } = usePreviewTime();
  const nav = useNav();
  const sheet = useClassSheet();   // when shown in the class card, leave it for the map
  const slot = pr.slots[0];
  const next = slot ? nextOccurrence(slot, resolveNow(new Date(), offsetMs)) : null;
  const onMap = pr.room ? findTarget(pr.room) : null;
  if (!next && !onMap) return null;
  const day = next ? (next.today ? 'Today' : next.tomorrow ? 'Tomorrow' : `${DOW3[next.date.getDay()]} ${MONTH_NAMES[next.date.getMonth()].slice(0, 3)} ${next.date.getDate()}`) : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
      {next ? (
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: c.ink3 }}>Next class</Text>
          <Text style={{ marginTop: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: next.today ? pr.color : c.ink, letterSpacing: -0.4 }}>{day}</Text>
            <Text style={[{ fontSize: 15, fontWeight: '600', color: c.ink2 }, tnum]}>{`   ${fmt12(next.start)} – ${fmt12(next.end, true)}`}</Text>
          </Text>
        </View>
      ) : <View />}
      {!!onMap && (
        <Pressable onPress={() => { sheet.close(); nav.openMap({ to: onMap.id }); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Show on map" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 2, opacity: pressed ? 0.6 : 1 })}>
          <Icon name="compass" size={16} stroke={2} color={c.link} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.link }}>Map</Text>
        </Pressable>
      )}
    </View>
  );
};

const TabBtn = ({ label, on, color, badge, onPress }: { label: string; on: boolean; color: string; badge?: React.ReactNode; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={({ pressed }) => ({ paddingBottom: 9, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 22 }}>
        <Text style={{ fontSize: 15.5, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink3, letterSpacing: -0.3 }}>{label}</Text>
        {badge}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, borderRadius: 2, backgroundColor: on ? color : 'transparent' }} />
    </Pressable>
  );
};

// ── About ───────────────────────────────────────────────────────
const About = ({ pr, todayIso, onNavigate }: { pr: Program; todayIso: string; onNavigate: (t: TabId) => void }) => {
  const { c, mode } = useTheme();
  const info = courseInfo(pr.name);
  const news = programNews(pr);
  const school = programSchoolEvents(pr, todayIso).slice(0, 5);
  return (
    <View>
      <CourseText text={info.desc} color={pr.color} />
      {(!!info.fee || !!info.prereq) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
          {!!info.fee && <Fact label="Course fee" value={info.fee} />}
          {!!info.prereq && <Fact label="Prerequisite" value={info.prereq} />}
        </View>
      )}

      {school.length > 0 && (
        <Section title="Coming up" link="Calendar" onLink={() => onNavigate('calendar')}>
          {school.map(e => {
            const d = fromISO(e.iso);
            return (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
                <View style={{ width: 36, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: e.iso === todayIso ? pr.color : c.ink3 }}>{DOW3[d.getDay()]}</Text>
                  <Text style={[{ fontFamily: fonts.serif, fontSize: 22, lineHeight: 25, color: e.iso === todayIso ? pr.color : c.ink }, tnum]}>{d.getDate()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{e.title}</Text>
                  {!!e.time && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1 }}>{e.time}</Text>}
                </View>
              </View>
            );
          })}
        </Section>
      )}

      {news.length > 0 && (
        <Section title="Announcements" link="All" onLink={() => onNavigate('announcements')}>
          {news.map(n => (
            <View key={n.id} style={{ paddingVertical: 9 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: glow(tagColor(n.category, c), mode) }}>
                {n.category}<Text style={{ fontWeight: '500', color: c.ink4 }}>{`   ${n.time}`}</Text>
              </Text>
              <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.ink, marginTop: 3, letterSpacing: -0.3, lineHeight: 20 }}>{n.title}</Text>
              <Text numberOfLines={2} style={{ fontSize: 13.5, color: c.ink2, marginTop: 3, lineHeight: 19 }}>{n.preview}</Text>
            </View>
          ))}
        </Section>
      )}
    </View>
  );
};

// Course-book text: "Big Ideas:" lines become small headings, "• " lines
// become bullets in the program colour. Long text folds after a few lines.
const CourseText = ({ text, color }: { text: string; color: string }) => {
  const { c } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const FOLD = 4;
  const long = lines.length > FOLD + 1 || text.length > 420;
  const shown = expanded || !long ? lines : lines.slice(0, FOLD);
  return (
    <View style={{ marginTop: 14 }}>
      {shown.map((l, i) => {
        if (/:$/.test(l) && l.length < 40) {
          return <Text key={i} style={{ fontSize: 14, fontWeight: '800', color: c.ink, letterSpacing: -0.2, marginTop: i ? 10 : 0, marginBottom: 4 }}>{l.replace(/:$/, '')}</Text>;
        }
        if (/^[•\-–]\s*/.test(l)) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 8 }} />
              <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: c.ink2 }}>{l.replace(/^[•\-–]\s*/, '')}</Text>
            </View>
          );
        }
        return <Text key={i} numberOfLines={!expanded && long && shown.length === 1 ? 4 : undefined} style={{ fontSize: 14.5, lineHeight: 21, color: c.ink2, marginTop: i ? 8 : 0 }}>{l}</Text>;
      })}
      {long && (
        <Pressable onPress={() => setExpanded(v => !v)} hitSlop={8} style={{ marginTop: 6, alignSelf: 'flex-start' }} accessibilityRole="button">
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.link }}>{expanded ? 'Show less' : 'Read more'}</Text>
        </Pressable>
      )}
    </View>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ maxWidth: '100%' }}>
      <Text style={{ fontSize: 12, fontWeight: '500', color: c.ink3 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: c.ink, marginTop: 1 }}>{value}</Text>
    </View>
  );
};

const Section = ({ title, link, onLink, children }: { title: string; link?: string; onLink?: () => void; children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{title}</Text>
        {!!link && <Pressable onPress={onLink} hitSlop={8}><Text style={{ fontSize: 13.5, fontWeight: '600', color: c.link }}>{link}</Text></Pressable>}
      </View>
      {children}
    </View>
  );
};

const TextLink = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 8, marginTop: 4, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>{label}</Text>
      <Icon name="chev-r" size={14} stroke={2} color={c.link} />
    </Pressable>
  );
};

// ── Grades ──────────────────────────────────────────────────────
// The mark that matters right now: the final once it's in, otherwise the term average.
const currentMark = (g: Partial<Record<Term, string>>) => {
  const final = Number(g.Final);
  if (g.Final && final > 0) return { label: 'Final', value: final };
  const avg = termAverage(g);
  return avg === null ? null : { label: 'Average', value: avg };
};
const letterFor = (n: number) => n >= 86 ? 'A' : n >= 73 ? 'B' : n >= 67 ? 'C+' : n >= 60 ? 'C' : n >= 50 ? 'C−' : 'F';

const Grades = ({ pr }: { pr: Program }) => {
  const { c, mode } = useTheme();
  const { gradesFor, setGrade } = useGrades();
  const g = gradesFor(pr.name);
  const mark = currentMark(g);
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text style={[{ fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, letterSpacing: -1, color: mark ? pr.color : c.ink4 }, tnum]}>
          {mark ? `${mark.value}%` : '—'}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink3 }}>
          {mark ? `${mark.label} · ${letterFor(mark.value)}` : 'No marks yet'}
        </Text>
      </View>
      <View style={{ marginTop: 10 }}>
        {TERMS.map((t, i) => {
          const v = g[t] || '';
          const n = Number(v);
          const tone = !v ? c.ink4 : glow(n >= 86 ? c.moss : n >= 73 ? c.navy700 : n >= 60 ? c.gold : c.crimson, mode);
          return (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: t === 'Final' ? '800' : '500', color: c.ink }}>{t}</Text>
              {!!v && <Text style={{ fontSize: 13, fontWeight: '800', color: tone }}>{letterFor(n)}</Text>}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: c.paper2, paddingHorizontal: 10 }}>
                <TextInput
                  value={v}
                  onChangeText={x => setGrade(pr.name, t, x)}
                  placeholder="—"
                  placeholderTextColor={c.ink4}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  style={[{ width: 46, textAlign: 'right', fontSize: 16, fontWeight: '700', color: tone, paddingVertical: 7 }, tnum]}
                  accessibilityLabel={`${t} mark`}
                />
                <Text style={{ fontSize: 13, color: c.ink4, marginLeft: 2 }}>%</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 12.5, color: c.ink4, marginTop: 10, lineHeight: 17 }}>
        Marks stay on this phone. MyEdBC is still the official record.
      </Text>
    </View>
  );
};

// ── Add homework (inline) ───────────────────────────────────────
const addDays = (iso: string, n: number) => { const d = fromISO(iso); return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };

const AddHomework = ({ accent, todayIso, empty, onAdd }: { accent: string; todayIso: string; empty: boolean; onAdd: (title: string, due: string) => void }) => {
  const { c, mode } = useTheme();
  const on = onGlow(mode);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState(1);
  const choices: [number, string][] = [[0, 'Today'], [1, 'Tomorrow'], [2, 'In 2 days'], [7, 'Next week']];
  const submit = () => {
    if (!title.trim()) return;
    onAdd(title, addDays(todayIso, days));
    setTitle(''); setDays(1); setOpen(false);
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Add homework" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={14} stroke={2.6} color={on} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>Add homework</Text>
        {empty && <Text style={{ flex: 1, textAlign: 'right', fontSize: 13, color: c.ink4 }}>Nothing posted yet</Text>}
      </Pressable>
    );
  }
  return (
    <View style={{ paddingVertical: 12, gap: 10 }}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="What is due?"
        placeholderTextColor={c.ink4}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        style={{ fontSize: 15, color: c.ink, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.paper2 }}
        accessibilityLabel="Homework title"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {choices.map(([n, label]) => {
          const sel = days === n;
          return (
            <Pressable key={n} onPress={() => setDays(n)} accessibilityRole="button" accessibilityState={{ selected: sel }} style={({ pressed }) => ({
              height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center',
              backgroundColor: sel ? accent : c.paper2, opacity: pressed ? 0.6 : 1,
            })}>
              <Text style={{ fontSize: 13.5, fontWeight: sel ? '700' : '500', color: sel ? on : c.ink2 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable onPress={() => { setOpen(false); setTitle(''); }} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: c.ink3 }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={submit} disabled={!title.trim()} accessibilityRole="button" style={({ pressed }) => ({ flex: 2, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.action, opacity: !title.trim() ? 0.4 : pressed ? 0.8 : 1 })}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#fff' }}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ── bits ─────────────────────────────────────────────────────────
const dueLabel = (iso: string, todayIso: string) => {
  if (iso === todayIso) return 'Today';
  const d = fromISO(iso), t = fromISO(todayIso);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `Late · ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return `${DOW3[d.getDay()]} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};
const dueColor = (iso: string, todayIso: string, priority: string, c: ReturnType<typeof useTheme>['c']) =>
  iso < todayIso || priority === 'high' ? c.danger : iso === todayIso ? c.gold : c.ink3;
