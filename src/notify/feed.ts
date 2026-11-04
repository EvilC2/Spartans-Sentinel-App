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
import type { HomeworkItem } from '../programs';
import type { PersonalEvent } from '../stores';
import type { Request } from '../social';
import type { Popup } from '../backend';
import { CALENDAR, fromISO, toISO } from '../calendar';
import { BADGES, UNLOCKED } from '../badges';
import { earnedAt } from '../earned';
import { eventDaysOn, addDays, EventDay } from './eventDays';

export type Topic = 'announcements' | 'homework' | 'events' | 'buzz' | 'friends' | 'badges';

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
const homeworkNotices = (items: HomeworkItem[]): Notice[] => items
  .filter(h => !h.done && h.due)
  .map(h => ({
    id: `hw:${h.id}:${h.due}`,
    topic: 'homework' as const,
    title: `Due tomorrow: ${h.title}`,
    body: [h.program, h.time ? `due ${h.time}` : ''].filter(Boolean).join(' · ') || 'Tap to see your homework',
    at: at(addDays(h.due, -1), EVE_HOUR),
    icon: 'tasks' as const,
    action: { kind: 'tab' as const, tab: 'homework' as const },
    local: true, until: endOf(h.due),
  }));

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

const badgeNotices = (): Notice[] => BADGES
  .filter(b => b.id in UNLOCKED)
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
    ...calendarNotices(days, input.popups, input.grade),
    ...personalNotices(input.events),
    ...friendNotices(input.requests),
    ...badgeNotices(),
    ...announcementNotices(input.announcements),
  ];
  const seen = new Set<string>();
  return all
    .filter(n => n.at >= from && n.at <= to && (!n.until || n.until >= input.now) && !seen.has(n.id) && (seen.add(n.id), true))
    .sort((a, b) => b.at - a.at);
};
