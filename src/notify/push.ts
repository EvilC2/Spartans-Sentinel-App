// Spartans — real phone notifications (expo-notifications).
//
// Two kinds reach the lock screen:
//   local   scheduled on the phone from feed.ts: homework the evening before,
//           Collab / Pro-D / days off, personal events. Works with no server
//           and no signal. Rebuilt whenever the data or the settings change.
//   remote  sent by the server (supabase/functions/send-push): snow days and
//           other admin banners, announcements, friend requests, badge
//           awards. Needs the Expo push token saved in push_tokens.
//
// Web has no notifications: every call is a no-op there. Needs a dev build
// (expo run:ios) after installing; Expo Go on Android can't do remote push.

import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import type { Notice, NoticeAction } from './feed';

export const pushSupported = Platform.OS !== 'web';

let N: typeof NotificationsType | null = null;
const mod = () => {
  if (!pushSupported) return null;
  if (!N) { try { N = require('expo-notifications'); } catch { N = null; } }
  return N;
};

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

// Show alerts even while the app is open (the in-app list updates too).
export const setupNotifications = async () => {
  const n = mod();
  if (!n) return;
  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true,
    }),
  });
  if (Platform.OS === 'android') {
    await n.setNotificationChannelAsync('reminders', {
      name: 'Reminders', importance: n.AndroidImportance.DEFAULT,
      description: 'Homework, calendar and event-day reminders',
    }).catch(() => {});
    await n.setNotificationChannelAsync('school', {
      name: 'School news', importance: n.AndroidImportance.HIGH,
      description: 'Snow days, big announcements, friend requests and badges',
    }).catch(() => {});
  }
};

export const getPermission = async (): Promise<PermissionState> => {
  const n = mod();
  if (!n) return 'unsupported';
  try {
    const p = await n.getPermissionsAsync();
    if (p.granted || p.ios?.status === n.IosAuthorizationStatus.PROVISIONAL) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch { return 'unsupported'; }
};

// Shows the system prompt once. After a "Don't allow", only Settings can
// turn it back on, so send them there.
export const askPermission = async (): Promise<PermissionState> => {
  const n = mod();
  if (!n) return 'unsupported';
  const now = await getPermission();
  if (now === 'denied') { Linking.openSettings().catch(() => {}); return now; }
  if (now === 'granted') return now;
  try {
    const p = await n.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch { return 'unsupported'; }
};

// iOS keeps at most 64 pending; stay under it.
const MAX_SCHEDULED = 60;

// Replace every pending reminder with this list (future ones only).
export const scheduleReminders = async (list: Notice[]) => {
  const n = mod();
  if (!n) return;
  try {
    await n.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    const upcoming = list.filter(x => x.at > now + 5_000).sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
    for (const x of upcoming) {
      await n.scheduleNotificationAsync({
        identifier: x.id,
        content: { title: x.title, body: x.body, data: { id: x.id, action: x.action ?? null }, sound: false },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(x.at), channelId: 'reminders' },
      });
    }
  } catch {}
};

export const setAppBadge = (count: number) => {
  const n = mod();
  if (!n) return;
  n.setBadgeCountAsync(count).catch(() => {});
};

// Tapping a notification (app open, in the background, or cold start).
export const onNotificationTap = (cb: (action: NoticeAction | null, id?: string) => void) => {
  const n = mod();
  if (!n) return () => {};
  const handle = (r: NotificationsType.NotificationResponse | null) => {
    if (!r) return;
    const data = r.notification.request.content.data as { id?: string; action?: NoticeAction | null } | undefined;
    cb(data?.action ?? null, data?.id);
  };
  n.getLastNotificationResponseAsync().then(r => { handle(r); n.clearLastNotificationResponseAsync?.().catch(() => {}); }).catch(() => {});
  const sub = n.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
};

// A remote push arriving while the app is open: refresh server data.
export const onNotificationReceived = (cb: () => void) => {
  const n = mod();
  if (!n) return () => {};
  const sub = n.addNotificationReceivedListener(() => cb());
  return () => sub.remove();
};

// Expo push token for the server. Needs an EAS project id (app.json →
// extra.eas.projectId, set by `eas init`) and a real phone.
export const getPushToken = async (): Promise<string | null> => {
  const n = mod();
  if (!n) return null;
  try {
    const Device = require('expo-device');
    if (!Device.isDevice) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return null;
    return (await n.getExpoPushTokenAsync({ projectId })).data;
  } catch { return null; }
};
