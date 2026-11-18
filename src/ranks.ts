// Spartans — App Club teams and roles. Five teams run the club:
//   Developer    builds the app: new things, seasonal changes, backend, iOS, Android
//   Maintenance  everything students see: trivia, facts, polls, news, menu, pop-ups
//   Badge        makes badges and gives them out (by award, by list, by QR code)
//   Feedback     what students say, from the app and in person
//   Executive    runs the club: President, Marketing, HR, Student Council rep,
//                Teacher Sponsor
// Ranks:
//   Top        President and Teacher Sponsor: everything, every team, and who
//              is on each one. The Teacher Sponsor has to be a teacher.
//              `owner` isn't a role you pick: it's the fact of owning the app,
//              kept on the server so someone can always fix things. It has
//              top powers and shows as the President view.
//   Developer  any Developer role. The server lets them do any job, but they
//              can't hand out roles. The Developer screen and "View" are the
//              owner's alone (src/devAccess.ts).
//   Manager    their whole team: every job in it, approving its work, and
//              adding or removing its members. Executive has no manager.
//   Member     only the jobs a manager gave them inside that team.
// Teacher (migration 0021) is staff, not a team: no App Club jobs, only
// Clubs & programs (the school's club list, who runs each program) and
// posting announcements to any program. Top roles are staff too.
// Roles are rows in the server's members table; `has_role()` there follows
// the same rules (migrations 0013 and 0017), so the app and the server agree.

import type { ImageSourcePropType } from 'react-native';
import type { Role } from './backend';
import type { IconName } from './components/Icon';
import type { PageTone } from './pages';

export type TeamId = 'developer' | 'maintenance' | 'badges' | 'feedback' | 'executive';
export const TEAM_ORDER: TeamId[] = ['developer', 'maintenance', 'badges', 'feedback', 'executive'];

export type Job = { role: Role; label: string; sub: string; icon: IconName; art: ImageSourcePropType; teacher?: boolean };
export type Team = {
  label: string; sub: string; icon: IconName; art: ImageSourcePropType; tone: PageTone;
  lead: Role | null;          // the team's Manager role (Executive has none)
  jobs: Job[];
  legacy?: Role[];            // old roles that still count as this team
};

const A = {
  laptop: require('../assets/subjects/laptop.png'),
  tools: require('../assets/subjects/tools.png'),
  trophy: require('../assets/subjects/trophy.png'),
  speech: require('../assets/subjects/speech.png'),
  briefcase: require('../assets/subjects/briefcase.png'),
  key: require('../assets/subjects/key.png'),
  bulb: require('../assets/subjects/bulb.png'),
  blossom: require('../assets/subjects/blossom.png'),
  link: require('../assets/subjects/link.png'),
  phone: require('../assets/pages/phone.png'),
  robot: require('../assets/subjects/robot.png'),
  thinking: require('../assets/subjects/thinking.png'),
  scroll: require('../assets/subjects/scroll.png'),
  chart: require('../assets/subjects/chart.png'),
  newspaper: require('../assets/subjects/newspaper.png'),
  plate: require('../assets/food/plate.png'),
  sparkles: require('../assets/subjects/sparkles.png'),
  palette: require('../assets/subjects/palette.png'),
  gift: require('../assets/food/gift.png'),
  memo: require('../assets/subjects/memo.png'),
  camera: require('../assets/subjects/camera.png'),
  inbox: require('../assets/homework/inbox.png'),
  pencil: require('../assets/subjects/pencil.png'),
  star: require('../assets/subjects/star.png'),
  megaphone: require('../assets/subjects/megaphone.png'),
  ledger: require('../assets/subjects/ledger.png'),
  council: require('../assets/subjects/council.png'),
  gradcap: require('../assets/subjects/gradcap.png'),
  desktop: require('../assets/subjects/desktop.png'),
  shield: require('../assets/brand/spartan-roundel.png'),
  goggles: require('../assets/subjects/goggles.png'),
  globe: require('../assets/subjects/globe.png'),
};
export const ART = A;

export const TEAMS: Record<TeamId, Team> = {
  developer: {
    label: 'Developer', sub: 'Builds the app itself', icon: 'grid', art: A.laptop, tone: 'sky', lead: 'lead_developer',
    jobs: [
      { role: 'dev_innovator', label: 'Innovator', sub: 'Adds new things to the app', icon: 'sparkle', art: A.bulb },
      { role: 'dev_seasonal', label: 'Seasonal', sub: 'Changes the app for each season', icon: 'sun', art: A.blossom },
      { role: 'dev_backend', label: 'Backend', sub: 'The server, data and accounts', icon: 'cloud', art: A.link },
      { role: 'dev_apple', label: 'Apple', sub: 'The iOS code and the App Store', icon: 'phone', art: A.phone },
      { role: 'dev_android', label: 'Android', sub: 'The Android code and Google Play', icon: 'phone', art: A.robot },
    ],
  },
  maintenance: {
    label: 'Maintenance', sub: 'What students see in the app', icon: 'tasks', art: A.tools, tone: 'moss', lead: 'lead_maintenance',
    jobs: [
      { role: 'trivia', label: 'Trivia', sub: 'Questions for The Buzz', icon: 'sparkle', art: A.thinking },
      { role: 'facts', label: 'Facts', sub: '"Did you know" cards for The Buzz', icon: 'book', art: A.scroll },
      { role: 'polls', label: 'Polls', sub: 'Quick polls and their results', icon: 'chart', art: A.chart },
      { role: 'news', label: 'News', sub: 'Announcements and club events', icon: 'news', art: A.newspaper },
      { role: 'menu', label: 'Menu', sub: 'Caf specials, prices, sold out', icon: 'fork', art: A.plate },
      { role: 'popups', label: 'Pop-ups', sub: 'Snow days, spirit days, big news', icon: 'flash', art: A.sparkles },
    ],
    legacy: ['events', 'library'],
  },
  badges: {
    label: 'Badge', sub: 'Makes badges and gives them out', icon: 'badge', art: A.trophy, tone: 'gold', lead: 'lead_badges',
    jobs: [
      { role: 'badges', label: 'Creator', sub: 'Designs new badges in the app', icon: 'badge', art: A.palette },
      { role: 'badge_award', label: 'Award-based Grantor', sub: 'Gives a badge to the students picked', icon: 'shield', art: A.gift },
      { role: 'badge_list', label: 'List-based Grantor', sub: 'Gives a badge to a program, team or list', icon: 'tasks', art: A.memo },
      { role: 'badge_qr', label: 'QR-code-based Grantor', sub: 'Puts up QR codes at events and places', icon: 'qr', art: A.camera },
    ],
  },
  feedback: {
    label: 'Feedback', sub: 'What students tell the App Club', icon: 'message', art: A.speech, tone: 'crimson', lead: 'lead_feedback',
    jobs: [
      { role: 'feedback', label: 'Digital', sub: 'All feedback sent from the app', icon: 'message', art: A.inbox },
      { role: 'feedback_real', label: 'Real', sub: 'Logs feedback heard in person', icon: 'edit', art: A.pencil },
    ],
  },
  executive: {
    label: 'Executive', sub: 'Runs the club', icon: 'shield', art: A.briefcase, tone: 'navy', lead: null,
    jobs: [
      { role: 'president', label: 'President', sub: 'Link to the district and the principal. Final say on everything', icon: 'shield', art: A.star },
      { role: 'marketing', label: 'Marketing', sub: 'Posters, Instagram and social media', icon: 'share', art: A.megaphone },
      { role: 'hr', label: 'Human Resources', sub: 'Makes sure everyone does their work', icon: 'users', art: A.ledger },
      { role: 'stuco', label: 'Student Council Rep', sub: "Brings the student council's say", icon: 'message', art: A.council },
      { role: 'sponsor', label: 'Teacher Sponsor', sub: 'A teacher. Same views as the President, and the most power', icon: 'grad', art: A.gradcap, teacher: true },
    ],
  },
};

// Roles with every power: the app's owner, the President, the Teacher Sponsor.
export const TOP: Role[] = ['owner', 'president', 'sponsor'];
const LEADS = TEAM_ORDER.map(t => TEAMS[t].lead).filter(Boolean) as Role[];

export const teamOf = (r: Role): TeamId | null => {
  for (const t of TEAM_ORDER) {
    const tm = TEAMS[t];
    if (tm.lead === r || tm.jobs.some(j => j.role === r) || tm.legacy?.includes(r)) return t;
  }
  return null;
};
export const jobOf = (r: Role): Job | undefined => {
  const t = teamOf(r);
  return t ? TEAMS[t].jobs.find(j => j.role === r) : undefined;
};
export const isLead = (r: Role) => LEADS.includes(r);

export const isTop = (roles: Role[]) => roles.some(r => TOP.includes(r));
// Old name: "has owner powers".
export const isOwner = isTop;
// Staff: runs the club list and may post to any program (is_staff() in 0021).
export const STAFF: Role[] = [...TOP, 'teacher'];
export const isStaff = (roles: Role[]) => roles.some(r => STAFF.includes(r));
// Roles that put you in App Club (teacher alone doesn't).
export const clubRoles = (roles: Role[]) => roles.filter(r => r !== 'teacher');
export const isDev = (roles: Role[]) => roles.some(r => teamOf(r) === 'developer');
// Manager of this team (top ranks count).
export const leads = (roles: Role[], t: TeamId) => {
  if (isTop(roles)) return true;
  const lead = TEAMS[t].lead;
  return !!lead && roles.includes(lead);
};
// May do this job: a top rank, the job itself, or its team's manager.
export const can = (roles: Role[], job: Role) => {
  if (isTop(roles) || roles.includes(job)) return true;
  const t = teamOf(job);
  return !!t && leads(roles, t);
};
// Sees this team in App Club.
export const onTeam = (roles: Role[], t: TeamId) => leads(roles, t) || roles.some(r => teamOf(r) === t);
// May add, remove and assign this role: top ranks anything; managers the
// jobs in their own team (not managers, not top roles).
export const canAssign = (roles: Role[], r: Role) => {
  if (isTop(roles)) return true;
  if (TOP.includes(r) || isLead(r)) return false;
  const t = teamOf(r);
  const lead = t ? TEAMS[t].lead : null;
  return !!lead && roles.includes(lead);
};

export type Rank = 'top' | 'manager' | 'member' | 'none';
export const rankIn = (roles: Role[], t: TeamId): Rank => {
  if (isTop(roles)) return 'top';
  const lead = TEAMS[t].lead;
  if (lead && roles.includes(lead)) return 'manager';
  return roles.some(r => teamOf(r) === t) ? 'member' : 'none';
};

// The role someone is known by: President / Sponsor first (the owner shows
// as President), then a manager role, then their first job.
export const mainRole = (roles: Role[]): Role | null =>
  (['president', 'sponsor'] as Role[]).find(r => roles.includes(r))
  || (roles.includes('owner') ? 'president' : null)
  || ALL_ROLES.find(x => isLead(x.role) && roles.includes(x.role))?.role
  || ALL_ROLES.find(x => roles.includes(x.role))?.role
  || null;

// How senior the main role is, for the role card: top > manager > developer > member.
export type Tier = 'top' | 'manager' | 'developer' | 'member';
export const tierOf = (roles: Role[]): Tier =>
  isTop(roles) ? 'top' : roles.some(isLead) ? 'manager' : isDev(roles) ? 'developer' : 'member';

// Human name for any role, for lists and invite codes.
export const roleLabel = (r: Role): string => {
  if (r === 'owner') return 'Owner';
  if (r === 'teacher') return 'Teacher';
  if (r === 'events') return 'Events (old role)';
  if (r === 'library') return 'Library (old role)';
  const t = teamOf(r);
  if (!t) return r;
  return isLead(r) ? `${TEAMS[t].label} Manager` : jobOf(r)?.label || r;
};
// "Polls" → "Maintenance · Polls"; executive roles stand alone.
export const roleFull = (r: Role): string => {
  const t = teamOf(r);
  if (!t || t === 'executive' || isLead(r)) return roleLabel(r);
  return `${TEAMS[t].label} · ${roleLabel(r)}`;
};

// One line for headers and the Settings card: "President",
// "Badge Manager · Maintenance: Polls". The owner reads as President.
export const rankLabel = (roles: Role[]): string => {
  const top = (['president', 'sponsor', 'owner'] as Role[]).find(r => roles.includes(r));
  if (top) return roleLabel(top === 'owner' ? 'president' : top);
  const parts: string[] = [];
  for (const t of TEAM_ORDER) {
    const lead = TEAMS[t].lead;
    if (lead && roles.includes(lead)) { parts.push(roleLabel(lead)); continue; }
    const mine = roles.filter(r => teamOf(r) === t);
    if (!mine.length) continue;
    parts.push(t === 'executive' ? mine.map(roleLabel).join(', ') : `${TEAMS[t].label}: ${mine.map(roleLabel).join(', ')}`);
  }
  if (roles.includes('teacher')) parts.push(roleLabel('teacher'));
  return parts.join(' · ');
};

// The art for a role (the owner gets the roundel; managers the key).
export const roleArt = (r: Role): ImageSourcePropType =>
  r === 'owner' ? A.shield : r === 'teacher' ? A.gradcap : isLead(r) ? A.key : jobOf(r)?.art || A.star;

// Every role someone can be given, in team order (owner isn't one).
export const ALL_ROLES: { team: TeamId; role: Role }[] = [
  ...TEAM_ORDER.flatMap(t => [
    ...(TEAMS[t].lead ? [{ team: t, role: TEAMS[t].lead as Role }] : []),
    ...TEAMS[t].jobs.map(j => ({ team: t, role: j.role })),
  ]),
];
