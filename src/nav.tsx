// Spartans — tiny navigation store. One active screen plus a one-deep "back"
// so sub-screens (Contacts, Homework, Me, Day view) return to where they came
// from. The tab bar lights the parent tab (see Chrome.tabFor).
// `program` is a one-shot request: nav.openProgram(id) switches to the
// Programs tab, which opens that card and clears it.
// Day view is now the Day tab inside Calendar: go('dayview') lands on the
// Calendar with `calMode` set, which CalendarScreen reads once and clears.

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { TabId } from './components/Chrome';

// `mapReq` is a one-shot request for the Map screen (nav.openMap): where to
// go and, optionally, where from. MapScreen reads it once and clears it.
export type MapReq = { to?: string; from?: string };

type Nav = {
  tab: TabId;
  program: string | null;
  mapReq: MapReq | null;
  calMode: 'month' | 'week' | 'day' | null;
  clearCalMode: () => void;
  go: (t: TabId) => void;
  openProgram: (id: string) => void;
  clearProgram: () => void;
  openMap: (req?: MapReq) => void;
  clearMapReq: () => void;
  back: () => void;
};

const NavCtx = createContext<Nav>({ tab: 'home', program: null, mapReq: null, calMode: null, clearCalMode: () => {}, go: () => {}, openProgram: () => {}, clearProgram: () => {}, openMap: () => {}, clearMapReq: () => {}, back: () => {} });

export const NavProvider = ({ children }: { children: React.ReactNode }) => {
  const [tab, setTab] = useState<TabId>('home');
  const [prev, setPrev] = useState<TabId>('home');
  const [program, setProgram] = useState<string | null>(null);
  const [mapReq, setMapReq] = useState<MapReq | null>(null);
  const [calMode, setCalMode] = useState<Nav['calMode']>(null);
  const value = useMemo<Nav>(() => ({
    tab, program, mapReq, calMode,
    go: t => {
      if (t === 'dayview') { setCalMode('day'); t = 'calendar'; }
      if (t !== tab) { setPrev(tab); setTab(t); }
    },
    clearCalMode: () => setCalMode(null),
    openProgram: id => { setProgram(id); if (tab !== 'programs') { setPrev(tab); setTab('programs'); } },
    clearProgram: () => setProgram(null),
    openMap: req => { setMapReq(req || null); if (tab !== 'map') { setPrev(tab); setTab('map'); } },
    clearMapReq: () => setMapReq(null),
    back: () => { setTab(prev); setPrev('home'); },
  }), [tab, prev, program, mapReq, calMode]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
};

export const useNav = () => useContext(NavCtx);
