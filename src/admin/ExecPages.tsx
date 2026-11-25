// Spartans — App Club → Executive pieces.
//   TopHome        the President's and Teacher Sponsor's App Club: a decision if
//                  one is waiting, every team with what's going on there, the club
//   Decisions      the whole decisions board
//   SchoolContacts principal and vice-principals, the office
//   Marketing     what to tell people about the app, the brand colours and
//                 marks for posters, and the campaign board.
//   HrPage        everyone in the club with their latest check-in, and the
//                 check-in board.
//   StucoPage     poll results to bring to student council, and the board
//                 of what student council asked the club for.

import React, { useMemo, useState } from 'react';
import { View, Text, Image, ImageSourcePropType, Linking } from 'react-native';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { useContent, phaseOf } from '../content';
import { useBadgeDesigns } from '../badgeDesigns';
import { BADGES } from '../badges';
import { STAFF, SCHOOL } from '../staff';
import { BRAND } from '../components/Chrome';
import type { Role } from '../backend';
import { ART, TEAMS, TEAM_ORDER, TeamId, TOP, teamOf, roleLabel } from '../ranks';
import { Act, Card, CardHead, Group, Hint, PersonRow, Pill, Row, SectionTitle } from './ui';
import { BoardView } from './Board';
import { Item, useBoard } from './boards';
import { usePeople, Person } from './Members';
import { useFeedbackInbox } from './FeedbackTeam';

// ── President / Teacher Sponsor home ────────────────────────────
// Three short parts. Each team is listed once, and its line says what's going
// on there; a red number is something waiting for someone.
export const TopHome = ({ sponsor, onTeam, onDecisions, onMembers, clubs }: {
  sponsor: boolean; onTeam: (t: TeamId) => void; onDecisions: () => void; onMembers: () => void; clubs?: React.ReactNode;
}) => {
  const store = useContent();
  const people = usePeople();
  const { designs } = useBadgeDesigns();
  const inbox = useFeedbackInbox();
  const decisions = useBoard('decisions');
  const live = store.posts.filter(p => phaseOf(p, store.now) === 'live').length;
  const soon = store.posts.filter(p => phaseOf(p, store.now) === 'scheduled').length;
  const fresh = (inbox.rows || []).filter(r => (r.status || 'new') === 'new').length;
  const waiting = designs.filter(d => d.status === 'pending').length;
  const open = (decisions.items || []).filter(i => i.status === 'open');
  const members = (people.people || []).filter(p => p.roles.length).length;

  const lines: Record<TeamId, { sub: string; count?: number }> = {
    developer: { sub: TEAMS.developer.sub },
    maintenance: { sub: `${live} post${live === 1 ? '' : 's'} live${soon ? `, ${soon} scheduled` : ''}` },
    badges: waiting ? { sub: 'Designs to approve', count: waiting } : { sub: TEAMS.badges.sub },
    feedback: fresh ? { sub: 'New feedback to read', count: fresh } : { sub: inbox.rows ? 'All caught up' : TEAMS.feedback.sub },
    executive: open.length ? { sub: 'Waiting for a final say', count: open.length } : { sub: 'Decisions, marketing, check-ins' },
  };
  const teams = (
    <Group title="Teams">
      {TEAM_ORDER.map(t => <Row key={t} art={TEAMS[t].art} label={TEAMS[t].label} sub={lines[t].sub} count={lines[t].count} onPress={() => onTeam(t)} />)}
    </Group>
  );
  const decision = open.length > 0 && <NextDecision board={decisions} open={open} onAll={onDecisions} />;
  return (
    <>
      {!sponsor && decision}
      {teams}
      {sponsor && decision}
      <Group title="Club">
        <Row art={ART.key} label="Members" sub={people.people ? `${members} ${members === 1 ? 'person' : 'people'}, their roles and invites` : 'Roles and invites'} onPress={onMembers} />
        {clubs}
      </Group>
    </>
  );
};

// The oldest open decision, with Approve / Decline right there.
const NextDecision = ({ board, open, onAll }: { board: ReturnType<typeof useBoard>; open: Item[]; onAll: () => void }) => {
  const { c } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const it = [...open].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const decide = async (status: 'yes' | 'no') => {
    setBusy(status); setErr(null);
    try { await board.save({ ...it, status }); }
    catch (e: any) { setErr(String(e?.message || 'Could not save that.')); }
    finally { setBusy(null); }
  };
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title="Needs your say" trailing={open.length > 1 ? `All ${open.length}` : 'All decisions'} onTrailing={onAll} />
      <Card>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 16.5, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{it.title}</Text>
          {!!it.body && <Text numberOfLines={4} style={{ fontSize: 14.5, color: c.ink2, lineHeight: 20 }}>{it.body}</Text>}
          {!!it.tag && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>About: {it.tag}</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Act label="Decline" tone="plain" fill busy={busy === 'no'} disabled={!!busy} onPress={() => decide('no')} /></View>
          <View style={{ flex: 1 }}><Act label="Approve" fill busy={busy === 'yes'} disabled={!!busy} onPress={() => decide('yes')} /></View>
        </View>
        {!!err && <Hint warn text={err} />}
      </Card>
    </View>
  );
};

// Page rows that count what's waiting on them. Only drawn for people who may
// open the page, so nobody else's phone asks the server for it.
type Counted = { art: ImageSourcePropType; label: string; sub: string; onPress: () => void };
export const DecisionsRow = (p: Counted) => {
  const b = useBoard('decisions');
  return <Row {...p} count={(b.items || []).filter(i => i.status === 'open').length} />;
};
export const InboxRow = ({ source, ...p }: Counted & { source: 'app' | 'real' }) => {
  const inbox = useFeedbackInbox();
  return <Row {...p} count={(inbox.rows || []).filter(r => (r.source || 'app') === source && (r.status || 'new') === 'new').length} />;
};

export const Decisions = ({ canDecide }: { canDecide: boolean }) => (
  <BoardView board="decisions" art={ART.star} tone="navy" canEdit={canDecide} />
);

// School contacts the President deals with.
export const SchoolContacts = () => (
  <Group title="School contacts" footer="For district and principal sign-off.">
    {STAFF.filter(s => s.group === 'admin').map(s => (
      <Row key={s.email} icon="mail" label={`${s.first} ${s.last}`} sub={s.role} onPress={() => Linking.openURL(`mailto:${s.email}`)} />
    ))}
    <Row icon="phone" label="Main office" sub={`${SCHOOL.phone} · ${SCHOOL.email}`} onPress={() => Linking.openURL(`tel:${SCHOOL.phoneRaw}`)} />
  </Group>
);

// ── Marketing ───────────────────────────────────────────────────
export const Marketing = ({ canEdit }: { canEdit: boolean }) => {
  const { c } = useTheme();
  const store = useContent();
  const people = usePeople();
  const live = store.posts.filter(p => phaseOf(p, store.now) === 'live').length;
  const club = (people.people || []).filter(p => p.roles.length).length;
  const swatches: [string, string][] = [['Navy', '#1A3A5C'], ['Gold', '#B68842'], ['Sky', '#3B8BD9'], ['Paper', '#FAF9F5']];
  return (
    <View style={{ gap: 24 }}>
      <Group title="What to say" footer="These update on their own. Always say it's Sentinel's unofficial app, made by students in the School App Club.">
        <Row art={ART.trophy} label={`${BADGES.length} badges to collect`} />
        <Row art={ART.sparkles} label={`${live} things live in the app right now`} />
        {club > 0 && <Row art={ART.key} label={`${club} students run it`} />}
      </Group>
      <Card>
        <CardHead icon="image" title="Brand" sub="The marks and colours for posters." />
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {[BRAND.tile, BRAND.navy, BRAND.roundel].map((src, i) => (
            <View key={i} style={{ flex: 1, aspectRatio: 1, borderRadius: 14, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={src} style={{ width: '64%', height: '64%', borderRadius: i === 0 ? 12 : 0 }} resizeMode="contain" />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {swatches.map(([n, hex]) => (
            <View key={n} style={{ flex: 1, gap: 4 }}>
              <View style={{ height: 36, borderRadius: 10, backgroundColor: hex, borderWidth: 1, borderColor: c.line }} />
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.ink }}>{n}</Text>
              <Text selectable style={[{ fontSize: 11.5, color: c.ink3 }, tnum]}>{hex}</Text>
            </View>
          ))}
        </View>
      </Card>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Campaigns" />
        <BoardView board="campaigns" art={ART.megaphone} tone="crimson" canEdit={canEdit} />
      </View>
    </View>
  );
};

// ── Human Resources ─────────────────────────────────────────────
export const HrPage = ({ canEdit }: { canEdit: boolean }) => {
  const { c } = useTheme();
  const people = usePeople();
  const checks = useBoard('checkins');
  const latest = useMemo(() => {
    const m = new Map<string, { status: string; at: string }>();
    for (const it of checks.items || []) {
      const k = (it.who || '').trim().toLowerCase();
      if (!k) continue;
      const had = m.get(k);
      if (!had || it.updatedAt > had.at) m.set(k, { status: it.status, at: it.updatedAt });
    }
    return m;
  }, [checks.items]);
  const statuses = checks.info.statuses;
  const members = (people.people || []).filter(p => p.roles.length && !p.roles.some(r => TOP.includes(r)));
  const statusOf = (p: Person) => latest.get(p.name.toLowerCase())?.status;
  const count = (s: string) => members.filter(p => statusOf(p) === s).length;
  const unchecked = members.filter(p => !statusOf(p)).length;

  return (
    <View style={{ gap: 20 }}>
      {!!people.err && <Hint warn text={people.err} />}
      <Group title="Where everyone is">
        {statuses.map(st => <Row key={st.id} label={st.label} detail={String(count(st.id))} />)}
        <Row label="Not checked yet" detail={String(unchecked)} />
      </Group>
      {TEAM_ORDER.map(t => {
        const list = members.filter(p => p.roles.some(r => teamOf(r) === t));
        if (!list.length) return null;
        return (
          <Group key={t} title={TEAMS[t].label}>
            {list.map(p => {
              const st = statuses.find(x => x.id === statusOf(p));
              return <PersonRow key={p.id} person={p.name} sub={p.roles.filter(r => teamOf(r) === t).map((r: Role) => roleLabel(r)).join(', ')}
                trailing={<Pill text={st ? st.label : 'Not checked'} tone={st ? st.tone : 'ink'} />} />;
            })}
          </Group>
        );
      })}
      {people.people !== null && !members.length && <Text style={{ fontSize: 13, color: c.ink3 }}>Nobody in the club yet.</Text>}
      <Hint text="Add a check-in note with someone's name to update their status." />
      <SectionTitle title="Check-in notes" />
      <BoardView board="checkins" art={ART.ledger} tone="navy" canEdit={canEdit} />
    </View>
  );
};

// ── Student Council Rep ─────────────────────────────────────────
export const StucoPage = ({ canEdit }: { canEdit: boolean }) => {
  const { c } = useTheme();
  const store = useContent();
  const polls = store.posts.filter(p => p.kind === 'poll' && p.status === 'published').slice(0, 4);
  return (
    <View style={{ gap: 14 }}>
      <Card pad={14}>
        <CardHead art={ART.chart} tone="sky" title="Poll results for council" sub="What students said in the app's latest polls." />
        {polls.length === 0 && <Text style={{ fontSize: 13, color: c.ink3 }}>No polls yet.</Text>}
        {polls.map(p => {
          if (p.kind !== 'poll') return null;
          const t = store.tally(p.id);
          const top = t.counts.length ? t.counts.indexOf(Math.max(...t.counts)) : -1;
          return (
            <View key={p.id} style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line2 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.ink }}>{p.data.prompt}</Text>
              {p.data.options.map((o, i) => {
                const pct = t.total ? Math.round(((t.counts[i] || 0) / t.total) * 100) : 0;
                return (
                  <View key={i} style={{ gap: 3 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: c.ink2, fontWeight: i === top ? '700' : '500' }}>{o}</Text>
                      <Text style={[{ fontSize: 12.5, color: c.ink3 }, tnum]}>{pct}%</Text>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.paper2, overflow: 'hidden' }}>
                      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: i === top ? c.sky : c.line }} />
                    </View>
                  </View>
                );
              })}
              <Text style={[{ fontSize: 12, color: c.ink4 }, tnum]}>{t.total.toLocaleString()} votes</Text>
            </View>
          );
        })}
      </Card>
      <SectionTitle title="Requests from council" />
      <BoardView board="stuco" art={ART.council} tone="sky" canEdit={canEdit} />
    </View>
  );
};
