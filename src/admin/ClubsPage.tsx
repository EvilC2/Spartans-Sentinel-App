// Spartans — App Club → Clubs & programs, for staff (Owner, President,
// Teacher Sponsor and teachers; migration 0021). Three parts:
//   Clubs          Sentinel's real club list. Students see it first in
//                  Programs → Add programs, with the blurb, when it meets, the
//                  room and the sponsor teacher. Hidden clubs stay here.
//   Who runs what  any program (a club, a team, even a class) and the people
//                  who run it. Managers get "Post an announcement" on that
//                  program's page; staff can post to every program.
//   Teachers       top roles only: who has the teacher role, adding one
//                  (find them, or a one-use invite code).
// Data and offline / demo fallbacks live in src/clubs.ts; the teacher list
// reuses the Members page's people store. The server checks every write.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../ThemeContext';
import { fonts } from '../theme';
import { ask } from '../confirm';
import type { Role } from '../backend';
import { isTop } from '../ranks';
import { KIND_ONE, classifyName, matchPrograms } from '../programs';
import { subjectImage } from '../programIcons';
import {
  CLUB_KINDS, Club, FoundPerson, Manager, builtInClubs, clubLine, matchClubs, newClub, programKey,
  useClubs, useProgramManagers,
} from '../clubs';
import { usePeople } from './Members';
import { Act, Card, ChipPick, ClubSheet, Empty, Field, FieldLabel, FoundLine, Group, Hint, PeopleFinder, PersonRow, Row, Search, Seg } from './ui';
import { usePeopleSearch } from './search';

type Tab = 'clubs' | 'managers' | 'teachers';

export const ClubsPrograms = ({ roles }: { roles: Role[] }) => {
  const [tab, setTab] = useState<Tab>('clubs');
  const top = isTop(roles);
  const { all } = useClubs();
  return (
    <View style={{ gap: 14 }}>
      <Seg value={tab} onChange={setTab} options={[
        { id: 'clubs', label: 'Clubs', count: all.length },
        { id: 'managers', label: 'Who runs what' },
        ...(top ? [{ id: 'teachers' as Tab, label: 'Teachers' }] : []),
      ]} />
      {tab === 'clubs' && <ClubList />}
      {tab === 'managers' && <Managers />}
      {tab === 'teachers' && top && <Teachers />}
    </View>
  );
};

// ── Clubs ───────────────────────────────────────────────────────
const ClubList = () => {
  const { c } = useTheme();
  const k = useClubs();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Club | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const shown = matchClubs(q, k.all);

  // Empty list: one tap adds the clubs, bands and extracurriculars the app already knows.
  const startFromBuiltIn = async () => {
    setBusy(true); setErr(null);
    try { for (const x of builtInClubs()) await k.save({ ...x, id: '' }); }
    catch (e: any) { setErr(String(e?.message || 'Could not add them all.')); }
    finally { setBusy(false); }
  };

  return (
    <>
      {!!k.note && <Hint text={k.note} warn />}
      {!!err && <Hint text={err} warn />}
      <Act label="Add a club" icon="plus" fill onPress={() => setEditing(newClub())} />
      {k.all.length > 6 && <Search value={q} onChange={setQ} placeholder="Search clubs" />}
      {!k.loaded ? (
        <Text style={{ fontSize: 13, color: c.ink3 }}>Loading…</Text>
      ) : k.all.length === 0 ? (
        <>
          <Empty title="No clubs yet" sub="Add Sentinel's clubs so students find them first in Programs → Add programs." />
          <Act label={busy ? 'Adding…' : "Start from the app's built-in list"} icon="tasks" tone="soft" fill disabled={busy} onPress={startFromBuiltIn} />
        </>
      ) : shown.length === 0 ? (
        <>
          <FoundLine n={0} q={q} onClear={() => setQ('')} />
          <Empty icon="search" title="No club matches" sub="Try part of its name, or its sponsor." />
        </>
      ) : (
        <>
        {!!q.trim() && <FoundLine n={shown.length} q={q} onClear={() => setQ('')} />}
        <Group footer="Students see these first in Programs → Add programs. Hidden ones stay here for staff only.">
          {shown.map(x => (
            <Row key={x.id} art={subjectImage(x.name, x.kind)} label={x.name}
              sub={[KIND_ONE[x.kind], clubLine(x)].filter(Boolean).join(' · ')}
              detail={x.active ? undefined : 'Hidden'} onPress={() => setEditing(x)} />
          ))}
        </Group>
        </>
      )}
      <ClubEditor club={editing} onClose={() => setEditing(null)} onSave={k.save} onDelete={k.remove} />
    </>
  );
};

const ClubEditor = ({ club, onClose, onSave, onDelete }: {
  club: Club | null; onClose: () => void; onSave: (x: Club) => Promise<Club>; onDelete: (id: string) => Promise<void>;
}) => {
  const { c } = useTheme();
  const [d, setD] = useState<Club>(newClub());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (club) { setD(club); setErr(null); } }, [club]);
  const set = (patch: Partial<Club>) => setD(x => ({ ...x, ...patch }));

  const save = async () => {
    setBusy(true); setErr(null);
    try { await onSave(d); onClose(); }
    catch (e: any) { setErr(String(e?.message || 'Could not save.')); }
    finally { setBusy(false); }
  };
  const del = async () => {
    if (!await ask(`Delete ${d.name}?`, 'It comes off the club list. Students who already added it keep it in their programs. To take it off the list for now, hide it instead.', 'Delete', true)) return;
    setBusy(true);
    try { await onDelete(d.id); onClose(); }
    catch (e: any) { setErr(String(e?.message || 'Could not delete.')); }
    finally { setBusy(false); }
  };

  return (
    <ClubSheet visible={!!club} onClose={onClose} title={d.id ? 'Edit club' : 'New club'} sub="What students see in Add programs"
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {!!d.id && <Act label="Delete" icon="trash" tone="danger" onPress={del} disabled={busy} />}
          <Act label={d.id ? 'Save' : 'Add club'} fill onPress={save} busy={busy} disabled={d.name.trim().length < 2} />
        </View>
      }>
      <Field label="Name" value={d.name} onChangeText={v => set({ name: v })} placeholder="Robotics Club" maxLength={80} autoCapitalize="words" />
      <View style={{ gap: 6 }}>
        <FieldLabel text="Kind" />
        <ChipPick multi={false} value={[d.kind]} onToggle={k => set({ kind: k })}
          options={CLUB_KINDS.map(k => ({ id: k, label: KIND_ONE[k] }))} />
      </View>
      <Field label="What it is" value={d.blurb} onChangeText={v => set({ blurb: v })} placeholder="One or two lines a student would want to know" multiline maxLength={2000} />
      <Field label="When it meets" value={d.meets} onChangeText={v => set({ meets: v })} placeholder="Tuesdays at lunch" maxLength={120} />
      <Field label="Room" value={d.room} onChangeText={v => set({ room: v })} placeholder="Room 214" maxLength={60} />
      <Field label="Sponsor teacher" value={d.sponsor} onChangeText={v => set({ sponsor: v })} placeholder="The teacher who runs it" maxLength={120} autoCapitalize="words" />
      <Field label="Google Classroom code" value={d.gc} onChangeText={v => set({ gc: v.trim() })} placeholder="abc1234" maxLength={20} autoCapitalize="none" autoCorrect={false} />
      <View style={{ gap: 6 }}>
        <FieldLabel text="Students" />
        <Seg value={d.active ? 'on' : 'off'} onChange={v => set({ active: v === 'on' })}
          options={[{ id: 'on', label: 'Shown' }, { id: 'off', label: 'Hidden' }]} />
      </View>
      {!!d.id && <Hint text="Renaming a club doesn't rename it for students who already added it, and its posts and managers stay with the old name." />}
      {!!err && <Hint text={err} warn />}
    </ClubSheet>
  );
};

// ── Who runs what ───────────────────────────────────────────────
const Managers = () => {
  const { c } = useTheme();
  const m = useProgramManagers();
  const { all } = useClubs();
  const [q, setQ] = useState('');
  const [program, setProgram] = useState<string | null>(null);

  // One row per program that has managers.
  const groups = useMemo(() => {
    const out = new Map<string, { name: string; people: Manager[] }>();
    for (const x of m.list || []) {
      const g = out.get(x.key) || { name: x.program, people: [] };
      g.people.push(x);
      out.set(x.key, g);
    }
    return [...out.entries()].map(([key, g]) => ({ key, ...g })).sort((a, b) => a.name.localeCompare(b.name));
  }, [m.list]);

  // Programs to pick from: the club list, then the built-in catalog. Exactly
  // what was typed is offered on its own line, for a program in neither.
  const picks = useMemo(() => {
    const s = q.trim();
    if (s.length < 2) return [];
    const seen = new Set<string>();
    return [...matchClubs(s, all).map(x => x.name), ...matchPrograms(s).map(e => e.name)]
      .filter(n => { const k = programKey(n); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  }, [q, all]);

  const typed = q.trim();
  const custom = typed.length >= 2 && !picks.some(n => programKey(n) === programKey(typed)) ? typed : null;
  const searching = !!typed;

  const countFor = (name: string) => groups.find(g => g.key === programKey(name))?.people.length || 0;

  return (
    <>
      <Hint text="Managers post announcements on their program's page in Programs. Staff can post to any program." />
      {!!m.note && <Hint text={m.note} warn />}
      <Search value={q} onChange={setQ} placeholder="Search clubs, teams and classes" />
      {searching && typed.length < 2 && <Text style={{ fontSize: 13.5, color: c.ink3, paddingHorizontal: 4 }}>Keep typing…</Text>}
      {searching && (picks.length > 0 || custom) && (
        <Group>
          {picks.map(n => {
            const k = countFor(n);
            return <Row key={n} art={subjectImage(n, classifyName(n))} label={n} sub={k ? `${k} running it` : 'Nobody runs it yet'} onPress={() => { setProgram(n); setQ(''); }} />;
          })}
          {custom && <Row key="custom" icon="plus" label={`Use “${custom}”`} sub="Not on the list? Use the name students typed." onPress={() => { setProgram(custom); setQ(''); }} />}
        </Group>
      )}
      {m.list === null || searching ? null : groups.length ? (
        <Group title="Programs with managers">
          {groups.map(g => (
            <Row key={g.key} art={subjectImage(g.name, classifyName(g.name))} label={g.name}
              sub={g.people.map(p => p.name).join(', ')} onPress={() => setProgram(g.name)} />
          ))}
        </Group>
      ) : (
        <Empty title="Nobody runs a program yet" sub="Find a program above, then add the students or teachers who run it." />
      )}
      <ManagerSheet program={program} onClose={() => setProgram(null)} m={m} />
    </>
  );
};

const ManagerSheet = ({ program, onClose, m }: { program: string | null; onClose: () => void; m: ReturnType<typeof useProgramManagers> }) => {
  const key = program ? programKey(program) : '';
  const people = (m.list || []).filter(x => x.key === key);
  const who = usePeopleSearch<FoundPerson>(m.find);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { who.clear(); setErr(null); }, [program]);   // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await f(); } catch (e: any) { setErr(String(e?.message || 'That did not work.')); } finally { setBusy(false); }
  };
  const remove = async (p: Manager) => {
    if (await ask(`Remove ${p.name}?`, `They can't post to ${p.program} any more. Their posts stay up.`, 'Remove', true)) run(() => m.remove(p));
  };

  return (
    <ClubSheet visible={!!program} onClose={onClose} title={program || ''} sub="Who runs it">
      <PeopleFinder s={who} action={p => {
        const has = people.some(x => x.userId === p.id);
        return <Act small tone={has ? 'plain' : 'soft'} label={has ? 'Added' : 'Add'} disabled={busy || has} onPress={() => run(async () => { await m.add(program!, p); who.clear(); })} />;
      }} />
      {people.length > 0 ? (
        <Group title="Managers">
          {people.map(p => (
            <PersonRow key={p.userId} person={p.name} sub={p.email}
              trailing={<Act small tone="danger" label="Remove" disabled={busy} onPress={() => remove(p)} />} />
          ))}
        </Group>
      ) : <Empty icon="users" title="Nobody runs it yet" sub="Find someone above to make them a manager." />}
      {!!err && <Hint text={err} warn />}
      <Hint text="They see “Post an announcement” on this program's page once it's in their Programs." />
    </ClubSheet>
  );
};

// ── Teachers (top roles) ────────────────────────────────────────
const Teachers = () => {
  const { c } = useTheme();
  const t = usePeople();
  const teachers = (t.people || []).filter(p => p.roles.includes('teacher'));
  const who = usePeopleSearch(t.find);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await f(); } catch (e: any) { setErr(String(e?.message || 'That did not work.')); } finally { setBusy(false); }
  };
  const invite = () => run(async () => {
    if (!t.live) throw new Error('Invite codes need the server.');
    const { admin } = await import('../backend');
    setCode(await admin.createInvite('teacher', 14));
  });

  return (
    <>
      <Hint icon="grad" text="Teachers keep the club list, pick who runs each program, and can post to any program. They don't get App Club jobs." />
      {!!t.err && <Hint text={t.err} warn />}
      <PeopleFinder s={who} placeholder="Find a teacher by name or email" none="Nobody found. If they don't have Spartans yet, make an invite code below."
        action={p => {
          const has = teachers.some(x => x.id === p.id);
          return <Act small tone={has ? 'plain' : 'soft'} label={has ? 'Teacher' : 'Add'} disabled={busy || has} onPress={() => run(async () => { await t.add(p, ['teacher']); who.clear(); })} />;
        }} />
      {teachers.length > 0 ? (
        <Group title="Teachers">
          {teachers.map(p => (
            <PersonRow key={p.id} person={p.name} sub={p.email}
              trailing={p.me ? undefined : <Act small tone="danger" label="Remove" disabled={busy}
                onPress={async () => { if (await ask(`Remove ${p.name} as a teacher?`, 'They keep their account and any other roles.', 'Remove', true)) run(() => t.set(p, 'teacher', false)); }} />} />
          ))}
        </Group>
      ) : <Empty icon="grad" title="No teachers yet" sub="Find one above, or make an invite code." />}
      <Group title="Not on Spartans yet?">
        <Row icon="mail" label="Make an invite code" sub="One use, for 14 days. They enter it in App Club." onPress={invite} />
      </Group>
      {!!code && (
        <Card>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.ink3 }}>Teacher invite code</Text>
          <Text selectable style={{ fontFamily: fonts.serif, fontSize: 30, letterSpacing: 2, color: c.ink }}>{code}</Text>
          <Act label="Copy" icon="copy" tone="soft" small onPress={() => { Clipboard.setStringAsync(code).catch(() => {}); }} />
        </Card>
      )}
      {!!err && <Hint text={err} warn />}
    </>
  );
};
