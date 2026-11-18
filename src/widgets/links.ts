// Spartans — deep links from the widgets and the Live Activity.
// spartans://home, spartans://homework, spartans://calendar … open that page.
// The scheme is set in app.json ("scheme": "spartans").

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import type { TabId } from '../components/Chrome';

const ROUTES: Record<string, TabId> = {
  home: 'home', homework: 'homework', calendar: 'calendar', dayview: 'dayview',
  programs: 'programs', announcements: 'announcements', lunch: 'lunch', map: 'map',
};

export const tabForUrl = (url: string | null): TabId | null => {
  const m = url?.match(/^spartans:\/\/\/?([a-z]+)/i);
  return m ? ROUTES[m[1].toLowerCase()] || null : null;
};

// `ready` is false until the tabs are on screen (signed in, splash gone), so a
// link that launched the app is applied once there is somewhere to go.
export const useDeepLinks = (go: (t: TabId) => void, ready: boolean) => {
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (!ready) return;
    const open = (url: string | null) => { const t = tabForUrl(url); if (t) goRef.current(t); };
    Linking.getInitialURL().then(open).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => open(url));
    return () => sub.remove();
  }, [ready]);
};
