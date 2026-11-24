# Notifications

How Spartans tells students things: the bell menu inside the app, real phone
notifications, and the big event-day banners.

## The three parts

| Part | What the student sees | Code |
| --- | --- | --- |
| **Notification menu** | Bell on every screen with a red count. **To do** on top (friend requests to accept or decline, homework coming due to tick off, right in the list), then **New**, then what you have read by day. Topic chips, swipe left to remove, Undo for everything. | `src/components/NotificationCenter.tsx` |
| **Phone notifications** | Real lock-screen alerts, app icon badge count. Tapping one opens the exact thing it is about. | `src/notify/push.ts` |
| **Event banners** | A big themed card the first time you open the app on a special day. Closing it can unlock a badge. | `src/components/EventBanner.tsx`, `src/notify/eventDays.ts` |

`src/notify/NotifyProvider.tsx` ties them together. `src/notify/feed.ts` builds
every notification from data the app already has, so the bell and the lock
screen always say the same thing.

## What sends what

| Topic (Settings switch) | Example | Sent by | When |
| --- | --- | --- | --- |
| Homework due | "Due tomorrow: Lab report" | the phone | 7 PM the evening before |
| Homework due | "Test Thursday: Unit 3" (quizzes and tests) | the phone | 7 PM three evenings before, if it was added before then |
| Homework due | "Test tomorrow: Unit 3 · Good luck!" | the phone | 7 PM the evening before |
| First class | "First up: Chemistry 11 at 8:30" | the phone | 15 min before first block on school days; tapping it opens the app, which starts the Lock Screen card |
| Calendar | "Tomorrow is a Pro-D Day. No classes." | the phone | 7 PM the evening before |
| Calendar | "Collab Day: sleep in, classes start at 9:25." | the phone | 7:15 AM on the day |
| Calendar | Your own events | the phone | 30 min before (or 7:30 AM if no time) |
| Announcements | Only ones posted with **push** on | the server | when published |
| Friend requests | "Priya Nair wants to be friends" | the server | when sent |
| Badges | "You earned Honor Roll" | the server | when App Club awards one |
| (always) | Snow day and other posted banners | the server | when posted; ignores topic switches, respects **Pause everything** |

Phone reminders are scheduled on the device, so they work with no signal and
no server. They are rebuilt whenever homework, events or settings change
(iOS allows 64 at a time; we keep the next 60).

## What a tap opens

Same from the bell and the lock screen (`exactAction` and `act`):

| About | Opens |
| --- | --- |
| Homework, quiz, test | that task on Homework, unfolded and marked |
| First class | that class's card |
| Your event, a day off, a Collab or Pro-D day, a club event | that day in Calendar, the event marked |
| Announcement | that post, in the reader |
| Trivia, poll, fact | that slide in The Buzz |
| Friend request | that request on Social (the friend, if already accepted) |
| Badge | that badge |
| Banner | that banner |

Screens receive it with `useFocus` (`src/nav.tsx`), which waits for data that is
still loading. Server pushes need no change: the row id they already carry
(`posts:<id>`, `friend_requests:<id>`) says what to open.

## Event banners

Three sources:

- **School calendar** (`src/calendar.ts`): first day, last day, first day
  back from winter break, Collab Day, Pro-D Day, early dismissal.
- **Same date every year**: Halloween, Valentine's, St. Patrick's, first day
  of spring, June 1.
- **Posted by App Club** (App Club Admin → Event banners → Post one for
  today): snow day, multicultural lunch, spirit day, big news. Needs the
  `popups` role.

Shown once per day per banner. If two land on one day, the higher priority
one shows first and the next waits until the first (and its badge) closes.
Today's banners stay at the top of the notification menu so they can be
opened again.

### Badges paired with banners

Closing the banner unlocks the badge (once). The button says **Claim badge**
when there is one to get, except for secret badges, which stay a surprise.

| Banner | Badge |
| --- | --- |
| Snow Day | A Christmas Miracle (secret) |
| First day | Welcome to Sentinel (Grade 12: Last First Day) |
| Last day | Freedom from 2026 |
| Back from winter break | New Year, Same Homework |
| Halloween | Spooky Sentinel |
| Valentine's Day | Cupid's Victim |
| St. Patrick's Day | Lucky Sentinel |
| First day of spring | ..hope? |
| June 1 | Summer Loading… |
| Collab, Pro-D, Multicultural Lunch, Spirit Day, Early dismissal | none yet |

To pair a badge: add `badge: '<badge-id>'` to the template in
`src/notify/eventDays.ts`. For posted banners the server decides
(`claim_popup_badge` checks the banner is live and has that badge).

### Adding a new banner

Add a template to `EVENT_TEMPLATES` in `src/notify/eventDays.ts`: name, title,
body, art (any Fluent 3D PNG in `assets/`), 2 or 3 gradient colours, a
particle style (`snow`, `confetti`, `sparkle`, `bubble`), and where it comes
from. Preview it in App Club Admin → Event banners.

## Going live (what's still needed)

Everything above works in the app today. Web preview shows the menu and
banners but has no phone notifications. To get real ones:

1. **Rebuild the app on your Mac** (new native code was added). Two
   commands, a few minutes each:
   `npx expo prebuild --platform ios`
   `npx expo run:ios`
   After that, open the bell and tap **Turn on**. Local reminders now work
   with no server.
   Heads up: the rebuild adds Apple's push permission to the app. The
   simulator doesn't care, but installing on a real iPhone with a free Apple
   account will fail to sign until you have the paid Developer account
   (step 2).
2. **Server pushes** (snow days, announcements, friend requests, badge
   awards) also need:
   - An Expo account and `eas init` in the project (gives the app its
     `projectId`, which the push token needs).
   - An Apple Developer account ($99/yr) so Apple will deliver pushes to
     iPhones. `eas credentials` sets up the push key.
   - Run `supabase/migrations/0006_notifications.sql` on the Supabase
     project (after 0004 and 0005).
   - Deploy the sender: `supabase functions deploy send-push`
   - In Supabase → Database → Webhooks, add four webhooks pointing at the
     `send-push` function: `popups` (insert, update), `announcements`
     (insert, update), `friend_requests` (insert), `badge_awards` (insert).
3. Queued content (publish later) does not trigger a push when its time
   comes; only publishing now does. If that matters, add a `pg_cron` job
   later.

## Stored on the phone

All keys start with `spartans-` so Delete account wipes them:
`spartans-inbox-v1` (read / removed), `spartans-banners-seen-v1`,
`spartans-badges-earned-v1`, `spartans-notify-v1` (settings).
