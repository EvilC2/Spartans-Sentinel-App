// Spartans — tiny navigation store. One active screen plus a one-deep "back"
// so sub-screens (Contacts, Homework, Me, Day view) return to where they came
// from. The tab bar lights the parent tab (see Chrome.tabFor).
// `program` is a one-shot request: nav.openProgram(id) switches to the
// Programs tab, which opens that card and clears it.
// Day view is now the Day tab inside Calendar: go('dayview') lands on the
// Calendar with `calMode` set, which CalendarScreen reads once and clears.
// `focus` is the same idea for one thing on a page: open(tab, focus) switches
// tab and the screen opens that exact item (see useFocus).

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { TabId } from './components/Chrome';

// `mapReq` is a one-shot request for the Map screen (nav.openMap): where to
// go and, optionally, where from. MapScreen reads it once and clears it.
export type MapReq = { to?: string; from?: string };

// One thing on a screen, for notifications that open exactly what they're about.
export type Focus =
  | { kind: 'homework'; id: string }                  // Homework: that task, opened
  | { kind: 'day'; iso: string; event?: string }      // Calendar: that day (and event)
  | { kind: 'news'; id: string }                      // Announcements: that post, reading
  | { kind: 'buzz'; id: string }                      // Home: that slide in The Buzz
  | { kind: 'menu'; id: string }                      // Cafeteria: that item
  | { kind: 'request'; id: string }                   // Social: that friend request
  | { kind: 'badges' };                               // Profile: the Badges sheet
type FocusReq = Focus & { at: number };

type Nav = {
  tab: TabId;
  program: string | null;
  mapReq: MapReq | null;
  calMode: 'month' | 'week' | 'day' | null;
  focus: FocusReq | null;
  clearCalMode: () => void;
  go: (t: TabId) => void;
  open: (t: TabId, focus: Focus) => void;
  clearFocus: () => void;
  openProgram: (id: string) => void;
  clearProgram: () => void;
  openMap: (req?: MapReq) => void;
  clearMapReq: () => void;
  back: () => void;
};

const NavCtx = createContext<Nav>({ tab: 'home', program: null, mapReq: null, calMode: null, focus: null, clearCalMode: () => {}, go: () => {}, open: () => {}, clearFocus: () => {}, openProgram: () => {}, clearProgram: () => {}, openMap: () => {}, clearMapReq: () => {}, back: () => {} });

export const NavProvider = ({ children }: { children: React.ReactNode }) => {
  const [tab, setTab] = useState<TabId>('home');
  const [prev, setPrev] = useState<TabId>('home');
  const [program, setProgram] = useState<string | null>(null);
  const [mapReq, setMapReq] = useState<MapReq | null>(null);
  const [calMode, setCalMode] = useState<Nav['calMode']>(null);
  const [focus, setFocus] = useState<FocusReq | null>(null);
  const value = useMemo<Nav>(() => ({
    tab, program, mapReq, calMode, focus,
    go: t => {
      setFocus(null);
      if (t === 'dayview') { setCalMode('day'); t = 'calendar'; }
      if (t !== tab) { setPrev(tab); setTab(t); }
    },
    open: (t, f) => {
      setFocus({ ...f, at: Date.now() });
      if (t !== tab) { setPrev(tab); setTab(t); }
    },
    clearFocus: () => setFocus(null),
    clearCalMode: () => setCalMode(null),
    openProgram: id => { setProgram(id); if (tab !== 'programs') { setPrev(tab); setTab('programs'); } },
    clearProgram: () => setProgram(null),
    openMap: req => { setMapReq(req || null); if (tab !== 'map') { setPrev(tab); setTab('map'); } },
    clearMapReq: () => setMapReq(null),
    back: () => { setFocus(null); setTab(prev); setPrev('home'); },
  }), [tab, prev, program, mapReq, calMode, focus]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
};

export const useNav = () => useContext(NavCtx);

// A screen's end of nav.open. `show` runs with the request and returns true
// once it has opened the thing. Until then it runs again whenever `deps`
// change, because what a notification points at may still be loading (a post
// from the server, say). After a while it gives up and the page just stays open.
const GIVE_UP_MS = 10_000;
export const useFocus = <K extends Focus['kind']>(kind: K, show: (f: Extract<Focus, { kind: K }>) => boolean, deps: unknown[]) => {
  const { focus, clearFocus } = useNav();
  const run = useRef(show);
  run.current = show;
  useEffect(() => {
    if (!focus || focus.kind !== kind) return;
    if (run.current(focus as unknown as Extract<Focus, { kind: K }>)) { clearFocus(); return; }
    const t = setTimeout(clearFocus, Math.max(0, focus.at + GIVE_UP_MS - Date.now()));
    return () => clearTimeout(t);
  }, [focus, ...deps]);   // eslint-disable-line react-hooks/exhaustive-deps
};
