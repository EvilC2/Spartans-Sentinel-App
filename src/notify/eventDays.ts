// Spartans — event days: the big days that get a banner when you open the app.
//
// Three places a day can come from:
//   calendar  src/calendar.ts already knows it (Collab Day, Pro-D, first day,
//             last day, first day back after winter break, early dismissal).
//   date      same month/day every year (Halloween, Valentine's, June 1…).
//   admin     App Club posts it from App Club Admin (a `popups` row): snow
//             days, multicultural lunch, spirit days. Can't be predicted.
//
// A banner is standalone. When a template names a `badge`, closing the banner
// unlocks it (once). Seasonal badges that just say "Halloween" or "Valentine's
// Day" are paired here; collab / Pro-D / multicultural have no badge yet.
//
// UI copy: no em dashes.

import type { ImageSourcePropType } from 'react-native';
import { CALENDAR, CalDay, fromISO, inSchoolYear, toISO } from '../calendar';
import type { TabId } from '../components/Chrome';
import type { Popup } from '../backend';

export type Particle = 'snow' | 'confetti' | 'sparkle' | 'bubble';
export type EventSource = 'calendar' | 'date' | 'admin';

export type EventTemplate = {
  id: string;
  name: string;                 // "Collab Day" (lists, notifications)
  title: string;                // big banner line
  body: string;
  art: ImageSourcePropType;
  colors: [string, string, ...string[]];   // top-left → bottom-right
  particle: Particle;
  accents: string[];            // particle colours
  source: EventSource;
  priority: number;             // higher wins when two land on one day
  badge?: string | ((grade: number) => string);
  cta?: { label: string; go: TabId };
  // Local reminders for predictable days. Admin days are pushed by the server.
  eve?: string;                 // 7 PM the day before
  morning?: string;             // 7:15 AM on the day
};

const art = {
  alarm: require('../../assets/homework/alarm.png'),
  party: require('../../assets/homework/party.png'),
  bulb: require('../../assets/subjects/bulb.png'),
  skier: require('../../assets/subjects/skier.png'),
  globe: require('../../assets/subjects/globe.png'),
  megaphone: require('../../assets/subjects/megaphone.png'),
  sparkles: require('../../assets/subjects/sparkles.png'),
  books: require('../../assets/subjects/books.png'),
  lantern: require('../../assets/subjects/lantern.png'),
  heart: require('../../assets/subjects/redheart.png'),
  seedling: require('../../assets/subjects/seedling.png'),
  blossom: require('../../assets/subjects/blossom.png'),
  icecream: require('../../assets/food/ice-cream.png'),
  shoe: require('../../assets/subjects/shoe.png'),
  star: require('../../assets/subjects/star.png'),
};

const BLUE_GOLD = ['#FFFFFF', '#F6D58B', '#9CC9F0'];
const CONFETTI = ['#FFD166', '#EF476F', '#06D6A0', '#4CC9F0', '#FFFFFF'];

export const EVENT_TEMPLATES: EventTemplate[] = [
  // ── Admin (App Club posts these) ──────────────────────────────
  {
    id: 'snow-day', name: 'Snow Day', title: 'Snow Day!', source: 'admin', priority: 100,
    body: 'School is closed today. Stay warm, stay off the Upper Levels, and check back for updates.',
    art: art.skier, colors: ['#A9D4F5', '#4A94D6', '#1A3A5C'], particle: 'snow', accents: ['#FFFFFF'],
    badge: 'a-christmas-miracle',
  },
  {
    id: 'multicultural-lunch', name: 'Multicultural Lunch', title: 'Multicultural Lunch', source: 'admin', priority: 60,
    body: 'Food from around the world at lunch today. Bring a few dollars and an appetite.',
    art: art.globe, colors: ['#F2A541', '#D8572A', '#7A1E48'], particle: 'confetti', accents: CONFETTI,
    cta: { label: 'Open the caf menu', go: 'lunch' },
  },
  {
    id: 'spirit-day', name: 'Spirit Day', title: 'Spirit Day', source: 'admin', priority: 60,
    body: 'Wear blue and gold. Show up loud.',
    art: art.megaphone, colors: ['#E3B55B', '#B68842', '#14304E'], particle: 'confetti', accents: ['#FFFFFF', '#F6D58B', '#3B8BD9'],
  },
  {
    id: 'announcement', name: 'Big news', title: 'Big news', source: 'admin', priority: 50,
    body: '',
    art: art.star, colors: ['#3B8BD9', '#1A3A5C'], particle: 'sparkle', accents: BLUE_GOLD,
  },

  // ── Calendar ──────────────────────────────────────────────────
  {
    id: 'first-day', name: 'First day', title: 'Welcome back, Spartans', source: 'calendar', priority: 90,
    body: 'Staggered start today. Check in to your homeroom (Block 1-1) at your grade\'s time.',
    art: art.sparkles, colors: ['#3B8BD9', '#1A3A5C', '#0E2238'], particle: 'sparkle', accents: BLUE_GOLD,
    badge: grade => (grade === 12 ? 'last-first-day' : 'welcome-to-sentinel'),
    eve: 'School starts tomorrow. Staggered start, check your grade\'s time.',
    morning: 'First day! Check in to your homeroom.',
  },
  {
    id: 'last-day', name: 'Last day', title: 'Last day of school', source: 'calendar', priority: 90,
    body: 'You made it. Have a great summer.',
    art: art.party, colors: ['#FFC857', '#F08A4B', '#C0392B'], particle: 'confetti', accents: CONFETTI,
    badge: 'freedom-from-2026',
    eve: 'Tomorrow is the last day of school.',
    morning: 'Last day of school. You made it.',
  },
  {
    id: 'winter-return', name: 'Back from break', title: 'New year, same homework', source: 'calendar', priority: 70,
    body: 'Welcome back from winter break. Your timetable picks up where it left off.',
    art: art.books, colors: ['#7FA7D3', '#2A5687', '#14304E'], particle: 'snow', accents: ['#FFFFFF'],
    badge: 'new-year-same-homework',
    cta: { label: 'See today\'s blocks', go: 'dayview' },
    eve: 'Winter break ends. School is back tomorrow.',
  },
  {
    id: 'collab', name: 'Collab Day', title: 'Collab Day', source: 'calendar', priority: 40,
    body: 'Teachers meet first thing, so you get a late start. Classes begin at 9:25.',
    art: art.alarm, colors: ['#4FB3E8', '#2E74BD', '#1A3A5C'], particle: 'bubble', accents: ['#FFFFFF', '#BFE3FA'],
    cta: { label: 'See today\'s blocks', go: 'dayview' },
    eve: 'Tomorrow is a Collab Day. Classes start at 9:25.',
    morning: 'Collab Day: sleep in, classes start at 9:25.',
  },
  {
    id: 'prod', name: 'Pro-D Day', title: 'Pro-D Day', source: 'calendar', priority: 40,
    body: 'No classes today. Teachers are learning, you are not.',
    art: art.bulb, colors: ['#2A5687', '#14304E', '#0E2238'], particle: 'sparkle', accents: ['#F6D58B', '#FFFFFF'],
    eve: 'Tomorrow is a Pro-D Day. No classes.',
  },
  {
    id: 'early-dismissal', name: 'Early dismissal', title: 'Early dismissal', source: 'calendar', priority: 30,
    body: 'School lets out early today.',
    art: art.shoe, colors: ['#7FA86E', '#5B7A4E', '#2F4A2A'], particle: 'bubble', accents: ['#FFFFFF', '#DDEBD3'],
    cta: { label: 'See today\'s blocks', go: 'dayview' },
    eve: 'Early dismissal tomorrow.',
  },

  // ── Same date every year ──────────────────────────────────────
  {
    id: 'halloween', name: 'Halloween', title: 'Happy Halloween', source: 'date', priority: 20,
    body: 'Costumes welcome. Candy encouraged.',
    art: art.lantern, colors: ['#F39237', '#A13D12', '#2A1024'], particle: 'sparkle', accents: ['#FFB347', '#FFFFFF'],
    badge: 'spooky-sentinel',
  },
  {
    id: 'valentines', name: 'Valentine\'s Day', title: 'Happy Valentine\'s Day', source: 'date', priority: 20,
    body: 'Be nice to someone today.',
    art: art.heart, colors: ['#F58CA8', '#D6456E', '#7A1E48'], particle: 'bubble', accents: ['#FFFFFF', '#FFD1DC'],
    badge: 'cupid-s-victim',
  },
  {
    id: 'st-patricks', name: 'St. Patrick\'s Day', title: 'St. Patrick\'s Day', source: 'date', priority: 20,
    body: 'Wear green or else.',
    art: art.seedling, colors: ['#7ACB7A', '#3E8E4F', '#1F4A2C'], particle: 'confetti', accents: ['#FFFFFF', '#C7F0B8', '#FFD166'],
    badge: 'lucky-sentinel',
  },
  {
    id: 'spring', name: 'First day of spring', title: 'First day of spring', source: 'date', priority: 20,
    body: 'Rain, but warmer rain.',
    art: art.blossom, colors: ['#F7B6C8', '#9CC9F0', '#3B8BD9'], particle: 'bubble', accents: ['#FFFFFF', '#FFD1DC'],
    badge: 'hope',
  },
  {
    id: 'june', name: 'June 1', title: 'Summer loading…', source: 'date', priority: 20,
    body: 'One month to go. Finals first.',
    art: art.icecream, colors: ['#FFD27A', '#F2A541', '#3B8BD9'], particle: 'sparkle', accents: ['#FFFFFF', '#FFF1C1'],
    badge: 'summer-loading',
  },
];

export const templateById = (id: string) =>
  EVENT_TEMPLATES.find(t => t.id === id) || EVENT_TEMPLATES.find(t => t.id === 'announcement')!;

// Admin templates, in the order App Club Admin lists them.
export const ADMIN_TEMPLATES = EVENT_TEMPLATES.filter(t => t.source === 'admin');

const BY_DATE: Record<string, string> = {
  '10-31': 'halloween', '02-14': 'valentines', '03-17': 'st-patricks', '03-20': 'spring', '06-01': 'june',
};

// One day's banner, ready to show.
export type EventDay = {
  key: string;                  // "collab:2026-09-24", unique per template + date
  iso: string;
  template: EventTemplate;
  title: string;
  body: string;
  chips: string[];
  badge?: string;
  popupId?: string;             // admin days: the popups row
  image?: string;               // admin days: photo behind the banner
};

const hasClasses = (d?: CalDay) => !!d?.code;

// Calendar-derived landmarks, computed once.
const DAYS = Object.keys(CALENDAR).sort();
const LAST_DAY = [...DAYS].reverse().find(iso => hasClasses(CALENDAR[iso]));
const WINTER_RETURN = (() => {
  const breakDays = DAYS.filter(iso => CALENDAR[iso].kind === 'break' && iso.slice(5, 7) === '12');
  const last = breakDays[breakDays.length - 1];
  return last ? DAYS.find(iso => iso > last && hasClasses(CALENDAR[iso])) : undefined;
})();

const calendarTemplate = (iso: string, d?: CalDay): string | null => {
  if (!d) return null;
  if (d.label === 'First day') return 'first-day';
  if (iso === LAST_DAY) return 'last-day';
  if (iso === WINTER_RETURN) return 'winter-return';
  if (d.kind === 'collab') return 'collab';
  if (d.kind === 'prod') return 'prod';
  if (d.early && hasClasses(d)) return 'early-dismissal';
  return null;
};

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const chipsFor = (tpl: EventTemplate, d?: CalDay): string[] => {
  const out: string[] = [];
  if (tpl.id === 'prod' || tpl.id === 'snow-day') return ['No classes'];
  if (d?.code) out.push(`Day ${d.code[0]}`);
  if (tpl.id === 'collab') out.push('Classes 9:25');
  if (d?.early) out.push(`Out at ${fmt12(d.early)}`);
  return out;
};

const make = (tpl: EventTemplate, iso: string, grade: number, extra?: Partial<EventDay>): EventDay => ({
  key: `${tpl.id}:${iso}`,
  iso,
  template: tpl,
  title: tpl.title,
  body: tpl.body,
  chips: chipsFor(tpl, CALENDAR[iso]),
  badge: typeof tpl.badge === 'function' ? tpl.badge(grade) : tpl.badge,
  ...extra,
});

// Admin popups active on `iso` (local date), as event days.
const fromPopups = (iso: string, popups: Popup[], grade: number): EventDay[] => popups
  .filter(p => toISO(new Date(p.starts_at)) <= iso && toISO(new Date(p.ends_at)) >= iso)
  .map(p => {
    const tpl = templateById(p.template_id);
    return make(tpl, iso, grade, {
      key: `${tpl.id}:${iso}:${p.id}`,
      title: p.title || tpl.title,
      body: p.body || tpl.body,
      badge: p.badge_id ?? (typeof tpl.badge === 'function' ? tpl.badge(grade) : tpl.badge),
      popupId: p.id,
      image: p.image_url || undefined,
    });
  });

// Every banner for one day, most important first.
export const eventDaysOn = (iso: string, popups: Popup[] = [], grade = 8): EventDay[] => {
  const out = fromPopups(iso, popups, grade);
  const cal = calendarTemplate(iso, CALENDAR[iso]);
  if (cal) out.push(make(templateById(cal), iso, grade));
  const dated = BY_DATE[iso.slice(5)];
  if (dated && inSchoolYear(iso)) out.push(make(templateById(dated), iso, grade));
  return out.sort((a, b) => b.template.priority - a.template.priority);
};

// Preview any template on any day (App Club Admin gallery).
export const previewDay = (tplId: string, iso: string, grade = 8): EventDay =>
  make(templateById(tplId), iso, grade, { key: `preview:${tplId}` });

export const addDays = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
