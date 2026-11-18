// Spartans — what the last widget / Live Activity sync did, for the Developer
// screen. Release builds swallow widget errors (a widget write must never take
// the app down), so this is the only place they show up.

export type WidgetStatus = {
  at: number;                              // last sync, ms (0 = never)
  results: Record<string, string>;         // widget name → 'ok' or the error
  live: string;                            // what the Live Activity step did
  previewing: boolean;                     // written for a previewed time
};

let status: WidgetStatus = { at: 0, results: {}, live: 'not run yet', previewing: false };
const subs = new Set<(s: WidgetStatus) => void>();

export const getWidgetStatus = () => status;

export const setWidgetStatus = (patch: Partial<WidgetStatus>) => {
  status = { ...status, ...patch, results: { ...status.results, ...(patch.results || {}) } };
  subs.forEach(f => f(status));
};

export const onWidgetStatus = (f: (s: WidgetStatus) => void) => {
  subs.add(f);
  return () => { subs.delete(f); };
};

// The Developer screen's "Refresh now" button; WidgetSync listens (iOS only).
const refreshers = new Set<() => void>();
export const requestWidgetRefresh = () => refreshers.forEach(f => f());
export const onWidgetRefresh = (f: () => void) => {
  refreshers.add(f);
  return () => { refreshers.delete(f); };
};

// Widget timelines are stored in the app group's UserDefaults, which only takes
// property-list values: a `null` anywhere in the props makes the native write
// throw ("Exception in HostFunction"). Drop null/undefined keys; the widget
// code already treats a missing key like null.
export const plain = <T,>(v: T): T => {
  if (Array.isArray(v)) return v.filter(x => x != null).map(plain) as unknown as T;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (x != null) out[k] = plain(x);
    return out as T;
  }
  return v;
};
