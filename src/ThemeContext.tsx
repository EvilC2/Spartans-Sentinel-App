// Sentinel — theme provider.
// Replaces app.jsx's `document.documentElement.setAttribute('data-theme')` +
// localStorage pair with Context + AsyncStorage.

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, Mode } from './theme';

const KEY = 'sentinel-theme';

type Ctx = {
  mode: Mode;
  c: (typeof colors)['light'];
  toggle: () => void;
};

const ThemeCtx = createContext<Ctx>({ mode: 'light', c: colors.light, toggle: () => {} });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === 'light' || v === 'dark') setMode(v);
    });
  }, []);

  const toggle = () => {
    setMode(m => {
      const next: Mode = m === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(KEY, next);
      return next;
    });
  };

  return (
    <ThemeCtx.Provider value={{ mode, c: colors[mode], toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
};

export const useTheme = () => useContext(ThemeCtx);
