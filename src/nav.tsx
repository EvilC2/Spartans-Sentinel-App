// Spartans — tiny navigation store. One active screen plus a one-deep "back"
// so sub-screens (Contacts, Homework, Me, Day view) return to where they came
// from. The tab bar lights the parent tab (see Chrome.tabFor).

import React, { createContext, useContext, useMemo, useState } from 'react';
import type { TabId } from './components/Chrome';

type Nav = { tab: TabId; go: (t: TabId) => void; back: () => void };

const NavCtx = createContext<Nav>({ tab: 'home', go: () => {}, back: () => {} });

export const NavProvider = ({ children }: { children: React.ReactNode }) => {
  const [tab, setTab] = useState<TabId>('home');
  const [prev, setPrev] = useState<TabId>('home');
  const value = useMemo<Nav>(() => ({
    tab,
    go: t => { if (t !== tab) { setPrev(tab); setTab(t); } },
    back: () => { setTab(prev); setPrev('home'); },
  }), [tab, prev]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
};

export const useNav = () => useContext(NavCtx);
