// Sentinel — TEMPORARY time-of-day preview.
// Lets the home screen be scrubbed to any time today so the live rotation can
// be checked without waiting for the bell. Stores an offset from the real
// clock, so a previewed time keeps ticking. Remove once the live card has
// been signed off — nothing else depends on this file except useToday and
// the floating play button on the home screen.
// `tools`: whether the TEMP controls show at all. Off until the owner switches
// them on in App Club → Developer tools; remembered on this phone.
// Owner only (src/devAccess.ts): usePreviewTime gives everyone else a switched-off
// copy, so a flag left on this phone or a leftover offset does nothing for them.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDevAccess } from './devAccess';

const TOOLS_KEY = 'spartans-temp-tools-v1';

type Ctx = {
  offsetMs: number;                       // 0 = live
  active: boolean;
  setTimeOfDay: (h: number, m: number) => void;
  shiftMinutes: (mins: number) => void;
  clear: () => void;
  tools: boolean;
  setTools: (on: boolean) => void;
};

const OFF: Ctx = {
  offsetMs: 0, active: false, setTimeOfDay: () => {}, shiftMinutes: () => {}, clear: () => {}, tools: false, setTools: () => {},
};
const PreviewCtx = createContext<Ctx>(OFF);

export const PreviewTimeProvider = ({ children }: { children: React.ReactNode }) => {
  const [offsetMs, setOffset] = useState(0);
  const [tools, setToolsState] = useState(false);
  useEffect(() => { AsyncStorage.getItem(TOOLS_KEY).then(v => setToolsState(v === '1')).catch(() => {}); }, []);
  const setTools = useCallback((on: boolean) => {
    setToolsState(on);
    if (!on) setOffset(0);
    AsyncStorage.setItem(TOOLS_KEY, on ? '1' : '0').catch(() => {});
  }, []);

  const setTimeOfDay = useCallback((h: number, m: number) => {
    const real = new Date();
    const target = new Date(real.getFullYear(), real.getMonth(), real.getDate(), h, m, 0, 0);
    setOffset(target.getTime() - real.getTime());
  }, []);
  const shiftMinutes = useCallback((mins: number) => setOffset(o => o + mins * 60_000), []);
  const clear = useCallback(() => setOffset(0), []);

  const value = useMemo(() => ({
    offsetMs, active: offsetMs !== 0, setTimeOfDay, shiftMinutes, clear, tools, setTools,
  }), [offsetMs, setTimeOfDay, shiftMinutes, clear, tools, setTools]);

  return <PreviewCtx.Provider value={value}>{children}</PreviewCtx.Provider>;
};

export const usePreviewTime = () => {
  const ctx = useContext(PreviewCtx);
  return useDevAccess() ? ctx : OFF;
};
