// Spartans — App Club Admin → Feedback: what students send from Help &
// feedback, worked through like an inbox.
//   New → In progress → Done, with a team note on each one.
//   One row of states with counts, search (looks through every state), and
//   a Filter button that opens kind / who from / part of the app.
// Members move feedback along and write notes; the Feedback manager (and
// top ranks) can also delete. Server rules: migrations 0013 and 0017.
// Every piece says who it came from: a student, a teacher, or an App Club
// member (with their role). `source` splits the two jobs:
//   app   Digital: sent from Help & feedback in the app
//   real  Real: heard in person and logged by hand (FeedbackLog.tsx)
// Demo mode has sample feedback so the inbox can be tried.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { useContent } from '../content';
import { ask } from '../confirm';
import { FEEDBACK_KINDS } from '../settings';
import type { FeedbackFrom, FeedbackKind, FeedbackRow, FeedbackStatus } from '../backend';
import { roleLabel } from '../ranks';
import { Act, Card, ChipPick, ClubSheet, Empty, Field, FieldLabel, FoundLine, Hint, Pill, Search, Seg, ago } from './ui';
import { matches } from './search';

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

  const [filters, setFilters] = useState(false);

  const searching = !!q.trim();
  const rows = (inbox.rows || []).filter(r => sourceOf(r) === source);
  const areas = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(r.area, (n.get(r.area) || 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  }, [rows]);
  const shown = useMemo(() => rows
    // Searching looks through every state, not just the one you were on.
    .filter(r => searching || status === 'all' || statusOf(r) === status)
    .filter(r => kind === 'all' || r.kind === kind)
    .filter(r => area === 'all' || r.area === area)
    .filter(r => from === 'all' || (r.from_type || 'student') === from)
    .filter(r => matches(q, r.message, r.area, r.note, r.said_by, r.heard_at, fromLabel(r))),
  [rows, status, kind, area, q, from]);
  const byStatus = (s: FeedbackStatus) => rows.filter(r => statusOf(r) === s).length;
  const filtersOn = [kind !== 'all', from !== 'all', area !== 'all'].filter(Boolean).length;
  const clearFilters = () => { setKind('all'); setFrom('all'); setArea('all'); };

  return (
    <>
      {!inbox.live && source === 'app' && <Hint text="Demo: sample feedback, so you can try the inbox." />}
      {!!inbox.err && <Hint text={inbox.err} warn />}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Search value={q} onChange={setQ} placeholder="Search feedback" /></View>
        <Pressable onPress={() => setFilters(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: filters }} accessibilityLabel={filtersOn ? `Filter, ${filtersOn} on` : 'Filter'}
          style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', backgroundColor: filtersOn ? c.navy50 : c.surface, borderWidth: 1, borderColor: filters ? c.link : c.line, opacity: pressed ? 0.7 : 1 })}>
          <Text style={[{ fontSize: 15, fontWeight: '600', color: filtersOn ? c.link : c.ink2 }, tnum]}>Filter{filtersOn ? ` ${filtersOn}` : ''}</Text>
        </Pressable>
      </View>

      {filters && (
        <Card>
          <View style={{ gap: 8 }}>
            <FieldLabel text="Kind" />
            <ChipPick multi={false} value={kind === 'all' ? [] : [kind]} onToggle={k => setKind(kind === k ? 'all' : k)} options={FEEDBACK_KINDS.map(k => ({ id: k.id, label: k.label, icon: k.icon }))} />
          </View>
          <View style={{ gap: 8 }}>
            <FieldLabel text="From" />
            <ChipPick multi={false} value={from === 'all' ? [] : [from]} onToggle={f => setFrom(from === f ? 'all' : f)} options={(Object.keys(FROM) as FeedbackFrom[]).map(f => ({ id: f, label: FROM[f].label, icon: FROM[f].icon }))} />
          </View>
          {areas.length > 1 && (
            <View style={{ gap: 8 }}>
              <FieldLabel text="Part of the app" />
              <ChipPick multi={false} value={area === 'all' ? [] : [area]} onToggle={a => setArea(area === a ? 'all' : a)} options={areas.map(a => ({ id: a, label: a }))} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Act label="Clear" tone="plain" fill disabled={!filtersOn} onPress={clearFilters} /></View>
            <View style={{ flex: 1 }}><Act label={`Show ${shown.length}`} fill onPress={() => setFilters(false)} /></View>
          </View>
        </Card>
      )}

      {searching ? <FoundLine n={shown.length} q={q} onClear={() => setQ('')} /> : (
        <Seg value={status} onChange={setStatus} options={[
          ...STATUSES.map(s => ({ id: s.id as FeedbackStatus | 'all', label: s.label, count: byStatus(s.id) })),
          { id: 'all' as const, label: 'All', count: rows.length },
        ]} />
      )}

      {/* The list */}
      {inbox.rows === null && !inbox.err && <Text style={{ fontSize: 14, color: c.ink3, paddingHorizontal: 4 }}>Loading…</Text>}
      {!!inbox.err && <Act label="Try again" icon="swap" tone="soft" onPress={inbox.load} />}
      {inbox.rows !== null && shown.length === 0 && (
        searching || filtersOn ? <Empty icon="search" title="Nothing matches" sub={filtersOn ? 'Try clearing the filters.' : 'Try another word.'} />
          : <Empty title={status === 'new' ? 'All caught up' : 'Nothing here'} />
      )}
      <View style={{ gap: 10 }}>
        {shown.map(f => <FeedbackCard key={f.id} f={f} showStatus={searching || status === 'all'} onPress={() => setOpen(f)} />)}
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

const FeedbackCard = ({ f, showStatus, onPress }: { f: FeedbackRow; showStatus: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  const tone = useKindTone()[f.kind];
  const k = FEEDBACK_KINDS.find(x => x.id === f.kind)!;
  const st = STATUSES.find(s => s.id === statusOf(f))!;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${k.label} about ${f.area}. ${st.label}. ${f.message || 'No message'}`}
      style={({ pressed }) => ({ padding: 16, borderRadius: 18, backgroundColor: pressed ? c.paper2 : c.surface, gap: 8, borderWidth: 1, borderColor: c.line2 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={k.icon} size={16} stroke={2.1} color={tone.fg} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.ink2 }}>{k.label} <Text style={{ fontWeight: '400', color: c.ink3 }}>· {f.area}</Text></Text>
        {showStatus && <Pill text={st.label} tone={statusOf(f) === 'done' ? 'moss' : statusOf(f) === 'doing' ? 'sky' : 'ink'} />}
      </View>
      <Text numberOfLines={3} style={{ fontSize: 15.5, color: f.message ? c.ink : c.ink3, lineHeight: 21 }}>{f.message || 'No message'}</Text>
      <Text numberOfLines={1} style={[{ fontSize: 13, color: c.ink3 }, tnum]}>{[fromLabel(f), f.said_by, f.heard_at, ago(f.created_at)].filter(Boolean).join(' · ')}</Text>
      {!!f.note && <Text numberOfLines={2} style={{ fontSize: 13.5, color: c.ink2, lineHeight: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line2 }}><Text style={{ fontWeight: '600' }}>Note: </Text>{f.note}</Text>}
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
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setNote(f?.note || ''); setErr(null); setSaved(false); }, [f?.id]);
  if (!f) return null;
  const k = FEEDBACK_KINDS.find(x => x.id === f.kind)!;

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
    <ClubSheet visible onClose={onClose} title={k.label} sub={`${f.area} · ${ago(f.created_at)}`}>
      <Text selectable style={{ fontSize: 17, color: f.message ? c.ink : c.ink3, lineHeight: 25 }}>{f.message || 'They just tapped "I like this".'}</Text>
      <Text style={[{ fontSize: 13, color: c.ink3, lineHeight: 18 }, tnum]}>
        {[fromLabel(f), f.said_by, f.heard_at ? `heard: ${f.heard_at}` : null, f.logged_by_name ? `logged by ${f.logged_by_name}` : null, new Date(f.created_at).toLocaleString(), f.platform, f.app_version ? `v${f.app_version}` : null].filter(Boolean).join(' · ')}
      </Text>

      <View style={{ gap: 8 }}>
        <FieldLabel text="Status" />
        <ChipPick multi={false} value={[statusOf(f)]} options={STATUSES} onToggle={s => { if (s !== statusOf(f)) run(() => onUpdate(f, { status: s })); }} />
      </View>

      <View style={{ gap: 8 }}>
        <Field label="Team note" value={note} onChangeText={setNote} placeholder="Who's on it, what you found, what you changed" multiline />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ flex: 1, fontSize: 13, color: c.ink3 }}>Only the feedback team sees notes.</Text>
          <Act label={saved ? 'Saved' : 'Save note'} icon={saved ? 'check' : undefined} small onPress={saveNote} disabled={note.trim() === (f.note || '')} />
        </View>
      </View>

      {!!err && <Hint text={err} warn />}
      {canDelete && <Act label="Delete" icon="trash" tone="danger" onPress={del} />}
    </ClubSheet>
  );
};
