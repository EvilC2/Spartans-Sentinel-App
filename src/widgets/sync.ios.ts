// Spartans — keeps the iOS widgets and the class Live Activity in step with
// the app (iOS only; sync.ts is the no-op for Android and web).
//
// Widgets: the Today and Class widgets get a timeline with an entry for every
// bell over the next 10 days, so they advance by themselves. Homework and Up
// ahead get one entry per midnight. All are rewritten when the app comes to
// the front, when the courses or homework change, and when the owner's time
// preview moves (so a simulated school day shows on the Home Screen too).
//
// Live Activity: on from LIVE_LEAD_MIN before the first bell until the last
// class ends, on school days. Apple only lets the app start one while it is
// open, and the app steps it to the next class while it is running (and every
// time it is opened). Each update is marked stale at the end of its period;
// once stale, the card shows the rest of the day with a timer per row, which
// stays right with the app closed. The "First class" reminder (notify/feed.ts)
// gets the app opened before school so the card goes up. To keep it fully
// current with the app closed, the server would push updates through APNs —
// see the note at the bottom.
//
// Each widget is written on its own: one failing must not stop the others.
// Failures are recorded in ./status for the Developer screen.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { after } from 'expo-widgets';
import TodayWidget from './TodayWidget';
import ClassWidget from './ClassWidget';
import HomeworkWidget from './HomeworkWidget';
import UpAheadWidget from './UpAheadWidget';
import ClassActivity from './ClassActivity';
import { todayTimeline, todayProps, homeworkTimeline, upAheadTimeline, liveWindow, TodayProps, TogetherFor } from './model';
import { plain, setWidgetStatus, onWidgetRefresh } from './status';
import { useProfile, Course } from '../ProfileContext';
import { useHomework } from '../stores';
import { usePreviewTime } from '../PreviewTime';
import { useSocial, togetherLabel, Friend } from '../social';
import type { HomeworkItem } from '../programs';

const LIVE_URL = 'spartans://home';
const TICK_MS = 15_000;

const errText = (e: unknown) => String((e as Error)?.message || e);

const attempt = (what: string, f: () => void) => {
  try {
    f();
    setWidgetStatus({ at: Date.now(), results: { [what]: 'ok' } });
  } catch (e) {
    setWidgetStatus({ at: Date.now(), results: { [what]: errText(e) } });
    if (__DEV__) console.warn(`[widgets] ${what} failed`, e);
  }
};

// The time preview (owner only) moves "now" by `offset`. Everything is worked
// out for the previewed moment, then slid back onto the real clock so iOS
// shows it at the right real time and its timers count the right amount.
const virtualNow = (offset: number) => new Date(Date.now() + offset);
const toReal = (offset: number) => (d: Date) => new Date(d.getTime() - offset);
const realProps = (p: TodayProps, offset: number): TodayProps =>
  !offset ? p : {
    ...p, start: p.start ? p.start - offset : 0, end: p.end ? p.end - offset : 0,
    rest: (p.rest || []).map(r => ({ ...r, start: r.start - offset, end: r.end - offset })),
  };

// Friends in a block, for the "with Alex" / "Spare with Alex" line.
const togetherWith = (courses: Course[], friends: Friend[]): TogetherFor =>
  p => (friends.length ? togetherLabel(p, courses, friends) : '');

const writeSchedule = (courses: Course[], offset: number, together: TogetherFor) => {
  const shift = toReal(offset);
  let today: { date: Date; props: TodayProps }[] = [];
  attempt('Today', () => {
    today = todayTimeline(virtualNow(offset), courses, together).map(e => ({ date: shift(e.date), props: plain(realProps(e.props, offset)) }));
    TodayWidget.updateTimeline(today);
  });
  attempt('Class', () => {
    if (!today.length) today = todayTimeline(virtualNow(offset), courses, together).map(e => ({ date: shift(e.date), props: plain(realProps(e.props, offset)) }));
    ClassWidget.updateTimeline(today);
  });
  attempt('Up ahead', () => {
    UpAheadWidget.updateTimeline(upAheadTimeline(virtualNow(offset), courses).map(e => ({ date: shift(e.date), props: plain(e.props) })));
  });
};

const writeHomework = (items: HomeworkItem[], courses: Course[], offset: number) => attempt('Homework', () => {
  const shift = toReal(offset);
  HomeworkWidget.updateTimeline(homeworkTimeline(virtualNow(offset), items, courses).map(e => ({ date: shift(e.date), props: plain(e.props) })));
});

// What the activity last showed, so a 15 s tick only talks to ActivityKit
// when something on the card actually changed.
let lastKey = '';
const keyOf = (p: TodayProps) => [p.mode, p.eyebrow, p.title, p.end, p.footer, p.tile?.name, p.together].join('|');

const syncLive = (courses: Course[], offset: number, together: TogetherFor) => {
  try {
    const now = virtualNow(offset);
    const running = ClassActivity.getInstances();
    const win = liveWindow(now, courses);

    if (!win || !win.on) {
      if (running.length) {
        // School's out: leave the final card up for a few minutes, then go.
        const last = plain(realProps(todayProps(now, courses, together), offset));
        running.forEach(a => { a.end(after(new Date(Date.now() + 10 * 60_000)), last).catch(() => {}); });
      }
      lastKey = '';
      setWidgetStatus({ live: !win ? 'off: no classes today' : `off: outside ${new Date(win.open).toTimeString().slice(0, 5)}–${new Date(win.close).toTimeString().slice(0, 5)}` });
      return;
    }

    const props = plain(realProps(todayProps(now, courses, together), offset));
    const stale = props.end ? new Date(props.end) : undefined;
    const key = keyOf(props) + offset;
    if (!running.length) {
      ClassActivity.start(props, LIVE_URL, stale);
      lastKey = key;
      setWidgetStatus({ live: `started: ${props.title}` });
      return;
    }
    // Only one at a time; anything extra is left over from an older run.
    running.slice(1).forEach(a => { a.end('immediate').catch(() => {}); });
    if (key !== lastKey) {
      running[0].update(props, stale)
        .then(() => setWidgetStatus({ live: `showing: ${props.title}` }))
        .catch(e => setWidgetStatus({ live: `update failed: ${errText(e)}` }));
      lastKey = key;
    }
  } catch (e) {
    // Most often: Live Activities are switched off for Spartans in Settings.
    setWidgetStatus({ live: `failed: ${errText(e)}` });
    if (__DEV__) console.warn('[widgets] live activity failed', e);
  }
};

export const WidgetSync = () => {
  const { profile } = useProfile();
  const { items } = useHomework();
  const { offsetMs } = usePreviewTime();
  const { friends } = useSocial();
  const courses = profile?.courses;
  const coursesRef = useRef<Course[]>([]);
  coursesRef.current = courses || [];
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const offsetRef = useRef(offsetMs);
  offsetRef.current = offsetMs;
  const togetherRef = useRef<TogetherFor>(() => '');
  togetherRef.current = togetherWith(courses || [], friends);

  const refreshAll = () => {
    const c = coursesRef.current, o = offsetRef.current;
    setWidgetStatus({ previewing: o !== 0 });
    writeSchedule(c, o, togetherRef.current);
    writeHomework(itemsRef.current, c, o);
    lastKey = '';
    syncLive(c, o, togetherRef.current);
  };

  // Courses or the previewed time changed (or first load): rewrite the
  // schedule widgets and the activity.
  useEffect(() => {
    if (!courses) return;
    setWidgetStatus({ previewing: offsetMs !== 0 });
    writeSchedule(courses, offsetMs, togetherRef.current);
    lastKey = '';
    syncLive(courses, offsetMs, togetherRef.current);
  }, [courses, offsetMs, friends]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!courses) return;
    writeHomework(items, courses, offsetMs);
  }, [items, courses, offsetMs]);

  useEffect(() => onWidgetRefresh(refreshAll), []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Back in the app: refresh everything. While it is open: step the activity.
  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (tick) return;
      tick = setInterval(() => syncLive(coursesRef.current, offsetRef.current, togetherRef.current), TICK_MS);
    };
    const stop = () => { if (tick) clearInterval(tick); tick = null; };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        refreshAll();
        start();
      } else {
        // Last word before going to the background, so the card is current.
        syncLive(coursesRef.current, offsetRef.current, togetherRef.current);
        stop();
      }
    });
    return () => { sub.remove(); stop(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

// Keeping the Live Activity moving with the app closed:
// expo-widgets can hand out per-activity APNs tokens (set
// `enablePushNotifications: true` on the plugin, then
// `instance.getPushToken()`). A Supabase Edge Function on a schedule could then
// send an `update` push at each bell with `content-state` =
// { name: 'SpartansClassActivity', props: JSON.stringify(todayProps(...)) }.
// It could also start the activity each morning with a push-to-start token
// (iOS 17.2+), so it appears even if the app wasn't opened before school.
// That needs the team's APNs auth key (.p8) on the server.
