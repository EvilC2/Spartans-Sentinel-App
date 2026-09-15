// Sentinel — badge catalogue.
// Every badge has a rarity (drives the colour) and a category (drives the
// grouping on the Badges page). Art is a placeholder hexagon until the real
// asset lands in `ART` (keyed by badge id, files in assets/badges/).
//
// "secret" is not one of the eight rarities Clive listed but the badge list
// tags several badges with it, so it is kept as a ninth tier: dark, and the
// description stays hidden until unlocked.
//
// Unlocks are local-only for now (no backend). `UNLOCKED` is demo data so the
// page has something to show; swap for a store when accounts sync.

export type Rarity =
  | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'exotic' | 'special' | 'seasonal' | 'secret';

export type Category =
  | 'sports' | 'academic' | 'classes' | 'app' | 'social' | 'fun' | 'events' | 'milestones' | 'seasonal';

export type Badge = {
  id: string;
  title: string;
  desc: string;
  rarity: Rarity;
  category: Category;
  flavor?: string;   // one line under the unlock date on the detail sheet
  art?: any;         // future image asset
};

export const RARITY_ORDER: Rarity[] = [
  'exotic', 'legendary', 'epic', 'rare', 'uncommon', 'common', 'special', 'seasonal', 'secret',
];

export const RARITY: Record<Rarity, { label: string; color: string; light: string; dark: string; chrome?: boolean }> = {
  common:    { label: 'Common',    color: '#8A93A0', light: '#B9C0CA', dark: '#5C6470' },
  uncommon:  { label: 'Uncommon',  color: '#3FA35B', light: '#7DD394', dark: '#22763A' },
  rare:      { label: 'Rare',      color: '#2F7CF6', light: '#7AB2FF', dark: '#1B4FB3' },
  epic:      { label: 'Epic',      color: '#8E44E8', light: '#BE8CFF', dark: '#5C1FA6' },
  legendary: { label: 'Legendary', color: '#D9A21B', light: '#F5D77A', dark: '#9A6E07' },
  exotic:    { label: 'Exotic',    color: '#9AA3AD', light: '#F2F5F8', dark: '#4D555E', chrome: true },
  special:   { label: 'Special',   color: '#F05A9B', light: '#FFA3CB', dark: '#B0296A' },
  seasonal:  { label: 'Seasonal',  color: '#F0862B', light: '#FFB878', dark: '#B55A0F' },
  secret:    { label: 'Secret',    color: '#2B2F36', light: '#5A606A', dark: '#0F1216' },
};

export const CATEGORY_ORDER: Category[] = [
  'milestones', 'academic', 'classes', 'sports', 'events', 'social', 'app', 'fun', 'seasonal',
];

export const CATEGORY: Record<Category, string> = {
  milestones: 'Milestones', academic: 'Academic', classes: 'Classes', sports: 'Sports',
  events: 'Events', social: 'Social', app: 'App', fun: 'Fun', seasonal: 'Seasonal',
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// [title, description, rarity, category, flavor?]
type Row = [string, string, Rarity, Category, string?];
const ROWS: Row[] = [
  ['The GOAT', 'Awarded to a single outstanding person in every grade year', 'exotic', 'milestones', 'One per grade. Ever.'],
  ['MVP', 'Be the most valued player on your team', 'legendary', 'sports', 'The team knows who carried.'],
  ['Highschool sweethearts', 'Relationship with another Sentinel Student', 'special', 'social', 'Cute. Gross. Cute.'],
  ['Is it smoky in here?', 'Spend an unusual amount of time in the bathroom', 'secret', 'fun', 'We saw nothing.'],
  ["She's melting", 'November 25th', 'seasonal', 'seasonal', 'Winter is coming.'],
  ['Group costume', 'Participate in a group Halloween costume', 'seasonal', 'seasonal', 'Coordination is a skill.'],
  ['Nerd', 'Take 5 difficult courses', 'rare', 'academic', 'Respect. Also, sleep.'],
  ['Non capisco!', 'Transfer to Sentinel in an exchange program', 'rare', 'milestones', 'Welcome from afar.'],
  ['Behind the wheel', 'Get your L licence', 'rare', 'milestones', 'The parking lot fears you.'],
  ['Watch the roads!!', 'Get your N licence', 'rare', 'milestones', 'One passenger. Just one.'],
  ['Am I Unc?', 'Complete grade 10 at Sentinel', 'epic', 'milestones', 'Not yet. Getting there.'],
  ['Halfway point', 'Get halfway through grade 10 at Sentinel', 'epic', 'milestones', 'Downhill from here. Kind of.'],
  ['Entering the big leagues', 'Start grade 11 at Sentinel', 'epic', 'milestones', 'It counts now.'],
  ['Freedom?', 'Last day of high school ever', 'legendary', 'milestones', 'Now what?'],
  ['Baller Jr', 'Join the Junior soccer team', 'rare', 'sports', 'Shin pads on.'],
  ['Baller', 'Join the senior soccer team', 'rare', 'sports', 'Big pitch energy.'],
  ['Ones for every theme day', 'Tight and bright, etc', 'legendary', 'events', 'You never missed one.'],
  ['School App Jesus', 'Found the school app', 'legendary', 'app', 'It began here.'],
  ['Senior Assassin', 'Participate in senior splash', 'epic', 'events', 'Trust no one.'],
  ['Campout', 'Attend Senior Campout', 'legendary', 'events', 'Smoke, stars, no sleep.'],
  ['Home Field Advantage', 'Compete at Sentinel', 'rare', 'sports', 'The crowd was yours.'],
  ['Bringing it home', 'Win a championship', 'legendary', 'sports', 'Banner material.'],
  ['The Regular', 'Attend 10 events', 'epic', 'events', 'Always there.'],
  ['New Year, Same Homework', 'First school day after winter break', 'seasonal', 'seasonal', 'It was waiting for you.'],
  ['First time?', 'Join your first club', 'uncommon', 'social', 'Everyone starts somewhere.'],
  ['Friday Night Lights', 'Attend/support a Friday game', 'rare', 'sports', 'Best night of the week.'],
  ['Playmaker', 'Join your first team', 'uncommon', 'sports', 'Welcome to the roster.'],
  ['Speedrunner', 'Unlock several badges in one day', 'secret', 'app', 'Any% badges.'],
  ['Tutorial Complete', 'Finish Grade 8', 'uncommon', 'milestones', 'The real game starts now.'],
  ['Completionist', 'Own badges from every category', 'secret', 'app', 'All of them. Wow.'],
  ['Final Boss', 'Take AP Calculus and AP Physics', 'legendary', 'academic', 'Good luck. Genuinely.'],
  ['Achievement Unlocked', 'Get your first badge', 'common', 'app', 'The first of many.'],
  ["You Weren't Supposed to Find This", 'Find your first in-app easter egg', 'secret', 'fun', 'Shh.'],
  ['Collector', 'Collect 50 badges', 'epic', 'app', 'Half the shelf full.'],
  ['Comeback Season', 'Improve significantly between terms', 'common', 'academic', 'Redemption arc.'],
  ['Behind the Curtain', 'Work backstage in a theatre production', 'rare', 'classes', 'Unseen, essential.'],
  ['Master Oogway', 'Finish senior mentorship for the grade 8s', 'epic', 'social', 'There are no accidents.'],
  ['Winter Arc', 'December', 'seasonal', 'seasonal', 'Lock in.'],
  ['Lucky Sentinel', "St. Patrick's Day", 'seasonal', 'seasonal', 'Wear green or else.'],
  ['A Christmas Miracle', 'Open the app during an official snow day', 'secret', 'seasonal', 'It actually happened.'],
  ['Welcome to Sentinel', 'First day', 'rare', 'milestones', 'Day one of the rest of it.'],
  ['Playoffs', 'Reach the postseason', 'epic', 'sports', 'Win or go home.'],
  ['Phew! That was easy.', 'Finish exam season', 'rare', 'academic', 'Hard work paid off. Time to breathe.'],
  ['Early Adopter', 'Join during launch year', 'secret', 'app', 'You were here first.'],
  ['First Bell', 'Complete your first school day', 'common', 'milestones', 'One down.'],
  ['April Fools', 'Successfully complete an April fools prank', 'epic', 'fun', 'Nobody got hurt. Right?'],
  ['Where Am I?', 'View the school map for the first time', 'common', 'app', 'Third floor is up.'],
  ['Sentinel Alumni', 'Unlocks after graduation', 'legendary', 'milestones', 'Once a Sentinel.'],
  ['Holiday Spirit', 'Participate in a December spirit event', 'seasonal', 'seasonal', 'Ugly sweater approved.'],
  ['#1 fan', 'Attend games for 5 different Sentinel teams', 'epic', 'sports', 'Loudest in the gym.'],
  ['Badge Addict', 'Collect 25 badges', 'common', 'app', 'Getting serious.'],
  ["That's okay, I'm a Member", 'Join 3 clubs', 'rare', 'social', 'Lunch is booked.'],
  ['Full Circle', 'Attend an event you also attended in Grade 8', 'rare', 'events', 'Same place, new you.'],
  ['Published', 'Get something into a school publication', 'epic', 'academic', 'In print.'],
  ['Game Day', 'Compete in your first game', 'uncommon', 'sports', 'Nerves are normal.'],
  ['On Time', 'Perfect punctuality streak', 'common', 'academic', 'Before the bell.'],
  ['Exam Season', 'Open the study section during finals', 'uncommon', 'academic', 'Cramming counts.'],
  ['Team Captain', 'Be named captain', 'legendary', 'sports', 'Lead by example.'],
  ['Ancient Knowledge', 'Answer a Sentinel-history trivia question', 'uncommon', 'fun', 'Since 1962.'],
  ['Cap & Gown', 'Graduation day', 'epic', 'milestones', 'Toss it.'],
  ['Freedom from 2026', 'Last day of school', 'seasonal', 'seasonal', 'See you in September.'],
  ['Mic Check', 'Perform music/live audio', 'epic', 'classes', 'Is this thing on?'],
  ['School Spirit', 'Attend a spirit event', 'uncommon', 'events', 'Blue and gold.'],
  ['..hope?', 'First day of spring', 'seasonal', 'seasonal', 'Rain, but warmer rain.'],
  ['Identity Crisis', 'Change your profile picture 3 times', 'secret', 'app', 'Which one is you?'],
  ['Academic Comeback', 'Improve your term 1 grades significantly', 'rare', 'academic', 'Told you so.'],
  ['The Axrtist', 'Have work displayed at school', 'rare', 'classes', 'On the wall.'],
  ['President', 'Lead a club', 'epic', 'social', 'Meetings are on you now.'],
  ['12th Man', 'Attend 10 school sporting events as a fan', 'rare', 'sports', 'Part of the team.'],
  ['Touch Grass', 'Secret badge for not opening the app all weekend', 'common', 'fun', 'Proud of you.'],
  ['Road Warrior', 'Compete at an away game', 'uncommon', 'sports', 'Bus ride included.'],
  ['Locked In', 'Study during exam week', 'uncommon', 'academic', 'Phone face down.'],
  ['Day One', "Join on the app's launch day", 'secret', 'app', 'Literally day one.'],
  ['The Victory Lap', 'Make it to the final month of Grade 12', 'epic', 'milestones', 'Coast. Carefully.'],
  ['Badge Hunter', 'Collect 10 badges', 'common', 'app', 'The hunt begins.'],
  ['Sentinel Athlete', 'Play one school sport', 'common', 'sports', 'Rep the crest.'],
  ['Home Turf', '100 school-day app streak', 'uncommon', 'app', 'Every single day.'],
  ['???', 'Description stays hidden until unlocked', 'common', 'fun', 'Told you it was hidden.'],
  ['Multi-Sport Athlete', 'Play 2+ sports in one year', 'uncommon', 'sports', 'Two seasons, one body.'],
  ['Academic Weapon', 'Earn an academic distinction', 'rare', 'academic', 'Certified.'],
  ['On Stage', 'Perform in front of the school', 'rare', 'classes', 'Spotlight on.'],
  ['Secret Admirer', 'Send an anonymous school-approved Valentine/message', 'seasonal', 'seasonal', 'They will never know.'],
  ['Back to School', 'Log in during the first week', 'seasonal', 'seasonal', 'Fresh notebooks.'],
  ['Trick or Treat', 'Secret Halloween badge', 'seasonal', 'seasonal', 'Boo.'],
  ['Triple Threat', 'Play 3+ sports', 'epic', 'sports', 'Do you sleep?'],
  ['Perfect Month', 'No missed classes for a month', 'rare', 'academic', 'Every seat, every day.'],
  ['Not Lost Anymore', '30 days at Sentinel', 'common', 'milestones', 'You know the stairs now.'],
  ['Study Buddy', 'Join a group study session', 'common', 'social', 'Better together.'],
  ["Cupid's Victim", "Valentine's Day", 'seasonal', 'seasonal', 'Roses are red.'],
  ['Top Dog', 'Become a Grade 12', 'legendary', 'milestones', 'The building is yours.'],
  ['Derby Day', 'Attend a major rivalry game', 'uncommon', 'sports', 'Bragging rights.'],
  ['Good luck charm', 'Sentinel wins a game you attended', 'uncommon', 'sports', 'Coincidence? No.'],
  ['Hello World', 'First login', 'common', 'app', 'Welcome in.'],
  ['Senior Sunrise', 'Participate in a senior sunrise event', 'epic', 'events', 'Worth the alarm.'],
  ['1 more year', 'Complete grade 11 at Sentinel', 'epic', 'milestones', 'Almost.'],
  ['Touch Grass II', 'Go an entire school break without opening the app', 'uncommon', 'fun', 'Real life, confirmed.'],
  ['Senior Sunset', 'Participate in senior sunset', 'epic', 'events', 'Golden hour, last time.'],
  ['Explorer', 'Use every main part of the app', 'common', 'app', 'Nothing left unturned.'],
  ["At This Point It's Personal", 'Lose a trivia/game feature several times in a row', 'uncommon', 'fun', 'One more try.'],
  ['Survived September', 'Make it through the first month', 'uncommon', 'milestones', 'The hardest one.'],
  ['Athlete + Scholar', 'Team athlete with strong academic recognition', 'common', 'academic', 'Both. At once.'],
  ['New Kid', 'Transfer to Sentinel from a different school', 'rare', 'milestones', 'Fresh start.'],
  ['Perfect Week', 'No missed classes for a week', 'uncommon', 'academic', 'Five for five.'],
  ['Little Sentinel', 'Attend your first school event', 'common', 'events', 'First of many.'],
  ['Early Bird', 'Open it before school', 'common', 'app', 'Before the first bell.'],
  ['OG', 'One of the first 200 users', 'common', 'app', 'Original.'],
  ['Five-Year Athlete', 'Play a sport every year', 'uncommon', 'sports', 'Never missed a season.'],
  ['Chronically Online', '30-day app streak', 'uncommon', 'app', 'Take a break. Or not.'],
  ['Opening Night', 'Participate in a school production', 'uncommon', 'classes', 'Break a leg.'],
  ['Fresh Meat', 'Join as a Grade 8', 'uncommon', 'milestones', 'Welcome, tiny one.'],
  ['NPC', 'Go a year without joining any extracurriculars', 'uncommon', 'fun', 'Background character.'],
  ['Main Character', 'Do something cool in front of the whole school', 'exotic', 'social', 'Everyone saw.'],
  ['Night Owl', 'Use the app unusually late during a school night', 'common', 'app', 'Go to sleep.'],
  ['Costume Commitment', 'Participate in a Halloween costume day', 'seasonal', 'seasonal', 'Fully committed.'],
  ['Spooky Sentinel', 'Halloween', 'seasonal', 'seasonal', 'Spooky season.'],
  ['Summer Loading…', 'First day of June', 'seasonal', 'seasonal', 'Almost there.'],
  ['Honor Roll', 'Self-explanatory', 'rare', 'academic', 'On the list.'],
  ['100 Hours', 'Major volunteering milestone', 'epic', 'social', 'Time well given.'],
  ['Last First Day', 'Open the app on your final first day of school', 'epic', 'milestones', 'Make it count.'],
  ['Bleeds Sentinel', 'Major long-term school participation achievement', 'common', 'milestones', 'Blue and gold forever.'],
];

// Real badge art, keyed by id. Source PNGs live in
// ~/Desktop/School App/App Badges USE THESE; resized to 810px (270pt @3x).
const ART: Record<string, any> = {
  'phew-that-was-easy': require('../assets/badges/phew-that-was-easy.png'),
};

export const BADGES: Badge[] = ROWS.map(([title, desc, rarity, category, flavor]) => {
  const id = slug(title) || 'unknown';
  return { id, title, desc, rarity, category, flavor, art: ART[id] };
});

// Demo unlocks (ISO dates). Replace with a real store once accounts sync.
export const UNLOCKED: Record<string, string> = {
  'hello-world': '2026-09-08',
  'welcome-to-sentinel': '2026-09-08',
  'achievement-unlocked': '2026-09-08',
  'first-bell': '2026-09-08',
  'back-to-school': '2026-09-09',
  'where-am-i': '2026-09-10',
  'early-bird': '2026-09-10',
  'phew-that-was-easy': '2026-06-27',
};

export const isUnlocked = (b: Badge) => b.id in UNLOCKED;
export const unlockedOn = (b: Badge): Date | null => UNLOCKED[b.id] ? new Date(UNLOCKED[b.id] + 'T12:00:00') : null;

export const formatUnlockDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export const sortByRarity = (list: Badge[]) =>
  [...list].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.title.localeCompare(b.title));
