# Spartans

Sentinel Secondary's unofficial app, run by the School App Club — iOS + Android
from one codebase. (Was "Sentinel"; renamed in the v3 rebrand. Scope lives in
`~/Desktop/School App/School app code/SCOPE-v3.md`.)
Ported from the React web prototype in `~/Desktop/School App/School app code`,
which stays around as the pixel reference.

## Run

```bash
npm start          # Metro; press i / a for a simulator, or scan with Expo Go
npm run web        # browser preview at localhost:8081
```

Native device builds need a full Xcode install (iOS) and Android Studio:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Layout

```
App.tsx                     shell — providers, screen switch, fonts, 430px phone frame
src/nav.tsx                 active screen + one-deep back (tabs: Home · Buzz · Calendar · Social · More)
src/stores.tsx              persisted stores: pins (Quick links), grades (class card), personal events
src/pages.ts                the pages listed on More; pinned ones become Quick links on Home
src/xp.ts                   XP + level from unlocked badges (local until the backend)
src/descriptions.ts         class card blurbs (subject-level fallback until the course book text lands)
src/theme.ts                design tokens (was styles.css :root)
src/ThemeContext.tsx        light/dark, persisted to AsyncStorage
src/data.ts                 mock news / announcements / homework
src/calendar.ts             GENERATED — 2026–2027 Sentinel calendar (rotation codes, events)
src/bell.ts                 2026–27 bell schedules (FIT / regular / collaboration) + day-plan builder
src/useToday.ts             live "now": current block, mm:ss countdown, progress (ticks each second)
src/PreviewTime.tsx         TEMPORARY time-of-day scrubber behind the play button on Home
src/weather.ts              live weather for the hero card (Open-Meteo, no key, school coords)
src/staff.ts                staff directory with real emails (school staff page, Sep 2026)
src/ProfileContext.tsx      student + 8 timetable slots (1-1…2-4) + extra classes, persisted
src/badges.ts               badge catalogue (120) — rarity, category, earned-badge store; art is placeholder
src/catalog.ts              course list (2025–26 Course Book) + staff list for autocomplete
src/auth.ts                 pure-JS SHA-256; passwords stored salted-hashed, never in clear
src/supabase.ts             Supabase client (keys from .env — see BACKEND.md)
src/backend.ts              typed helpers over the backend: auth, profile, admin, buzz, badges, social
supabase/migrations/        the schema + row-level rules (0001_init.sql); seed/ has the badge catalogue
src/screens/OnboardingScreen.tsx  splash, 7-step sign up, sign in (also "Edit profile & classes")
src/components/Icon.tsx     stroke icon set (react-native-svg) incl. weather + tab glyphs
src/components/Crest.tsx    the real school crest (assets/crest*.png) + wordmark
src/components/Chrome.tsx   Spartans brand mark (placeholder helmet), Header, NowDot, Grid, TabBar (5 tabs)
src/components/AppHeader.tsx the header every screen shows: brand · bell · avatar (or back + title)
src/components/ClassCard.tsx the class card sheet (info, next time, description, editable grades)
src/components/Cards.tsx    announcement / event / quick-link cards
src/components/BadgeArt.tsx placeholder hexagon badge art + rarity pill
src/screens/BadgesScreen.tsx  Badges page sheet (sort by rarity / category) + badge detail sheet
src/screens/*.tsx           Home, NewsScreen (= the Buzz tab), Calendar (month + week), Social, More,
                            DayView, Homework, Contacts, Profile
```

## Web → native mapping

| Web prototype | Here |
|---|---|
| `var(--ink)` | `useTheme().c.ink` |
| CSS `box-shadow` | `shadow.sm/md/lg` (shadow* + elevation) |
| `linear-gradient(Ndeg, …)` | `expo-linear-gradient` + `angleToVector(N)` |
| `repeating-linear-gradient` (Pro-D hatch) | SVG `<Line>` set in `CalendarScreen` |
| `radial-gradient` (photo sheen) | SVG `<RadialGradient>` in `ProfileScreen` |
| `backdrop-filter` (tab bar) | `expo-blur` `BlurView` |
| `@keyframes nowPulse` | `NowDot` — Animated scale + fade ring |
| `@keyframes sheetIn` | `DaySheet` — Animated translateY + opacity |
| `-webkit-line-clamp` | `numberOfLines` |
| `grid-template-columns: repeat(n, 1fr)` | `<Grid cols={n} gap={g}>` (measures, then sizes cells) |
| `localStorage` | `AsyncStorage` |

## Calendar data

`src/calendar.ts` is generated (throwaway Python script) from two official
sources: the West Vancouver Schools "School Year 2026 - 2027" district calendar
(holidays, Pro-D, breaks, first/last day) and Sentinel's "Block Rotation
Schedule September 7th – October 30th, 2026" sheet, which was verified
day-by-day. Rotation codes after Oct 30 are projected from the weekly A/B
pattern that sheet follows and carry `projected: true` (the day sheet says
"Rotation projected"). Sync days and Collaboration Days beyond October are not
published yet. Regenerate rather than hand-edit when the school posts the next
sheet.

Bell times come from the "2026-2027 Sentinel Bell Schedule" PDF (`src/bell.ts`).

"Today" uses the device clock while the date is inside the school year and
falls back to Thu Sep 17 2026, 9:32 AM otherwise (labelled "demo date" for the
owner only). The dashed play button (owner only, `src/devAccess.ts`) beside the greeting is a TEMPORARY scrubber for previewing
other times of day — delete it and `src/PreviewTime.tsx` once the live card is
signed off.

## Contacts

`src/staff.ts` holds the staff directory scraped from the school's staff page,
with real `@wvschools.ca` addresses. The Contacts tab lists the student's own
teachers first (matched by last name, then first initial; unmatched teachers
get a pattern-derived address flagged "unverified"), then counselling (the
student's counsellor by last-name range is flagged "Yours"), admin, office,
library and the school's main lines. Tapping a row copies the address and
opens the mail app.

## Timetable model

Sentinel runs 8 blocks: 1-1…1-4 on Day 1 and 2-1…2-4 on Day 2. A rotation code
like `2-23F14` means Day 2, so its digits map to the student's 2-2, 2-3, 2-1,
2-4 courses. Block 1-1 is homeroom. School email is `firstl###@edu.sd45.bc.ca` (e.g. johnd907).
Rooms are 3 digits starting with the floor (1, 2 or 3), optionally with a letter (149A), or a
named space from `ROOM_NAMES` (PORT, GYM, LIB…). The named list is a best guess until the posted
school map is checked. A block can be marked Spare. The last block (1-4 / 2-4) offers the district
Premier Academies first.

## Backend

Supabase. `BACKEND.md` is the zero-to-running setup; `GITHUB.md` is how the club
shares the repo and hands it over each year. Screens still run local-only until
they are wired to `src/backend.ts` (phase 2).

## Accounts

One local account per device. Sign up saves the profile plus a salted SHA-256 of
the password (`src/auth.ts`) and opens a session. Sign out keeps the account;
Sign in checks school email (or its local part) or student number + password.
There is no server yet, so nothing syncs between devices.

## Structure (v3)

Tabs: Home · Buzz · Calendar · Social · More. Contacts, Homework, Profile and Day view are reached
from More, Quick links or the header avatar. Every screen shows the same header (brand, bell,
avatar); there is no search. Tapping a class anywhere opens the class card. More pages carry a pin;
pinned pages are the Quick links on Home. The temporary time-preview button sits in the corner of
the rotation card and its chips open beneath the card.

## Known gaps

- News, announcements and homework are still mock data — no backend, no auth.
- The bell opens the Buzz; Map, Lunch menu, Library, Grades and University on More are
  placeholders for later phases. Social is a placeholder until accounts exist.
- The Spartans logo is a placeholder helmet glyph until the real files land.
- Weather needs network; the hero shows "—" until Open-Meteo answers.
