// Spartans — App Club Admin → Feedback: what students send from Help &
// feedback, worked through like an inbox.
//   New → In progress → Done, with a team note on each one.
//   Counts up top (tap to filter), the mix of likes / fixes / ideas /
//   confusing, search, and filters by kind and part of the app.
// Members move feedback along and write notes; the Feedback manager (and
// top ranks) can also delete. Server rules: migrations 0013 and 0017.
// Every piece says who it came from: a student, a teacher, or an App Club
// member (with their role). `source` splits the two jobs:
//   app   Digital: sent from Help & feedback in the app
//   real  Real: heard in person and logged by hand (FeedbackLog.tsx)
// Demo mode has sample feedback so the inbox can be tried.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { shadow, tnum } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { useContent } from '../content';
import { ask } from '../confirm';
import { FEEDBACK_KINDS } from '../settings';
import type { FeedbackFrom, FeedbackKind, FeedbackRow, FeedbackStatus } from '../backend';
import { roleLabel } from '../ranks';
import { fieldStyle } from '../screens/Settings';

const STATUSES: { id: FeedbackStatus; label: string; icon: IconName }[] = [
  { id: 'new', label: 'New', icon: 'bell' },
  { id: 'doing', label: 'In progress', icon: 'clock' },
  { id: 'done', label: 'Done', icon: 'check-circle' },
];
const statusOf = (f: FeedbackRow): FeedbackStatus => f.status || 'new';
const sourceOf = (f: FeedbackRow) => f.source || 'app';

export const FROM: Record<FeedbackFrom, { label: string; icon: IconName }> = {
  student: { label: 'Student', icon: 'me' },
  teacher: { label: 'Teacher', icon: 'grad' },
  club: { label: 'App Club', icon: 'shield' },
};
// "Student", "Teacher", "App Club · Polls".
export const fromLabel = (f: Pick<FeedbackRow, 'from_type' | 'from_role'>) => {
  const t = f.from_type || 'student';
  if (t !== 'club') return FROM[t].label;
  return f.from_role ? `App Club · ${roleLabel(f.from_role as any)}` : 'App Club';
};

const DEMO_KEY = 'spartans-feedback-demo-v2';
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const DEMO: FeedbackRow[] = [
  { id: 'd1', user_id: null, area: 'Map', kind: 'fix', message: 'The route to the theatre goes through the gym, but the gym doors are locked after lunch.', platform: 'ios', app_version: '1.0.0', created_at: hoursAgo(3), status: 'new', from_type: 'student' },
  { id: 'd2', user_id: null, area: 'The Buzz', kind: 'like', message: 'The trivia is actually fun. More Sentinel history ones please!', platform: 'ios', app_version: '1.0.0', created_at: hoursAgo(7), status: 'new', from_type: 'student' },
  { id: 'd3', user_id: null, area: 'Cafeteria', kind: 'idea', message: 'Show which specials are vegetarian right on the card.', platform: 'android', app_version: '1.0.0', created_at: hoursAgo(26), status: 'doing', note: 'Menu tags exist already, need to show them on The Buzz card.', from_type: 'student' },
  { id: 'd4', user_id: null, area: 'Calendar', kind: 'confusing', message: "I couldn't tell if tomorrow was Day 1 or Day 2.", platform: 'ios', app_version: '1.0.0', created_at: hoursAgo(30), status: 'new', from_type: 'student' },
  { id: 'd5', user_id: null, area: 'Badges & levels', kind: 'idea', message: 'Badge for helping at the food drive?', platform: 'ios', app_version: '1.0.0', created_at: hoursAgo(50), status: 'done', note: 'Sent to the Badges team.', from_type: 'student' },
  { id: 'd6', user_id: null, area: 'Homework', kind: 'fix', message: 'Due dates jump a day when I set them late at night.', platform: 'android', app_version: '1.0.0', created_at: hoursAgo(72), status: 'doing', from_type: 'student' },
  { id: 'd7', user_id: null, area: 'Home', kind: 'like', message: '', platform: 'ios', app_version: '1.0.0', created_at: hoursAgo(96), status: 'done', from_type: 'student' },
  { id: 'd8', user_id: null, area: 'Sign up & sign in', kind: 'confusing', message: 'It asked for my student number twice.', platform: 'ios', app_version: '1.0.0', created_at: hoursAgo(120), status: 'new', from_type: 'teacher' },
  { id: 'd9', user_id: null, area: 'The Buzz', kind: 'idea', message: 'Let us schedule a poll for the morning announcements.', platform: 'ios', app_version: '1.0.0', created_at: hoursAgo(9), status: 'new', from_type: 'club', from_role: 'polls' },
  { id: 'r1', user_id: null, area: 'Cafeteria', kind: 'fix', message: 'Said the poutine price in the app is old. It went up to $6.50.', platform: null, app_version: null, created_at: hoursAgo(5), status: 'new', source: 'real', from_type: 'student', heard_at: 'Lunch line', said_by: 'Grade 10 student', logged_by_name: 'Ella Tran' },
  { id: 'r2', user_id: null, area: 'Calendar', kind: 'like', message: 'Uses the Day 1 / Day 2 card every morning instead of the board.', platform: null, app_version: null, created_at: hoursAgo(28), status: 'done', source: 'real', from_type: 'teacher', heard_at: 'In class', said_by: 'Mr. Grant', logged_by_name: 'Ella Tran' },
];

// ── Data ──
export const useFeedbackInbox = () => {
  const { mode } = useContent();
  const live = mode !== 'demo';
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    if (!live) {
      try { const v = await AsyncStorage.getItem(DEMO_KEY); setRows(v ? JSON.parse(v) : DEMO); } catch { setRows(DEMO); }
      return;
    }
    try { const { feedback } = await import('../backend'); setRows(await feedback.list()); }
    catch (e: any) { setErr(String(e?.message || 'Could not load feedback.')); }
  }, [live]);
  useEffect(() => { load(); }, [load]);

  const keep = (next: FeedbackRow[]) => {
    setRows(next);
    if (!live) AsyncStorage.setItem(DEMO_KEY, JSON.stringify(next)).catch(() => {});
  };

  const update = async (f: FeedbackRow, patch: { status?: FeedbackStatus; note?: string | null }) => {
    if (live) {
      try {
        const { feedback } = await import('../backend');
        const out = await feedback.update(f.id, patch);
        keep((rows || []).map(x => (x.id === f.id ? { ...x, ...out } : x)));
      } catch (e: any) {
        throw new Error(/status|note|column/i.test(String(e?.message)) ? 'Statuses and notes need migration 0013 on the server.' : String(e?.message || 'Could not save.'));
      }
      return;
    }
    keep((rows || []).map(x => (x.id === f.id ? { ...x, ...patch, updated_at: new Date().toISOString() } : x)));
  };

  const remove = async (f: FeedbackRow) => {
    if (live) { const { feedback } = await import('../backend'); await feedback.remove(f.id); }
    keep((rows || []).filter(x => x.id !== f.id));
  };

  // Real: log something heard in person.
  const log = async (f: { area: string; kind: FeedbackKind; message: string; from_type: FeedbackFrom; from_role?: string | null; heard_at?: string | null; said_by?: string | null }, by: string) => {
    if (live) {
      try {
        const { feedback } = await import('../backend');
        const row = await feedback.log(f);
        keep([row, ...(rows || [])]);
      } catch (e: any) {
        throw new Error(/log_feedback|does not exist|schema cache/i.test(String(e?.message)) ? 'Logging needs migration 0017 on the server.' : String(e?.message || 'Could not log it.'));
      }
      return;
    }
    const row: FeedbackRow = { id: `r${Date.now()}`, user_id: null, platform: null, app_version: null, created_at: new Date().toISOString(), status: 'new', source: 'real', logged_by_name: by, ...f };
    keep([row, ...(rows || [])]);
  };

  return { rows, err, load, update, remove, log, live };
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 10080 ? `${Math.round(m / 1440)}d ago` : new Date(iso).toLocaleDateString();
};

// ════════════════════════════════════════════════════════════════
export const FeedbackTeam = ({ canDelete, source = 'app', inbox: given }: { canDelete: boolean; source?: 'app' | 'real'; inbox?: ReturnType<typeof useFeedbackInbox> }) => {
  const { c } = useTheme();
  const own = useFeedbackInbox();
  const inbox = given || own;
  const [from, setFrom] = useState<FeedbackFrom | 'all'>('all');
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('new');
  const [kind, setKind] = useState<FeedbackKind | 'all'>('all');
  const [area, setArea] = useState<string | 'all'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<FeedbackRow | null>(null);

  const tone = useKindTone();
  const rows = (inbox.rows || []).filter(r => sourceOf(r) === source);
  const areas = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(r.area, (n.get(r.area) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  }, [rows]);
  const shown = useMemo(() => rows
    .filter(r => status === 'all' || statusOf(r) === status)
    .filter(r => kind === 'all' || r.kind === kind)
    .filter(r => area === 'all' || r.area === area)
    .filter(r => from === 'all' || (r.from_type || 'student') === from)
    .filter(r => !q.trim() || `${r.message} ${r.area} ${r.note || ''}`.toLowerCase().includes(q.trim().toLowerCase())),
  [rows, status, kind, area, q, from]);
  const byStatus = (s: FeedbackStatus) => rows.filter(r => statusOf(r) === s).length;
  const byKind = (k: FeedbackKind) => rows.filter(r => r.kind === k).length;

  return (
    <>
      {!inbox.live && source === 'app' && <Hint text="Demo mode: sample feedback so you can try the inbox. Real feedback comes from the server." />}
      {!!inbox.err && <Text style={{ fontSize: 13, color: c.crimson }}>{inbox.err}</Text>}

      {/* Where things stand */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {STATUSES.map(s => {
          const on = status === s.id;
          return (
            <Pressable key={s.id} onPress={() => setStatus(on ? 'all' : s.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => [{ flex: 1, padding: 12, borderRadius: 18, gap: 4, backgroundColor: on ? c.navy700 : c.surface, opacity: pressed ? 0.85 : 1 }, on ? shadow.md : shadow.sm]}>
              <Icon name={s.icon} size={16} stroke={2} color={on ? '#fff' : c.navy700} />
              <Text style={[{ fontSize: 24, fontWeight: '700', color: on ? '#fff' : c.ink, letterSpacing: -0.5 }, tnum]}>{byStatus(s.id)}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: on ? 'rgba(255,255,255,0.85)' : c.ink3 }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* The mix */}
      {rows.length > 0 && (
        <View style={[{ padding: 14, borderRadius: 18, backgroundColor: c.surface, gap: 10 }, shadow.sm]}>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
            {FEEDBACK_KINDS.map(k => byKind(k.id) > 0 && <View key={k.id} style={{ flex: byKind(k.id), backgroundColor: tone[k.id].fg }} />)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {FEEDBACK_KINDS.map(k => {
              const on = kind === k.id;
              return (
                <Pressable key={k.id} onPress={() => setKind(on ? 'all' : k.id)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? tone[k.id].fg : tone[k.id].bg }}>
                  <Icon name={k.icon} size={13} stroke={2} color={on ? '#fff' : tone[k.id].fg} />
                  <Text style={[{ fontSize: 12.5, fontWeight: '700', color: on ? '#fff' : tone[k.id].fg }, tnum]}>{k.label} {byKind(k.id)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Search + area */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: c.surface }}>
        <Icon name="search" size={16} stroke={2} color={c.ink4} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search feedback and notes" placeholderTextColor={c.ink4} autoCorrect={false}
          style={{ flex: 1, paddingVertical: 11, fontSize: 15.5, color: c.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}) }} />
        {!!q && <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search"><Icon name="close" size={15} stroke={2} color={c.ink4} /></Pressable>}
        <Pressable onPress={inbox.load} hitSlop={8} accessibilityLabel="Refresh"><Icon name="swap" size={15} stroke={2} color={c.ink3} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {(['all', 'student', 'teacher', 'club'] as const).map(f => {
          const on = from === f;
          const n = f === 'all' ? rows.length : rows.filter(r => (r.from_type || 'student') === f).length;
          return (
            <Pressable key={f} onPress={() => setFrom(f)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => ({ flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, backgroundColor: on ? c.navy700 : c.surface, borderWidth: on ? 0 : 1, borderColor: c.line, opacity: pressed ? 0.8 : 1 })}>
              {f !== 'all' && <Icon name={FROM[f].icon} size={13} stroke={2.2} color={on ? '#fff' : c.ink3} />}
              <Text numberOfLines={1} style={[{ fontSize: 12.5, fontWeight: '700', color: on ? '#fff' : c.ink2 }, tnum]}>{f === 'all' ? `All ${n}` : `${n}`}</Text>
            </Pressable>
          );
        })}
      </View>
      {areas.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {['all', ...areas].map(a => {
            const on = area === a;
            return (
              <Pressable key={a} onPress={() => setArea(a)} style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? c.navy700 : c.paper2 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{a === 'all' ? 'Every part of the app' : a}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* The list */}
      {inbox.rows === null && !inbox.err && <Text style={{ fontSize: 13, color: c.ink3 }}>Loading…</Text>}
      {inbox.rows !== null && shown.length === 0 && (
        <View style={{ alignItems: 'center', gap: 6, paddingVertical: 18 }}>
          <Icon name="check-circle" size={24} stroke={1.8} color={c.moss} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink2 }}>{status === 'new' && kind === 'all' && area === 'all' && !q ? 'All caught up' : 'Nothing matches'}</Text>
        </View>
      )}
      <View style={{ gap: 10 }}>
        {shown.map(f => <FeedbackCard key={f.id} f={f} onPress={() => setOpen(f)} />)}
      </View>

      <FeedbackSheet f={open} canDelete={canDelete} onClose={() => setOpen(null)}
        onUpdate={async (f, patch) => { await inbox.update(f, patch); setOpen(o => (o && o.id === f.id ? { ...o, ...patch } : o)); }}
        onDelete={async f => { await inbox.remove(f); setOpen(null); }} />
    </>
  );
};

const useKindTone = () => {
  const { c } = useTheme();
  return {
    like: { fg: c.moss, bg: c.mossTint },
    fix: { fg: c.crimson, bg: c.crimsonTint },
    idea: { fg: c.sky600, bg: c.skyTint },
    confusing: { fg: c.gold, bg: c.goldTint },
  } as Record<FeedbackKind, { fg: string; bg: string }>;
};

const FeedbackCard = ({ f, onPress }: { f: FeedbackRow; onPress: () => void }) => {
  const { c } = useTheme();
  const tone = useKindTone()[f.kind];
  const k = FEEDBACK_KINDS.find(x => x.id === f.kind)!;
  const st = STATUSES.find(s => s.id === statusOf(f))!;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${k.label} about ${f.area}. ${st.label}`}
      style={({ pressed }) => [{ padding: 14, borderRadius: 18, backgroundColor: c.surface, gap: 8, opacity: pressed ? 0.85 : 1 }, shadow.sm]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={k.icon} size={15} stroke={2} color={tone.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: c.ink }}>{k.label} <Text style={{ fontWeight: '500', color: c.ink3 }}>· {f.area}</Text></Text>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: c.ink4 }}>{[fromLabel(f), f.said_by, f.heard_at, ago(f.created_at)].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: statusOf(f) === 'done' ? c.mossTint : statusOf(f) === 'doing' ? c.skyTint : c.paper2 }}>
          <Icon name={st.icon} size={11} stroke={2.2} color={statusOf(f) === 'done' ? c.moss : statusOf(f) === 'doing' ? c.sky600 : c.ink3} />
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: statusOf(f) === 'done' ? c.moss : statusOf(f) === 'doing' ? c.sky600 : c.ink3 }}>{st.label}</Text>
        </View>
      </View>
      {f.message ? (
        <Text numberOfLines={3} style={{ fontSize: 14, color: c.ink2, lineHeight: 19 }}>{f.message}</Text>
      ) : (
        <Text style={{ fontSize: 13.5, color: c.ink4, fontStyle: 'italic' }}>No message</Text>
      )}
      {!!f.note && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <Icon name="edit" size={12} stroke={2} color={c.ink4} style={{ marginTop: 2 }} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, color: c.ink3 }}>{f.note}</Text>
        </View>
      )}
    </Pressable>
  );
};

// One piece of feedback: the whole message, where it came from, its status
// and the team's note.
const FeedbackSheet = ({ f, canDelete, onClose, onUpdate, onDelete }: {
  f: FeedbackRow | null; canDelete: boolean; onClose: () => void;
  onUpdate: (f: FeedbackRow, patch: { status?: FeedbackStatus; note?: string | null }) => Promise<void>;
  onDelete: (f: FeedbackRow) => Promise<void>;
}) => {
  const { c } = useTheme();
  const tones = useKindTone();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setNote(f?.note || ''); setErr(null); setSaved(false); }, [f?.id]);
  if (!f) return null;
  const k = FEEDBACK_KINDS.find(x => x.id === f.kind)!;
  const tone = tones[f.kind];

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    try { await fn(); } catch (e: any) { setErr(String(e?.message || 'Could not save.')); }
  };
  const saveNote = () => run(async () => { await onUpdate(f, { note: note.trim() || null }); setSaved(true); setTimeout(() => setSaved(false), 1400); });
  const del = async () => {
    if (!(await ask('Delete this feedback?', 'It is removed for the whole feedback team.', 'Delete', true))) return;
    run(() => onDelete(f));
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <View style={{ backgroundColor: tone.bg, paddingTop: 10, paddingBottom: 18, paddingHorizontal: 20 }}>
          <View style={{ alignItems: 'center', paddingBottom: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tone.fg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={k.icon} size={21} stroke={2} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: c.ink, letterSpacing: -0.4 }}>{k.label}</Text>
              <Text style={{ fontSize: 13, color: c.ink3 }}>{f.area} · {ago(f.created_at)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close"
              style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Icon name="close" size={15} stroke={2} color={c.ink2} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
          <Text selectable style={{ fontSize: 17, color: f.message ? c.ink : c.ink4, lineHeight: 24, fontStyle: f.message ? 'normal' : 'italic' }}>{f.message || 'They just tapped "I like this".'}</Text>
          <Text style={[{ fontSize: 12, color: c.ink4 }, tnum]}>
            {[fromLabel(f), f.said_by, f.heard_at ? `heard: ${f.heard_at}` : null, f.logged_by_name ? `logged by ${f.logged_by_name}` : null, new Date(f.created_at).toLocaleString(), f.platform, f.app_version ? `v${f.app_version}` : null].filter(Boolean).join(' · ')}
          </Text>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.ink3, letterSpacing: 0.8, textTransform: 'uppercase' }}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {STATUSES.map(s => {
                const on = statusOf(f) === s.id;
                return (
                  <Pressable key={s.id} onPress={() => !on && run(() => onUpdate(f, { status: s.id }))} accessibilityRole="radio" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 5, paddingVertical: 11, borderRadius: 16, backgroundColor: on ? c.navy700 : c.surface, opacity: pressed ? 0.8 : 1 }, on ? shadow.md : shadow.sm]}>
                    <Icon name={s.icon} size={17} stroke={2} color={on ? '#fff' : c.navy700} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#fff' : c.ink }}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.ink3, letterSpacing: 0.8, textTransform: 'uppercase' }}>Team note</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="Who's on it, what you found, what you changed…" placeholderTextColor={c.ink4}
              multiline style={[fieldStyle(c), { minHeight: 90, textAlignVertical: 'top', borderWidth: 0 }]} />
            <Pressable onPress={saveNote} disabled={note.trim() === (f.note || '')} accessibilityRole="button"
              style={({ pressed }) => ({ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: c.navy700, opacity: note.trim() === (f.note || '') ? 0.4 : pressed ? 0.7 : 1 })}>
              <Icon name="check" size={13} stroke={2.4} color="#fff" />
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#fff' }}>{saved ? 'Saved' : 'Save note'}</Text>
            </Pressable>
            <Text style={{ fontSize: 12, color: c.ink4 }}>Only the feedback team sees notes.</Text>
          </View>

          {!!err && <Text style={{ fontSize: 13.5, color: c.crimson }}>{err}</Text>}

          {canDelete && (
            <Pressable onPress={del} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: c.crimsonTint, opacity: pressed ? 0.7 : 1 })}>
              <Icon name="trash" size={14} stroke={2} color={c.crimson} />
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.crimson }}>Delete</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const Hint = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, backgroundColor: c.skyTint }}>
      <Icon name="sparkle" size={16} stroke={1.9} color={c.sky600} />
      <Text style={{ flex: 1, fontSize: 12.5, color: c.ink2, lineHeight: 17 }}>{text}</Text>
    </View>
  );
};
