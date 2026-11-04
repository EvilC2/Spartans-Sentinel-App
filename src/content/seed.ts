// Spartans — starter posts. The trivia, polls and news the app has always
// shipped with (src/data.ts), as Posts, so admins can edit or take down
// anything students see. Times are rebuilt on every launch so the samples
// sit around today. Also the sample numbers shown in demo mode.

import S from '../data';
import type { Post, NewsCategory } from './model';

const at = (daysAgo: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

// "7:48 AM" = today, "Yesterday" = 1, weekday = a few days back.
const ago = (time: string, i: number) => {
  const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(time);
  if (m) return at(0, (Number(m[1]) % 12) + (/pm/i.test(m[3]) ? 12 : 0), Number(m[2]));
  if (time === 'Yesterday') return at(1, 9);
  return at(2 + Math.floor(i / 2), 8 + (i % 3));
};

// Photos behind the starter posts (Unsplash, free to use). Admins can swap
// or remove them in the editor.
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=70&auto=format&fit=crop`;
const IMAGES: Record<string, string> = {
  'seed-b1': U('1562774053-701939374585'),   // the school building
  'seed-b2': U('1532012197267-da84d127e765'),   // open book in the stacks
  'seed-b3': U('1529390079861-591de354faf5'),   // student writing
  'seed-b4': U('1511632765486-a01980e01a18'),   // friends outside
  'seed-b5': U('1461988320302-91bde64fc8e4'),   // "make something awesome"
  'seed-n1': U('1529900748604-07564a03e7a6'),   // cleats on the pitch
  'seed-n2': U('1541339907198-e08756dedf3f'),   // grad caps
  'seed-n3': U('1481627834876-b7833e8f5570'),   // library shelves
  'seed-n4': U('1465847899084-d164df4dedc6'),   // orchestra
  'seed-n5': U('1427504494785-3a9ca7044f45'),   // hallway
  'seed-n6': U('1552674605-db6ffd4facb5'),      // runners at sunrise
  'seed-n7': U('1555939594-58d7cb561ad1'),      // bbq
  'seed-n8': U('1485965120184-e220f721d03e'),   // bike
  'seed-menu-special': U('1498837167922-ddd27525d352'),   // salad bar
  'seed-event-club': U('1522202176988-66273c2fd55f'),     // students with laptops
};
const pic = (id: string) => ({ image: IMAGES[id] || null });

const base = (id: string, places: Post['places'], createdAt: string, extra: Partial<Post> = {}) => ({
  id, places, status: 'published' as const, startsAt: null, endsAt: null, sort: 0, pinned: false,
  createdAt, updatedAt: createdAt, sample: true, ...extra,
});

export const seedPosts = (): Post[] => {
  const out: Post[] = [];
  // The Buzz order: pinned news first, then the fun ones, then one more news.
  let sort = 10;
  for (const b of S.buzz as any[]) {
    const created = at(3, 8);
    if (b.kind === 'trivia') out.push({ ...base(`seed-${b.id}`, ['buzz'], created, { sort: sort += 10 }), kind: 'trivia', data: { prompt: b.prompt, options: b.options, answer: b.answer, explain: b.explain, ...pic(`seed-${b.id}`) } });
    if (b.kind === 'poll') out.push({ ...base(`seed-${b.id}`, ['buzz'], created, { sort: sort += 10 }), kind: 'poll', data: { prompt: b.prompt, options: b.options, showResults: true, ...pic(`seed-${b.id}`) } });
    if (b.kind === 'fact') out.push({ ...base(`seed-${b.id}`, ['buzz'], created, { sort: sort += 10 }), kind: 'fact', data: { eyebrow: b.eyebrow, title: b.title, body: b.body, ...pic(`seed-${b.id}`) } });
  }
  S.news.forEach((n: any, i) => {
    // The three that used to be "announcements" also went to the bell and The Buzz.
    const places: Post['places'] = ['news'];
    if (i < 3) places.push('bell');
    if (n.pinned) places.push('buzz');
    if (i === 1) places.push('buzz');
    out.push({
      ...base(`seed-${n.id}`, places, ago(n.time, i), { pinned: !!n.pinned, sort: n.pinned ? 0 : i === 1 ? 900 : 0 }),
      kind: 'news',
      data: { category: n.category as NewsCategory, title: n.title, body: n.body || n.preview, author: n.author, role: n.role, ...pic(`seed-${n.id}`) },
    });
  });
  // Drafts that show admins how menu changes and club events work.
  out.push({
    ...base('seed-menu-special', ['cafeteria', 'buzz'], at(0, 7), { status: 'draft', sort: 5 }),
    kind: 'menu',
    data: { itemId: 'special', name: 'Daily Special', price: 10, blurb: 'Write what the special is today.', cats: ['plated'], featured: true, ...pic('seed-menu-special') },
  });
  out.push({
    ...base('seed-event-club', ['calendar'], at(0, 7), { status: 'draft' }),
    kind: 'event',
    data: { title: 'School App Club meeting', date: at(-3, 12).slice(0, 10), time: '12:15', place: 'Room 214', body: 'Ideas, bugs, what to build next. Everyone welcome.', ...pic('seed-event-club') },
  });
  return out;
};

// Demo mode has no server to count with, so sample posts start from these
// numbers and this phone's own views and answers are added on top.
export const SAMPLE_STATS: Record<string, { viewers: number; opens: number; votes?: number[] }> = {
  'seed-b1': { viewers: 812, opens: 0, votes: [341, 120, 88, 59] },
  'seed-b2': { viewers: 774, opens: 0 },
  'seed-b3': { viewers: 690, opens: 0, votes: [61, 77, 402, 38] },
  'seed-b4': { viewers: 845, opens: 0, votes: [212, 268, 97, 140] },
  'seed-b5': { viewers: 433, opens: 0, votes: [150, 92, 64, 21] },
  'seed-n1': { viewers: 1012, opens: 433 },
  'seed-n2': { viewers: 655, opens: 210 },
  'seed-n3': { viewers: 501, opens: 96 },
  'seed-n4': { viewers: 388, opens: 71 },
  'seed-n5': { viewers: 290, opens: 22 },
  'seed-n6': { viewers: 610, opens: 188 },
  'seed-n7': { viewers: 702, opens: 340 },
  'seed-n8': { viewers: 214, opens: 9 },
};
