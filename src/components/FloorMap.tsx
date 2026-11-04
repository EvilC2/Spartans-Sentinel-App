// Spartans — the floor plan, drawn from src/map/data.ts with react-native-svg.
// One floor at a time, the outside drawn under every floor. Pan with one
// finger (or the mouse), pinch to zoom, double-tap to zoom in, tap a room to
// pick it. A route is drawn as a navy line with chevrons, a green start dot,
// a red pin at the end and "↓ 2nd" pills where it changes floor.
//
// Gestures are a PanResponder on the wrapper, so they work the same on iOS,
// Android and the web build. Taps are hit-tested against the room rects in
// map units, not via SVG onPress, for the same reason. Panning is clamped so
// the building can never be flung off the screen.
//
// Labels thin out as you zoom out: at a glance you get the big places, and
// room numbers and the legend squares appear as you come in. `ref` exposes
// zoomBy / reset for the buttons the Map screen floats over the map.

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, PanResponder, LayoutChangeEvent, Platform, GestureResponderEvent } from 'react-native';
import Svg, { Rect, Path, Circle, Text as SvgText, TSpan, G, Defs, Pattern, Line } from 'react-native-svg';
import { useTheme } from '../ThemeContext';
import { ROOMS, OUTSIDE, VIEW, BUILDING, ENTRANCE, NAVIGABLE, UNITS_PER_M, Floor, Room, roomById } from '../map/data';
import { Route, legLinkMarkers } from '../map/route';
import { tnum } from '../theme';

// Either a point (with an optional zoom) or a box to fit.
export type Focus = { x: number; y: number; z?: number; key: number; box?: { x0: number; y0: number; x1: number; y1: number } };

export type FloorMapHandle = { zoomBy: (factor: number) => void; reset: () => void };

type Props = {
  floor: Floor;
  route?: Route | null;
  fromId?: string | null;
  toId?: string | null;
  onTapRoom?: (r: Room | null, at: { x: number; y: number }) => void;
  onInteract?: (active: boolean) => void;   // so a parent scroll view can stand back
  focus?: Focus | null;
  height: number;
};

const MIN_Z = 0.9, MAX_Z = 6, FIT_MAX_Z = 2.2;   // fits never zoom past 2.2×: a short leg still shows its surroundings
const FIT_PAD = 420;                             // map units of breathing room around a fitted route leg

export const FloorMap = forwardRef<FloorMapHandle, Props>(function FloorMap(
  { floor, route, fromId, toId, onTapRoom, onInteract, focus, height }, ref,
) {
  const { c, mode } = useTheme();
  const [size, setSize] = useState({ w: 0, h: height });
  const [zShown, setZShown] = useState(1);     // settled zoom; drives labels and the scale bar

  // Base scale fits the whole sheet into the view; z multiplies it.
  const s0 = size.w ? Math.min(size.w / VIEW.w, size.h / VIEW.h) : 1;
  const svgW = VIEW.w * s0, svgH = VIEW.h * s0;
  const cx = size.w / 2, cy = size.h / 2;      // RN scales about the centre

  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const zv = useRef(new Animated.Value(1)).current;
  const st = useRef({ tx: 0, ty: 0, z: 1 });    // plain numbers mirror the Animated values

  // map units → local svg px (before the transform)
  const toLocal = (mx: number, my: number) => ({ x: (mx - VIEW.x) * s0 + (size.w - svgW) / 2, y: (my - VIEW.y) * s0 + (size.h - svgH) / 2 });
  // screen px → map units (through the current transform)
  const toMap = (sx: number, sy: number) => {
    const { tx: x, ty: y, z } = st.current;
    const lx = cx + (sx - x - cx) / z, ly = cy + (sy - y - cy) / z;
    return { x: (lx - (size.w - svgW) / 2) / s0 + VIEW.x, y: (ly - (size.h - svgH) / 2) / s0 + VIEW.y };
  };

  // Keep the sheet overlapping the window: you can't lose the building.
  const clamp = (x: number, y: number, z: number) => {
    if (!size.w) return { x, y };
    const a = toLocal(VIEW.x, VIEW.y), b = toLocal(VIEW.x + VIEW.w, VIEW.y + VIEW.h);
    // A screen edge is centre + (local − centre) × z + t. When the sheet is
    // bigger than the window it has to cover it (no blank strips); when it is
    // smaller it just stays inside.
    const fix = (lo: number, hi: number, centre: number, extent: number, t: number) => {
      const sLo = centre + (lo - centre) * z, sHi = centre + (hi - centre) * z;
      const [tMin, tMax] = sHi - sLo >= extent
        ? [extent - sHi, -sLo]             // cover
        : [-sLo, extent - sHi];            // fit inside
      return Math.max(tMin, Math.min(tMax, t));
    };
    return { x: fix(a.x, b.x, cx, size.w, x), y: fix(a.y, b.y, cy, size.h, y) };
  };

  const setT = (x: number, y: number, z: number, settle = false) => {
    const p = clamp(x, y, z);
    st.current = { tx: p.x, ty: p.y, z };
    tx.setValue(p.x); ty.setValue(p.y); zv.setValue(z);
    if (settle) setZShown(z);
  };

  // translation that puts map point (mx,my) at screen (sx,sy) for zoom z
  const centreOn = (mx: number, my: number, z: number, sx = cx, sy = cy) => {
    const l = toLocal(mx, my);
    return { x: sx - cx - (l.x - cx) * z, y: sy - cy - (l.y - cy) * z };
  };

  const animateTo = (x: number, y: number, z: number) => {
    const p = clamp(x, y, z);
    st.current = { tx: p.x, ty: p.y, z };
    const cfg = { duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true };
    Animated.parallel([
      Animated.timing(tx, { toValue: p.x, ...cfg }),
      Animated.timing(ty, { toValue: p.y, ...cfg }),
      Animated.timing(zv, { toValue: z, ...cfg }),
    ]).start(() => setZShown(z));
  };

  const frameBuilding = (animate = false) => {
    if (!size.w) return;
    const z = Math.min(size.w / (BUILDING.w * s0), size.h / (BUILDING.h * s0)) * 0.98;
    const t = centreOn(BUILDING.x + BUILDING.w / 2, BUILDING.y + BUILDING.h / 2, z);
    if (animate) animateTo(t.x, t.y, z); else setT(t.x, t.y, z, true);
  };

  // First layout: frame the building, not the whole sheet with its margins.
  const framed = useRef(false);
  useEffect(() => {
    if (!size.w || framed.current) return;
    framed.current = true;
    if (!focus) frameBuilding();
  }, [size.w, size.h]);

  // A focus that lands before the first layout would otherwise be dropped, so
  // this also runs when the size arrives; appliedFocus keeps it to once each.
  const appliedFocus = useRef(-1);
  useEffect(() => {
    if (!focus || !size.w || appliedFocus.current === focus.key) return;
    appliedFocus.current = focus.key;
    if (focus.box) {
      const bw = Math.max(200, focus.box.x1 - focus.box.x0 + FIT_PAD), bh = Math.max(200, focus.box.y1 - focus.box.y0 + FIT_PAD);
      const z = Math.max(MIN_Z, Math.min(FIT_MAX_Z, Math.min(size.w / (bw * s0), size.h / (bh * s0))));
      const t = centreOn((focus.box.x0 + focus.box.x1) / 2, (focus.box.y0 + focus.box.y1) / 2, z);
      animateTo(t.x, t.y, z);
      return;
    }
    const z = focus.z ?? Math.max(st.current.z, 2.2);
    const t = centreOn(focus.x, focus.y, z, cx, cy * 0.9);
    animateTo(t.x, t.y, z);
  }, [focus?.key, size.w, size.h]);

  const zoomAbout = (factor: number, sx = cx, sy = cy) => {
    const m = toMap(sx, sy);
    const z = Math.max(MIN_Z, Math.min(MAX_Z, st.current.z * factor));
    const t = centreOn(m.x, m.y, z, sx, sy);
    return { t, z };
  };

  useImperativeHandle(ref, () => ({
    zoomBy: f => { const { t, z } = zoomAbout(f); animateTo(t.x, t.y, z); },
    reset: () => frameBuilding(true),
  }), [size.w, size.h, s0]);

  // ── gestures ───────────────────────────────────────────────
  const g = useRef({ start: { tx: 0, ty: 0, z: 1 }, pinch0: 0, pinchLocal: { x: 0, y: 0 }, moved: 0, lastTap: 0, touches: 0, lastTapAt: { x: 0, y: 0 } });

  const touchesOf = (e: GestureResponderEvent) => e.nativeEvent.touches?.length ? e.nativeEvent.touches : [e.nativeEvent];

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => {
      g.current.start = { ...st.current };
      g.current.moved = 0;
      g.current.touches = touchesOf(e).length;
      tx.stopAnimation(); ty.stopAnimation(); zv.stopAnimation();
      onInteract?.(true);
    },
    onPanResponderMove: (e, gs) => {
      const ts = touchesOf(e);
      if (ts.length >= 2) {
        const a = ts[0], b = ts[1];
        const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        const mid = { x: (a.locationX + b.locationX) / 2, y: (a.locationY + b.locationY) / 2 };
        if (g.current.touches < 2) {
          // pinch begins: remember the map point under the fingers
          g.current.touches = 2;
          g.current.pinch0 = d;
          g.current.start = { ...st.current };
          const m = toMap(mid.x, mid.y);
          g.current.pinchLocal = toLocal(m.x, m.y);
        }
        const z = Math.max(MIN_Z, Math.min(MAX_Z, g.current.start.z * (d / (g.current.pinch0 || d))));
        const l = g.current.pinchLocal;
        setT(mid.x - cx - (l.x - cx) * z, mid.y - cy - (l.y - cy) * z, z);
        g.current.moved = 99;
        return;
      }
      if (g.current.touches >= 2) return;   // lifted one finger of a pinch: ignore the tail
      g.current.moved = Math.max(g.current.moved, Math.abs(gs.dx) + Math.abs(gs.dy));
      setT(g.current.start.tx + gs.dx, g.current.start.ty + gs.dy, g.current.start.z);
    },
    onPanResponderTerminate: () => { onInteract?.(false); setZShown(st.current.z); },
    onPanResponderRelease: (e, gs) => {
      onInteract?.(false);
      setZShown(st.current.z);
      if (g.current.moved < 6 && g.current.touches < 2) {
        const now = Date.now();
        const { locationX, locationY } = e.nativeEvent;
        const near = Math.abs(locationX - g.current.lastTapAt.x) < 30 && Math.abs(locationY - g.current.lastTapAt.y) < 30;
        if (now - g.current.lastTap < 320 && near) {
          // double tap: zoom in on that point
          const { t, z } = zoomAbout(1.8, locationX, locationY);
          animateTo(t.x, t.y, z);
          g.current.lastTap = 0;
        } else {
          g.current.lastTap = now;
          g.current.lastTapAt = { x: locationX, y: locationY };
          const m = toMap(locationX, locationY);
          onTapRoom?.(hit(m.x, m.y, floor), m);
        }
      } else if (g.current.touches < 2 && (Math.abs(gs.vx) > 0.25 || Math.abs(gs.vy) > 0.25)) {
        // a little glide, clamped like everything else
        const p = clamp(st.current.tx + gs.vx * 90, st.current.ty + gs.vy * 90, st.current.z);
        st.current.tx = p.x; st.current.ty = p.y;
        const cfg = { duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true };
        Animated.parallel([
          Animated.timing(tx, { toValue: p.x, ...cfg }),
          Animated.timing(ty, { toValue: p.y, ...cfg }),
        ]).start();
      }
    },
  }), [floor, size.w, size.h, onTapRoom, onInteract]);

  // Mouse wheel on the web build: zoom about the pointer.
  const wheelSettle = useRef<any>(null);
  const wheel = Platform.OS === 'web' ? {
    onWheel: (ev: any) => {
      ev.preventDefault?.();
      const rect = ev.currentTarget?.getBoundingClientRect?.();
      const sx = rect ? ev.clientX - rect.left : cx, sy = rect ? ev.clientY - rect.top : cy;
      const { t, z } = zoomAbout(ev.deltaY < 0 ? 1.12 : 0.89, sx, sy);
      setT(t.x, t.y, z);
      clearTimeout(wheelSettle.current);
      wheelSettle.current = setTimeout(() => setZShown(st.current.z), 140);
    },
  } : {};

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // ── drawing ────────────────────────────────────────────────
  const dark = mode === 'dark';
  const ink = c.ink;
  // Rooms sit lighter than the corridors in both themes, so the plan reads
  // the same way on a dark phone as it does on the posted sheet.
  const line = dark ? '#4A5768' : '#A8AEB8';        // shared walls
  const wall = dark ? '#6E7E92' : '#6B7482';        // outer walls
  const roomFill = dark ? '#243040' : '#FFFFFF';
  const hallFill = dark ? '#141B24' : '#ECE8DF';
  const outdoorFill = dark ? '#0B1017' : '#F2EFE8';
  const dot = dark ? '#2E3845' : '#CFC9BA';
  const stairFill = dark ? '#2E3E52' : '#DCE5F0';
  const routeColor = dark ? '#6FB6FA' : c.navy600, halo = dark ? '#0B1017' : '#FFFFFF';

  // Declutter: big places always, room numbers from 1.15×, legend letters from 1.7×.
  const showRooms = zShown >= 1.15, showPoi = zShown >= 1.7, showSmall = zShown >= 2.2;
  const labelFor = (r: Room) => {
    if (r.kind === 'poi') return showPoi;
    if (r.kind === 'void') return showSmall;
    if ((r.font || 40) <= 22) return showSmall;
    if (r.kind === 'room') return showRooms;
    return true;
  };

  const rooms = useMemo(() => ROOMS.filter(r => r.floor === floor), [floor]);
  const legs = route?.legs.filter(l => l.floor === floor || l.floor === 0) || [];
  const markers = route ? legLinkMarkers(route, floor) : [];
  const startRoom = fromId ? roomById(fromId) : null;
  const endRoom = toId ? roomById(toId) : null;
  const endAt = toId === ENTRANCE.id ? ENTRANCE : endRoom ? { floor: endRoom.floor, x: endRoom.x + endRoom.w / 2, y: endRoom.y + endRoom.h / 2 } : null;
  const startAt = fromId === ENTRANCE.id ? ENTRANCE : startRoom ? { floor: startRoom.floor, x: startRoom.x + startRoom.w / 2, y: startRoom.y + startRoom.h / 2 } : null;
  const onThisFloor = (f: Floor) => f === floor || f === 0;

  // Scale bar: pick 10 / 20 / 50 / 100 m, whichever sits near 90 px.
  const pxPerM = s0 * zShown * UNITS_PER_M;
  const barM = [10, 20, 50, 100].reduce((best, m) => Math.abs(m * pxPerM - 90) < Math.abs(best * pxPerM - 90) ? m : best, 10);

  return (
    <View onLayout={onLayout} style={{ height, overflow: 'hidden', backgroundColor: outdoorFill }} {...pan.panHandlers} {...wheel}>
      {size.w > 0 && (
        <Animated.View style={{ width: size.w, height: size.h, transform: [{ translateX: tx }, { translateY: ty }, { scale: zv }] }} pointerEvents="none">
          <Svg width={svgW} height={svgH} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} style={{ position: 'absolute', left: (size.w - svgW) / 2, top: (size.h - svgH) / 2 }}>
            <Defs>
              <Pattern id="dots" patternUnits="userSpaceOnUse" width="30" height="30">
                <Circle cx="15" cy="15" r="2.1" fill={dot} />
              </Pattern>
              <Pattern id="steps" patternUnits="userSpaceOnUse" width="20" height="20">
                <Line x1="0" y1="10" x2="20" y2="10" stroke={line} strokeWidth="2.2" />
              </Pattern>
            </Defs>

            {/* outside, drawn under every floor */}
            {OUTSIDE.map(r => (
              <G key={r.id}>
                <Rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill="url(#dots)" stroke={line} strokeWidth={2} strokeDasharray={r.kind === 'void' ? '10 9' : undefined} />
                {labelFor(r) && <Label r={r} fill={c.ink3} />}
              </G>
            ))}

            {/* the building: a solid base so no dotted ground shows through gaps */}
            <Rect x={BUILDING.x} y={BUILDING.y} width={BUILDING.w} height={BUILDING.h} fill={hallFill} opacity={0.55} rx={4} />

            {rooms.filter(r => r.kind === 'hall').map(r => <Rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={hallFill} />)}
            {rooms.filter(r => r.kind === 'outdoor').map(r => (
              <G key={r.id}>
                <Rect x={r.x} y={r.y} width={r.w} height={r.h} fill="url(#dots)" stroke={line} strokeWidth={2} />
                {labelFor(r) && <Label r={r} fill={c.ink3} />}
              </G>
            ))}

            {rooms.filter(r => r.kind === 'room' || r.kind === 'place' || r.kind === 'void').map(r => {
              const isEnd = r.id === toId, isStart = r.id === fromId;
              const fill = isEnd ? c.navy700 : isStart ? c.moss : r.kind === 'void' ? hallFill : r.color ? tint(r.color, dark) : roomFill;
              return (
                <G key={r.id}>
                  <Rect
                    x={r.x} y={r.y} width={r.w} height={r.h} rx={3}
                    fill={fill}
                    stroke={isEnd ? c.navy700 : isStart ? c.moss : line}
                    strokeWidth={isEnd || isStart ? 6 : 2.5}
                  />
                  {labelFor(r) && <Label r={r} fill={isEnd || isStart ? '#fff' : r.kind === 'void' ? c.ink4 : ink} serif={r.kind === 'place'} />}
                </G>
              );
            })}

            {rooms.filter(r => r.kind === 'stairs').map(r => (
              <G key={r.id}>
                <Rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill={stairFill} stroke={line} strokeWidth={2.5} />
                <Rect x={r.x + 7} y={r.y + 7} width={r.w - 14} height={r.h - 14} fill="url(#steps)" />
              </G>
            ))}

            {rooms.filter(r => r.kind === 'hall' && r.label && showSmall).map(r => <Label key={r.id + 'l'} r={r} fill={c.ink3} />)}

            {rooms.filter(r => r.kind === 'poi').map(r => {
              const isEnd = r.id === toId, isStart = r.id === fromId;
              return (
                <G key={r.id}>
                  <Rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill={r.color} stroke={isEnd ? c.navy700 : isStart ? c.moss : '#0E2238'} strokeWidth={isEnd || isStart ? 7 : 2} />
                  {labelFor(r) && <Label r={r} fill="#0E2238" />}
                </G>
              );
            })}

            {/* outer wall, last so it sits over the room edges */}
            <Rect x={BUILDING.x} y={BUILDING.y} width={BUILDING.w} height={BUILDING.h} rx={4} fill="none" stroke={wall} strokeWidth={4} opacity={0.5} />

            {/* Main Entrance mark */}
            <G opacity={floor === 3 ? 1 : 0.32}>
              <Rect x={ENTRANCE.x - 150} y={ENTRANCE.y - 9} width={300} height={18} rx={9} fill={routeColor} />
              <SvgText x={ENTRANCE.x} y={ENTRANCE.y + 62} fontSize={38} fontWeight="700" fill={floor === 3 ? c.navy700 : c.ink4} textAnchor="middle">Main Entrance</SvgText>
            </G>

            {/* compass — the posted map has south at the top */}
            <G opacity={0.75}>
              <Circle cx={VIEW.x + 130} cy={VIEW.y + VIEW.h - 150} r={54} fill={roomFill} stroke={line} strokeWidth={3} />
              <Path d={`M${VIEW.x + 130} ${VIEW.y + VIEW.h - 195} l14 45 -14 -12 -14 12 z`} fill={c.navy700} />
              <SvgText x={VIEW.x + 130} y={VIEW.y + VIEW.h - 78} fontSize={30} fontWeight="700" fill={c.ink3} textAnchor="middle">N</SvgText>
              <SvgText x={VIEW.x + 130} y={VIEW.y + VIEW.h - 214} fontSize={26} fontWeight="600" fill={c.ink4} textAnchor="middle">S</SvgText>
            </G>

            {/* route */}
            {legs.map((leg, i) => {
              const d = leg.points.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
              return (
                <G key={i}>
                  <Path d={d} stroke={halo} strokeWidth={24} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.92} />
                  <Path d={d} stroke={routeColor} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {chevrons(leg.points).map((ch, k) => (
                    <Path key={k} d={`M${ch.x - 13} ${ch.y - 15} L${ch.x + 6} ${ch.y} L${ch.x - 13} ${ch.y + 15}`} transform={`rotate(${ch.a} ${ch.x} ${ch.y})`} stroke={halo} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </G>
              );
            })}

            {markers.map((m, i) => {
              const txt = m.toFloor === 0 ? 'Out' : `${m.kind === 'elevator' ? '⇵' : m.toFloor > floor ? '↑' : '↓'} ${m.toFloor === 1 ? '1st' : m.toFloor === 2 ? '2nd' : '3rd'}`;
              return (
                <G key={i}>
                  <Rect x={m.x - 66} y={m.y - 29} width={132} height={58} rx={29} fill={c.navy700} stroke={halo} strokeWidth={5} />
                  <SvgText x={m.x} y={m.y + 12} fontSize={32} fontWeight="700" fill="#fff" textAnchor="middle">{txt}</SvgText>
                </G>
              );
            })}

            {startAt && onThisFloor(startAt.floor) && (
              <G>
                <Circle cx={startAt.x} cy={startAt.y} r={27} fill={c.moss} stroke={halo} strokeWidth={7} />
                <Circle cx={startAt.x} cy={startAt.y} r={8} fill="#fff" />
              </G>
            )}
            {endAt && onThisFloor(endAt.floor) && (
              <G>
                <Path d={`M${endAt.x} ${endAt.y} c -34 -40 -44 -56 -44 -78 a44 44 0 1 1 88 0 c 0 22 -10 38 -44 78 z`} fill={c.crimson} stroke={halo} strokeWidth={6} />
                <Circle cx={endAt.x} cy={endAt.y - 78} r={15} fill="#fff" />
              </G>
            )}
          </Svg>
        </Animated.View>
      )}

      {/* scale bar */}
      {size.w > 0 && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, bottom: 10, alignItems: 'flex-start' }}>
          <View style={{ width: Math.round(barM * pxPerM), height: 6, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderColor: c.ink4, opacity: 0.8 }} />
          <Text style={[{ fontSize: 10, fontWeight: '700', color: c.ink4, marginTop: 2 }, tnum]}>{barM} m</Text>
        </View>
      )}
    </View>
  );
});

// ── bits ─────────────────────────────────────────────────────
const Label = ({ r, fill, serif }: { r: Room; fill: string; serif?: boolean }) => {
  if (!r.label) return null;
  const lines = r.label.split('\n');
  const fs = r.font || (r.kind === 'room' ? 40 : 30);
  const x = r.x + r.w / 2, y = r.y + r.h / 2;
  const lh = fs * 1.08;
  const y0 = y - ((lines.length - 1) * lh) / 2 + fs * 0.36;
  return (
    <SvgText
      x={x} y={y0} fontSize={fs} fill={fill} textAnchor="middle"
      fontWeight={r.kind === 'room' ? '600' : '500'}
      fontFamily={serif ? 'Newsreader_500Medium' : undefined}
      transform={r.vert ? `rotate(-90 ${x} ${y})` : undefined}
    >
      {lines.map((l, i) => <TSpan key={i} x={x} dy={i ? lh : 0}>{l}</TSpan>)}
    </SvgText>
  );
};

// Arrow heads every ~110 units along a polyline, rotated to its direction.
function chevrons(pts: { x: number; y: number }[]) {
  const out: { x: number; y: number; a: number }[] = [];
  let carry = 70;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    let d = carry;
    while (d < len - 30) {
      out.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len, a: ang });
      d += 110;
    }
    carry = d - len;
  }
  return out;
}

function hit(x: number, y: number, floor: Floor): Room | null {
  // smallest navigable rect under the point wins (pois sit inside rooms)
  const cands = ROOMS.filter(r => (r.floor === floor || r.floor === 0) && (NAVIGABLE.has(r.kind) || r.kind === 'poi') && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (!cands.length) return null;
  return cands.sort((a, b) => a.w * a.h - b.w * b.h)[0];
}

// A legend colour as a room fill: pale in light mode, dim in dark.
function tint(hex: string, dark: boolean) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (v: number, to: number, k: number) => Math.round(v + (to - v) * k);
  return dark
    ? `rgb(${mix(r, 20, 0.6)},${mix(g, 26, 0.6)},${mix(b, 34, 0.6)})`
    : `rgb(${mix(r, 255, 0.55)},${mix(g, 255, 0.55)},${mix(b, 255, 0.55)})`;
}
