# GitHub for the club

Goal: several people work on different things at once, nothing breaks for
the others, and the whole thing changes hands every June without anyone
begging a graduate for access.

## 1. The repo belongs to an organization, not a person

A personal repo dies with its owner's interest. An **organization** has
owners (plural), and owners can be swapped.

1. GitHub → top-right **+** → **New organization** → **Free**.
2. Name: `sentinel-app-club` (this becomes the URL). Contact email: the
   club's shared email, not a student one.
3. Skip inviting people for now.

Then push this repo into it:

1. In the org: **New repository**. Name `spartans`. Private. Do **not** add a
   README/.gitignore — this repo already has them.
2. In Terminal:

```bash
cd ~/Projects/SentinelApp
```

```bash
git remote add origin https://github.com/sentinel-app-club/spartans.git
```

```bash
git push -u origin main
```

(Git will ask you to sign in in the browser the first time.)

## 2. People

**Org → People → Invite member.** Two levels:

- **Owner** — you, plus one other current member, plus the teacher sponsor
  if there is one. Owners can do everything, including delete. Always keep
  at least two owners so no one person is a single point of failure.
- **Member** — everyone else in the club who writes code.

Create one **team** called `devs` with every member in it and give the team
**Write** on `spartans`. Adding a new person = add them to the team.

## 3. Nobody pushes straight to `main`

`main` is what ships. Everyone works on a branch, opens a pull request, one
other person reads it, then it merges. That is the whole process.

Set it once: **Repo → Settings → Rules → Rulesets → New branch ruleset**:

- Name `protect main`, target: default branch.
- Tick **Restrict deletions**, **Require a pull request before merging**
  (required approvals: **1**), **Block force pushes**.
- Enforcement: **Active**.

Day to day, for each piece of work:

```bash
git switch -c calendar-week-view
```

…edit, test…

```bash
git add -A && git commit -m "Calendar: week view toggle"
```

```bash
git push -u origin calendar-week-view
```

Then open the pull request from the link Git prints. Small PRs, one thing
each. `SCOPE-v3.md` is the list of things; pick a line, branch, do it.

## 4. Who is doing what

**Repo → Projects → New project → Board.** Columns: *To do · Doing · Review
· Done*. Turn the phase-2/3/4 lines of `SCOPE-v3.md` into cards. Drag one
to *Doing* when you branch. That is the only coordination needed.

## 5. What never goes in the repo

- `.env` (Supabase keys) — already git-ignored; each dev copies
  `.env.example` and pastes the two values from `BACKEND.md` step 5.
- The Supabase database password / service key, Apple/Google signing keys.
  These live in the club password manager (Bitwarden free org works).

## 6. Handover checklist (May)

1. Invite next year's lead as org **Owner**. They accept.
2. Rotate the shared password-manager vault to them.
3. Supabase: add them as org Owner (`BACKEND.md` → Handover).
4. Expo / Apple / Google developer accounts, when they exist: same — org
   or team accounts, never personal.
5. Remove graduates from the org **after** the new lead confirms access.
