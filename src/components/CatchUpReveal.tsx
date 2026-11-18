// Spartans — the end of Catch Up: every badge on one screen. Same dark stage
// and turning rays as BadgeUnlock (the one-at-a-time moment), but the badges
// pop into a grid sized so all of them fit without scrolling, commons first
// and the rarest last, while the XP counts up beside the level it reaches.
// Tap during the animation to skip to the end.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View, Text, Pressable, Animated, Easing, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Polygon } from 'react-native-svg';
import { BadgeArt } from './BadgeArt';
import { RankEmblem } from './RankEmblem';
import { Badge } from '../badges';
import { catchUpXp, revealOrder } from '../catchUp';
import { levelFor, rankFor, totalXp } from '../xp';
import { fonts, tnum } from '../theme';

const GOLD = '#E8D8AE';
const MAX_CELL = 92;
const POP_SPREAD_MS = 2000;   // however many badges, the pops take about this long

// The most columns-and-rows-efficient grid: the biggest square cell where
// `n` of them fit in the box.
export const fitGrid = (n: number, w: number, h: number) => {
  let best = { cols: 1, cell: 0 };
  for (let cols = 1; cols <= Math.max(1, n); cols++) {
    const cell = Math.min(w / cols, h / Math.ceil(n / cols));
    if (cell > best.cell) best = { cols, cell };
  }
  return { cols: best.cols, cell: Math.min(best.cell, MAX_CELL) };
};

export const CatchUpReveal = ({ badges, grade, topInset, bottomInset, onDone }: {
  badges: Badge[]; grade: number; topInset: number; bottomInset: number; onDone: () => void;
}) => {
  const ordered = useMemo(() => revealOrder(badges), [badges]);
  const xp = useMemo(() => catchUpXp(grade, ordered), [grade, ordered]);
  const gained = xp.grade + xp.badges;
  const base = useMemo(() => Math.max(0, totalXp() - gained), [gained]);

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [finished, setFinished] = useState(false);

  const backdrop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;   // 0-1 of the XP
  const end = useRef(new Animated.Value(0)).current;     // summary and button
  const pops = useRef(ordered.map(() => new Animated.Value(0))).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  const finish = () => {
    running.current?.stop();
    backdrop.setValue(1); count.setValue(1);
    pops.forEach(v => v.setValue(1));
    Animated.timing(end, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    setFinished(true);
  };

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  // Starts once the grid has been measured, since the pops need their cells.
  const started = useRef(false);
  useEffect(() => {
    if (!box || started.current) return;
    started.current = true;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduce => {
      if (!alive) return;
      if (reduce) { finish(); return; }
      const gap = Math.max(14, Math.min(90, POP_SPREAD_MS / Math.max(1, ordered.length)));
      const spread = gap * ordered.length;
      const all = Animated.sequence([
        Animated.timing(backdrop, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.parallel([
          Animated.stagger(gap, pops.map(v => Animated.spring(v, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }))),
          Animated.timing(count, { toValue: 1, duration: spread + 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        ]),
      ]);
      running.current = all;
      all.start(({ finished: ran }) => { if (ran) finish(); });
    });
    return () => { alive = false; };
  }, [box]);   // eslint-disable-line react-hooks/exhaustive-deps

  const onGrid = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox(b => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
  };
  const onStage = (e: LayoutChangeEvent) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const grid = box ? fitGrid(ordered.length, box.w, box.h) : null;
  const R = Math.max(stage.w, stage.h) * 0.75;
  const rays = Array.from({ length: 20 }, (_, i) => (360 / 20) * i);

  return (
    <View onLayout={onStage} style={{ flex: 1, backgroundColor: '#050C1C', overflow: 'hidden' }}>
      <Pressable
        style={{ flex: 1 }}
        onPress={() => { if (!finished) finish(); }}
        accessible={false}
      >
        {R > 0 && (
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: stage.w / 2 - R, top: stage.h / 2 - R, width: R * 2, height: R * 2,
            opacity: backdrop,
            transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
          }}>
            <Svg width={R * 2} height={R * 2} viewBox="-100 -100 200 200">
              <Defs>
                <RadialGradient id="catchUpBurst" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor="#F5D77A" stopOpacity={0.5} />
                  <Stop offset="0.45" stopColor="#B68842" stopOpacity={0.2} />
                  <Stop offset="1" stopColor="#B68842" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              {rays.map((a, i) => (
                <Polygon key={i} points="0,0 -4,-100 4,-100" fill="#F5D77A" opacity={i % 2 ? 0.07 : 0.035} transform={`rotate(${a})`} />
              ))}
              <Circle cx={0} cy={0} r={100} fill="url(#catchUpBurst)" />
            </Svg>
          </Animated.View>
        )}

        <View style={{ flex: 1, paddingTop: topInset + 18, paddingBottom: bottomInset + 16, paddingHorizontal: 16 }}>
          <Animated.View style={{ alignItems: 'center', opacity: backdrop }}>
            <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 2, color: GOLD, textTransform: 'uppercase' }}>You're caught up</Text>
            <XpTicker count={count} gained={gained} base={base} />
          </Animated.View>

          <View
            onLayout={onGrid}
            accessible
            accessibilityLabel={`${ordered.length} badges earned: ${ordered.map(b => b.title).join(', ')}`}
            style={{ flex: 1, marginTop: 14, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}
          >
            {grid && (
              <View style={{ width: grid.cell * grid.cols, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {ordered.map((b, i) => (
                  <Animated.View
                    key={b.id}
                    style={{
                      width: grid.cell, height: grid.cell, padding: Math.max(1, grid.cell * 0.04),
                      opacity: pops[i].interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                      transform: [{ scale: pops[i].interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
                    }}
                  >
                    <BadgeArt badge={b} size={grid.cell - 2 * Math.max(1, grid.cell * 0.04)} />
                  </Animated.View>
                ))}
              </View>
            )}
          </View>

          <Animated.View style={{ opacity: end, transform: [{ translateY: end.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }} pointerEvents={finished ? 'auto' : 'none'}>
            <Text style={[{ fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.78)', textAlign: 'center' }, tnum]}>
              {ordered.length} {ordered.length === 1 ? 'badge' : 'badges'} for +{xp.badges.toLocaleString()} XP
              {xp.grade > 0 ? `, Grade ${grade} for +${xp.grade.toLocaleString()} XP` : ''}
            </Text>
            <Pressable
              onPress={onDone}
              accessibilityRole="button"
              style={({ pressed }) => ({ height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD, marginTop: 14, opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#0E2238' }}>Let's go</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </View>
  );
};

// Counts up on its own so a frame only redraws this, not the whole grid.
const XpTicker = ({ count, gained, base }: { count: Animated.Value; gained: number; base: number }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = count.addListener(({ value }) => setN(Math.round(value * gained)));
    return () => count.removeListener(id);
  }, [count, gained]);
  const level = levelFor(base + n);
  const rank = rankFor(level);
  const emblem = useMemo(() => <RankEmblem rank={rank} level={level} size={52} />, [rank, level]);
  return (
    <View style={{ alignItems: 'center', marginTop: 8 }} accessible accessibilityLabel={`${gained.toLocaleString()} XP. Level ${levelFor(base + gained)}`}>
      <Text style={[{ fontFamily: fonts.serif, fontSize: 46, lineHeight: 52, letterSpacing: -1, color: '#fff' }, tnum]}>
        +{n.toLocaleString()} <Text style={{ fontSize: 22, color: GOLD }}>XP</Text>
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        {emblem}
        <Text style={[{ fontSize: 16, fontWeight: '700', color: '#fff' }, tnum]}>Level {level}</Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)' }}>{rank.title}</Text>
      </View>
    </View>
  );
};
