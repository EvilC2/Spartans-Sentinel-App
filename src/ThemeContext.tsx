// Sentinel — theme provider.
// Replaces app.jsx's `document.documentElement.setAttribute('data-theme')` +
// localStorage pair with Context + AsyncStorage.
// `pref` is what the student picked in Settings → Appearance; 'system' follows
// the phone. `mode` is what is actually showing.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, Mode } from './theme';

const KEY = 'sentinel-theme';

export type ThemePref = Mode | 'system';

type Ctx = {
  mode: Mode;
  pref: ThemePref;
  c: (typeof colors)['light'];
  toggle: () => void;
  setPref: (p: ThemePref) => void;
};

const ThemeCtx = createContext<Ctx>({ mode: 'light', pref: 'light', c: colors.light, toggle: () => {}, setPref: () => {} });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [pref, setPrefState] = useState<ThemePref>('light');
  const system = useColorScheme();
  const mode: Mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
    });
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(KEY, p);
  };
  const toggle = () => setPref(mode === 'light' ? 'dark' : 'light');

  return (
    <ThemeCtx.Provider value={{ mode, pref, c: colors[mode], toggle, setPref }}>
      {children}
    </ThemeCtx.Provider>
  );
};

export const useTheme = () => useContext(ThemeCtx);
