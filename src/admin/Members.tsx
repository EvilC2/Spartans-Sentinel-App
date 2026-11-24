// Spartans — App Club: who is in the club and what they do.
//   Members({ scope: team })  a team's Members page, for its Manager.
//   Members({ scope: 'all' }) People & invites, for the Owner, President and
//                             Teacher Sponsor: everyone, every team.
// People show grouped by team (search turns that into one list, best match
// first); tap someone to switch their roles on or off, a team at a time, with
// the teams they're on already open. "Invite" picks a role from the teams list first,
// then either finds someone already on Spartans or makes a one-use code for
// someone who isn't yet.
// Rules (src/ranks.ts, enforced again by the server in 0013 / 0017):
//   Top ranks  change anything, including other top roles.
//   Managers   add and remove the jobs in their own team, never managers.
//   The server keeps at least one Owner. Teacher Sponsor is for teachers.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { useProfile, fullName } from '../ProfileContext';
import { ask } from '../confirm';
import { useContent } from '../content';
import type { Role } from '../backend';
import {
  TEAMS, TEAM_ORDER, TOP, TeamId, ALL_ROLES, canAssign, clubRoles, isLead, jobOf, roleLabel, roleArt, teamOf,
} from '../ranks';
import { Toggle } from '../screens/Settings';
import { Act, Card, Choice, ClubSheet, Empty, Fold, FoundLine, Group, Hint, PeopleFinder, PersonRow, Result, Search, Seg, Step } from './ui';
import { byTitle, matches, usePeopleSearch } from './search';

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
      if (p.me) throw new Error('Use the eye (top right) to try other roles in demo mode.');
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
      return byTitle(q, [...DEMO_DIRECTORY, ...(people || []).filter(p => !p.me)].filter(f => matches(q, f.name, f.email)), f => f.name);
    }
    const { team } = await import('../backend');
    return (await team.find(q)).map(r => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim(), email: r.email, grade: r.grade, teacher: isTeacherEmail(r.email) }));
  };

  return { people, err, load, set, add, find, live, myRoles };
};

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

// Everything someone does, in one line.
const summaryAll = (p: Person) => topOf(p) ? topLabel(p)
  : TEAM_ORDER.filter(tm => inTeam(p, tm)).map(tm => (tm === 'executive' ? summaryIn(p, tm) : `${TEAMS[tm].label}: ${summaryIn(p, tm)}`)).join(' · ');

// ════════════════════════════════════════════════════════════════
export const Members = ({ scope }: { scope: TeamId | 'all' }) => {
  const { c } = useTheme();
  const t = usePeople();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Person | null>(null);
  const [inviting, setInviting] = useState(false);
  const [group, setGroup] = useState<'teams' | 'az'>('teams');
  const searching = !!q.trim();
  const everyone = (t.people || []).filter(p => scope === 'all' ? clubRoles(p.roles).length > 0 : inTeam(p, scope));
  const found = byTitle(q, everyone.filter(p => matches(q, p.name, p.email, summaryAll(p))), p => p.name);
  const tops = everyone.filter(p => !!topOf(p));
  const lead = scope === 'all' ? null : TEAMS[scope].lead;
  const managers = lead ? everyone.filter(p => p.roles.includes(lead)) : [];
  const canInvite = ALL_ROLES.some(r => (scope === 'all' || r.team === scope) && canAssign(t.myRoles, r.role));
  const az = [...everyone].sort((a, b) => a.name.localeCompare(b.name));

  // Keep the open sheet in step with changes.
  useEffect(() => { if (open && t.people) setOpen(t.people.find(p => p.id === open.id) || null); }, [t.people]);

  const person = (line: (p: Person) => string) => (p: Person) => (
    <PersonRow key={p.id} person={p.name + (p.me ? ' (you)' : '')} gold={!!topOf(p)} sub={[p.teacher && !topOf(p) ? 'Teacher' : null, line(p)].filter(Boolean).join(' · ') || 'No roles'} onPress={() => setOpen(p)} />
  );

  return (
    <View style={{ gap: 14 }}>
      {!!t.err && <Hint text={t.err} warn />}
      {canInvite && <Act label="Invite someone" icon="plus" fill onPress={() => setInviting(true)} />}
      <Search value={q} onChange={setQ} placeholder={scope === 'all' ? 'Search names and roles' : `Search ${TEAMS[scope].label}`} />

      {t.people === null && !t.err && <Text style={{ fontSize: 14, color: c.ink3, paddingHorizontal: 4 }}>Loading…</Text>}

      {t.people && searching && (
        <>
          <FoundLine n={found.length} q={q} onClear={() => setQ('')} />
          {found.length > 0
            ? <Group>{found.map(person(p => (scope === 'all' ? summaryAll(p) : summaryIn(p, scope))))}</Group>
            : <Empty icon="search" title="Nobody matches" sub="Try part of a name, or a role like Polls." />}
        </>
      )}

      {t.people && !searching && scope === 'all' && (
        <>
          <Seg value={group} onChange={setGroup} options={[{ id: 'teams', label: 'By team' }, { id: 'az', label: 'A to Z', count: everyone.length }]} />
          {group === 'az' ? (
            <Group>{az.map(person(summaryAll))}</Group>
          ) : (
            <View style={{ gap: 24, marginTop: 6 }}>
              {tops.length > 0 && <Group title="Running the club">{tops.map(person(topLabel))}</Group>}
              {TEAM_ORDER.map(tm => {
                const list = everyone.filter(p => inTeam(p, tm) && !topOf(p));
                return (
                  <Group key={tm} title={TEAMS[tm].label} note={String(list.length)}>
                    {list.length ? list.map(person(p => summaryIn(p, tm)))
                      : <Text style={{ fontSize: 14, color: c.ink3, padding: 16 }}>Nobody yet.</Text>}
                  </Group>
                );
              })}
            </View>
          )}
        </>
      )}

      {t.people && !searching && scope !== 'all' && (
        <Group title={`${everyone.length} on the team`} footer={managers.length ? undefined : lead ? 'No manager yet.' : undefined}>
          {everyone.length ? everyone.map(person(p => summaryIn(p, scope)))
            : <Text style={{ fontSize: 14, color: c.ink3, padding: 16 }}>Nobody on {TEAMS[scope].label} yet.</Text>}
        </Group>
      )}
      {!t.live && <Hint text="Demo: sample club members. Changes stay on this phone." />}

      <PersonSheet p={open} scope={scope} myRoles={t.myRoles} onClose={() => setOpen(null)} onSet={t.set} />
      <InviteSheet visible={inviting} scope={scope} myRoles={t.myRoles} live={t.live} find={t.find} add={t.add} onClose={() => setInviting(false)} />
    </View>
  );
};

// ── One person: their roles, team by team ──────────────────────
const PersonSheet = ({ p, scope, myRoles, onClose, onSet }: {
  p: Person | null; scope: TeamId | 'all'; myRoles: Role[]; onClose: () => void; onSet: (p: Person, r: Role, on: boolean) => Promise<void>;
}) => {
  const { c } = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const [unfolded, setUnfolded] = useState<string[]>([]);
  // Opens on what they do already; the other teams stay one line each.
  useEffect(() => {
    setMsg(null);
    setUnfolded(scope !== 'all' ? [scope] : p ? TEAM_ORDER.filter(tm => inTeam(p, tm) && !topOf(p)) : []);
  }, [p?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  const fold = (id: string) => setUnfolded(x => (x.includes(id) ? x.filter(y => y !== id) : [...x, id]));
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
        <Text style={[{ fontSize: 13, color: c.ink3, paddingHorizontal: 4 }, tnum]}>{[p.since ? `In the club since ${new Date(p.since).toLocaleDateString()}` : null, p.by ? `added by ${p.by}` : null].filter(Boolean).join(' · ')}</Text>
      )}
      {p.roles.includes('owner') && (
        <Text style={{ fontSize: 13.5, color: c.ink2 }}>{p.me ? 'You own' : 'Owns'} the app, so {p.me ? 'you see' : 'they see'} the President view. That isn't a role and can't be changed here.</Text>
      )}
      {scope === 'all' && (
        <Group title="Running the club">
          {(['president', 'sponsor'] as Role[]).map(r => (
            <RoleSwitch key={r} role={r} on={p.roles.includes(r)} disabled={!canAssign(myRoles, r)} onChange={v => flip(r, v)}
              note={r === 'sponsor' && !p.teacher ? 'Teachers only' : undefined} />
          ))}
        </Group>
      )}
      <Group title={scope === 'all' ? 'Teams' : undefined}>
        {teams.map(tm => {
          const team = TEAMS[tm];
          const top = !!topOf(p);
          const mgr = !!team.lead && p.roles.includes(team.lead);
          return (
            <Fold key={tm} art={team.art} label={team.label} sub={top ? 'Everything, with their role' : summaryIn(p, tm) || 'Not on this team'} open={unfolded.includes(tm)} onToggle={() => fold(tm)}>
              {team.lead && (
                <RoleSwitch role={team.lead} on={top || mgr} disabled={top || !canAssign(myRoles, team.lead)}
                  note={top ? 'Included with their top role' : !canAssign(myRoles, team.lead) ? 'Only the President or Teacher Sponsor can change this' : undefined}
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
            </Fold>
          );
        })}
      </Group>
      {!p.me && p.roles.some(r => canAssign(myRoles, r) && (scope === 'all' || teamOf(r) === scope)) && (
        <Act label={scope === 'all' ? 'Take out of the club' : `Take off ${TEAMS[scope].label}`} icon="trash" tone="danger" onPress={removeAll} />
      )}
    </ClubSheet>
  );
};

const RoleSwitch = ({ role, on, disabled, note, onChange }: { role: Role; on: boolean; disabled?: boolean; note?: string; onChange: (v: boolean) => void }) => {
  const { c } = useTheme();
  const job = jobOf(role);
  const sub = role === 'owner' ? 'Everything, every team' : isLead(role) ? 'Every job on the team, approvals, members' : job?.sub || '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 9, paddingHorizontal: 16 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '600', color: c.ink }}>{isLead(role) ? 'Manager' : roleLabel(role)}</Text>
        <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 17 }}>{note || sub}</Text>
      </View>
      <Toggle on={on} disabled={disabled} onChange={onChange} label={roleLabel(role)} />
    </View>
  );
};

// ── Invite: pick the role (by team), then the person or a code ──
export const RolePicker = ({ value, onPick, scope, myRoles }: { value: Role | null; onPick: (r: Role) => void; scope: TeamId | 'all'; myRoles: Role[] }) => {
  const [openTeam, setOpenTeam] = useState<TeamId | 'top' | null>(scope === 'all' ? (value ? teamOf(value) || 'top' : null) : scope);
  const teams = scope === 'all' ? TEAM_ORDER : [scope];
  const tops = (['president', 'sponsor'] as Role[]).filter(r => scope === 'all' && canAssign(myRoles, r));
  const groups: { id: TeamId | 'top'; label: string; art: any; roles: Role[] }[] = [
    ...teams.map(tm => ({
      id: tm, label: TEAMS[tm].label, art: TEAMS[tm].art,
      roles: [...(TEAMS[tm].lead ? [TEAMS[tm].lead!] : []), ...TEAMS[tm].jobs.map(j => j.role)].filter(r => !TOP.includes(r) && canAssign(myRoles, r)),
    })),
    ...(tops.length ? [{ id: 'top' as const, label: 'Running the club', art: roleArt('owner'), roles: tops }] : []),
  ].filter(g => g.roles.length);

  return (
    <Group>
      {groups.map(g => (
        <Fold key={g.id} art={g.art} label={g.label} open={openTeam === g.id} onToggle={() => setOpenTeam(o => (o === g.id ? null : g.id))}
          sub={value && g.roles.includes(value) ? (isLead(value) ? 'Manager' : roleLabel(value)) : `${g.roles.length} role${g.roles.length === 1 ? '' : 's'}`}>
          {g.roles.map(r => (
            <Choice key={r} on={value === r} onPress={() => onPick(r)} label={isLead(r) ? 'Manager' : roleLabel(r)}
              sub={isLead(r) ? 'Every job on the team, approvals, members' : jobOf(r)?.sub} />
          ))}
        </Fold>
      ))}
    </Group>
  );
};

const InviteSheet = ({ visible, scope, myRoles, live, find, add, onClose }: {
  visible: boolean; scope: TeamId | 'all'; myRoles: Role[]; live: boolean;
  find: (q: string) => Promise<Found[]>; add: (f: Found, roles: Role[]) => Promise<void>; onClose: () => void;
}) => {
  const { c } = useTheme();
  const [role, setRole] = useState<Role | null>(null);
  const [how, setHow] = useState<'find' | 'code'>('find');
  const who = usePeopleSearch(find);
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setRole(null); who.clear(); setCode(null); setMsg(null); setHow('find'); } }, [visible]);
  const job = role ? jobOf(role) : undefined;

  const give = async (f: Found) => {
    if (!role) return;
    if (job?.teacher && !f.teacher && !(await ask(`${f.name} isn't a teacher account`, 'The Teacher Sponsor has to be a teacher. Give it anyway?', 'Give it anyway'))) return;
    try {
      await add(f, [role]);
      setMsg({ ok: true, text: `${f.name} is now ${roleLabel(role)}${teamOf(role) && teamOf(role) !== 'executive' && !isLead(role) ? ` on ${TEAMS[teamOf(role)!].label}` : ''}.` });
      who.clear();
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
    <ClubSheet visible={visible} onClose={onClose} title="Invite someone" sub={scope === 'all' ? 'Pick the role first, then who' : `To ${TEAMS[scope].label}`}>
      <Step n={1} text="What will they do?" />
      <RolePicker value={role} onPick={r => { setRole(r); setCode(null); setMsg(null); }} scope={scope} myRoles={myRoles} />

      {role && (
        <>
          <Step n={2} text={`Who is the new ${isLead(role) ? 'Manager' : roleLabel(role)}?`} />
          {job?.teacher && <Hint text="The Teacher Sponsor has to be a teacher (a wvschools.ca account)." icon="grad" />}
          <Seg value={how} onChange={v => { setHow(v); setMsg(null); }} options={[{ id: 'find', label: 'Already on Spartans' }, { id: 'code', label: 'Not yet' }]} />
          {how === 'find' ? (
            <PeopleFinder s={who} none="Nobody found. If they don't have Spartans yet, make an invite code instead."
              action={f => <Act label="Add" small onPress={() => give(f)} />} />
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
                <Act label="Make a code" icon="mail" fill onPress={mint} busy={busy} disabled={!live} />
              )}
            </Card>
          )}
        </>
      )}
      <Result msg={msg} />
    </ClubSheet>
  );
};
