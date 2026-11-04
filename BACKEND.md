# Spartans backend

Supabase (Postgres + auth + storage). Free tier is plenty for one school.
This is the `BACKEND.md` that `SCOPE-v3.md` points at.

What lives where:

```
supabase/migrations/0001_init.sql   every table, role rule and function — the whole backend
supabase/seed/badges.sql            badge catalogue + XP values (generated from src/badges.ts)
scripts/badge-seed.mjs              regenerates the seed when badges.ts changes
src/supabase.ts                     the client; reads keys from .env
src/backend.ts                      typed helpers screens call (auth, buzz, admin, badges, social…)
.env.example                        copy to .env, fill in two values
```

Rules the server enforces (never the app): school-email-only sign-up,
one role writes only its own content, single-use invite codes, badge
awards need a reason, friends-only profile reads.

---

## Set up from zero (once, ~15 minutes)

Do these on your Mac in a browser.

### 1. Make the account under the club, not you

Supabase projects belong to an **organization**. Make the org first so it can
be handed over when you graduate (see *Handover* at the bottom).

1. Go to https://supabase.com and click **Start your project**.
2. Sign in with GitHub. Use the **club GitHub org account** if it exists
   (see `GITHUB.md`); otherwise your own for now — ownership moves later.
3. When asked for an organization, name it `Sentinel School App Club`.
   Plan: **Free**.

### 2. Create the project

1. **New project**.
2. Name: `spartans`. Region: **Canada (Central)** or **West US** — closest.
3. Database password: click **Generate**, then paste it into the club's
   password manager. You rarely need it again; the app never uses it.
4. Click **Create new project** and wait ~2 minutes.

### 3. Run the schema

1. Left sidebar → **SQL Editor** → **New query**.
2. On your Mac, open `supabase/migrations/0001_init.sql`, select all, copy.
3. Paste into the editor and click **Run**. It should say *Success*.
4. New query again. Paste all of `supabase/seed/badges.sql`. **Run**.

If step 3 errors, the message names the line. Fix nothing by hand — tell the
chat, and re-run after a reset:

```sql
drop schema public cascade; create schema public;
```

### 4. Turn off email confirmation (for now)

Sign-up would otherwise wait for a click in an email the district may filter.

1. Sidebar → **Authentication** → **Sign In / Providers** → **Email**.
2. Turn **Confirm email** off. Save.

Revisit once the club has tested that `@edu.sd45.bc.ca` receives Supabase mail.

### 5. Put the keys in the app

1. Sidebar → **Project Settings** → **API Keys**.
2. Copy **Project URL** and the **publishable** (anon) key. The *secret* /
   *service_role* key never goes in the app.
3. In Terminal:

```bash
cp ~/Projects/SentinelApp/.env.example ~/Projects/SentinelApp/.env
```

4. Open `~/Projects/SentinelApp/.env` and paste the two values.
5. Restart Metro (`npm start`) — env vars are read at start.

`.env` is git-ignored. Every club member who runs the app copies these two
values in themselves; they are not secret, but keep them out of commits so a
project swap is one file.

### 6. Make yourself owner

1. Run the app, sign up with your school email.
2. SQL Editor → new query:

```sql
insert into members (user_id, role)
select id, 'owner' from profiles where email = 'YOU###@edu.sd45.bc.ca';
```

That is the only manual role grant ever needed. From now on, the owner
creates invite codes in the app (`admin.createInvite('news')`) and hands them
to club members, who redeem them in **Settings → App Club Admin**.

---

## How it fits together

### Roles

`trivia` `polls` `news` `menu` `popups` `badges` `library` `owner`.

- `has_role(r)` — true if the signed-in user holds `r` (or `owner`) and it
  was not revoked. Every write policy is `has_role(...)`.
- `create_invite(role, days)` — owner only. Returns a 10-character code,
  expires in `days` (default 7).
- `redeem_invite(code)` — binds that role to the caller. Single use.
- `revoke_role(user, role)` — owner only. Sets `revoked_at`; the row stays as
  the audit trail.

### Content

Every content table has `status` (`draft | queued | published`),
`publish_at`, `author`. Readers see a row when it is **live**:
`published`, or `queued` with `publish_at` in the past. No cron job —
scheduling is just a timestamp.

Poll and menu counts are added up on the server (`0005_scale.sql`):
`poll_tally(ids[])` / `menu_tally(ids[])` return one row per option with
`votes` and `mine`, for up to 200 polls or items per call. The app never
downloads raw votes.

| table | who writes | notes |
|---|---|---|
| `buzz_items` | by `kind`: trivia/fact → `trivia`, poll → `polls`, news → `news` | `payload` JSON, shapes below |
| `poll_votes` | any student, own row | one per user per poll (upsert to change). Nobody reads others' rows; counts come from `poll_tally()` |
| `menu_items` | `menu` | `price_cents`, `tags[]`, `photo_url`, `served_on` |
| `menu_ratings` | any student, own row | emoji only, no free text. Counts come from `menu_tally()` |
| `announcements` | `news` | `category`, `pinned` |
| `popups` | `popups` | `template_id`, `starts_at`–`ends_at` window |
| `library_status` | `library` | single row (`id = 1`) |

`buzz_items.payload` shapes (client-defined, not enforced):

```
trivia  { question, options: string[], answer: number, explanation? }
fact    { text, source? }
poll    { question, options: string[], closes_at? }
news    { title, body, image_url?, link? }
```

### Badges / XP

- `badge_catalog` mirrors `src/badges.ts` (id, rarity, xp). When badges.ts
  changes: `node scripts/badge-seed.mjs > supabase/seed/badges.sql`, then
  run that file in the SQL editor (it upserts).
- `award_badge(user, badge_id, reason)` — `badges` role. Reason required.
  The row is the audit entry (who, when, why).
- Revoke by setting `revoked_at`. A trigger keeps `profiles.xp_total` in
  sync either way. Level = the same formula as `src/xp.ts`.

### Social

- `find_student('samb456')` / `find_student('AB12CD34')` — email local part,
  full email, or friend code. Returns name + grade only, never the profile.
- `friend_requests` — sender inserts, receiver flips `status`. Once
  `accepted`, each can read the other's full profile (timetable included) —
  compare is client-side, as the scope says.
- `request_peers()` — name + grade for the other side of each pending
  request (profiles are friends-only, so the app can't read a requester's
  name otherwise). Lives in `0002_social_peers.sql`; run it in the SQL editor
  after `0001`. Until it runs the Social tab hides requests it can't name.
- No chat tables. Do not add any.

### App Club Admin posts (0007 + 0008)

Run `0007_events_role.sql` first, on its own, then `0008_admin_content.sql`
(Postgres can't use a new role name in the same run that adds it).

- `posts` — every trivia question, fact, poll, news post, menu change,
  pop-up banner and club event. `places` says where it shows (buzz, news,
  banner, bell, cafeteria, calendar); `starts_at` / `ends_at` say when.
  Students read live posts only; the role for the kind (or owner) writes.
- `post_views`, `post_answers` — one row per student per post. Written only
  through `see_posts()` and `answer_post()`. Admins read totals with
  `post_stats()`; everyone reads vote counts with `post_tally()`. Nobody can
  see who answered what.
- Team (owners): `team_list()`, `set_member_role(user, role, on)` (refuses to
  remove the last owner), `find_people('name / email / student #')`.
- New role `events` for club events.
- Phone alerts for posts: add a Database Webhook on `posts` (INSERT, UPDATE)
  pointing at the `send-push` function, same as the others in NOTIFICATIONS.md.
- Until 0008 runs, the app keeps admin changes on the phone that made them and
  says so at the top of App Club Admin.

### App Club: five teams (0016 + 0017)

Run `0016_five_teams_roles.sql` first, on its own, then `0017_five_teams.sql`
(same reason as 0007: new role names can't be used in the run that adds them).

- Teams and roles match `src/ranks.ts`: Developer, Maintenance, Badge,
  Feedback, Executive. Owner, President and Teacher Sponsor have every power;
  any Developer role can do every job but can't hand out roles.
- Fact posts need the new `facts` role and club events use `news`. 0017 gives
  `facts` to everyone who had `trivia`, and `news` to everyone who had `events`.
- `feedback` gets `from_type` / `from_role` (set by the server from the
  sender's account), `source` ('app' or 'real'), `heard_at`, `said_by`,
  `logged_by`. `log_feedback()` is for the Real job.
- `club_items` — every team's boards (ideas, seasonal, backend, iOS and
  Android checklists, campaigns, HR check-ins, student council, decisions).
- Badge grantors: `award_badge_many()`, `program_roster()`, `find_many()`;
  students claim QR badges with `claim_badge_code()`.
- Teacher accounts: sign-up only accepts @edu.sd45.bc.ca emails today, so a
  Teacher Sponsor has to use a student-style account until teacher sign-up exists.

### Storage

| bucket | read | write |
|---|---|---|
| `menu-photos` | public | `menu` |
| `post-images` | public | any App Club role (photo behind a post, `data.image`, 0010) |
| `badge-art` | public | `badges` |
| `profile-photos` | own folder | own folder (`<user id>/…`) |

### Push

`push_tokens` — one row per device. Sending pushes needs an Edge Function
with the service key; not built yet. Comes with the dev build.

---

## Changing the schema

Add a new file `supabase/migrations/0002_<what>.sql` and run it in the SQL
editor. Never edit `0001_init.sql` after it has been run on the real
project. Say in the file what it changes and why.

---

## Handover (do this before June)

- Supabase: **Organization settings → Team** → invite next year's lead as
  **Owner**. Then remove yourself. Projects stay with the org.
- The database password and the service key live in the club password
  manager, not in anyone's head.
- GitHub: see `GITHUB.md`.
