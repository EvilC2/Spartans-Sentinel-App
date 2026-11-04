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

// Seasonal badges take their colour from the season, not the rarity: fall is
// orange, winter light blue, spring green, summer yellow. The Seasonal group
// heading rotates through all four.
export type Season = 'fall' | 'winter' | 'spring' | 'summer';

export type Badge = {
  id: string;
  title: string;
  desc: string;
  rarity: Rarity;
  category: Category;
  flavor?: string;   // one line under the unlock date on the detail sheet
  season?: Season;   // seasonal badges only
  tint?: Tint;       // seasonal: colour sampled from the badge's own outline
  art?: any;         // real art, when it exists
  custom?: CustomArt; // made by the Badge team in App Club Admin (src/badgeDesigns.ts)
  designId?: string;  // the design it came from
  editedAt?: string;  // last approved Badge team edit (ISO), for "recent" sorting
};

// Art for a badge made in the Badge team wizard. `template` is the rarity's
// blank hexagon; `icon` puts a PNG on top of it (x/y: centre offset as a
// fraction of the badge box, -0.5…0.5; scale: icon width as a fraction of
// the box); `image` is a PNG that replaces the whole badge.
// `original` (edits to a built-in badge only) keeps the shipped art.
export type CustomArt =
  | { mode: 'original' }
  | { mode: 'template' }
  | { mode: 'icon'; uri: string; x: number; y: number; scale: number }
  | { mode: 'image'; uri: string };

export type Tint = { label: string; color: string; light: string; dark: string; chrome?: boolean };

export const SEASON: Record<Season, Tint> = {
  fall:   { label: 'Fall',   color: '#F0862B', light: '#FFB878', dark: '#B55A0F' },
  winter: { label: 'Winter', color: '#5FB3F0', light: '#C9E8FF', dark: '#2A7FC4' },
  spring: { label: 'Spring', color: '#4CC079', light: '#A6EBBF', dark: '#25874F' },
  summer: { label: 'Summer', color: '#F2B705', light: '#FFE08A', dark: '#B98700' },
};
export const SEASON_ORDER: Season[] = ['fall', 'winter', 'spring', 'summer'];

// The colour a badge is drawn in: its season if it has one, else its rarity.
export const tintOf = (b: Pick<Badge, 'rarity' | 'season' | 'tint'>): Tint =>
  b.tint ?? (b.season ? SEASON[b.season] : RARITY[b.rarity]);

// Build a tint from one hex colour: lighter and darker companions for the
// rim gradient, glow and unlock burst.
const mix = (hex: string, to: number, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (sh: number) => Math.round(((n >> sh) & 255) * (1 - t) + to * t).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`.toUpperCase();
};
export const tintFrom = (label: string, color: string): Tint =>
  ({ label, color, light: mix(color, 255, 0.45), dark: mix(color, 0, 0.35) });

export const RARITY_ORDER: Rarity[] = [
  'exotic', 'legendary', 'epic', 'rare', 'uncommon', 'common', 'special', 'seasonal', 'secret',
];

export const RARITY: Record<Rarity, Tint> = {
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
  ['Front Row', 'Check into an event early', 'common', 'events', "Early arrival has its perks."],
  ['Got homework?', 'Open the app after the school day is over', 'common', 'app', "School might be over. Work isn't."],
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
  // ── Added from the Spartans Badge Map (Oct 2026) ──
  ['The Walk', 'Cross the stage at commencement', 'epic', 'milestones', "Don't trip."],
  ['Officially Official', 'Receive your diploma or graduation package', 'epic', 'milestones', "It's real now."],
  ['After Party', 'Attend the official dry grad celebration', 'epic', 'events', 'The night after the night.'],
  ['End Credits', 'Complete your final high-school exam', 'epic', 'academic', 'Roll them.'],
  ['Senior Meeting', 'Attend the official graduation assembly', 'epic', 'events', 'Listen up, Grade 12.'],
  ['Class Colours', 'Pick up official grad clothing or merchandise', 'epic', 'milestones', 'Wear it loud.'],
  ['The Final Chapter', 'Attend the graduation kickoff or information session', 'epic', 'events', 'It begins. For the last time.'],
  ['Say Cheese', 'Complete official graduation photos', 'epic', 'milestones', 'Chin up. Hold it.'],
  ['Ready for the Walk', 'Attend graduation rehearsal', 'epic', 'events', 'Practice makes graduates.'],
  ['Class Dismissed', 'Complete the final scheduled day of Grade 12 classes', 'epic', 'milestones', 'For good.'],
  ['Prom Night', 'Attend the official school prom', 'epic', 'events', 'Dance like no one is filming. They are.'],
  ['Ticket to the Night', 'Purchase or receive an official prom ticket', 'epic', 'events', 'Admit one.'],
  ['Future Funded', 'Submit a school-approved scholarship application', 'epic', 'academic', 'Paperwork that pays.'],
  ['Under the Stars', 'Attend the official senior campout', 'epic', 'events', 'No signal. No problem.'],
  ['Golden Hour', 'Participate in the official senior sunrise', 'epic', 'events', 'First light, last year.'],
  ['One Last Sunset', 'Participate in the official senior sunset', 'epic', 'events', 'Golden, then gone.'],
  ['What Does This Do?', 'Find a secret interaction in the app, like long-pressing the Sentinel logo', 'secret', 'app', 'Curiosity rewarded.'],
  ['Class of 2027', 'Permanent graduation-year badge', 'legendary', 'milestones', 'Your year. Forever.'],
  ['Social Butterfly', 'Attend events across sports, arts, clubs and more', 'epic', 'events', 'Everywhere at once.'],
  ['Volunteer', 'Participate in a school volunteer activity', 'rare', 'social', 'Hands up.'],
];

// Real badge art, keyed by id. The first ten came from
// ~/Desktop/SentinelApp/App Badge used; the rest from the Spartans Badge Map
// (PDF extractions for seasonal/secret, Piper.xlsx 900px renders with the
// white knocked out for the others). All trimmed and padded to 810px squares
// (270pt @3x) so every badge sits at the same scale.
const ART: Record<string, any> = {
  '1-fan': require('../assets/badges/1-fan.png'),
  '1-more-year': require('../assets/badges/1-more-year.png'),
  '100-hours': require('../assets/badges/100-hours.png'),
  '12th-man': require('../assets/badges/12th-man.png'),
  'a-christmas-miracle': require('../assets/badges/a-christmas-miracle.png'),
  'academic-comeback': require('../assets/badges/academic-comeback.png'),
  'academic-weapon': require('../assets/badges/academic-weapon.png'),
  'after-party': require('../assets/badges/after-party.png'),
  'am-i-unc': require('../assets/badges/am-i-unc.png'),
  'april-fools': require('../assets/badges/april-fools.png'),
  'back-to-school': require('../assets/badges/back-to-school.png'),
  'baller': require('../assets/badges/baller.png'),
  'baller-jr': require('../assets/badges/baller-jr.png'),
  'behind-the-curtain': require('../assets/badges/behind-the-curtain.png'),
  'behind-the-wheel': require('../assets/badges/behind-the-wheel.png'),
  'bringing-it-home': require('../assets/badges/bringing-it-home.png'),
  'campout': require('../assets/badges/campout.png'),
  'cap-gown': require('../assets/badges/cap-gown.png'),
  'class-colours': require('../assets/badges/class-colours.png'),
  'class-dismissed': require('../assets/badges/class-dismissed.png'),
  'class-of-27-28-etc': require('../assets/badges/class-of-27-28-etc.png'),
  'collector': require('../assets/badges/collector.png'),
  'completionist': require('../assets/badges/completionist.png'),
  'costume-commitment': require('../assets/badges/costume-commitment.png'),
  'cupid-s-victim': require('../assets/badges/cupid-s-victim.png'),
  'day-one': require('../assets/badges/day-one.png'),
  'early-adopter': require('../assets/badges/early-adopter.png'),
  'end-credits': require('../assets/badges/end-credits.png'),
  'entering-the-big-leagues': require('../assets/badges/entering-the-big-leagues.png'),
  'final-boss': require('../assets/badges/final-boss.png'),
  'freedom': require('../assets/badges/freedom.png'),
  'friday-night-lights': require('../assets/badges/friday-night-lights.png'),
  'front-row': require('../assets/badges/front-row.png'),
  'full-circle': require('../assets/badges/full-circle.png'),
  'future-funded': require('../assets/badges/future-funded.png'),
  'game-day': require('../assets/badges/game-day.png'),
  'golden-hour': require('../assets/badges/golden-hour.png'),
  'got-homework': require('../assets/badges/got-homework.png'),
  'group-costume': require('../assets/badges/group-costume.png'),
  'halfway-point': require('../assets/badges/halfway-point.png'),
  'highschool-sweethearts': require('../assets/badges/highschool-sweethearts.png'),
  'holiday-spirit': require('../assets/badges/holiday-spirit.png'),
  'home-field-advantage': require('../assets/badges/home-field-advantage.png'),
  'honor-roll': require('../assets/badges/honor-roll.png'),
  'hope': require('../assets/badges/hope.png'),
  'identity-crisis': require('../assets/badges/identity-crisis.png'),
  'is-it-smoky-in-here': require('../assets/badges/is-it-smoky-in-here.png'),
  'last-first-day': require('../assets/badges/last-first-day.png'),
  'lucky-sentinel': require('../assets/badges/lucky-sentinel.png'),
  'main-character': require('../assets/badges/main-character.png'),
  'master-oogway': require('../assets/badges/master-oogway.png'),
  'mic-check': require('../assets/badges/mic-check.png'),
  'mvp': require('../assets/badges/mvp.png'),
  'nerd': require('../assets/badges/nerd.png'),
  'new-kid': require('../assets/badges/new-kid.png'),
  'new-year-same-homework': require('../assets/badges/new-year-same-homework.png'),
  'non-capisco': require('../assets/badges/non-capisco.png'),
  'officially-official': require('../assets/badges/officially-official.png'),
  'on-stage': require('../assets/badges/on-stage.png'),
  'one-last-sunset': require('../assets/badges/one-last-sunset.png'),
  'ones-for-every-theme-day': require('../assets/badges/ones-for-every-theme-day.png'),
  'perfect-month': require('../assets/badges/perfect-month.png'),
  'phew-that-was-easy': require('../assets/badges/phew-that-was-easy.png'),
  'playoffs': require('../assets/badges/playoffs.png'),
  'president': require('../assets/badges/president.png'),
  'prom-night': require('../assets/badges/prom-night.png'),
  'published': require('../assets/badges/published.png'),
  'ready-for-the-walk': require('../assets/badges/ready-for-the-walk.png'),
  'say-cheese': require('../assets/badges/say-cheese.png'),
  'school-app-jesus': require('../assets/badges/school-app-jesus.png'),
  'secret-admirer': require('../assets/badges/secret-admirer.png'),
  'senior-assassin': require('../assets/badges/senior-assassin.png'),
  'senior-meeting': require('../assets/badges/senior-meeting.png'),
  'senior-sunrise': require('../assets/badges/senior-sunrise.png'),
  'senior-sunset': require('../assets/badges/senior-sunset.png'),
  'sentinel-alumni': require('../assets/badges/sentinel-alumni.png'),
  'she-s-melting': require('../assets/badges/she-s-melting.png'),
  'social-butterfly': require('../assets/badges/social-butterfly.png'),
  'speedrunner': require('../assets/badges/speedrunner.png'),
  'spooky-sentinel': require('../assets/badges/spooky-sentinel.png'),
  'summer-loading': require('../assets/badges/summer-loading.png'),
  'team-captain': require('../assets/badges/team-captain.png'),
  'that-s-okay-i-m-a-member': require('../assets/badges/that-s-okay-i-m-a-member.png'),
  'the-axrtist': require('../assets/badges/the-axrtist.png'),
  'the-final-chapter': require('../assets/badges/the-final-chapter.png'),
  'the-regular': require('../assets/badges/the-regular.png'),
  'the-victory-lap': require('../assets/badges/the-victory-lap.png'),
  'the-walk': require('../assets/badges/the-walk.png'),
  'ticket-to-the-night': require('../assets/badges/ticket-to-the-night.png'),
  'top-dog': require('../assets/badges/top-dog.png'),
  'trick-or-treat': require('../assets/badges/trick-or-treat.png'),
  'triple-threat': require('../assets/badges/triple-threat.png'),
  'under-the-stars': require('../assets/badges/under-the-stars.png'),
  'volunteer': require('../assets/badges/volunteer.png'),
  'watch-the-roads': require('../assets/badges/watch-the-roads.png'),
  'welcome-to-sentinel': require('../assets/badges/welcome-to-sentinel.png'),
  'what-does-this-do': require('../assets/badges/what-does-this-do.png'),
  'winter-arc': require('../assets/badges/winter-arc.png'),
  'you-weren-t-supposed-to-find-this': require('../assets/badges/you-weren-t-supposed-to-find-this.png'),
};

// Which season each seasonal badge belongs to (by id).
const SEASON_OF: Record<string, Season> = {
  'she-s-melting': 'winter', 'group-costume': 'fall', 'new-year-same-homework': 'winter',
  'winter-arc': 'winter', 'lucky-sentinel': 'spring', 'holiday-spirit': 'winter',
  'freedom-from-2026': 'summer', 'hope': 'spring', 'secret-admirer': 'winter',
  'back-to-school': 'fall', 'trick-or-treat': 'fall', 'cupid-s-victim': 'winter',
  'costume-commitment': 'fall', 'spooky-sentinel': 'fall', 'summer-loading': 'summer',
};

// Seasonal badges: the detail-sheet wash and unlock burst take the colour of
// the badge's own outline (sampled from the art) instead of the season's.
const OUTLINE: Record<string, string> = {
  'back-to-school': '#F6A60B',        // gold pencils
  'hope': '#6C9019',                  // spring green wreath
  'cupid-s-victim': '#D13E38',        // red heart frame
  'group-costume': '#C8521F',         // pumpkin orange
  'holiday-spirit': '#2E7A28',        // wreath green
  'lucky-sentinel': '#1F7A2A',        // clover green
  'secret-admirer': '#9A1D24',        // burgundy
  'she-s-melting': '#41ADF6',         // ice blue
  'spooky-sentinel': '#6B2FA0',       // purple flame
  'summer-loading': '#F8A10E',        // sun orange
  'trick-or-treat': '#EC6208',        // pumpkin
  'winter-arc': '#48A7EF',            // ice blue
  'costume-commitment': '#8A3FB8',    // purple dragon
  'new-year-same-homework': '#C9962A',// gold on navy
};

export const BADGES: Badge[] = ROWS.map(([title, desc, rarity, category, flavor]) => {
  const id = slug(title) || 'unknown';
  const season = rarity === 'seasonal' ? SEASON_OF[id] : undefined;
  const tint = season && OUTLINE[id] ? tintFrom(SEASON[season].label, OUTLINE[id]) : undefined;
  return { id, title, desc, rarity, category, flavor, art: ART[id], season, tint };
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
  'campout': '2026-08-28',
  'game-day': '2026-09-11',
  'got-homework': '2026-09-11',
};

export const isUnlocked = (b: Badge) => b.id in UNLOCKED;
export const unlockedOn = (b: Badge): Date | null => UNLOCKED[b.id] ? new Date(UNLOCKED[b.id] + 'T12:00:00') : null;

export const formatUnlockDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export const sortByRarity = (list: Badge[]) =>
  [...list].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.title.localeCompare(b.title));
