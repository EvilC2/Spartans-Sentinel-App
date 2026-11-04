// Spartans — App Club: who is in the club and what they do.
//   Members({ scope: team })  a team's Members page, for its Manager.
//   Members({ scope: 'all' }) People & invites, for the Owner, President and
//                             Teacher Sponsor: everyone, every team.
// People show grouped by team; tap someone to switch their roles on or off
// (grouped by team too). "Invite" picks a role from the teams list first,
// then either finds someone already on Spartans or makes a one-use code for
// someone who isn't yet.
// Rules (src/ranks.ts, enforced again by the server in 0013 / 0017):
//   Top ranks  change anything, including other top roles.
//   Managers   add and remove the jobs in their own team, never managers.
//   The server keeps at least one Owner. Teacher Sponsor is for teachers.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { Icon } from '../components/Icon';
import { useProfile, fullName } from '../ProfileContext';
import { ask } from '../confirm';
import { useContent } from '../content';
import type { Role } from '../backend';
import {
  TEAMS, TEAM_ORDER, TOP, TeamId, ALL_ROLES, canAssign, isTop, isLead, jobOf, roleLabel, roleArt, teamOf,
} from '../ranks';
import { Toggle } from '../screens/Settings';
import { Act, Card, CardHead, ClubSheet, Field, Hint, Pill, Search, Seg, toneOf } from './ui';

export type Person = { id: string; name: string; email: string; grade?: number; roles: Role[]; since?: string; by?: string | null; me?: boolean; teacher?: boolean };
type Found = { id: string; name: string; email: string; grade?: number; teacher?: boolean };

const DEMO_KEY = 'spartans-team-demo-v3';
const DEMO_TEAM: Person[] = [
  { id: 'demo-noor', name: 'Noor Ahmed', email: 'noora310@edu.sd45.bc.ca', grade: 12, roles: ['president'] },
  { id: 'demo-rivera', name: 'Ms. Rivera', email: 'mrivera@wvschools.ca', roles: ['sponsor'], teacher: true },
  { id: 'demo-theo', name: 'Theo Park', email: 'theop227@edu.sd45.bc.ca', grade: 12, roles: ['lead_developer', 'dev_backend'] },
  { id: 'demo-mia', name: 'Mia Santos', email: 'mias415@edu.sd45.bc.ca', grade: 11, roles: ['dev_apple'] },
  { id: 'demo-raj', name: 'Raj Gill', email: 'rajg118@edu.sd45.bc.ca', grade: 11, roles: ['dev_android', 'dev_seasonal'] },
  { id: 'demo-kai', name: 'Kai Moreno', email: 'kaim118@edu.sd45.bc.ca', grade: 9, roles: ['dev_innovator', 'badges'] },
  { id: 'demo-priya', name: 'Priya Nair', email: 'priyan204@edu.sd45.bc.ca', grade: 11, roles: ['lead_maintenance', 'marketing'] },
  { id: 'demo-sam', name: 'Sam Okafor', email: 'samo311@edu.sd45.bc.ca', grade: 11, roles: ['trivia', 'polls'] },
  { id: 'demo-lila', name: 'Lila Moore', email: 'lilam522@edu.sd45.bc.ca', grade: 10, roles: ['facts', 'popups'] },
  { id: 'demo-leo', name: 'Leo Marchetti', email: 'leom502@edu.sd45.bc.ca', grade: 12, roles: ['menu', 'news'] },
  { id: 'demo-ava', name: 'Ava Lindqvist', email: 'aval227@edu.sd45.bc.ca', grade: 10, roles: ['lead_badges'] },
  { id: 'demo-zoe', name: 'Zoe Kim', email: 'zoek604@edu.sd45.bc.ca', grade: 9, roles: ['badge_award', 'badge_qr'] },
  { id: 'demo-owen', name: 'Owen Fraser', email: 'owenf733@edu.sd45.bc.ca', grade: 10, roles: ['badge_list'] },
  { id: 'demo-jo', name: 'Jo Whitfield', email: 'jow640@edu.sd45.bc.ca', grade: 12, roles: ['lead_feedback', 'feedback'] },
  { id: 'demo-ella', name: 'Ella Tran', email: 'ellat281@edu.sd45.bc.ca', grade: 11, roles: ['feedback_real', 'stuco'] },
  { id: 'demo-ben', name: 'Ben Liu', email: 'benl390@edu.sd45.bc.ca', grade: 12, roles: ['hr'] },
];
const DEMO_DIRECTORY: Found[] = [
  { id: 'demo-maya', name: 'Maya Chen', email: 'mayac118@edu.sd45.bc.ca', grade: 10 },
  { id: 'demo-noah', name: 'Noah Patel', email: 'noahp442@edu.sd45.bc.ca', grade: 11 },
  { id: 'demo-grant', name: 'Mr. Grant', email: 'dgrant@wvschools.ca', teacher: true },
];
// Teachers have wvschools.ca addresses; students have edu.sd45.bc.ca.
const isTeacherEmail = (e: string) => /@wvschools\.ca$/i.test(e.trim());

// ── Data: server in live mode, this phone in demo ──
export const usePeople = () => {
  const { mode, roles: myRoles } = useContent();
  const { profile } = useProfile();
  const live = mode !== 'demo';
  const [people, setPeople] = useState<Person[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const me: Person = { id: 'me', name: `${fullName(profile!) || 'You'}`, email: profile?.email || '', grade: profile?.grade, roles: myRoles, me: true };

  const load = useCallback(async () => {
    setErr(null);
    if (!live) {
      try {
        const v = await AsyncStorage.getItem(DEMO_KEY);
        setPeople([me, ...(v ? JSON.parse(v) : DEMO_TEAM)]);
      } catch { setPeople([me, ...DEMO_TEAM]); }
      return;
    }
    try {
      const { team, auth } = await import('../backend');
      const [rows, myId] = await Promise.all([team.list(), auth.userId()]);
      const byUser = new Map<string, Person>();
      for (const r of rows) {
        const p = byUser.get(r.user_id) || { id: r.user_id, name: `${r.first_name} ${r.last_name}`.trim() || r.email, email: r.email, grade: r.grade, roles: [], since: r.granted_at, by: r.granted_by_name, me: r.user_id === myId, teacher: isTeacherEmail(r.email) };
        p.roles.push(r.role);
        if (r.granted_at < (p.since || '')) p.since = r.granted_at;
        byUser.set(r.user_id, p);
      }
      setPeople([...byUser.values()].sort((a, b) => Number(!!b.me) - Number(!!a.me) || a.name.localeCompare(b.name)));
    } catch (e: any) {
      setErr(/team_list|not find|does not exist/i.test(String(e?.message)) ? 'The people list needs migrations 0016 and 0017 on the server.' : String(e?.message || 'Could not load the club.'));
    }
  }, [live, profile?.email, myRoles.join()]);
  useEffect(() => { load(); }, [load]);

  const saveDemo = (list: Person[]) => {
    setPeople(list);
    AsyncStorage.setItem(DEMO_KEY, JSON.stringify(list.filter(p => !p.me))).catch(() => {});
  };

  const set = async (p: Person, role: Role, on: boolean) => {
    if (!live) {
      if (p.me) throw new Error('Use "View as" (top right) to try other roles in demo mode.');
      saveDemo((people || []).map(x => x.id === p.id ? { ...x, roles: on ? [...new Set([...x.roles, role])] : x.roles.filter(r => r !== role) } : x)
        .filter(x => x.me || x.roles.length));
      return;
    }
    const { team } = await import('../backend');
    await team.set(p.id, role, on);
    await load();
  };

  const add = async (f: Found, roles: Role[]) => {
    if (!live) {
      const had = (people || []).find(x => x.id === f.id);
      saveDemo([...(people || []).filter(x => x.id !== f.id), { ...f, ...had, roles: [...new Set([...(had?.roles || []), ...roles])] }]);
      return;
    }
    const { team } = await import('../backend');
    for (const r of roles) await team.set(f.id, r, true);
    await load();
  };

  const find = async (q: string): Promise<Found[]> => {
    if (!live) {
      const s = q.trim().toLowerCase();
      return [...DEMO_DIRECTORY, ...(people || []).filter(p => !p.me)].filter(f => (f.name + f.email).toLowerCase().includes(s));
    }
    const { team } = await import('../backend');
    return (await team.find(q)).map(r => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim(), email: r.email, grade: r.grade, teacher: isTeacherEmail(r.email) }));
  };

  return { people, err, load, set, add, find, live, myRoles };
};

const initialsOf = (name: string) => name.replace(/^(Mr|Ms|Mrs|Mx|Dr)\.?\s+/i, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const inTeam = (p: Person, t: TeamId) => p.roles.some(r => teamOf(r) === t);
const topOf = (p: Person) => (['president', 'sponsor', 'owner'] as Role[]).find(r => p.roles.includes(r));
const topLabel = (p: Person) => {
  const r = topOf(p);
  return r === 'owner' ? 'Owns the app' : r ? roleLabel(r) : '';
};

// What someone does on one team, in a few words.
const summaryIn = (p: Person, t: TeamId) => {
  const rs = p.roles.filter(r => teamOf(r) === t);
  const lead = TEAMS[t].lead;
  if (lead && rs.includes(lead)) {
    const jobs = rs.filter(r => r !== lead).map(roleLabel);
    return ['Manager', ...jobs].join(', ');
  }
  return rs.map(roleLabel).join(', ');
};

// ════════════════════════════════════════════════════════════════
export const Members = ({ scope }: { scope: TeamId | 'all' }) => {
  const { c } = useTheme();
  const t = usePeople();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Person | null>(null);
  const [inviting, setInviting] = useState(false);
  const [group, setGroup] = useState<'teams' | 'az'>('teams');
  const teams = scope === 'all' ? TEAM_ORDER : [scope];
  const s = q.trim().toLowerCase();
  const people = (t.people || []).filter(p => !s || `${p.name} ${p.email} ${p.roles.map(roleLabel).join(' ')}`.toLowerCase().includes(s));
  const tops = people.filter(p => !!topOf(p));
  const lead = scope === 'all' ? null : TEAMS[scope].lead;
  const managers = lead ? (t.people || []).filter(p => p.roles.includes(lead)) : [];
  const canInvite = ALL_ROLES.some(r => (scope === 'all' || r.team === scope) && canAssign(t.myRoles, r.role));
  const total = (t.people || []).filter(p => scope === 'all' ? p.roles.length : inTeam(p, scope)).length;

  // Keep the open sheet in step with changes.
  useEffect(() => { if (open && t.people) setOpen(t.people.find(p => p.id === open.id) || null); }, [t.people]);

  return (
    <View style={{ gap: 14 }}>
      {!!t.err && <Hint text={t.err} warn />}
      {!t.live && <Hint text="Demo: sample club members. Changes stay on this phone." />}

      <Card>
        <CardHead icon="users" tone={scope === 'all' ? 'gold' : TEAMS[scope].tone} title={scope === 'all' ? `${total} in the club` : `${total} on ${TEAMS[scope].label}`}
          sub={scope === 'all' ? 'Tap anyone to change what they do.' : managers.length ? `Managed by ${managers.map(m => m.me ? 'you' : m.name.split(' ')[0]).join(' and ')}.` : 'No manager yet.'} />
        {canInvite && <Act label="Invite someone" icon="plus" fill onPress={() => setInviting(true)} />}
      </Card>

      <Search value={q} onChange={setQ} placeholder="Search names, emails or roles" />
      {scope === 'all' && <Seg value={group} onChange={setGroup} options={[{ id: 'teams', label: 'By team' }, { id: 'az', label: 'A to Z' }]} />}
      {t.people === null && !t.err && <Text style={{ fontSize: 13, color: c.ink3 }}>Loading…</Text>}

      {t.people && scope === 'all' && group === 'az' && (
        <PeopleCard title="Everyone" people={people.filter(p => p.roles.length)} line={p => topOf(p) ? topLabel(p) : TEAM_ORDER.filter(tm => inTeam(p, tm)).map(tm => `${TEAMS[tm].label}: ${summaryIn(p, tm)}`).join(' · ')} onOpen={setOpen} />
      )}
      {t.people && (scope !== 'all' || group === 'teams') && (
        <>
          {scope === 'all' && tops.length > 0 && <PeopleCard title="Top" sub="President and Teacher Sponsor" tone="gold" people={tops} line={topLabel} onOpen={setOpen} />}
          {teams.map(tm => {
            const list = people.filter(p => inTeam(p, tm) && (scope === 'all' || !topOf(p)));
            if (!list.length && s) return null;
            return <PeopleCard key={tm} title={TEAMS[tm].label} art={TEAMS[tm].art} tone={TEAMS[tm].tone} people={list} line={p => summaryIn(p, tm)} onOpen={setOpen}
              empty={`Nobody on ${TEAMS[tm].label} yet.`} />;
          })}
        </>
      )}
      {scope !== 'all' && tops.length > 0 && !s && (
        <Text style={{ fontSize: 12.5, color: c.ink4, lineHeight: 17 }}>The President and Teacher Sponsor can do everything here too: {tops.map(o => o.me ? 'you' : o.name).join(', ')}.</Text>
      )}

      <PersonSheet p={open} scope={scope} myRoles={t.myRoles} onClose={() => setOpen(null)} onSet={t.set} />
      <InviteSheet visible={inviting} scope={scope} myRoles={t.myRoles} live={t.live} find={t.find} add={t.add} onClose={() => setInviting(false)} />
    </View>
  );
};

const PeopleCard = ({ title, sub, art, tone = 'navy', people, line, onOpen, empty }: {
  title: string; sub?: string; art?: any; tone?: any; people: Person[]; line: (p: Person) => string; onOpen: (p: Person) => void; empty?: string;
}) => {
  const { c, mode } = useTheme();
  const t = toneOf(c, mode, tone);
  return (
    <Card pad={14}>
      <CardHead art={art} icon="shield" tone={tone} title={title} sub={sub} trailing={<Pill text={String(people.length)} tone={tone} />} />
      {people.length === 0 ? (
        <Text style={{ fontSize: 13, color: c.ink4 }}>{empty || 'Nobody yet.'}</Text>
      ) : (
        <View>
          {people.map((p, i) => {
            const top = topOf(p);
            const isMgr = p.roles.some(isLead);
            return (
              <Pressable key={p.id} onPress={() => onOpen(p)} accessibilityRole="button" accessibilityLabel={`${p.name}. ${line(p)}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: top ? c.gold : isMgr ? t.ink : t.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: top || isMgr ? '#fff' : t.ink }}>{initialsOf(p.name)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>{p.name}{p.me ? ' (you)' : ''}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{line(p) || 'No roles'}</Text>
                </View>
                {p.teacher && <Pill text="Teacher" tone="ink" />}
                <Icon name="chev-r" size={15} stroke={2} color={c.ink4} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
};

// ── One person: their roles, team by team ──────────────────────
const PersonSheet = ({ p, scope, myRoles, onClose, onSet }: {
  p: Person | null; scope: TeamId | 'all'; myRoles: Role[]; onClose: () => void; onSet: (p: Person, r: Role, on: boolean) => Promise<void>;
}) => {
  const { c } = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setMsg(null); }, [p?.id]);
  if (!p) return null;
  const teams = scope === 'all' ? TEAM_ORDER : [scope];
  const who = p.me ? 'yourself' : p.name.split(' ')[0];

  const flip = async (role: Role, on: boolean) => {
    setMsg(null);
    if (TOP.includes(role) && !(await ask(on ? `Make ${who} ${roleLabel(role)}?` : `Take ${roleLabel(role)} away from ${who}?`,
      'The President and Teacher Sponsor run every team and choose who is on each one.', on ? 'Yes' : 'Take it away', !on))) return;
    if (isLead(role) && !(await ask(on ? `Make ${who} the ${roleLabel(role)}?` : `Remove ${who} as manager?`,
      on ? 'Managers run the whole team: every job, approvals, and who is on it.' : 'They keep any jobs they already had.', on ? 'Make manager' : 'Remove', !on))) return;
    if (role === 'sponsor' && on && !p.teacher && !(await ask(`${who} isn't a teacher account`, 'The Teacher Sponsor has to be a teacher. Give it anyway?', 'Give it anyway'))) return;
    try { await onSet(p, role, on); } catch (e: any) { setMsg(String(e?.message || 'Could not change that.')); }
  };
  const removeAll = async () => {
    const mine = p.roles.filter(r => canAssign(myRoles, r) && (scope === 'all' || teamOf(r) === scope));
    if (!mine.length || !(await ask(scope === 'all' ? `Take ${p.name} out of the club?` : `Take ${p.name} off ${TEAMS[scope].label}?`, 'They lose every role listed here.', 'Remove', true))) return;
    try { for (const r of mine) await onSet(p, r, false); onClose(); } catch (e: any) { setMsg(String(e?.message || 'Could not remove them.')); }
  };

  return (
    <ClubSheet visible onClose={onClose} title={p.name + (p.me ? ' (you)' : '')} tone="navy"
      sub={[p.teacher ? 'Teacher' : p.grade ? `Grade ${p.grade}` : null, p.email].filter(Boolean).join(' · ')}>
      {!!msg && <Hint text={msg} warn />}
      {(p.since || p.by) && (
        <Text style={[{ fontSize: 12.5, color: c.ink4 }, tnum]}>{[p.since ? `In the club since ${new Date(p.since).toLocaleDateString()}` : null, p.by ? `added by ${p.by}` : null].filter(Boolean).join(' · ')}</Text>
      )}
      {p.roles.includes('owner') && (
        <Text style={{ fontSize: 13.5, color: c.ink2 }}>{p.me ? 'You own' : 'Owns'} the app, so {p.me ? 'you see' : 'they see'} the President view. That isn't a role and can't be changed here.</Text>
      )}
      {scope === 'all' && (
        <RoleGroup title="Top" tone="gold">
          {(['president', 'sponsor'] as Role[]).map(r => (
            <RoleSwitch key={r} role={r} on={p.roles.includes(r)} disabled={!canAssign(myRoles, r)} onChange={v => flip(r, v)}
              note={r === 'sponsor' && !p.teacher ? 'Teachers only' : undefined} />
          ))}
        </RoleGroup>
      )}
      {teams.map(tm => {
        const team = TEAMS[tm];
        const top = !!topOf(p);
        const mgr = !!team.lead && p.roles.includes(team.lead);
        return (
          <RoleGroup key={tm} title={team.label} art={team.art} tone={team.tone}>
            {team.lead && (
              <RoleSwitch role={team.lead} on={top || mgr} disabled={top || !canAssign(myRoles, team.lead)}
                note={top ? 'Included with their top role' : !canAssign(myRoles, team.lead) ? 'Only a top role can change this' : undefined}
                onChange={v => flip(team.lead!, v)} />
            )}
            {team.jobs.filter(j => !TOP.includes(j.role)).map(j => {
              const via = top || mgr;
              return (
                <RoleSwitch key={j.role} role={j.role} on={via || p.roles.includes(j.role)} disabled={via || !canAssign(myRoles, j.role)}
                  note={via ? (top ? 'Included with their top role' : 'Included as manager') : j.teacher && !p.teacher ? 'Teachers only' : undefined}
                  onChange={v => flip(j.role, v)} />
              );
            })}
            {(team.legacy || []).filter(r => p.roles.includes(r)).map(r => (
              <RoleSwitch key={r} role={r} on disabled={!canAssign(myRoles, r)} note="Old role. Switch it off once they have a new one." onChange={v => flip(r, v)} />
            ))}
          </RoleGroup>
        );
      })}
      {!p.me && p.roles.some(r => canAssign(myRoles, r) && (scope === 'all' || teamOf(r) === scope)) && (
        <Act label={scope === 'all' ? 'Take out of the club' : `Take off ${TEAMS[scope].label}`} icon="trash" tone="danger" onPress={removeAll} />
      )}
    </ClubSheet>
  );
};

const RoleGroup = ({ title, art, tone, children }: { title: string; art?: any; tone: any; children: React.ReactNode }) => (
  <Card pad={14}>
    <CardHead art={art} icon="shield" tone={tone} title={title} />
    <View>{children}</View>
  </Card>
);

const RoleSwitch = ({ role, on, disabled, note, onChange }: { role: Role; on: boolean; disabled?: boolean; note?: string; onChange: (v: boolean) => void }) => {
  const { c } = useTheme();
  const job = jobOf(role);
  const sub = role === 'owner' ? 'Everything, every team' : isLead(role) ? 'Every job on the team, approvals, members' : job?.sub || '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.line2 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: c.ink }}>{isLead(role) ? 'Manager' : roleLabel(role)}</Text>
        <Text style={{ fontSize: 12, color: note ? c.ink4 : c.ink3, marginTop: 1, lineHeight: 16 }}>{note || sub}</Text>
      </View>
      <Toggle on={on} disabled={disabled} onChange={onChange} label={roleLabel(role)} />
    </View>
  );
};

// ── Invite: pick the role (by team), then the person or a code ──
export const RolePicker = ({ value, onPick, scope, myRoles }: { value: Role | null; onPick: (r: Role) => void; scope: TeamId | 'all'; myRoles: Role[] }) => {
  const { c, mode } = useTheme();
  const teams = scope === 'all' ? TEAM_ORDER : [scope];
  const [openTeam, setOpenTeam] = useState<TeamId | 'top' | null>(scope === 'all' ? (value ? teamOf(value) || 'top' : null) : scope);
  const tops = (['president', 'sponsor'] as Role[]).filter(r => scope === 'all' && canAssign(myRoles, r));
  const groups: { id: TeamId | 'top'; label: string; art: any; tone: any; roles: Role[] }[] = [
    ...(tops.length ? [{ id: 'top' as const, label: 'Top', art: roleArt('owner'), tone: 'gold', roles: tops }] : []),
    ...teams.map(tm => ({
      id: tm, label: TEAMS[tm].label, art: TEAMS[tm].art, tone: TEAMS[tm].tone,
      roles: [...(TEAMS[tm].lead ? [TEAMS[tm].lead!] : []), ...TEAMS[tm].jobs.map(j => j.role)].filter(r => !TOP.includes(r) && canAssign(myRoles, r)),
    })),
  ].filter(g => g.roles.length);

  return (
    <View style={{ gap: 10 }}>
      {groups.map(g => {
        const isOpen = openTeam === g.id;
        const t = toneOf(c, mode, g.tone);
        const picked = !!value && g.roles.includes(value);
        return (
          <View key={g.id} style={{ borderRadius: 20, backgroundColor: t.bg, overflow: 'hidden' }}>
            <Pressable onPress={() => setOpenTeam(isOpen ? null : g.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={g.art} style={{ width: 28, height: 28 }} resizeMode="contain" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: c.ink }}>{g.label}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3 }}>{picked ? roleLabel(value!) : `${g.roles.length} role${g.roles.length === 1 ? '' : 's'}`}</Text>
              </View>
              {picked && <Icon name="check-circle" size={18} stroke={2.2} color={t.ink} />}
              <Icon name={isOpen ? 'chev-d' : 'chev-r'} size={16} stroke={2.2} color={t.ink} />
            </Pressable>
            {isOpen && (
              <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
                {g.roles.map(r => {
                  const on = value === r;
                  const job = jobOf(r);
                  return (
                    <Pressable key={r} onPress={() => onPick(r)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: on ? t.ink : c.surface, opacity: pressed ? 0.8 : 1 })}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: '700', color: on ? t.on : c.ink }}>{isLead(r) ? 'Manager' : roleLabel(r)}</Text>
                        <Text style={{ fontSize: 12, color: on ? t.on : c.ink3, opacity: on ? 0.85 : 1, marginTop: 1, lineHeight: 16 }}>
                          {r === 'owner' ? 'Everything, every team' : isLead(r) ? `Runs ${TEAMS[teamOf(r)!].label}: every job, approvals, members` : job?.sub}
                        </Text>
                      </View>
                      {job?.teacher && <Pill text="Teachers" tone={on ? 'ink' : 'navy'} />}
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? t.on : c.line, alignItems: 'center', justifyContent: 'center' }}>
                        {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.on }} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const InviteSheet = ({ visible, scope, myRoles, live, find, add, onClose }: {
  visible: boolean; scope: TeamId | 'all'; myRoles: Role[]; live: boolean;
  find: (q: string) => Promise<Found[]>; add: (f: Found, roles: Role[]) => Promise<void>; onClose: () => void;
}) => {
  const { c } = useTheme();
  const [role, setRole] = useState<Role | null>(null);
  const [how, setHow] = useState<'find' | 'code'>('find');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setRole(null); setQ(''); setFound(null); setCode(null); setMsg(null); setHow('find'); } }, [visible]);
  const job = role ? jobOf(role) : undefined;

  const search = async () => {
    if (q.trim().length < 2) return;
    setMsg(null);
    try { setFound(await find(q)); } catch (e: any) { setMsg({ ok: false, text: String(e?.message || 'Search failed.') }); }
  };
  const give = async (f: Found) => {
    if (!role) return;
    if (job?.teacher && !f.teacher && !(await ask(`${f.name} isn't a teacher account`, 'The Teacher Sponsor has to be a teacher. Give it anyway?', 'Give it anyway'))) return;
    try {
      await add(f, [role]);
      setMsg({ ok: true, text: `${f.name} is now ${roleLabel(role)}${teamOf(role) && teamOf(role) !== 'executive' && !isLead(role) ? ` on ${TEAMS[teamOf(role)!].label}` : ''}.` });
      setFound(null); setQ('');
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || 'Could not add them.') }); }
  };
  const mint = async () => {
    if (!role || busy) return;
    setBusy(true); setMsg(null);
    try { const { admin } = await import('../backend'); setCode(await admin.createInvite(role)); }
    catch (e: any) { setMsg({ ok: false, text: String(e?.message || 'Could not make a code.') }); }
    finally { setBusy(false); }
  };

  return (
    <ClubSheet visible={visible} onClose={onClose} title="Invite someone" sub={scope === 'all' ? 'Pick the role first, then who' : `To ${TEAMS[scope].label}`} tone="gold" art={roleArt('owner')}>
      <StepLabel n={1} text="What will they do?" />
      <RolePicker value={role} onPick={r => { setRole(r); setCode(null); setMsg(null); }} scope={scope} myRoles={myRoles} />

      {role && (
        <>
          <StepLabel n={2} text={`Who is the new ${isLead(role) ? 'Manager' : roleLabel(role)}?`} />
          {job?.teacher && <Hint text="The Teacher Sponsor has to be a teacher (a wvschools.ca account)." icon="grad" />}
          <Seg value={how} onChange={v => { setHow(v); setMsg(null); }} options={[{ id: 'find', label: 'On Spartans already' }, { id: 'code', label: 'Not on Spartans yet' }]} />
          {how === 'find' ? (
            <Card pad={14}>
              <Field value={q} onChangeText={setQ} onSubmitEditing={search} placeholder="Name, school email or student number" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
              <Act label="Search" icon="search" tone="soft" fill onPress={search} disabled={q.trim().length < 2} />
              {found && found.length === 0 && <Text style={{ fontSize: 13, color: c.ink3, lineHeight: 18 }}>Nobody found. If they don't have Spartans yet, make an invite code instead.</Text>}
              {found && found.map(f => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line2 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>{f.name}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3 }}>{[f.teacher ? 'Teacher' : f.grade ? `Grade ${f.grade}` : null, f.email].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Act label="Add" icon="plus" small onPress={() => give(f)} />
                </View>
              ))}
            </Card>
          ) : (
            <Card pad={14}>
              <Text style={{ fontSize: 13.5, color: c.ink2, lineHeight: 19 }}>A one-use code for {roleLabel(role)}. It lasts 7 days. Send it to them privately; they enter it on the App Club page.</Text>
              {!live && <Hint text="Invite codes need the server. Demo mode can't make one." />}
              {code ? (
                <View style={{ alignItems: 'center', gap: 8, padding: 16, borderRadius: 16, backgroundColor: c.paper2 }}>
                  <Text selectable style={[{ fontSize: 30, fontWeight: '800', color: c.ink, letterSpacing: 4 }, tnum]}>{code}</Text>
                  <Act label="Copy code" icon="copy" small tone="soft" onPress={() => { Clipboard.setStringAsync(code).catch(() => {}); setMsg({ ok: true, text: 'Copied.' }); }} />
                </View>
              ) : (
                <Act label={busy ? 'Making…' : 'Make a code'} icon="mail" fill onPress={mint} disabled={busy || !live} />
              )}
            </Card>
          )}
        </>
      )}
      {msg && <Text style={{ fontSize: 14, fontWeight: '600', color: msg.ok ? c.moss : c.danger }}>{msg.text}</Text>}
    </ClubSheet>
  );
};

const StepLabel = ({ n, text }: { n: number; text: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.navy700, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: c.ink }}>{text}</Text>
    </View>
  );
};

