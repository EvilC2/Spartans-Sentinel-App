// Spartans — every notification the app knows about, built from data it
// already has. Pure functions: give them a time window, get notices back.
//
// The same builders feed two things:
//   the in-app list   window = last 30 days up to "now" (NotificationCenter)
//   phone reminders   window = real now → 14 days ahead (push.ts schedules them)
// so the bell and the lock screen always say the same thing.
//
// Server-sent ones (announcements, friend requests, badge awards, admin
// banners) arrive by push AND show up here from their own data.

import type { IconName } from '../components/Icon';
import type { TabId } from '../components/Chrome';
import { HW_KIND_LABEL, isAssessment, type HomeworkItem } from '../programs';
import type { PersonalEvent } from '../stores';
import type { Request } from '../social';
import type { Popup } from '../backend';
import { CALENDAR, fromISO, toISO } from '../calendar';
import { fmt12, buildDayPlan } from '../bell';
import { roomShort, type Course } from '../ProfileContext';
import { BADGES, UNLOCKED } from '../badges';
import { catchUpBadgeIds, earnedAt, isCatchUpBadge } from '../earned';
import { eventDaysOn, addDays, EventDay } from './eventDays';

export type Topic = 'announcements' | 'homework' | 'classes' | 'events' | 'buzz' | 'friends' | 'badges';

// What tapping a notice does.
export type NoticeAction =
  | { kind: 'tab'; tab: TabId }
  | { kind: 'banner'; key: string }
  | { kind: 'badge'; id: string };

export type Notice = {
  id: string;             // stable: the same fact always gets the same id
  topic: Topic;
  title: string;
  body: string;
  at: number;             // ms; when it "arrived"
  icon: IconName;
  action?: NoticeAction;
  event?: EventDay;       // event-day notices draw the banner's colours
  badgeId?: string;       // badge notices draw the badge
  local?: boolean;        // true = a phone reminder can be scheduled for it
  until?: number;         // ms; drops out of the list after this (stale reminders)
};

export const TOPIC_LOOK: Record<Topic, { icon: IconName; label: string }> = {
  announcements: { icon: 'news', label: 'School' },
  homework: { icon: 'tasks', label: 'Homework' },
  classes: { icon: 'clock', label: 'Classes' },
  events: { icon: 'calendar', label: 'Calendar' },
  buzz: { icon: 'sparkle', label: 'The Buzz' },
  friends: { icon: 'users', label: 'Friends' },
  badges: { icon: 'badge', label: 'Badges' },
};

export const EVE_HOUR = 19;           // "the evening before" reminders
export const MORNING = [7, 15];       // event-day morning reminder

const at = (iso: string, h: number, m = 0) => {
  const d = fromISO(iso);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
const endOf = (iso: string) => at(iso, 23, 59);

const shortDate = (iso: string) =>
  fromISO(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

export type FeedInput = {
  homework: HomeworkItem[];
  courses: Course[];                // for the first-class reminder
  events: PersonalEvent[];          // personal only (homework-derived ones are skipped)
  requests: Request[];
  popups: Popup[];
  // App Club posts placed in the bell (news, trivia, polls, events…). `at` is
  // when the post went out; `topic` and `tab` say where it belongs.
  announcements: { id: string; title: string; body: string; at: number; topic: Topic; tab: TabId; icon?: IconName }[];
  grade: number;
  now: number;                      // the app's "now" (demo / preview aware)
};

// Every ISO date from a → b inclusive.
const daysBetween = (a: string, b: string) => {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
};

// ── Builders ─────────────────────────────────────────────────────
// Homework: the evening before. Quizzes and tests also get one three evenings
// before, so there's time to study ("Chem test Thursday"). That early one is
// only made for items added before it would go off (the id holds when it was
// added), so a test added two days out doesn't show a stale "in 3 days".
export const STUDY_DAYS = 3;
const addedAt = (h: HomeworkItem) => Number(h.id.split('-')[1]) || 0;
const weekday = (iso: string) => fromISO(iso).toLocaleDateString('en-US', { weekday: 'long' });

const homeworkNotices = (items: HomeworkItem[]): Notice[] => items
  .filter(h => !h.done && h.due)
  .flatMap(h => {
    const name = h.kind ? HW_KIND_LABEL[h.kind] : '';
    const where = [h.program, h.time ? `at ${fmt12(h.time, true)}` : ''].filter(Boolean).join(' · ');
    const base = { topic: 'homework' as const, icon: 'tasks' as const, action: { kind: 'tab' as const, tab: 'homework' as const }, local: true, until: endOf(h.due) };
    const out: Notice[] = [{
      ...base,
      id: `hw:${h.id}:${h.due}`,
      title: isAssessment(h) ? `${name} tomorrow: ${h.title}` : `Due tomorrow: ${h.title}`,
      body: isAssessment(h) ? [where, 'Good luck!'].filter(Boolean).join(' · ') : where || 'Tap to see your homework',
      at: at(addDays(h.due, -1), EVE_HOUR),
    }];
    const early = at(addDays(h.due, -STUDY_DAYS), EVE_HOUR);
    if (isAssessment(h) && addedAt(h) < early) out.push({
      ...base,
      id: `hw-early:${h.id}:${h.due}`,
      title: `${name} ${weekday(h.due)}: ${h.title}`,
      body: [where, `${STUDY_DAYS} days to get ready`].filter(Boolean).join(' · '),
      at: early,
    });
    return out;
  });

// First class of each school day, FIRST_CLASS_LEAD minutes before the bell.
// Apple only lets the app start the Lock Screen card while it's open, so this
// is the nudge: tap it, the app opens, and the card goes up for the day.
export const FIRST_CLASS_LEAD = 15;
const firstClassNotices = (days: string[], courses: Course[]): Notice[] => days.flatMap(iso => {
  const plan = buildDayPlan(CALENDAR[iso], courses);
  const first = plan?.blocks[0];
  if (!plan || !first) return [];
  const [h, m] = first.start.split(':').map(Number);
  const name = first.kind === 'fit' ? 'FIT' : first.course?.name || `Block ${first.slot || first.block}`;
  const room = first.course?.room ? roomShort(first.course.room) : '';
  return [{
    id: `class:${iso}`, topic: 'classes' as const, icon: 'clock' as const,
    title: `First up: ${name} at ${fmt12(first.start)}`,
    body: [`Day ${plan.dayNum}`, room, 'Tap to put today on your Lock Screen'].filter(Boolean).join(' · '),
    at: at(iso, h, m) - FIRST_CLASS_LEAD * 60_000,
    action: { kind: 'tab' as const, tab: 'home' as const },
    local: true, until: at(iso, h, m) + 10 * 60_000,
  }];
});

// School dates: event-day banners (eve + morning) and days off.
const calendarNotices = (days: string[], popups: Popup[], grade: number): Notice[] => {
  const out: Notice[] = [];
  for (const iso of days) {
    const ev = eventDaysOn(iso, popups, grade)[0];
    if (ev) {
      const t = ev.template;
      if (t.eve) out.push({
        id: `eve:${ev.key}`, topic: 'events', title: `Tomorrow: ${t.name}`, body: t.eve,
        at: at(addDays(iso, -1), EVE_HOUR), icon: 'calendar', event: ev,
        action: { kind: 'tab', tab: 'calendar' }, local: true, until: endOf(iso),
      });
      out.push({
        id: `day:${ev.key}`, topic: 'events', title: ev.title, body: t.morning || ev.body,
        at: ev.popupId ? Date.parse(popups.find(p => p.id === ev.popupId)!.starts_at) : at(iso, MORNING[0], MORNING[1]),
        icon: 'sparkle', event: ev, action: { kind: 'banner', key: ev.key },
        local: !ev.popupId && !!t.morning,
      });
      continue;
    }
    // Days off without a banner: the first day of a holiday or break.
    const d = CALENDAR[iso];
    const prev = CALENDAR[addDays(iso, -1)];
    if (d && (d.kind === 'holiday' || d.kind === 'break') && !(prev?.kind === 'break' && d.kind === 'break')) {
      out.push({
        id: `off:${iso}`, topic: 'events', title: `No school ${fromISO(iso).toLocaleDateString('en-US', { weekday: 'long' })}`,
        body: d.label || 'Day off', at: at(addDays(iso, -1), EVE_HOUR), icon: 'calendar',
        action: { kind: 'tab', tab: 'calendar' }, local: true, until: endOf(iso),
      });
    }
  }
  return out;
};

const personalNotices = (events: PersonalEvent[]): Notice[] => events
  .filter(e => e.source !== 'homework' && !e.done)
  .map(e => {
    const [h, m] = (e.time || '07:30').split(':').map(Number);
    const when = at(e.iso, h, m) - (e.time ? 30 * 60_000 : 0);
    return {
      id: `ev:${e.id}:${e.iso}:${e.time || ''}`,
      topic: 'events' as const,
      title: e.time ? `In 30 minutes: ${e.title}` : `Today: ${e.title}`,
      body: [e.className, e.time ? `at ${e.time}` : shortDate(e.iso)].filter(Boolean).join(' · '),
      at: when, icon: 'calendar' as const,
      action: { kind: 'tab' as const, tab: 'calendar' as const }, local: true, until: endOf(e.iso),
    };
  });

const friendNotices = (requests: Request[]): Notice[] => requests
  .filter(r => r.direction === 'in')
  .map(r => ({
    id: `fr:${r.id}`, topic: 'friends' as const,
    title: `${r.peer.firstName} ${r.peer.lastName}`.trim() + ' wants to be friends',
    body: `Grade ${r.peer.grade} · tap to answer`,
    at: Date.parse(r.created) || 0, icon: 'users' as const,
    action: { kind: 'tab' as const, tab: 'social' as const },
  }));

// Catch Up gives dozens of badges at once: one notice for the lot.
const catchUpNotice = (): Notice[] => {
  const ids = catchUpBadgeIds().filter(id => id in UNLOCKED && BADGES.some(b => b.id === id));
  if (!ids.length) return [];
  const when = Math.max(...ids.map(id => earnedAt(id) ?? 0));
  return [{
    id: `catchup:${when}`, topic: 'badges' as const,
    title: 'Catch Up complete',
    body: `${ids.length} ${ids.length === 1 ? 'badge' : 'badges'} added to your collection`,
    at: when, icon: 'badge' as const,
    action: { kind: 'tab' as const, tab: 'me' as const },
  }];
};

const badgeNotices = (): Notice[] => BADGES
  .filter(b => b.id in UNLOCKED && !isCatchUpBadge(b.id))
  .map(b => ({
    id: `badge:${b.id}`, topic: 'badges' as const,
    title: `Badge unlocked: ${b.title}`,
    body: b.flavor || b.desc,
    at: earnedAt(b.id) ?? at(UNLOCKED[b.id], 12),
    icon: 'badge' as const, badgeId: b.id,
    action: { kind: 'badge' as const, id: b.id },
  }));

// App Club posts, at the time they went out.
const announcementNotices = (list: FeedInput['announcements']): Notice[] =>
  list.map(a => ({
    id: `ann:${a.id}`, topic: a.topic,
    title: a.title, body: a.body, at: a.at, icon: a.icon || TOPIC_LOOK[a.topic].icon,
    action: { kind: 'tab' as const, tab: a.tab },
  }));

// ── Public ───────────────────────────────────────────────────────
// All notices whose time falls in [from, to], newest first.
export const buildFeed = (input: FeedInput, from: number, to: number): Notice[] => {
  const days = daysBetween(toISO(new Date(from)), addDays(toISO(new Date(to)), 1));
  const all = [
    ...homeworkNotices(input.homework),
    ...firstClassNotices(days, input.courses),
    ...calendarNotices(days, input.popups, input.grade),
    ...personalNotices(input.events),
    ...friendNotices(input.requests),
    ...badgeNotices(),
    ...catchUpNotice(),
    ...announcementNotices(input.announcements),
  ];
  const seen = new Set<string>();
  return all
    .filter(n => n.at >= from && n.at <= to && (!n.until || n.until >= input.now) && !seen.has(n.id) && (seen.add(n.id), true))
    .sort((a, b) => b.at - a.at);
};
