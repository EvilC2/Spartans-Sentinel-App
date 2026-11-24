// Spartans — the notification system's state. One provider, three jobs:
//
//   1. Inbox      builds the list from feed.ts, remembers what was read or
//                 removed, counts unread for the bell and the app icon.
//   2. Banners    on the first open of a big day (event-day banner), shows
//                 the banner once; closing it unlocks the paired badge.
//   3. Phone      asks permission, keeps local reminders scheduled, saves the
//                 push token (with topics) for server pushes, and takes a
//                 tapped notification to the exact thing it's about.
//
// Renders its own overlays (NotificationCenter, EventBanner, BadgeUnlock)
// so any screen can open them through useNotify().
// Keys start with "spartans-" so Delete account wipes them.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useProfile } from '../ProfileContext';
import { useHomework, useEvents, usePersisted } from '../stores';
import { useSocial } from '../social';
import { useNav } from '../nav';
import { useClassSheet } from '../components/ClassCard';
import { usePreviewTime } from '../PreviewTime';
import { resolveNow } from '../useToday';
import { toISO } from '../calendar';
import { BADGES, Badge } from '../badges';
import { earnBadge, loadEarned, useEarnedVersion } from '../earned';
import { loadDesigns } from '../badgeDesigns';
import { useNotifyPrefs } from '../settings';
import { backendConfigured } from '../supabase';
import { useContent, Post, KINDS, titleOf } from '../content';
import type { Popup } from '../backend';
import { buildFeed, exactAction, noticeIdFor, Notice, NoticeAction } from './feed';
import { NotifyCtx, Ctx } from './context';
import { eventDaysOn, EventDay } from './eventDays';
import {
  PermissionState, askPermission, getPermission, getPushToken, onNotificationReceived,
  onNotificationTap, scheduleReminders, setAppBadge, setupNotifications,
} from './push';
import type { TabId } from '../components/Chrome';
import { NotificationCenter } from '../components/NotificationCenter';
import { EventBanner } from '../components/EventBanner';
import { BadgeUnlock } from '../components/BadgeUnlock';

const DAY = 86_400_000;
const INBOX_WINDOW = 30 * DAY;
const SCHEDULE_AHEAD = 14 * DAY;

type Inbox = { since: number; read: Record<string, 1>; gone: Record<string, 1> };

export const NotifyProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile, signedIn, loaded } = useProfile();
  const { items } = useHomework();
  const { events } = useEvents();
  const social = useSocial();
  const nav = useNav();
  const classSheet = useClassSheet();
  const { offsetMs } = usePreviewTime();
  const { prefs } = useNotifyPrefs();
  const earnedVersion = useEarnedVersion();
  const content = useContent();

  const [inbox, setInbox, inboxLoaded] = usePersisted<Inbox>('spartans-inbox-v1', { since: 0, read: {}, gone: {} });
  const [seen, setSeen, seenLoaded] = usePersisted<Record<string, number>>('spartans-banners-seen-v1', {});
  const [centerOpen, setCenterOpen] = useState(false);
  const [banner, setBanner] = useState<{ day: EventDay; preview: boolean } | null>(null);
  const [unlock, setUnlock] = useState<Badge | null>(null);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [serverPopups, setServerPopups] = useState<Popup[]>([]);
  // Banners: the old popups table plus App Club Admin pop-up posts.
  const popups = useMemo(() => [...content.popups, ...serverPopups], [content.popups, serverPopups]);
  const [earnedReady, setEarnedReady] = useState(false);
  const [tapped, setTapped] = useState<NoticeAction | null>(null);
  const [pendingPost, setPendingPost] = useState<{ id: string; tab: TabId; at: number } | null>(null);

  // ── Clock: the app's "now" (demo date / preview aware), minute ticks ──
  const [now, setNow] = useState(() => resolveNow(new Date(), offsetMs).getTime());
  useEffect(() => {
    const tick = () => setNow(resolveNow(new Date(), offsetMs).getTime());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [offsetMs]);
  const todayIso = toISO(new Date(now));

  // ── Startup ──
  useEffect(() => {
    loadEarned().finally(() => setEarnedReady(true));
    setupNotifications().then(() => getPermission().then(setPermission));
  }, []);
  // Badges the Badge team made and an owner approved join the catalogue.
  useEffect(() => { loadDesigns(signedIn); }, [signedIn]);
  useEffect(() => {
    if (inboxLoaded && !inbox.since) setInbox(v => ({ ...v, since: Date.now() }));
  }, [inboxLoaded]);

  // Admin banners (snow day…) from the server.
  const refreshPopups = useCallback(async () => {
    if (!backendConfigured || !signedIn) return;
    try {
      const { popups: api } = await import('../backend');
      const t = Date.now();
      setServerPopups((await api.active()).filter(p =>
        p.status === 'published' || (p.status === 'queued' && !!p.publish_at && Date.parse(p.publish_at) <= t)));
    } catch {}
  }, [signedIn]);
  useEffect(() => { refreshPopups(); }, [refreshPopups]);

  // Back in the foreground: new day? new popups? permission changed in Settings?
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') return;
      setNow(resolveNow(new Date(), offsetMs).getTime());
      refreshPopups();
      social.refresh().catch(() => {});
      getPermission().then(setPermission);
    });
    const off = onNotificationReceived(() => { refreshPopups(); social.refresh().catch(() => {}); });
    return () => { sub.remove(); off(); };
  }, [offsetMs, refreshPopups, social.refresh]);

  // ── Feed ──
  const grade = profile?.grade || 8;
  const feedInput = useMemo(() => ({
    homework: items.map(h => {
      if (h.program || !h.slot) return h;
      const k = profile?.courses.find(x => x.slot === h.slot);
      return { ...h, program: k?.name || `Block ${h.slot}` };
    }),
    courses: profile?.courses || [],
    events: events.filter(e => e.source !== 'homework'),
    requests: social.requests,
    popups,
    announcements: content.inPlace('bell').filter(p => p.kind !== 'popup').map(bellItem),
    grade,
  }), [items, events, social.requests, popups, grade, profile?.courses, content.inPlace]);

  // Calendar banners from before this phone had the app never went out, so a
  // new account doesn't open to a month of "notifications" it never got.
  const notices = useMemo(() => buildFeed({ ...feedInput, now }, now - INBOX_WINDOW, now)
    .filter(n => prefs.on[n.topic] !== false && !inbox.gone[n.id])
    .filter(n => !n.event || (!!inbox.since && n.at >= inbox.since - DAY))
    .slice(0, 80),
  // earnedVersion: a badge earned this session joins the list
  [feedInput, now, prefs.on, inbox.gone, inbox.since, earnedVersion]);

  // First run: anything older than a day before install counts as read,
  // so a new phone doesn't open to fifty unread.
  const isRead = useCallback((n: Notice) =>
    !!inbox.read[n.id] || (!!inbox.since && n.at < inbox.since - DAY), [inbox.read, inbox.since]);
  const unread = notices.filter(n => !isRead(n)).length;

  const markRead = useCallback((id: string) => setInbox(v => v.read[id] ? v : { ...v, read: { ...v.read, [id]: 1 } }), []);
  const markAllRead = useCallback(() => setInbox(v => {
    const read = { ...v.read };
    notices.forEach(n => { read[n.id] = 1; });
    return { ...v, read };
  }), [notices]);
  const dismiss = useCallback((ids: string[]) => setInbox(v => {
    const read = { ...v.read }, gone = { ...v.gone };
    ids.forEach(id => { read[id] = 1; gone[id] = 1; });
    return { ...v, read, gone };
  }), []);
  const restore = useCallback((ids: string[]) => setInbox(v => {
    const gone = { ...v.gone };
    ids.forEach(id => { delete gone[id]; });
    return { ...v, gone };
  }), []);

  // Keep the stored maps from growing forever: drop ids no longer in the window.
  useEffect(() => {
    if (!inboxLoaded) return;
    const keys = Object.keys(inbox.read).length + Object.keys(inbox.gone).length;
    if (keys < 400) return;
    const live = new Set(buildFeed({ ...feedInput, now }, now - INBOX_WINDOW, now).map(n => n.id));
    const keep = (m: Record<string, 1>) => Object.fromEntries(Object.entries(m).filter(([k]) => live.has(k))) as Record<string, 1>;
    setInbox(v => ({ ...v, read: keep(v.read), gone: keep(v.gone) }));
  }, [inboxLoaded, notices.length]);

  // ── Banners ──
  const today = useMemo(() => eventDaysOn(todayIso, popups, grade), [todayIso, popups, grade]);
  const ready = loaded && !!profile && signedIn && seenLoaded && earnedReady;

  useEffect(() => {
    // One at a time: a second banner the same day waits for the first one
    // (and its badge) to close.
    if (!ready || banner || unlock) return;
    const next = today.find(d => !seen[d.key]);
    if (next) {
      setBanner({ day: next, preview: false });
      if (next.popupId) content.opened(next.popupId);   // counts for the admin's numbers
    }
  }, [ready, today, seen, banner, unlock]);

  const closeBanner = useCallback(() => {
    if (!banner) return;
    const { day, preview } = banner;
    setBanner(null);
    if (preview) return;
    setSeen(v => ({ ...v, [day.key]: Date.now() }));
    markRead(`day:${day.key}`);
    if (!day.badge) return;
    const got = earnBadge(day.badge, day.iso);
    if (got) {
      markRead(`badge:${got.id}`);
      setTimeout(() => setUnlock(got), 380);   // after the banner fades
    }
    if (day.popupId && backendConfigured) {
      const fromPost = popups.find(p => p.id === day.popupId)?.from_post;
      import('../backend').then(({ popups: api, posts }) => (fromPost ? posts.claimBadge(day.popupId!) : api.claimBadge(day.popupId!))).catch(() => {});
    }
  }, [banner, markRead, popups]);

  // iOS can't present a second modal while one is sliding away, so wait for
  // the notification centre to close before showing a banner or badge.
  const afterCenter = useCallback((fn: () => void) => {
    if (!centerOpen) { fn(); return; }
    setCenterOpen(false);
    setTimeout(fn, 550);
  }, [centerOpen]);

  const showBanner = useCallback((day: EventDay) => afterCenter(() => setBanner({ day, preview: false })), [afterCenter]);

  // ── Acting on a notice (tap in the list, or on the phone's notification) ──
  const act = useCallback((a?: NoticeAction | null) => {
    if (!a) return;
    if (a.kind !== 'class') classSheet.close();
    if (a.kind === 'tab') { setCenterOpen(false); nav.go(a.tab); }
    else if (a.kind === 'open') {
      // The page changes under the closing list; the item opens once it's gone,
      // because some of them open a sheet of their own.
      if (centerOpen) nav.go(a.tab);
      afterCenter(() => nav.open(a.tab, a.focus));
    } else if (a.kind === 'class') {
      const course = profile?.courses.find(k => k.slot === a.slot);
      afterCenter(() => { if (course) classSheet.openCourse(course); else nav.open('calendar', { kind: 'day', iso: a.iso }); });
    } else if (a.kind === 'post') {
      setPendingPost({ ...a, at: Date.now() });
    }
    else if (a.kind === 'badge') {
      const b = BADGES.find(x => x.id === a.id);
      if (b) afterCenter(() => setUnlock(b));
    } else if (a.kind === 'banner') {
      const iso = a.key.split(':')[1];
      const day = eventDaysOn(iso, popups, grade).find(d => d.key === a.key || (!!d.popupId && a.key.endsWith(`:${d.popupId}`)));
      if (day) showBanner(day);
      else if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) act({ kind: 'open', tab: 'calendar', focus: { kind: 'day', iso } });
    }
  }, [nav, popups, grade, showBanner, afterCenter, centerOpen, classSheet, profile?.courses]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A push about a post: its kind decides where it lives, and on a cold start
  // the posts may not be here yet. Wait for it, then open it.
  useEffect(() => {
    if (!pendingPost || !ready) return;
    const p = content.posts.find(x => x.id === pendingPost.id);
    const left = pendingPost.at + 8_000 - Date.now();
    if (p) { setPendingPost(null); act(postAction(p)); return; }
    const t = setTimeout(() => { setPendingPost(null); act({ kind: 'tab', tab: pendingPost.tab }); }, Math.max(0, left));
    return () => clearTimeout(t);
  }, [pendingPost, ready, content.posts]);   // eslint-disable-line react-hooks/exhaustive-deps

  const open = useCallback((n: Notice) => { markRead(n.id); act(n.action); }, [markRead, act]);

  // Tapped on the lock screen / notification centre.
  const actRef = useRef(act);
  actRef.current = act;
  useEffect(() => onNotificationTap((a, id) => {
    if (id) markRead(noticeIdFor(id));
    setTapped(exactAction(a, id));
  }), []);
  // A tap that launched the app waits for the profile, and for any event-day
  // banner (and its badge) to be closed: iOS shows one sheet at a time.
  const blocked = !!banner || !!unlock || today.some(d => !seen[d.key]);
  const settle = useRef(60);
  useEffect(() => {
    if (blocked || !ready) { settle.current = 600; return; }
    if (!tapped) return;
    const t = setTimeout(() => { settle.current = 60; setTapped(null); actRef.current(tapped); }, settle.current);
    return () => clearTimeout(t);
  }, [tapped, ready, blocked]);

  // ── Phone: reminders, badge count, push token ──
  const requestPermission = useCallback(async () => { setPermission(await askPermission()); }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    const id = setTimeout(() => {
      if (prefs.paused) { scheduleReminders([]); return; }
      const real = Date.now();
      scheduleReminders(buildFeed({ ...feedInput, now: real }, real, real + SCHEDULE_AHEAD)
        .filter(n => n.local && prefs.on[n.topic] !== false));
    }, 1200);
    return () => clearTimeout(id);
  }, [permission, prefs, feedInput]);

  useEffect(() => { if (permission === 'granted') setAppBadge(prefs.paused ? 0 : unread); }, [permission, unread, prefs.paused]);

  useEffect(() => {
    if (permission !== 'granted' || !backendConfigured || !signedIn) return;
    let cancelled = false;
    (async () => {
      const token = await getPushToken();
      if (!token || cancelled) return;
      const { push } = await import('../backend');
      const topics = Object.keys(prefs.on).filter(k => prefs.on[k]);
      Promise.resolve(push.register(token, Platform.OS, topics, prefs.paused)).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [permission, signedIn, prefs]);

  const value = useMemo<Ctx>(() => ({
    notices, unread, isRead, markRead, markAllRead, dismiss, restore, open,
    centerOpen, openCenter: () => setCenterOpen(true), closeCenter: () => setCenterOpen(false),
    permission, requestPermission, today, showBanner, now,
  }), [notices, unread, isRead, markRead, markAllRead, dismiss, restore, open, centerOpen, permission, requestPermission, today, showBanner, now]);

  return (
    <NotifyCtx.Provider value={value}>
      {children}
      {signedIn && !!profile && <NotificationCenter visible={centerOpen} onClose={() => setCenterOpen(false)} />}
      <EventBanner day={banner?.day ?? null} preview={!!banner?.preview} onClose={closeBanner}
        onAction={tab => { closeBanner(); nav.go(tab); }} />
      <BadgeUnlock badge={unlock} onDone={() => setUnlock(null)} />
    </NotifyCtx.Provider>
  );
};

// Where a post opens: news in the reader, an event on its day, a menu change on
// its item, everything else on its slide in The Buzz.
const postAction = (p: Post): NoticeAction =>
  p.kind === 'news' ? { kind: 'open', tab: 'announcements', focus: { kind: 'news', id: p.id } }
  : p.kind === 'event' ? { kind: 'open', tab: 'calendar', focus: { kind: 'day', iso: p.data.date, event: p.id } }
  : p.kind === 'menu' ? { kind: 'open', tab: 'lunch', focus: { kind: 'menu', id: p.id } }
  : p.kind === 'popup' ? { kind: 'banner', key: `${p.data.template}:${toISO(new Date())}:${p.id}` }
  : { kind: 'open', tab: 'home', focus: { kind: 'buzz', id: p.id } };

// An App Club post in the bell list.
const bellItem = (p: Post) => {
  const body = p.kind === 'news' ? p.data.body
    : p.kind === 'trivia' ? 'New trivia in The Buzz. Tap to answer.'
    : p.kind === 'poll' ? 'New poll in The Buzz. Tap to vote.'
    : p.kind === 'event' ? [p.data.date, p.data.time, p.data.place].filter(Boolean).join(' · ')
    : p.kind === 'menu' ? p.data.blurb
    : p.kind === 'fact' ? p.data.body : '';
  const topic = p.kind === 'news' ? 'announcements' as const : p.kind === 'event' ? 'events' as const : 'buzz' as const;
  return { id: p.id, title: titleOf(p), body: body.slice(0, 200), at: Date.parse(p.startsAt || p.createdAt), topic, action: postAction(p), icon: KINDS[p.kind].icon };
};
