// Spartans — small stores behind the Settings screen.
//   Notifications: which alerts the student wants. Saved on the device; the
//     notification system (src/notify) reads the same copy and sends the
//     topics to the server with the push token.
//   Help & feedback: "I like this / Needs fixing / Idea / Confusing" about one
//     part of the app. Kept on the device as a history, sent to the server
//     (migration 0004) when possible, retried on the next send if offline.
// Keys start with "spartans-" so Delete account wipes them too.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendConfigured } from './supabase';
import type { FeedbackFrom, FeedbackKind, Role } from './backend';
import { ALL_ROLES } from './ranks';
import type { IconName } from './components/Icon';

export const APP_VERSION = 'v3.0';

// ── Notifications ────────────────────────────────────────────────
const NOTIFY_KEY = 'spartans-notify-v1';

export const NOTIFY_TOPICS: { id: string; label: string; sub: string; icon: IconName }[] = [
  { id: 'announcements', label: 'Announcements', sub: 'New school and club announcements', icon: 'news' },
  { id: 'homework', label: 'Homework due', sub: 'The evening before something is due', icon: 'tasks' },
  { id: 'events', label: 'Calendar', sub: 'Your events, days off, Collab and Pro-D days', icon: 'calendar' },
  { id: 'buzz', label: 'The Buzz', sub: 'New trivia, facts and polls', icon: 'sparkle' },
  { id: 'friends', label: 'Friend requests', sub: 'When someone adds you', icon: 'users' },
  { id: 'badges', label: 'Badges', sub: 'When you unlock one', icon: 'badge' },
];

export type NotifyPrefs = { paused: boolean; on: Record<string, boolean> };
const DEFAULT_NOTIFY: NotifyPrefs = {
  paused: false,
  on: { announcements: true, homework: true, events: true, buzz: false, friends: true, badges: true },
};

// One copy for the whole app: Settings writes, the notification system reads.
let notifyPrefs = DEFAULT_NOTIFY;
let notifyLoaded = false;
const notifyListeners = new Set<(p: NotifyPrefs) => void>();
const setNotifyPrefs = (next: NotifyPrefs) => {
  notifyPrefs = next;
  notifyListeners.forEach(f => f(next));
};

export const useNotifyPrefs = () => {
  const [prefs, setPrefs] = useState<NotifyPrefs>(notifyPrefs);
  useEffect(() => {
    notifyListeners.add(setPrefs);
    if (!notifyLoaded) {
      notifyLoaded = true;
      AsyncStorage.getItem(NOTIFY_KEY).then(v => {
        if (!v) return;
        try { const x = JSON.parse(v); setNotifyPrefs({ paused: !!x.paused, on: { ...DEFAULT_NOTIFY.on, ...x.on } }); } catch {}
      }).catch(() => {});
    }
    return () => { notifyListeners.delete(setPrefs); };
  }, []);
  const write = (next: NotifyPrefs) => { setNotifyPrefs(next); AsyncStorage.setItem(NOTIFY_KEY, JSON.stringify(next)).catch(() => {}); };
  const onCount = NOTIFY_TOPICS.filter(t => prefs.on[t.id]).length;
  return {
    prefs,
    onCount: prefs.paused ? 0 : onCount,
    setTopic: (id: string, v: boolean) => write({ ...notifyPrefs, on: { ...notifyPrefs.on, [id]: v } }),
    setPaused: (v: boolean) => write({ ...notifyPrefs, paused: v }),
  };
};

// ── Help & feedback ──────────────────────────────────────────────
const FEEDBACK_KEY = 'spartans-feedback-v1';

// Parts of the app a message can be about, in tab order then sub-pages.
export const FEEDBACK_AREAS = [
  'Home', 'The Buzz', 'Programs', 'Calendar', 'Announcements', 'Social',
  'Map', 'Cafeteria', 'Contacts', 'Homework', 'Day view',
  'Profile & ID card', 'Badges & levels', 'Settings', 'Sign up & sign in', 'Something else',
];

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string; icon: IconName; hint: string }[] = [
  { id: 'like', label: 'I like this', icon: 'check-circle', hint: 'What do you like about it? (optional)' },
  { id: 'fix', label: 'Needs fixing', icon: 'edit', hint: 'What went wrong, and what did you expect?' },
  { id: 'idea', label: 'Idea', icon: 'sparkle', hint: 'What would make it better?' },
  { id: 'confusing', label: 'Confusing', icon: 'compass', hint: 'What was hard to figure out?' },
];

export type SentFeedback = {
  id: string; area: string; kind: FeedbackKind; message: string; at: string; sent: boolean;
  from?: FeedbackFrom; fromRole?: string | null;
};

// Who the feedback is from, by account: an App Club member (with their main
// role), a teacher (a wvschools.ca account, or the Teacher Sponsor), or a
// student. There is no teacher sign-up yet, so most accounts are students.
export const feedbackFrom = (roles: Role[], email?: string | null): { from: FeedbackFrom; fromRole: string | null } => {
  const main = ALL_ROLES.find(r => roles.includes(r.role))?.role || (roles.includes('owner') ? 'owner' : null);
  if (roles.includes('sponsor') || /@wvschools\.ca$/i.test(email || '')) return { from: 'teacher', fromRole: main };
  if (main) return { from: 'club', fromRole: main };
  return { from: 'student', fromRole: null };
};

const readFeedback = async (): Promise<SentFeedback[]> => {
  try { const v = await AsyncStorage.getItem(FEEDBACK_KEY); return v ? JSON.parse(v) : []; } catch { return []; }
};
const writeFeedback = (list: SentFeedback[]) => AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(0, 50))).catch(() => {});

// Push every unsent message; returns the updated history.
const flush = async (list: SentFeedback[]): Promise<SentFeedback[]> => {
  if (!backendConfigured || !list.some(f => !f.sent)) return list;
  const { feedback, auth } = await import('./backend');
  if (!(await auth.session().catch(() => null))) return list;
  const out: SentFeedback[] = [];
  for (const f of list) {
    if (f.sent) { out.push(f); continue; }
    try {
      const base = { area: f.area, kind: f.kind, message: f.message, platform: Platform.OS, app_version: APP_VERSION };
      try { await feedback.send({ ...base, from_type: f.from || 'student', from_role: f.fromRole || null }); }
      catch (e: any) {
        // before migration 0017 the from columns don't exist yet
        if (!/from_type|from_role|column/i.test(String(e?.message))) throw e;
        await feedback.send(base);
      }
      out.push({ ...f, sent: true });
    } catch { out.push(f); }
  }
  return out;
};

export const useFeedback = () => {
  const [list, setList] = useState<SentFeedback[]>([]);
  useEffect(() => {
    readFeedback().then(async l => {
      setList(l);
      const next = await flush(l);
      if (next !== l) { setList(next); writeFeedback(next); }
    });
  }, []);
  const send = async (f: { area: string; kind: FeedbackKind; message: string; from?: FeedbackFrom; fromRole?: string | null }) => {
    const item: SentFeedback = { ...f, message: f.message.trim(), id: String(Date.now()), at: new Date().toISOString(), sent: false };
    const next = await flush([item, ...(await readFeedback())]);
    setList(next);
    await writeFeedback(next);
    return next[0].sent;
  };
  return { list, send };
};
