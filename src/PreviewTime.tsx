// Sentinel — TEMPORARY time-of-day preview.
// Lets the home screen be scrubbed to any time today so the live rotation can
// be checked without waiting for the bell. Stores an offset from the real
// clock, so a previewed time keeps ticking. Remove once the live card has
// been signed off — nothing else depends on this file except useToday and
// the floating play button on the home screen.

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Ctx = {
  offsetMs: number;                       // 0 = live
  active: boolean;
  setTimeOfDay: (h: number, m: number) => void;
  shiftMinutes: (mins: number) => void;
  clear: () => void;
};

const PreviewCtx = createContext<Ctx>({
  offsetMs: 0, active: false, setTimeOfDay: () => {}, shiftMinutes: () => {}, clear: () => {},
});

export const PreviewTimeProvider = ({ children }: { children: React.ReactNode }) => {
  const [offsetMs, setOffset] = useState(0);

  const setTimeOfDay = useCallback((h: number, m: number) => {
    const real = new Date();
    const target = new Date(real.getFullYear(), real.getMonth(), real.getDate(), h, m, 0, 0);
    setOffset(target.getTime() - real.getTime());
  }, []);
  const shiftMinutes = useCallback((mins: number) => setOffset(o => o + mins * 60_000), []);
  const clear = useCallback(() => setOffset(0), []);

  const value = useMemo(() => ({
    offsetMs, active: offsetMs !== 0, setTimeOfDay, shiftMinutes, clear,
  }), [offsetMs, setTimeOfDay, shiftMinutes, clear]);

  return <PreviewCtx.Provider value={value}>{children}</PreviewCtx.Provider>;
};

export const usePreviewTime = () => useContext(PreviewCtx);
