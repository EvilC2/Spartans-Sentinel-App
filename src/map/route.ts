// Spartans — the pathfinder. Builds a graph from the hall centrelines in
// data.ts (nodes at every hall end, crossing, room door and link), joins
// floors through the links, then runs Dijkstra. Also turns a path into plain
// directions ("Along the hall past 304 and 300, about 55 m").
//
// Everything is computed once at import; a route is a few hundred nodes and
// takes well under a millisecond.

import {
  ROOMS, HALLS, LINKS, ENTRANCE, NAVIGABLE, UNITS_PER_M, FLOORS,
  Floor, Room, Link, roomById, roomName,
} from './data';

export type Node = { id: number; floor: Floor; x: number; y: number; link?: Link; room?: Room };
type Edge = { to: number; w: number; via?: Link };

const nodes: Node[] = [];
const adj: Edge[][] = [];
const nodeAt = new Map<string, number>();       // "floor:x:y" → node id
const doorNode = new Map<string, number>();     // room id → its hall node
const roomNode = new Map<string, number>();     // room id → node at the room centre
const linkNodes = new Map<string, Partial<Record<Floor, number>>>();

const key = (f: Floor, x: number, y: number) => `${f}:${Math.round(x)}:${Math.round(y)}`;

const addNode = (floor: Floor, x: number, y: number, extra: Partial<Node> = {}) => {
  const k = key(floor, x, y);
  let id = nodeAt.get(k);
  if (id === undefined) {
    id = nodes.length;
    nodes.push({ id, floor, x, y, ...extra });
    adj.push([]);
    nodeAt.set(k, id);
  } else if (extra.link || extra.room) {
    Object.assign(nodes[id], extra);
  }
  return id;
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const addEdge = (a: number, b: number, w = dist(nodes[a], nodes[b]), via?: Link) => {
  if (a === b) return;
  adj[a].push({ to: b, w, via });
  adj[b].push({ to: a, w, via });
};

// Nearest point on a hall centreline (segments are axis-aligned, but the
// maths is general).
const project = (h: typeof HALLS[number], p: [number, number]) => {
  const [ax, ay] = h.a, [bx, by] = h.b;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
  const x = ax + t * dx, y = ay + t * dy;
  return { x, y, d: Math.hypot(p[0] - x, p[1] - y) };
};

// Every hall keeps a list of the points that were snapped onto it; the
// edges are laid down along the hall once all points are known.
const hallPoints: number[][] = HALLS.map(() => []);

const snap = (floor: Floor, p: [number, number]) => {
  let best = -1, bd = Infinity, bp = { x: 0, y: 0 };
  HALLS.forEach((h, i) => {
    if (h.floor !== floor) return;
    const r = project(h, p);
    if (r.d < bd) { bd = r.d; best = i; bp = { x: r.x, y: r.y }; }
  });
  const id = addNode(floor, bp.x, bp.y);
  hallPoints[best].push(id);
  return id;
};

const doorPoint = (r: Room): [number, number] => {
  switch (r.door) {
    case 't': return [r.x + r.w / 2, r.y];
    case 'b': return [r.x + r.w / 2, r.y + r.h];
    case 'l': return [r.x, r.y + r.h / 2];
    case 'r': return [r.x + r.w, r.y + r.h / 2];
    default: return [r.x + r.w / 2, r.y + r.h / 2];
  }
};

function build() {
  // hall ends and crossings
  HALLS.forEach((h, i) => {
    hallPoints[i].push(addNode(h.floor, h.a[0], h.a[1]), addNode(h.floor, h.b[0], h.b[1]));
  });
  HALLS.forEach((h, i) => HALLS.forEach((g, j) => {
    if (j <= i || h.floor !== g.floor) return;
    const x = crossing(h, g);
    if (x) { const id = addNode(h.floor, x[0], x[1]); hallPoints[i].push(id); hallPoints[j].push(id); }
  }));

  // rooms: centre node ↔ door node on the hall
  ROOMS.forEach(r => {
    if (!NAVIGABLE.has(r.kind) && r.kind !== 'poi') return;
    const d = doorPoint(r);
    const centre = addNode(r.floor, r.x + r.w / 2, r.y + r.h / 2, { room: r });
    const hall = snap(r.floor, d);
    nodes[hall].room = nodes[hall].room || r;
    roomNode.set(r.id, centre);
    doorNode.set(r.id, hall);
    addEdge(centre, hall, Math.max(dist(nodes[centre], nodes[hall]), 10));
  });

  // the front doors
  const ent = addNode(ENTRANCE.floor, ENTRANCE.x, ENTRANCE.y);
  roomNode.set(ENTRANCE.id, ent);
  doorNode.set(ENTRANCE.id, ent);
  hallPoints[HALLS.findIndex(h => h.floor === 3 && h.b[0] === 1570 && h.b[1] === 1330)].push(ent);

  // links: a hall node per floor, plus a "shaft" node beside it. Stepping
  // off the hall into the shaft costs a little, so one staircase down two
  // floors beats two different staircases with a walk between.
  LINKS.forEach(l => {
    const per: Partial<Record<Floor, number>> = {};
    (Object.keys(l.at) as unknown as Floor[]).forEach(fk => {
      const f = Number(fk) as Floor;
      const p = l.at[f]!;
      const hall = snap(f, p);
      const shaft = nodes.length;
      nodes.push({ id: shaft, floor: f, x: nodes[hall].x, y: nodes[hall].y, link: l });
      adj.push([]);
      addEdge(hall, shaft, l.kind === 'door' ? 5 : 70);
      per[f] = shaft;
    });
    linkNodes.set(l.id, per);
    // Indoor floors chain in order; "outside" (0) is one flight from any of them.
    const fl = (Object.keys(per).map(Number) as Floor[]).filter(f => f !== 0).sort((a, b) => a - b);
    const w = l.kind === 'door' ? 10 : 150;
    for (let i = 0; i < fl.length - 1; i++) addEdge(per[fl[i]]!, per[fl[i + 1]]!, w, l);
    if (per[0] !== undefined) fl.forEach(f => addEdge(per[0]!, per[f]!, w + 15, l));
  });

  // lay edges along every hall
  HALLS.forEach((h, i) => {
    const horiz = Math.abs(h.b[0] - h.a[0]) >= Math.abs(h.b[1] - h.a[1]);
    const ids = Array.from(new Set(hallPoints[i])).sort((a, b) => horiz ? nodes[a].x - nodes[b].x : nodes[a].y - nodes[b].y);
    for (let k = 0; k < ids.length - 1; k++) addEdge(ids[k], ids[k + 1]);
  });
}

function crossing(h: typeof HALLS[number], g: typeof HALLS[number]): [number, number] | null {
  const hx = [Math.min(h.a[0], h.b[0]), Math.max(h.a[0], h.b[0])], hy = [Math.min(h.a[1], h.b[1]), Math.max(h.a[1], h.b[1])];
  const gx = [Math.min(g.a[0], g.b[0]), Math.max(g.a[0], g.b[0])], gy = [Math.min(g.a[1], g.b[1]), Math.max(g.a[1], g.b[1])];
  const hH = hy[0] === hy[1], gH = gy[0] === gy[1];
  if (hH && !gH) {
    const x = gx[0], y = hy[0];
    return x >= hx[0] && x <= hx[1] && y >= gy[0] && y <= gy[1] ? [x, y] : null;
  }
  if (!hH && gH) {
    const x = hx[0], y = gy[0];
    return x >= gx[0] && x <= gx[1] && y >= hy[0] && y <= hy[1] ? [x, y] : null;
  }
  // parallel: share an endpoint?
  const ends: [number, number][] = [h.a, h.b];
  for (const e of ends) if ((e[0] === g.a[0] && e[1] === g.a[1]) || (e[0] === g.b[0] && e[1] === g.b[1])) return e;
  return null;
}

build();

// ────────────────────────────────────────────────────────────────
// Routing
// ────────────────────────────────────────────────────────────────
export type RouteOptions = { stepFree?: boolean };

export type Leg = {
  floor: Floor;
  points: { x: number; y: number }[];
  units: number;
  passed: string[];     // room ids whose doors the leg walks past
};

export type Step = {
  kind: 'start' | 'walk' | 'stairs' | 'elevator' | 'door' | 'arrive';
  floor: Floor;
  text: string;
  detail?: string;
  toFloor?: Floor;
  at?: { x: number; y: number };
  link?: string;
};

export type Route = {
  from: string; to: string;
  legs: Leg[];
  steps: Step[];
  metres: number;
  minutes: number;
  floors: Floor[];        // floors the route touches, in order walked
  nodes: Node[];
};

export const targetNode = (id: string) => roomNode.get(id);

export function findRoute(fromId: string, toId: string, opts: RouteOptions = {}): Route | null {
  const s = roomNode.get(fromId), t = roomNode.get(toId);
  if (s === undefined || t === undefined) return null;
  if (s === t) return null;

  const distTo = new Array(nodes.length).fill(Infinity);
  const prev = new Array<number>(nodes.length).fill(-1);
  const prevVia = new Array<Link | undefined>(nodes.length);
  const done = new Array(nodes.length).fill(false);
  distTo[s] = 0;
  // small graph: a plain O(n²) selection is fine
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && distTo[i] < best) { best = distTo[i]; u = i; }
    if (u === -1 || u === t) break;
    done[u] = true;
    for (const e of adj[u]) {
      if (opts.stepFree && e.via && e.via.kind === 'stairs') continue;
      // Students take the stairs; the elevator only wins when it's step-free.
      const w = e.via?.kind === 'elevator' && !opts.stepFree ? e.w * 5 : e.w;
      const nd = distTo[u] + w;
      if (nd < distTo[e.to]) { distTo[e.to] = nd; prev[e.to] = u; prevVia[e.to] = e.via; }
    }
  }
  if (distTo[t] === Infinity) return null;

  const path: number[] = [];
  for (let v = t; v !== -1; v = prev[v]) path.push(v);
  path.reverse();

  // legs: split where the floor changes
  const legs: Leg[] = [];
  let cur: Leg | null = null;
  path.forEach((id, i) => {
    const n = nodes[id];
    if (!cur || cur.floor !== n.floor) {
      cur = { floor: n.floor, points: [], units: 0, passed: [] };
      legs.push(cur);
    }
    const last = cur.points[cur.points.length - 1];
    cur.points.push({ x: n.x, y: n.y });
    if (last) cur.units += Math.hypot(n.x - last.x, n.y - last.y);
    // rooms passed: the hall node of a room, not the ends of the path
    if (n.room && i > 0 && i < path.length - 1 && n.room.id !== fromId && n.room.id !== toId && n.room.kind === 'room') {
      cur.passed.push(n.room.id);
    }
  });

  const steps = describe(path, legs, fromId, toId);
  const walkUnits = legs.reduce((a, l) => a + l.units, 0);
  const metres = Math.max(5, Math.round(walkUnits / UNITS_PER_M / 5) * 5);
  const flights = legs.length - 1;
  const minutes = Math.max(1, Math.ceil((metres / 1.3 + flights * 15) / 60));
  // Passing through a floor inside the elevator doesn't count as visiting it.
  const floors = legs.filter(l => l.points.length > 1).map(l => l.floor);

  return { from: fromId, to: toId, legs, steps, metres, minutes, floors, nodes: path.map(i => nodes[i]) };
}

const floorName = (f: Floor) => f === 0 ? 'outside' : FLOORS.find(x => x.id === f)!.name;

export const targetName = (id: string) => id === ENTRANCE.id ? ENTRANCE.name : (roomById(id) ? roomName(roomById(id)!) : id);

const metresOf = (units: number) => Math.max(5, Math.round(units / UNITS_PER_M / 5) * 5);

function describe(path: number[], legs: Leg[], fromId: string, toId: string): Step[] {
  const steps: Step[] = [];
  const first = nodes[path[0]];
  steps.push({ kind: 'start', floor: first.floor, text: `Start at ${targetName(fromId)}`, detail: floorName(first.floor), at: first });

  legs.forEach((leg, i) => {
    const walk = metresOf(leg.units);
    let text: string;
    if (leg.floor === 0) text = 'Walk outside';
    else if (leg.passed.length) {
      const p = leg.passed.slice(-2);
      text = `Along the hall past ${p.length === 2 ? `${p[0]} and ${p[1]}` : p[0]}`;
    } else text = i === 0 ? 'Head down the hall' : 'Along the hall';
    if (leg.units > 15) steps.push({ kind: 'walk', floor: leg.floor, text, detail: `about ${walk} m` });

    if (i < legs.length - 1) {
      // the link between this leg and the next
      const lastIdx = legs.slice(0, i + 1).reduce((a, l) => a + l.points.length, 0) - 1;
      const n = nodes[path[lastIdx]];
      const next = legs[i + 1].floor;
      const via = n.link;
      const kind: Step['kind'] = via?.kind === 'elevator' ? 'elevator' : via?.kind === 'door' ? 'door' : 'stairs';
      steps.push({ kind, floor: leg.floor, toFloor: next, text: linkText(kind, via?.label || 'the stairs', leg.floor, next), at: n, link: via?.id });
    }
  });

  const last = nodes[path[path.length - 1]];
  steps.push({ kind: 'arrive', floor: last.floor, text: `${targetName(toId)}`, detail: `${floorName(last.floor)} · you're here`, at: last });

  // The same stairs two floors in a row read as one step ("down to the 1st").
  for (let i = 0; i < steps.length - 1; i++) {
    const a = steps[i], b = steps[i + 1];
    if (a.link && a.link === b.link && a.kind === b.kind && b.toFloor !== undefined) {
      const label = LINKS.find(l => l.id === a.link)?.label || 'the stairs';
      steps.splice(i, 2, { ...b, floor: a.floor, at: a.at, text: linkText(a.kind, label, a.floor, b.toFloor) });
      i--;
    }
  }
  return steps;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function linkText(kind: Step['kind'], label: string, from: Floor, to: Floor) {
  const dir = to === 0 ? 'out' : from === 0 ? 'in' : to > from ? 'up' : 'down';
  if (kind === 'door') return dir === 'out' ? `Out through ${label}` : `In through ${label}`;
  if (dir === 'out') return `${cap(label)}, out of the building`;
  if (dir === 'in') return `In and up ${label} to the ${floorName(to)}`;
  if (kind === 'elevator') return `Take ${label} ${dir} to the ${floorName(to)}`;
  return `${cap(label)}, ${dir} to the ${floorName(to)}`;
}

// Where a floor change happens on a given floor, for drawing the "↓ 2" pill.
export const legLinkMarkers = (r: Route, floor: Floor) => {
  const out: { x: number; y: number; toFloor: Floor; kind: Step['kind'] }[] = [];
  r.steps.forEach(s => {
    if ((s.kind === 'stairs' || s.kind === 'elevator' || s.kind === 'door') && s.floor === floor && s.at && s.toFloor !== undefined) {
      out.push({ x: s.at.x, y: s.at.y, toFloor: s.toFloor, kind: s.kind });
    }
  });
  return out;
};

// Debug helper: every node on a floor (for checking the graph in a browser).
export const debugGraph = () => ({ nodes, adj });
