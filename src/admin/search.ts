// Spartans — how every search box in App Club works, so they all behave alike.
//   matches(q, …)     each word typed has to start a word in the text, in any
//                     order ("sam pol" finds Sam Okafor, Polls). Longer bits
//                     also match inside a word. Accents and case don't matter.
//   byTitle(q, …)     best first: the title starts with it, a word in the title
//                     does, then everything else in its own order.
//   usePeopleSearch   looks people up as you type: waits for a pause, ignores
//                     answers to older questions, and says where it's at.

import { useEffect, useRef, useState } from 'react';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

export const matches = (q: string, ...text: (string | null | undefined)[]): boolean => {
  const want = words(q);
  if (!want.length) return true;
  const hay = norm(text.filter(Boolean).join(' '));
  const have = words(hay);
  return want.every(w => have.some(h => h.startsWith(w)) || (w.length >= 4 && hay.includes(w)));
};

export const byTitle = <T,>(q: string, list: T[], title: (x: T) => string): T[] => {
  const s = norm(q).trim();
  if (!s) return list;
  const rank = (x: T) => {
    const t = norm(title(x));
    return t.startsWith(s) ? 0 : words(t).some(w => w.startsWith(s)) ? 1 : 2;
  };
  return list.map((x, i) => ({ x, i, r: rank(x) })).sort((a, b) => a.r - b.r || a.i - b.i).map(e => e.x);
};

export type SearchState = 'idle' | 'short' | 'busy' | 'none' | 'found' | 'error';

export const usePeopleSearch = <T,>(find: (q: string) => Promise<T[]>) => {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<T[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [error, setError] = useState<string | null>(null);
  const run = useRef(find);
  run.current = find;

  useEffect(() => {
    const s = q.trim();
    setError(null);
    if (s.length < 2) { setFound([]); setState(s ? 'short' : 'idle'); return; }
    setState('busy');
    let stale = false;
    const t = setTimeout(() => {
      run.current(s).then(
        list => { if (!stale) { setFound(list); setState(list.length ? 'found' : 'none'); } },
        e => { if (!stale) { setFound([]); setState('error'); setError(String(e?.message || 'Search failed. Try again.')); } },
      );
    }, 280);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  return { q, setQ, found, state, error, clear: () => setQ('') };
};
