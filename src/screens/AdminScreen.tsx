// Spartans — App Club (the gold header bubble, or the gold card in Profile →
// Settings). What it shows depends on who you are (src/ranks.ts). Everyone
// in the club starts with their role card (admin/RoleCard), then:
//   Not in the club   the join page (admin/JoinClub), the club's pitch.
//   President         what needs a final say, what's going on, every team.
//                     (The app's owner sees this too.)
//   Teacher Sponsor   the same access, laid out for looking rather than
//                     doing: what's going on first, decisions, then teams.
//   Developer         their role card and a line about the team's work.
//   Everyone else     their own pages, grouped by team.
// Anyone who runs people (top roles, team managers) gets Members at the
// very bottom, always in the same place.
// Staff (top roles and the `teacher` role, migration 0021) also get "School":
// Clubs & programs (admin/ClubsPage), the real club list and who runs each
// program. A teacher with no club role sees just that, under their card,
// instead of the join page.
// Dev tools are the app owner's alone (src/devAccess.ts): the Developer screen
// (admin/DevPages, under the Developer team) and the "View" button in the
// header's top right, the TEMPORARY view switcher (admin/ViewAs), which lights
// up gold while you view as someone else.
// The server enforces the real roles either way (migrations 0013 and 0017).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, ImageSourcePropType } from 'react-native';
import { useTheme } from '../ThemeContext';
import { AppHeader } from '../components/AppHeader';
import { useProfile, fullName, initials } from '../ProfileContext';
import { useContent, Post, PostKind, KIND_ORDER } from '../content';
import type { Role } from '../backend';
import { PostEditor, newPost } from '../admin/PostEditor';
import { PostDetail } from '../admin/PostDetail';
import { BadgeTeam } from '../admin/BadgeTeam';
import { OnScreen, Posts } from '../admin/Maintenance';
import { FeedbackTeam } from '../admin/FeedbackTeam';
import { FeedbackLog } from '../admin/FeedbackLog';
import { Members } from '../admin/Members';
import { JoinClub, Redeem } from '../admin/JoinClub';
import { AwardGrant, ListGrant, QrGrant } from '../admin/BadgeGrant';
import { DeveloperScreen } from '../admin/DevPages';
import { Decisions, Marketing, HrPage, NeedsYourSay, RightNow, SchoolContacts, StucoPage } from '../admin/ExecPages';
import { RoleCard } from '../admin/RoleCard';
import { ClubsPrograms } from '../admin/ClubsPage';
import { ViewAsButton, ViewAsSheet } from '../admin/ViewAs';
import { Group, Hint, PageTitle, Row } from '../admin/ui';
import { useDevAccess } from '../devAccess';
import { loadDesigns, useBadgeDesigns } from '../badgeDesigns';
import { APP_VERSION } from '../settings';
import {
  ART, TEAMS, TEAM_ORDER, TeamId, can, clubRoles, isDev, isLead, isStaff, isTop, jobOf, leads, mainRole, onTeam, roleLabel, teamOf, tierOf,
} from '../ranks';
import type { ScreenProps } from '../../App';

// ── Pages ───────────────────────────────────────────────────────
type Go = {
  roles: Role[];
  editable: PostKind[];
  openPost: (p: Post) => void;
  newPost: (k: PostKind) => void;
};
type PageDef = {
  id: string; team: TeamId | null; label: string; sub: string; art: ImageSourcePropType;
  show: (roles: Role[]) => boolean;
  render: (g: Go) => React.ReactNode;
};

const jobPage = (t: TeamId, role: Role, id: string, render: (g: Go) => React.ReactNode): PageDef => {
  const j = jobOf(role)!;
  return { id, team: t, label: j.label, sub: j.sub, art: j.art, show: r => can(r, role), render };
};
const posts = (kinds: PostKind[]) => (g: Go) => <Posts kinds={kinds} editable={g.editable} onOpen={g.openPost} onNew={g.newPost} />;

const PAGES: PageDef[] = [
  // Maintenance
  { id: 'mnt.screen', team: 'maintenance', label: 'On screen', sub: 'What students see right now', art: ART.desktop,
    show: r => onTeam(r, 'maintenance'), render: g => <OnScreen onOpen={g.openPost} /> },
  jobPage('maintenance', 'trivia', 'mnt.trivia', posts(['trivia'])),
  jobPage('maintenance', 'facts', 'mnt.facts', posts(['fact'])),
  jobPage('maintenance', 'polls', 'mnt.polls', posts(['poll'])),
  jobPage('maintenance', 'news', 'mnt.news', posts(['news', 'event'])),
  jobPage('maintenance', 'menu', 'mnt.menu', posts(['menu'])),
  jobPage('maintenance', 'popups', 'mnt.popups', posts(['popup'])),
  // Badge
  jobPage('badges', 'badges', 'bdg.creator', g => <BadgeTeam canApprove={leads(g.roles, 'badges')} />),
  jobPage('badges', 'badge_award', 'bdg.award', () => <AwardGrant />),
  jobPage('badges', 'badge_list', 'bdg.list', () => <ListGrant />),
  jobPage('badges', 'badge_qr', 'bdg.qr', () => <QrGrant />),
  // Feedback
  jobPage('feedback', 'feedback', 'fb.digital', g => <FeedbackTeam canDelete={leads(g.roles, 'feedback')} />),
  jobPage('feedback', 'feedback_real', 'fb.real', g => <FeedbackLog canDelete={leads(g.roles, 'feedback')} />),
  // Executive
  jobPage('executive', 'marketing', 'exe.marketing', g => <Marketing canEdit={can(g.roles, 'marketing')} />),
  jobPage('executive', 'hr', 'exe.hr', g => <HrPage canEdit={can(g.roles, 'hr')} />),
  jobPage('executive', 'stuco', 'exe.stuco', g => <StucoPage canEdit={can(g.roles, 'stuco')} />),
  { id: 'exe.decisions', team: 'executive', label: 'Decisions', sub: 'Everything that needed a final say', art: ART.star,
    show: isTop, render: g => <View style={{ gap: 24 }}><Decisions canDecide={isTop(g.roles)} /><SchoolContacts /></View> },
  // School (staff, not a team)
  { id: 'school.clubs', team: null, label: 'Clubs & programs', sub: 'The club list, and who runs each program', art: ART.council,
    show: isStaff, render: g => <ClubsPrograms roles={g.roles} /> },
];
// Pages reached from Members, not listed under a team.
const membersPage = (scope: TeamId | 'all'): PageDef => ({
  id: `members.${scope}`, team: scope === 'all' ? null : scope, label: 'Members',
  sub: scope === 'all' ? 'Everyone in the club, their roles, and invites' : `Who is on ${TEAMS[scope].label}, and invites`,
  art: ART.key, show: () => true, render: () => <Members scope={scope} />,
});
const pageById = (id: string): PageDef | undefined =>
  id.startsWith('members.') ? membersPage(id.slice(8) as TeamId | 'all') : PAGES.find(p => p.id === id);

type Route = { kind: 'home' } | { kind: 'team'; team: TeamId } | { kind: 'page'; id: string; from: Route };

export default function AdminScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const store = useContent();
  const { refreshRoles, signedIn, profile } = useProfile();
  const roles = store.roles;
  const [route, setRoute] = useState<Route>({ kind: 'home' });
  const [editing, setEditing] = useState<Post | null>(null);
  const [detail, setDetail] = useState<Post | null>(null);
  const [viewing, setViewing] = useState(false);
  const { designs } = useBadgeDesigns();
  const devAccess = useDevAccess();
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { refreshRoles(); store.refresh(); }, []);
  useEffect(() => { loadDesigns(signedIn); }, [signedIn]);
  useEffect(() => { store.loadStats(store.posts.map(p => p.id)); }, [store.posts.length]);
  // A new view (or new roles) starts at the top of App Club.
  useEffect(() => { setRoute({ kind: 'home' }); }, [roles.join()]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [route]);

  const visible = useMemo(() => PAGES.filter(p => p.show(roles)), [roles.join()]);
  const top = isTop(roles);
  const dev = isDev(roles);
  const inClub = clubRoles(roles).length > 0;
  const staff = isStaff(roles);
  const pending = designs.filter(d => d.status === 'pending').length;
  const countFor = (p: PageDef) => p.id === 'bdg.creator' && leads(roles, 'badges') ? pending : 0;

  const go: Go = {
    roles,
    editable: KIND_ORDER.filter(k => store.canEdit(k)),
    openPost: setDetail,
    newPost: k => setEditing(newPost(k)),
  };
  const openPage = (id: string) => setRoute(r => ({ kind: 'page', id, from: r.kind === 'page' ? r.from : r }));
  const openTeam = (t: TeamId) => setRoute({ kind: 'team', team: t });
  const back = route.kind === 'page' ? () => setRoute(route.from) : route.kind === 'team' ? () => setRoute({ kind: 'home' }) : undefined;
  // iOS can't show the editor while the results sheet is still sliding away.
  const editFromDetail = (p: Post) => { setDetail(null); setTimeout(() => setEditing(p), 450); };

  const headerClub = store.canViewAs ? <ViewAsButton onPress={() => setViewing(true)} /> : null;
  const sheets = store.canViewAs ? <ViewAsSheet visible={viewing} onClose={() => setViewing(false)} /> : null;
  // The Developer team's page: the dev tools for the owner, a plain line for the rest.
  const developerPage = devAccess
    ? <DeveloperScreen onViewAs={() => setViewing(true)} />
    : <Hint text="The Developer team's work happens in the app's code, so there's nothing to run here." />;

  // Not in the club (and not staff): the join page.
  if (!inClub && !staff) {
    return (
      <>
        <JoinClub topInset={topInset} club={headerClub} />
        {sheets}
      </>
    );
  }

  const page = route.kind === 'page' ? pageById(route.id) : null;
  const team = route.kind === 'team' ? route.team : null;
  const sponsorView = roles.includes('sponsor') && !roles.includes('president') && !roles.includes('owner');

  // ── The role card ──
  const main = mainRole(roles);
  const tier = tierOf(roles);
  const jobsOn = (t: TeamId) => roles.filter(r => teamOf(r) === t && !isLead(r)).map(roleLabel);
  const devOnly = dev && !roles.some(r => isLead(r) && teamOf(r) === 'developer') && tier === 'developer';
  const cardRole = top ? roleLabel(main!) : devOnly ? 'Developer' : main ? roleLabel(main) : !inClub ? roleLabel('teacher') : 'Member';
  const myTeams = TEAM_ORDER.filter(t => roles.some(r => teamOf(r) === t));
  const cardFoot = top ? (sponsorView ? 'Every team. You can open anything.' : 'Every team, and the final say.')
    : !inClub ? 'Clubs, programs and their announcements'
    : myTeams.map(t => {
      const jobs = jobsOn(t);
      const lead = TEAMS[t].lead && roles.includes(TEAMS[t].lead!);
      if (t === 'executive') return jobs.join(', ');
      if (lead) return `Runs the ${TEAMS[t].label} team`;
      return devOnly && t === 'developer' ? jobs.join(', ') : `${TEAMS[t].label} team${jobs.length > 1 ? `: ${jobs.join(', ')}` : ''}`;
    }).join(' · ');
  const card = (
    <RoleCard tier={tier} role={cardRole} foot={cardFoot} tag={tier === 'developer' ? `build ${APP_VERSION}` : undefined}
      name={profile ? fullName(profile) || 'You' : 'You'} initials={profile ? initials(profile) : '?'} photo={profile?.photoUri}
      sub={sponsorView || (!inClub && staff) ? 'Teacher' : profile?.grade ? `Grade ${profile.grade}` : undefined} />
  );

  // ── Rows ──
  const pageRow = (p: PageDef) => <Row key={p.id} art={p.art} label={p.label} sub={p.sub} count={countFor(p)} onPress={() => openPage(p.id)} />;
  const teamRow = (t: TeamId) => {
    const n = visible.filter(p => p.team === t).reduce((a, p) => a + countFor(p), 0);
    return <Row key={t} art={TEAMS[t].art} label={TEAMS[t].label} sub={TEAMS[t].sub} count={n} onPress={() => openTeam(t)} />;
  };
  const ledTeams = TEAM_ORDER.filter(t => TEAMS[t].lead && roles.includes(TEAMS[t].lead!));
  const membersGroup = top ? (
    <Group title="Members">
      <Row art={ART.key} label="Everyone in the club" sub="Roles, managers and invites" onPress={() => openPage('members.all')} />
    </Group>
  ) : ledTeams.length ? (
    <Group title="Members">
      {ledTeams.map(t => <Row key={t} art={ART.key} label={`${TEAMS[t].label} members`} sub="Who's on the team, and invites" onPress={() => openPage(`members.${t}`)} />)}
    </Group>
  ) : null;

  const schoolGroup = staff ? (
    <Group title="School">{visible.filter(p => p.id.startsWith('school.')).map(pageRow)}</Group>
  ) : null;

  const home = top ? (
    sponsorView ? (
      <>
        <Hint icon="grad" text="Nothing here needs you day to day. Look around whenever you like, and weigh in when a decision is waiting." />
        <RightNow onTeam={openTeam} onDecisions={() => openPage('exe.decisions')} onPeople={() => openPage('members.all')} />
        <NeedsYourSay canDecide onAll={() => openPage('exe.decisions')} />
        <Group title="Look around">{TEAM_ORDER.map(teamRow)}</Group>
      </>
    ) : (
      <>
        <NeedsYourSay canDecide onAll={() => openPage('exe.decisions')} />
        <RightNow onTeam={openTeam} onDecisions={() => openPage('exe.decisions')} onPeople={() => openPage('members.all')} />
        <Group title="Teams">{TEAM_ORDER.map(teamRow)}</Group>
      </>
    )
  ) : (
    <>
      {dev && developerPage}
      {myTeams.filter(t => t !== 'developer').map(t => {
        const list = visible.filter(p => p.team === t);
        if (!list.length) return null;
        const solo = myTeams.filter(x => x !== 'developer').length === 1 && !dev;
        return <Group key={t} title={solo ? 'Your work' : TEAMS[t].label}>{list.map(pageRow)}</Group>;
      })}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <AppHeader topInset={topInset} title="App Club" back onBack={back} club={headerClub} />

        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 24 }}>
          {page ? (
            <>
              <PageTitle kicker={page.team ? TEAMS[page.team].label : page.id.startsWith('school.') ? 'School' : 'App Club'} title={page.label} sub={page.sub} art={page.art} />
              {page.team === 'maintenance' && !!store.note && <Hint text={store.note} warn />}
              <View style={{ gap: 14 }}>{page.render(go)}</View>
            </>
          ) : team ? (
            <>
              <PageTitle kicker="Team" title={TEAMS[team].label} sub={TEAMS[team].sub} art={TEAMS[team].art} />
              {team === 'developer'
                ? developerPage
                : <Group title="Pages">{visible.filter(p => p.team === team).map(pageRow)}</Group>}
              {TEAMS[team].lead && leads(roles, team) && (
                <Group title="Members">
                  <Row art={ART.key} label={`${TEAMS[team].label} members`} sub="Who's on the team, and invites" onPress={() => openPage(`members.${team}`)} />
                </Group>
              )}
            </>
          ) : (
            <>
              {card}
              {home}
              {schoolGroup}
              {membersGroup}
              <Redeem prominent={false} />
            </>
          )}
        </View>
      </ScrollView>

      <PostDetail post={detail} onClose={() => setDetail(null)} onEdit={editFromDetail} />
      <PostEditor post={editing} onClose={() => setEditing(null)} />
      {sheets}
    </View>
  );
}
