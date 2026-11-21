// Spartans — Catch Up: the questions, and which badges the answers earn.
// Catch Up gives a student what they would already have if they had been using
// the app since they started at Sentinel. It runs on the honour system.
//
// A badge comes from one of three places:
//   1. Every account: first login, first day.
//   2. Time at Sentinel: worked out from the grade, the grade they started in
//      and today's date (milestones, and dated badges like Halloween).
//   3. Answers: an option lists the badges it earns.
// Left out on purpose: badges only someone else can give (The GOAT), things no
// phone could know (streaks, opening the app at night), and questions a school
// app shouldn't ask (relationships, "Is it smoky in here?").
//
// Every id here must also be in catch_up_allowed() (migration 0019, widened in
// 0022), or the server won't keep it. The screen is src/screens/CatchUpScreen.tsx.

import type { ImageSourcePropType } from 'react-native';
import { BADGES, Badge, RARITY_ORDER } from './badges';
import { RARITY_XP, gradeXp } from './xp';

export const CATCH_UP_NAME = 'Catch Up';

export type Answers = Record<string, string | string[]>;

type Ctx = { grade: number; start: number; prior: boolean };
export type Option = { id: string; label: string; sub?: string; badges?: string[] };
export type Question = {
  id: string;
  section: string;
  art: ImageSourcePropType;
  prompt: string;
  sub?: string;
  multi?: boolean;
  options: Option[] | ((x: Ctx) => Option[]);
  when?: (x: Ctx, a: Answers) => boolean;
};

const ART = {
  crest: require('../assets/brand/spartan-roundel.png'),
  trophy: require('../assets/subjects/trophy.png'),
  megaphone: require('../assets/subjects/megaphone.png'),
  sparkles: require('../assets/subjects/sparkles.png'),
  council: require('../assets/subjects/council.png'),
  gradcap: require('../assets/subjects/gradcap.png'),
  palette: require('../assets/subjects/palette.png'),
  key: require('../assets/subjects/key.png'),
  blossom: require('../assets/subjects/blossom.png'),
  star: require('../assets/subjects/star.png'),
};

const playsSport = (_: Ctx, a: Answers) => !!a.sports && a.sports !== 'none';
// Been here long enough for "three years in a row" to be possible.
const longTimer = (x: Ctx) => x.grade - x.start >= 2;

export const QUESTIONS: Question[] = [
  {
    id: 'start', section: 'Your time here', art: ART.crest,
    // Read as "what grade are you starting?" by some Grade 12s, so it says
    // plainly that Grade 8 means "been here the whole time".
    prompt: 'Which grade were you in when you first started at Sentinel?',
    sub: 'Been here since the start of high school? That’s Grade 8.',
    options: x => [8, 9, 10, 11, 12].filter(g => g <= x.grade).map(g => ({
      id: String(g),
      label: `Grade ${g}`,
      sub: g === 8 ? (x.grade > 8 ? 'Been at Sentinel the whole time' : 'Started this year, like everyone in Grade 8')
        : g === x.grade ? 'New this year' : undefined,
    })),
  },
  {
    id: 'arrival', section: 'Your time here', art: ART.crest,
    prompt: 'Before Sentinel, where were you?',
    options: x => [
      // Grade 8 is the first year of high school, so a Grade 8 start can't be a transfer.
      ...(x.start === 8
        ? [{ id: 'local', label: 'Elementary school', sub: 'Came up to Sentinel for Grade 8' }]
        : [
          { id: 'transfer', label: 'Another high school', badges: ['new-kid'] },
          { id: 'elementary', label: 'Elementary or middle school', sub: 'Some schools go past Grade 7' },
          { id: 'moved', label: 'Somewhere out of town' },
        ]),
      { id: 'exchange', label: 'Here on an exchange program', badges: ['non-capisco'] },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'sports', section: 'Sports', art: ART.trophy,
    prompt: 'In one school year, how many Sentinel teams have you been on?',
    sub: 'Your busiest year. Real teams, tryouts and all.',
    options: [
      { id: 'none', label: 'None' },
      { id: 'one', label: 'One team', badges: ['sentinel-athlete', 'playmaker'] },
      { id: 'two', label: 'Two teams', badges: ['sentinel-athlete', 'playmaker', 'multi-sport-athlete'] },
      { id: 'three', label: 'Three or more', badges: ['sentinel-athlete', 'playmaker', 'multi-sport-athlete', 'triple-threat'] },
    ],
  },
  {
    id: 'sportsDone', section: 'Sports', art: ART.trophy, multi: true, when: playsSport,
    prompt: 'On your teams, have you ever…',
    sub: 'Pick all that are true.',
    options: x => [
      { id: 'game', label: 'Played in an actual game', badges: ['game-day'] },
      { id: 'home', label: 'Competed at Sentinel', badges: ['home-field-advantage'] },
      { id: 'away', label: 'Competed at an away game', badges: ['road-warrior'] },
      { id: 'playoffs', label: 'Made the playoffs', badges: ['playoffs'] },
      { id: 'champs', label: 'Won a championship', badges: ['bringing-it-home'] },
      { id: 'captain', label: 'Been named captain', badges: ['team-captain'] },
      { id: 'mvp', label: 'Been named team MVP', badges: ['mvp'] },
      { id: 'soccerJr', label: 'Played junior soccer', badges: ['baller-jr'] },
      { id: 'soccerSr', label: 'Played senior soccer', badges: ['baller'] },
      ...(x.start === 8 && x.grade === 12 ? [{ id: 'everyYear', label: 'Played a sport every single year', badges: ['five-year-athlete'] }] : []),
    ],
  },
  {
    id: 'fan', section: 'In the stands', art: ART.megaphone, multi: true,
    prompt: 'Cheering from the stands, have you…',
    sub: 'Pick all that are true.',
    options: [
      { id: 'friday', label: 'Been to a Friday night game', badges: ['friday-night-lights'] },
      { id: 'rivalry', label: 'Been to a big rivalry game', badges: ['derby-day'] },
      { id: 'win', label: 'Watched Sentinel win in person', badges: ['good-luck-charm'] },
      { id: 'ten', label: 'Been to 10 or more games', badges: ['12th-man'] },
      { id: 'five', label: 'Watched 5 different Sentinel teams', badges: ['1-fan'] },
    ],
  },
  {
    id: 'events', section: 'School life', art: ART.sparkles, multi: true,
    prompt: 'At school events, have you…',
    sub: 'Dances, assemblies, spirit days, shows.',
    options: x => [
      { id: 'first', label: 'Been to any school event', badges: ['little-sentinel'] },
      { id: 'spirit', label: 'Joined a spirit event', badges: ['school-spirit'] },
      { id: 'early', label: 'Shown up early to one', badges: ['front-row'] },
      { id: 'ten', label: 'Been to 10 or more events', badges: ['the-regular'] },
      { id: 'all', label: 'Been to sports, arts and club events', badges: ['social-butterfly'] },
      { id: 'theme', label: 'Dressed up for every theme day', badges: ['ones-for-every-theme-day'] },
      ...(x.start === 8 && x.grade > 8 ? [{ id: 'again', label: 'Gone back to an event from Grade 8', badges: ['full-circle'] }] : []),
    ],
  },
  {
    id: 'traditions', section: 'School life', art: ART.blossom, multi: true,
    prompt: 'Which Sentinel traditions have you been part of?',
    options: [
      { id: 'costume', label: 'Dressed up for a Halloween costume day', badges: ['costume-commitment'] },
      { id: 'group', label: 'Done a group Halloween costume', badges: ['group-costume'] },
      { id: 'december', label: 'Joined a December spirit event', badges: ['holiday-spirit'] },
      { id: 'valentine', label: 'Sent an anonymous Valentine through the school', badges: ['secret-admirer'] },
      { id: 'prank', label: 'Pulled off an April Fools prank', badges: ['april-fools'] },
    ],
  },
  {
    id: 'clubs', section: 'Clubs', art: ART.council,
    prompt: 'How many clubs have you joined at Sentinel?',
    sub: 'Clubs, council, committees, bands, crews. Sports teams are earlier.',
    options: [
      { id: 'none', label: 'None yet' },
      { id: 'some', label: 'One or two', badges: ['first-time'] },
      { id: 'many', label: 'Three or more', badges: ['first-time', 'that-s-okay-i-m-a-member'] },
    ],
  },
  {
    id: 'people', section: 'Clubs', art: ART.council, multi: true,
    prompt: 'Outside of class, have you…',
    options: x => [
      { id: 'lead', label: 'Led a club or been on its exec', badges: ['president'] },
      ...(longTimer(x) ? [{ id: 'loyal', label: 'Stuck with the same club or team for 3 years', badges: ['bleeds-sentinel'] }] : []),
      { id: 'volunteer', label: 'Volunteered with the school', badges: ['volunteer'] },
      { id: 'hours', label: 'Reached 100 volunteer hours', badges: ['volunteer', '100-hours'] },
      { id: 'study', label: 'Joined a group study session', badges: ['study-buddy'] },
    ],
  },
  {
    id: 'academics', section: 'Classes', art: ART.gradcap, multi: true,
    prompt: 'In your classes, have you…',
    sub: 'Pick all that are true.',
    options: x => [
      { id: 'honor', label: 'Made the honour roll', badges: ['honor-roll'] },
      { id: 'distinction', label: 'Earned an academic distinction', badges: ['academic-weapon'] },
      { id: 'both', label: 'Earned academic recognition while on a team', badges: ['athlete-scholar'] },
      { id: 'comeback', label: 'Raised your marks a lot between terms', badges: ['comeback-season', 'academic-comeback'] },
      { id: 'nerd', label: 'Taken 5 hard courses', badges: ['nerd'] },
      ...(x.grade >= 11 ? [{ id: 'boss', label: 'Taken AP Calculus and AP Physics', badges: ['final-boss'] }] : []),
      { id: 'published', label: 'Had work in a school publication', badges: ['published'] },
    ],
  },
  {
    id: 'attendance', section: 'Classes', art: ART.star, multi: true,
    prompt: 'How about showing up and studying?',
    sub: 'Pick all that are true.',
    options: x => [
      { id: 'week', label: 'A full week without missing a class', badges: ['perfect-week'] },
      { id: 'month', label: 'A full month without missing a class', badges: ['perfect-week', 'perfect-month'] },
      { id: 'late', label: 'A whole term without being late', badges: ['on-time'] },
      ...(x.prior ? [{ id: 'exams', label: 'Properly studied through an exam week', badges: ['locked-in'] }] : []),
    ],
  },
  {
    id: 'stage', section: 'Arts', art: ART.palette, multi: true,
    prompt: 'On stage or behind it, have you…',
    options: [
      { id: 'stage', label: 'Performed in front of the school', badges: ['on-stage'] },
      { id: 'music', label: 'Performed music or live audio', badges: ['mic-check'] },
      { id: 'show', label: 'Been in a school production', badges: ['opening-night'] },
      { id: 'crew', label: 'Worked backstage on a production', badges: ['behind-the-curtain'] },
      { id: 'art', label: 'Had your art displayed at school', badges: ['the-axrtist'] },
    ],
  },
  {
    id: 'licence', section: 'Out of school', art: ART.key,
    when: x => x.grade >= 10,
    prompt: 'Do you drive?',
    options: [
      { id: 'none', label: 'Not yet' },
      { id: 'l', label: 'I have my L', badges: ['behind-the-wheel'] },
      { id: 'n', label: 'I have my N', badges: ['behind-the-wheel', 'watch-the-roads'] },
    ],
  },
  {
    id: 'senior', section: 'Grade 12', art: ART.gradcap, multi: true,
    when: x => x.grade === 12,
    prompt: 'So far this year, have you…',
    options: [
      { id: 'sunrise', label: 'Gone to senior sunrise', badges: ['senior-sunrise', 'golden-hour'] },
      { id: 'splash', label: 'Played senior splash', badges: ['senior-assassin'] },
      { id: 'photos', label: 'Done your grad photos', badges: ['say-cheese'] },
      { id: 'merch', label: 'Picked up grad clothing', badges: ['class-colours'] },
      { id: 'kickoff', label: 'Gone to the grad kickoff', badges: ['the-final-chapter'] },
      { id: 'assembly', label: 'Gone to the grad assembly', badges: ['senior-meeting'] },
      { id: 'scholarship', label: 'Applied for a school-approved scholarship', badges: ['future-funded'] },
    ],
  },
];

// ── Working it out ───────────────────────────────────────────────
const ctxOf = (grade: number, a: Answers): Ctx => {
  const picked = Number(a.start);
  const start = picked >= 8 && picked <= grade ? picked : grade;
  return { grade, start, prior: start < grade };
};

export const optionsOf = (q: Question, grade: number, a: Answers): Option[] => {
  const x = ctxOf(grade, a);
  return typeof q.options === 'function' ? q.options(x) : q.options;
};

// The questions that apply, which depends on the grade and earlier answers.
export const questionsFor = (grade: number, a: Answers): Question[] => {
  const x = ctxOf(grade, a);
  return QUESTIONS.filter(q => !q.when || q.when(x, a));
};

const answered = (q: Question, a: Answers) => {
  const v = a[q.id];
  return q.multi ? Array.isArray(v) : typeof v === 'string' && !!v;
};
export const firstUnanswered = (grade: number, a: Answers) => {
  const list = questionsFor(grade, a);
  const i = list.findIndex(q => !answered(q, a));
  return i < 0 ? list.length - 1 : i;
};

// How far through, 0-99. 100 is only for a finished Catch Up.
export const scoreFor = (grade: number, a: Answers) => {
  const list = questionsFor(grade, a);
  if (!list.length) return 0;
  return Math.min(99, Math.round((list.filter(q => answered(q, a)).length / list.length) * 100));
};

// Dated badges, by [month, day] of the date they arrive on.
const DATED: [string, number, number][] = [
  ['back-to-school', 9, 8], ['spooky-sentinel', 10, 31], ['trick-or-treat', 10, 31],
  ['she-s-melting', 11, 25], ['winter-arc', 12, 1], ['new-year-same-homework', 1, 5],
  ['cupid-s-victim', 2, 14], ['lucky-sentinel', 3, 17], ['hope', 3, 20], ['summer-loading', 6, 1],
];

// Was this month and day already reached in the current school year?
const reached = (now: Date, month: number, day: number) => {
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return now.getTime() >= new Date(month >= 9 ? startYear : startYear + 1, month - 1, day).getTime();
};

// Every badge these answers earn. `owned` counts toward the collection badges.
export const badgesFrom = (grade: number, a: Answers, owned: string[] = [], now = new Date()): string[] => {
  const x = ctxOf(grade, a);
  const out = new Set<string>(['hello-world', 'welcome-to-sentinel', 'first-bell']);
  const add = (...ids: string[]) => ids.forEach(id => out.add(id));

  // Time at Sentinel
  if (x.start === 8) add('fresh-meat');
  if (x.prior || reached(now, 10, 1)) add('not-lost-anymore', 'survived-september');
  if (x.prior) add('phew-that-was-easy', 'freedom-from-2026');
  if (x.start === 8 && grade >= 9) add('tutorial-complete');
  if (x.start <= 10 && (grade > 10 || (grade === 10 && reached(now, 2, 1)))) add('halfway-point');
  if (x.start <= 10 && grade >= 11) add('am-i-unc');
  if (x.start <= 11 && grade >= 11) add('entering-the-big-leagues');
  if (x.start <= 11 && grade === 12) add('1-more-year');
  if (grade === 12) add('top-dog', 'last-first-day', 'class-of-2027');
  if (grade === 12 && reached(now, 6, 1)) add('the-victory-lap');   // the final month of Grade 12

  // Dates: everything if they were here last year, otherwise what has passed.
  for (const [id, m, d] of DATED) if (x.prior || reached(now, m, d)) add(id);

  // Answers
  for (const q of questionsFor(grade, a)) {
    const v = a[q.id];
    const picked = Array.isArray(v) ? v : v ? [v] : [];
    for (const o of optionsOf(q, grade, a)) if (picked.includes(o.id)) add(...(o.badges || []));
  }

  // Collection badges: this haul counts.
  add('achievement-unlocked');
  const count = new Set([...out, ...owned]).size;
  if (count >= 5) add('speedrunner');
  if (count >= 10) add('badge-hunter');
  if (count >= 25) add('badge-addict');
  if (count >= 50) add('collector');

  return [...out].filter(id => BADGES.some(b => b.id === id));
};

// Commons first, so the rarest land last in the reveal.
export const revealOrder = (list: Badge[]) =>
  [...list].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.title.localeCompare(b.title));

export const catchUpXp = (grade: number, list: Badge[]) => ({
  grade: gradeXp(grade),
  badges: list.reduce((s, b) => s + RARITY_XP[b.rarity], 0),
});
