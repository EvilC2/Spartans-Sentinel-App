// Spartans — App Club (the gold coin in the header, or the navy card in
// Profile → Settings). What it shows depends on who you are (src/ranks.ts).
// Everyone in the club starts with their role card (admin/RoleCard), then:
//   Not in the club   the join page (admin/JoinClub), the club's pitch.
//   President         a decision if one is waiting, then one line per team with
//                     what's going on there. (The app's owner sees this too.)
//   Teacher Sponsor   the same, teams first and decisions after.
//   Developer         their role card and a line about the team's work.
//   Everyone else     their own pages, grouped by team if they're on several.
// Anyone who runs people (top roles, team managers) gets Members at the
// bottom. Staff (top roles and the `teacher` role, migration 0021) also get
// Clubs & programs (admin/ClubsPage): the real club list and who runs each
// program. A teacher with no club role sees just that, under their card,
// instead of the join page.
// Every page's header names where Back goes; the page's own name is below it.
// Page names are jobs to do ("Give to students"); roles keep their own names.
// Dev tools are the app owner's alone (src/devAccess.ts): the Developer screen
// (admin/DevPages, under the Developer team) and the eye in the header, the
// TEMPORARY view switcher (admin/ViewAs). While it's on, a bar says who you're
// viewing as.
// The server enforces the real roles either way (migrations 0013 and 0017).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useTheme } from '../ThemeContext';
import { AppHeader } from '../components/AppHeader';
import { useProfile, fullName, initials } from '../ProfileContext';
import { useContent, Post, PostKind, KIND_ORDER, phaseOf } from '../content';
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
import { Decisions, DecisionsRow, HrPage, InboxRow, Marketing, SchoolContacts, StucoPage, TopHome } from '../admin/ExecPages';
import { RoleCard } from '../admin/RoleCard';
import { ClubsPrograms } from '../admin/ClubsPage';
import { ViewAsBar, ViewAsButton, ViewAsSheet } from '../admin/ViewAs';
import { Group, Hint, PageTitle, Row } from '../admin/ui';
import { useDevAccess } from '../devAccess';
import { loadDesigns, useBadgeDesigns } from '../badgeDesigns';
import {
  ART, TEAMS, TEAM_ORDER, TeamId, can, clubRoles, isDev, isLead, isStaff, isTop, jobOf, leads, mainRole, onTeam, roleArt, roleFull, roleLabel, teamOf, tierOf,
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
  section?: string;          // heading it sits under on its team's page
  kinds?: PostKind[];        // post pages: the row says how many are live
  show: (roles: Role[]) => boolean;
  render: (g: Go) => React.ReactNode;
};

const jobPage = (t: TeamId, role: Role, id: string, render: (g: Go) => React.ReactNode, over: Partial<PageDef> = {}): PageDef => {
  const j = jobOf(role)!;
  return { id, team: t, label: j.label, sub: j.sub, art: j.art, show: r => can(r, role), render, ...over };
};
const postPage = (role: Role, id: string, kinds: PostKind[]): PageDef =>
  jobPage('maintenance', role, id, g => <Posts kinds={kinds} editable={g.editable} onOpen={g.openPost} onNew={g.newPost} />, { kinds, section: 'Posts' });

const PAGES: PageDef[] = [
  // Maintenance
  { id: 'mnt.screen', team: 'maintenance', label: 'On screen', sub: 'What students see right now', art: ART.desktop,
    show: r => onTeam(r, 'maintenance'), render: g => <OnScreen onOpen={g.openPost} /> },
  postPage('trivia', 'mnt.trivia', ['trivia']),
  postPage('facts', 'mnt.facts', ['fact']),
  postPage('polls', 'mnt.polls', ['poll']),
  postPage('news', 'mnt.news', ['news', 'event']),
  postPage('menu', 'mnt.menu', ['menu']),
  postPage('popups', 'mnt.popups', ['popup']),
  // Badge
  jobPage('badges', 'badges', 'bdg.creator', g => <BadgeTeam canApprove={leads(g.roles, 'badges')} />,
    { label: 'Design badges', sub: 'Make new ones and edit the rest' }),
  jobPage('badges', 'badge_award', 'bdg.award', () => <AwardGrant />,
    { label: 'Give to students', sub: 'Pick a badge and who earned it', section: 'Give out badges' }),
  jobPage('badges', 'badge_list', 'bdg.list', () => <ListGrant />,
    { label: 'Give to a group', sub: 'A class, a team or a sign-in list', section: 'Give out badges' }),
  jobPage('badges', 'badge_qr', 'bdg.qr', () => <QrGrant />,
    { label: 'QR codes', sub: 'Codes to put up at events and places', section: 'Give out badges' }),
  // Feedback
  jobPage('feedback', 'feedback', 'fb.digital', g => <FeedbackTeam canDelete={leads(g.roles, 'feedback')} />,
    { label: 'Inbox', sub: 'Feedback sent from the app' }),
  jobPage('feedback', 'feedback_real', 'fb.real', g => <FeedbackLog canDelete={leads(g.roles, 'feedback')} />,
    { label: 'In person', sub: 'Log feedback you heard yourself' }),
  // Executive
  { id: 'exe.decisions', team: 'executive', label: 'Decisions', sub: 'Everything that needed a final say', art: ART.star,
    show: isTop, render: g => <View style={{ gap: 28 }}><Decisions canDecide={isTop(g.roles)} /><SchoolContacts /></View> },
  jobPage('executive', 'marketing', 'exe.marketing', g => <Marketing canEdit={can(g.roles, 'marketing')} />),
  jobPage('executive', 'hr', 'exe.hr', g => <HrPage canEdit={can(g.roles, 'hr')} />, { label: 'Check-ins', sub: 'Is everyone getting their work done' }),
  jobPage('executive', 'stuco', 'exe.stuco', g => <StucoPage canEdit={can(g.roles, 'stuco')} />, { label: 'Student council', sub: 'Poll results and what council asked for' }),
  // School (staff, not a team)
  { id: 'school.clubs', team: null, label: 'Clubs & programs', sub: 'The club list, and who runs each program', art: ART.council,
    show: isStaff, render: g => <ClubsPrograms roles={g.roles} /> },
];
// Pages reached from Members, not listed under a team.
const membersPage = (scope: TeamId | 'all'): PageDef => ({
  id: `members.${scope}`, team: scope === 'all' ? null : scope, label: 'Members',
  sub: scope === 'all' ? 'Everyone in the club and what they do' : `Everyone on ${TEAMS[scope].label}`,
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
  // Forward starts at the top; Back returns to where you were on that page.
  const places = useRef<Record<string, number>>({});
  const returning = useRef(false);
  const routeKey = route.kind === 'home' ? 'home' : route.kind === 'team' ? `team.${route.team}` : `page.${route.id}`;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => { places.current[routeKey] = e.nativeEvent.contentOffset.y; };
  useEffect(() => {
    const y = returning.current ? places.current[routeKey] || 0 : 0;
    returning.current = false;
    scroll.current?.scrollTo({ y: 0, animated: false });
    if (!y) return;
    const t = setTimeout(() => scroll.current?.scrollTo({ y, animated: false }), 60);   // once its rows are laid out
    return () => clearTimeout(t);
  }, [routeKey]);

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
  const goBack = (r: Route) => { returning.current = true; setRoute(r); };
  const back = route.kind === 'page' ? () => goBack(route.from) : route.kind === 'team' ? () => goBack({ kind: 'home' }) : undefined;
  // The header says where Back goes.
  const headTitle = route.kind === 'page' && route.from.kind === 'team' ? TEAMS[route.from.team].label : 'App Club';
  // iOS can't show the editor while the results sheet is still sliding away.
  const editFromDetail = (p: Post) => { setDetail(null); setTimeout(() => setEditing(p), 450); };

  const headerClub = store.canViewAs ? <ViewAsButton onPress={() => setViewing(true)} /> : null;
  const sheets = store.canViewAs ? <ViewAsSheet visible={viewing} onClose={() => setViewing(false)} /> : null;
  // The Developer team's page: the dev tools for the owner, a plain line for the rest.
  const developerPage = devAccess
    ? <DeveloperScreen onViewAs={() => setViewing(true)} />
    : <Hint icon="grid" text="The Developer team's work happens in the app's code, so there's nothing to run here." />;

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
  const devOnly = dev && tier === 'developer';
  const myTeams = TEAM_ORDER.filter(t => roles.some(r => teamOf(r) === t));
  const mainTeam = devOnly ? 'developer' : main ? teamOf(main) : null;
  const cardRole = devOnly ? 'Developer' : main ? roleLabel(main) : !inClub ? roleLabel('teacher') : 'Member';
  const devJobs = roles.filter(r => teamOf(r) === 'developer' && !isLead(r));
  const others = clubRoles(roles).filter(r => r !== main && r !== 'owner' && !(devOnly && teamOf(r) === 'developer')
    // A manager already has every job on their team.
    && !(TEAMS[teamOf(r) || 'executive'].lead && roles.includes(TEAMS[teamOf(r) || 'executive'].lead!) && !isLead(r)));
  const cardFoot = top ? undefined
    : !inClub ? 'Clubs, programs and announcements'
    : [
      devOnly ? devJobs.map(roleLabel).join(', ') : main && mainTeam && mainTeam !== 'executive' && !isLead(main) ? `${TEAMS[mainTeam].label} team` : null,
      others.length ? `Also ${others.map(r => (teamOf(r) === mainTeam ? roleLabel(r) : roleFull(r).replace(' · ', ': '))).join(', ')}` : null,
    ].filter(Boolean).join(' · ') || undefined;
  const cardArt = top && main ? roleArt(main) : !inClub ? roleArt('teacher') : mainTeam ? TEAMS[mainTeam].art : undefined;
  const card = (
    <RoleCard tier={tier} role={cardRole} foot={cardFoot} art={cardArt}
      name={profile ? fullName(profile) || 'You' : 'You'} initials={profile ? initials(profile) : '?'} photo={profile?.photoUri}
      sub={!inClub ? undefined : sponsorView ? 'Teacher' : profile?.grade ? `Grade ${profile.grade}` : undefined} />
  );

  // ── Rows ──
  // Post pages say what's out there instead of describing themselves.
  const rowSub = (p: PageDef) => {
    if (!p.kinds) return p.sub;
    const n = { live: 0, scheduled: 0, draft: 0, ended: 0 };
    for (const x of store.posts) if (p.kinds.includes(x.kind)) n[phaseOf(x, store.now)]++;
    return [n.live && `${n.live} live`, n.scheduled && `${n.scheduled} scheduled`, n.draft && `${n.draft} draft${n.draft === 1 ? '' : 's'}`].filter(Boolean).join(', ') || 'Nothing live';
  };
  const pageRow = (p: PageDef) => {
    const row = { art: p.art, label: p.label, sub: rowSub(p), onPress: () => openPage(p.id) };
    if (p.id === 'exe.decisions') return <DecisionsRow key={p.id} {...row} />;
    if (p.id === 'fb.digital' || p.id === 'fb.real') return <InboxRow key={p.id} source={p.id === 'fb.real' ? 'real' : 'app'} {...row} />;
    return <Row key={p.id} {...row} count={countFor(p)} />;
  };
  // A team's pages, under their headings.
  const pageGroups = (list: PageDef[]) => [...new Set(list.map(p => p.section))].map(sec => (
    <Group key={sec || 'main'} title={sec}>{list.filter(p => p.section === sec).map(pageRow)}</Group>
  ));
  const ledTeams = TEAM_ORDER.filter(t => TEAMS[t].lead && roles.includes(TEAMS[t].lead!));
  const memberRow = (t: TeamId) => (
    <Row key={t} icon="users" label={ledTeams.length > 1 ? `${TEAMS[t].label} members` : 'Members'} sub="Who's on the team, and invites" onPress={() => openPage(`members.${t}`)} />
  );
  const clubsPage = visible.find(p => p.id === 'school.clubs');
  const workTeams = myTeams.filter(t => t !== 'developer' && visible.some(p => p.team === t));

  const home = top ? (
    <TopHome sponsor={sponsorView} onTeam={openTeam} onDecisions={() => openPage('exe.decisions')}
      onMembers={() => openPage('members.all')} clubs={clubsPage && pageRow(clubsPage)} />
  ) : (
    <>
      {dev && developerPage}
      {workTeams.length === 1 && !dev
        ? pageGroups(visible.filter(p => p.team === workTeams[0]))
        : workTeams.map(t => <Group key={t} title={TEAMS[t].label}>{visible.filter(p => p.team === t).map(pageRow)}</Group>)}
      {staff && clubsPage && <Group>{pageRow(clubsPage)}</Group>}
      {ledTeams.length > 0 && <Group title={ledTeams.length > 1 ? 'Members' : undefined}>{ledTeams.map(memberRow)}</Group>}
      <Redeem />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView ref={scroll} onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <AppHeader topInset={topInset} title={headTitle} back onBack={back} club={headerClub} />

        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 24 }}>
          <ViewAsBar />
          {page ? (
            <>
              <PageTitle title={page.label} sub={page.sub} art={page.art} />
              {page.team === 'maintenance' && !!store.note && <Hint text={store.note} warn />}
              <View style={{ gap: 14 }}>{page.render(go)}</View>
            </>
          ) : team ? (
            <>
              <PageTitle title={TEAMS[team].label} sub={TEAMS[team].sub} art={TEAMS[team].art} />
              {team === 'developer' ? developerPage : pageGroups(visible.filter(p => p.team === team))}
              {TEAMS[team].lead && leads(roles, team) && <Group>{memberRow(team)}</Group>}
            </>
          ) : (
            <>
              {card}
              {home}
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
