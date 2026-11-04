// Spartans — App Club → Executive pieces.
//   RightNow       one line per thing going on, for President and Sponsor
//   NeedsYourSay   open decisions with Approve / Decline
//   Decisions      the whole decisions board
//   SchoolContacts principal and vice-principals, the office
//   Marketing     what to tell people about the app, the brand colours and
//                 marks for posters, and the campaign board.
//   HrPage        everyone in the club with their latest check-in, and the
//                 check-in board.
//   StucoPage     poll results to bring to student council, and the board
//                 of what student council asked the club for.

import React, { useMemo } from 'react';
import { View, Text, Image, Linking } from 'react-native';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { useContent, phaseOf } from '../content';
import { useBadgeDesigns } from '../badgeDesigns';
import { BADGES } from '../badges';
import { STAFF, SCHOOL } from '../staff';
import { BRAND } from '../components/Chrome';
import type { Role } from '../backend';
import { ART, TEAMS, TEAM_ORDER, TeamId, TOP, teamOf, roleLabel } from '../ranks';
import { Act, Card, CardHead, Group, Hint, Pill, Row, SectionTitle } from './ui';
import { BoardView } from './Board';
import { useBoard } from './boards';
import { usePeople, Person } from './Members';
import { useFeedbackInbox } from './FeedbackTeam';

// ── Right now ───────────────────────────────────────────────────
// What's going on in the club, one line each, for the President and the
// Teacher Sponsor. Each line opens where it happens.
export const RightNow = ({ onTeam, onDecisions, onPeople }: { onTeam: (t: TeamId) => void; onDecisions: () => void; onPeople: () => void }) => {
  const store = useContent();
  const people = usePeople();
  const { designs } = useBadgeDesigns();
  const inbox = useFeedbackInbox();
  const decisions = useBoard('decisions');
  const live = store.posts.filter(p => phaseOf(p, store.now) === 'live').length;
  const fresh = (inbox.rows || []).filter(r => (r.status || 'new') === 'new').length;
  const waiting = designs.filter(d => d.status === 'pending').length;
  const open = (decisions.items || []).filter(i => i.status === 'open').length;
  const members = (people.people || []).filter(p => p.roles.length).length;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <Group title="Right now">
      <Row art={TEAMS.maintenance.art} label={plural(live, 'post live', 'posts live')} sub="Trivia, polls, news and the caf menu" onPress={() => onTeam('maintenance')} />
      <Row art={TEAMS.feedback.art} label={plural(fresh, 'new piece of feedback', 'new pieces of feedback')} sub="From the app and in person" onPress={() => onTeam('feedback')} />
      <Row art={TEAMS.badges.art} label={plural(waiting, 'badge waiting', 'badges waiting')} sub="New designs to approve" onPress={() => onTeam('badges')} />
      <Row art={ART.star} label={plural(open, 'decision open', 'decisions open')} sub="Waiting for a final say" onPress={onDecisions} />
      {people.people !== null && <Row art={ART.key} label={plural(members, 'person in the club', 'people in the club')} sub="Across five teams" onPress={onPeople} />}
    </Group>
  );
};

// Open decisions with Approve / Decline right there. The President and the
// Teacher Sponsor decide; everyone else with access just reads.
export const NeedsYourSay = ({ canDecide, onAll }: { canDecide: boolean; onAll: () => void }) => {
  const { c } = useTheme();
  const b = useBoard('decisions');
  const open = (b.items || []).filter(i => i.status === 'open');
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title="Needs a final say" trailing="All decisions" onTrailing={onAll} />
      {b.items !== null && open.length === 0 && (
        <Card><Text style={{ fontSize: 14, color: c.ink3 }}>Nothing waiting. New questions show up here.</Text></Card>
      )}
      {open.slice(0, 3).map(it => (
        <Card key={it.id}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>{it.title}</Text>
            {!!it.body && <Text style={{ fontSize: 14, color: c.ink2, lineHeight: 20 }}>{it.body}</Text>}
            {!!it.tag && <Text style={{ fontSize: 12.5, color: c.ink3 }}>About: {it.tag}</Text>}
          </View>
          {canDecide && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Act label="Approve" icon="check" fill onPress={() => b.save({ ...it, status: 'yes' })} />
              <Act label="Decline" icon="close" tone="plain" fill onPress={() => b.save({ ...it, status: 'no' })} />
            </View>
          )}
        </Card>
      ))}
    </View>
  );
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
      <Group title="Check-ins">
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
              return <Row key={p.id} label={p.name} sub={p.roles.filter(r => teamOf(r) === t).map((r: Role) => roleLabel(r)).join(', ')}
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
