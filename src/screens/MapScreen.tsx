// Spartans — Map (from Home's map tile, More, or "Show on map" on a class
// card). The map itself sits at the top and stays put; everything else
// scrolls under it. That also keeps dragging the map away from the page
// scroll, which used to fight each other.
//
// Order down the page: map card (floor switch, zoom and Step-free floating
// on it) → your classes and Places rows (3D art, like the caf categories) →
// From / To → the route card and its steps.
// Looks follow the caf menu: fills and soft shadows, no hairline outlines,
// sentence-case labels, Fluent 3D art (src/map/art.ts). Leave "From" empty
// and the route starts at the Main Entrance. Nothing takes focus on open, so
// the keyboard stays down until you tap a field. While you type, the map
// folds away and From / To slide up to the top, so the keyboard never
// covers the field or its suggestions.
//
// The route comes from src/map/route.ts, is drawn on the plan (FloorMap) and
// spelled out step by step; tapping a step jumps the map to that spot.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Image, Animated, Easing, useWindowDimensions, Platform, ImageSourcePropType, LayoutAnimation, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G155 } from '../theme';
import { Icon } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { FloorMap, Focus, FloorMapHandle } from '../components/FloorMap';
import { useProfile, shortName, Course } from '../ProfileContext';
import { useToday } from '../useToday';
import { useNav } from '../nav';
import {
  FLOORS, ENTRANCE, Floor, Room, Target, findTarget, searchTargets, roomById, roomName, TARGETS,
} from '../map/data';
import { findRoute, targetName, Route, Step } from '../map/route';
import { MAP_ART, PLACES } from '../map/art';
import { subjectImage } from '../programIcons';
import { glow } from '../components/ProgramIcon';
import { useKeyboardShown } from '../useKeyboard';
import type { ScreenProps } from '../../App';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);

type Field = 'from' | 'to';

export default function MapScreen({ topInset }: ScreenProps) {
  const { c, mode } = useTheme();
  const { profile } = useProfile();
  const nav = useNav();
  const { height: winH } = useWindowDimensions();
  const courses = profile?.courses || [];
  const t = useToday(courses);

  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [focused, setFocused] = useState<Field | null>(null);
  const [floor, setFloor] = useState<Floor>(3);
  const [stepFree, setStepFree] = useState(false);
  const [picked, setPicked] = useState<Room | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const scroll = useRef<ScrollView>(null);
  const map = useRef<FloorMapHandle>(null);
  const focusKey = useRef(0);
  const fieldsY = useRef(0);
  const kbOn = useKeyboardShown();
  const typing = kbOn && !!focused;

  // Typing: fold the map shut and bring From / To to the top of the page.
  // The fold animates only if it's configured before this render commits.
  const wasTyping = useRef(typing);
  if (wasTyping.current !== typing) {
    wasTyping.current = typing;
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
  }
  useEffect(() => {
    if (!typing) return;
    const id = setTimeout(() => scroll.current?.scrollTo({ y: fieldsY.current, animated: true }), 60);
    return () => clearTimeout(id);
  }, [typing]);

  // Opened with a destination (class card → Show on map).
  useEffect(() => {
    const req = nav.mapReq;
    if (!req) return;
    if (req.to) pick('to', findTarget(req.to));
    if (req.from) pick('from', findTarget(req.from));
    nav.clearMapReq();
  }, [nav.mapReq]);

  const effectiveFrom = fromId || ENTRANCE.id;
  const route = useMemo<Route | null>(() => toId ? findRoute(effectiveFrom, toId, { stepFree }) : null, [effectiveFrom, toId, stepFree]);

  const goTo = (x: number, y: number, f: Floor, z?: number) => {
    if (f !== 0) setFloor(f);
    focusKey.current += 1;
    setFocus({ x, y, z, key: focusKey.current });
  };
  // Frame everything the route does on one floor (plus any outdoor stretch).
  const fitFloor = (r: Route, f: Floor) => {
    const pts = r.legs.filter(l => l.floor === f || l.floor === 0).flatMap(l => l.points);
    if (!pts.length) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    setFloor(f);
    focusKey.current += 1;
    setFocus({ x: 0, y: 0, key: focusKey.current, box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } });
  };
  const showFloor = (f: Floor) => { if (route && route.floors.includes(f)) fitFloor(route, f); else setFloor(f); };

  const pick = (field: Field, tg: Target | null) => {
    setFocused(null);
    if (!tg) return;
    if (field === 'to') { setToId(tg.id); setToText(tg.name); }
    else { setFromId(tg.id === ENTRANCE.id ? null : tg.id); setFromText(tg.id === ENTRANCE.id ? '' : tg.name); }
    setPicked(null);
    // If this pick makes (or remakes) a route, the route effect frames it —
    // jumping to the picked room first would fight that and land on the
    // wrong floor. Only jump when there is nothing to route yet.
    const willRoute = field === 'to' ? tg.id !== toId : !!toId;
    if (willRoute) return;
    const r = roomById(tg.id);
    if (r) goTo(r.x + r.w / 2, r.y + r.h / 2, r.floor === 0 ? floor : r.floor);
    else goTo(ENTRANCE.x, ENTRANCE.y, 3);
  };

  // Once a route exists, show its first indoor floor and frame that leg.
  useEffect(() => {
    if (!route) return;
    const first = route.legs.find(l => l.floor !== 0) || route.legs[0];
    fitFloor(route, first.floor === 0 ? 3 : first.floor);
  }, [route?.from, route?.to]);

  const onType = (field: Field, v: string) => {
    if (field === 'to') { setToText(v); setToId(null); }
    else { setFromText(v); setFromId(null); }
  };
  const onSubmit = (field: Field) => pick(field, findTarget(field === 'to' ? toText : fromText));

  const swap = () => {
    const f = fromId, ft = fromText;
    setFromId(toId); setFromText(toId ? toText : '');
    setToId(f || ENTRANCE.id); setToText(f ? ft : ENTRANCE.name);
  };

  const clear = () => { setFromId(null); setFromText(''); setToId(null); setToText(''); setPicked(null); };

  const suggestions = focused ? searchTargets(focused === 'to' ? toText : fromText, 6) : [];

  // Chips: next class first, then every class with a room the map knows.
  const chips = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; name: string; label: string; sub: string; id: string; color: string; hot?: boolean }[] = [];
    const add = (k: Course, hot = false) => {
      if (!k || k.spare || !k.room) return;
      const tg = findTarget(k.room);
      if (!tg || seen.has(tg.id)) return;
      seen.add(tg.id);
      out.push({ key: tg.id, name: k.name, label: shortName(k.name), sub: tg.id.toUpperCase(), id: tg.id, color: k.color, hot });
    };
    if (t.nextBlock?.course) add(t.nextBlock.course, true);
    courses.forEach(k => add(k));
    return out;
  }, [courses, t.nextBlock?.course?.room]);

  const nowRoom = t.current?.course?.room ? findTarget(t.current.course.room) : null;

  // The map takes the top of the screen and stays there; the rest scrolls.
  const mapH = Math.max(270, Math.min(440, Math.round(winH * 0.4)));
  const floorName = FLOORS.find(f => f.id === floor)!.name;
  const indoorFloors = route ? route.floors.filter(f => f !== 0).length : 0;
  // 3D art for a picked room or a search hit: a class you take, a Places
  // spot, or a plain pin.
  const artFor = (id: string, kind?: Target['kind']): ImageSourcePropType => {
    const mine = chips.find(ch => ch.id === id);
    if (mine) return subjectImage(mine.name);
    const place = PLACES.find(pl => pl.id === id);
    if (place) return place.art;
    if (id === ENTRANCE.id || kind === 'entrance') return MAP_ART.door;
    if (/^wc-/.test(id)) return MAP_ART.toilet;
    if (/^elev/.test(id)) return MAP_ART.elevator;
    if (kind === 'outdoor') return MAP_ART.stadium;
    return MAP_ART.pin;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <AppHeader topInset={topInset} title="Map" back />

      {/* ── The map, pinned, in a rounded card (folded away while typing) ── */}
      <View style={typing ? { height: 0, overflow: 'hidden' } : undefined}>
        <View style={[{ marginTop: 12, marginHorizontal: 16, borderRadius: 24, backgroundColor: c.surface }, shadow.md]}>
          <View style={{ borderRadius: 24, overflow: 'hidden' }}>
            <FloorMap
              ref={map}
              floor={floor} route={route} fromId={effectiveFrom} toId={toId} focus={focus} height={mapH}
              onTapRoom={r => { setFocused(null); setPicked(r); }}
            />

            {/* a soft scrim so the floating controls stay readable over the plan */}
            <LinearGradient
              pointerEvents="none"
              colors={[c.paper, c.paper + '00']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70, opacity: 0.85 }}
            />

            {/* floor switch, top left: one capsule, the floor you're on filled, its name after */}
            <View style={[{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 999, padding: 3, gap: 2 }, shadow.sm]}>
              {FLOORS.map(f => {
                const on = floor === f.id;
                const onRoute = route?.floors.includes(f.id);
                return (
                  <Pressable key={f.id} onPress={() => showFloor(f.id)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={f.name}
                    style={({ pressed }) => ({
                      width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: on ? c.navy700 : 'transparent', opacity: pressed ? 0.7 : 1,
                    })}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: on ? '#fff' : c.ink2 }}>{f.short}</Text>
                    {onRoute && <View style={{ position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: on ? '#fff' : c.sky }} />}
                  </Pressable>
                );
              })}
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.ink2, paddingLeft: 6, paddingRight: 10 }}>
                {floor === 3 ? 'Entry level' : floorName}
              </Text>
            </View>

            {/* zoom capsule + whole school + step-free + clear, right side */}
            <View style={{ position: 'absolute', top: 10, right: 10, gap: 8, alignItems: 'center' }}>
              <View style={[{ backgroundColor: c.surface, borderRadius: 20, paddingVertical: 2 }, shadow.sm]}>
                <RoundBtn bare icon="plus" label="Zoom in" onPress={() => map.current?.zoomBy(1.6)} />
                <View style={{ height: 1.5, marginHorizontal: 10, backgroundColor: c.paper2, borderRadius: 1 }} />
                <RoundBtn bare icon="minus" label="Zoom out" onPress={() => map.current?.zoomBy(0.62)} />
              </View>
              <RoundBtn icon="compass" label="Show the whole school" onPress={() => map.current?.reset()} />
              <RoundBtn art={MAP_ART.stepfree} label="Step-free route" on={stepFree} onPress={() => setStepFree(v => !v)} />
              {(route || toId) && <RoundBtn icon="close" label="Clear route" onPress={clear} />}
            </View>

            {/* tapped-room card */}
            {picked && (
              <View style={[{ position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: c.surface, borderRadius: 20, padding: 10, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, shadow.md]}>
                <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
                  <Image source={artFor(picked.id, picked.kind === 'outdoor' ? 'outdoor' : undefined)} style={{ width: 32, height: 32 }} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{roomName(picked)}</Text>
                  <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{picked.floor === 0 ? 'Outside' : FLOORS.find(f => f.id === picked.floor)!.name}</Text>
                </View>
                <PillBtn label="Start here" onPress={() => pick('from', findTarget(picked.id))} />
                <PillBtn label="Go here" primary onPress={() => pick('to', findTarget(picked.id))} />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Everything else scrolls ───────────────────────────── */}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        // Room under From / To while typing, so they can scroll to the top.
        contentContainerStyle={{ paddingBottom: typing ? winH : 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* your classes, then the places people ask for most */}
        {chips.length > 0 && (
          <>
            <RowTitle title="Your classes" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }} keyboardShouldPersistTaps="handled">
              {chips.map(ch => (
                <ArtTile
                  key={ch.key}
                  art={subjectImage(ch.name)}
                  label={ch.label}
                  sub={ch.sub}
                  subColor={glow(ch.color, mode)}
                  hot={ch.hot}
                  on={toId === ch.id}
                  onPress={() => pick('to', findTarget(ch.id))}
                  a11y={`Route to ${ch.label}, ${ch.sub}${ch.hot ? ', next class' : ''}`}
                />
              ))}
            </ScrollView>
          </>
        )}
        <RowTitle title="Places" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }} keyboardShouldPersistTaps="handled">
          {PLACES.map(pl => (
            <ArtTile key={pl.id} art={pl.art} label={pl.label} on={toId === pl.id} onPress={() => pick('to', findTarget(pl.id))} a11y={`Route to ${pl.label}`} />
          ))}
        </ScrollView>

        {/* From / To */}
        <View onLayout={e => { fieldsY.current = e.nativeEvent.layout.y + 8; }} style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <View style={[{ backgroundColor: c.surface, borderRadius: 22, padding: 8 }, shadow.sm]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <FieldRow
                  label="From" dot={c.moss} value={fromText} placeholder={ENTRANCE.name}
                  active={focused === 'from'} resolved={!!fromId || !fromText}
                  onChange={v => onType('from', v)} onFocus={() => setFocused('from')} onSubmit={() => onSubmit('from')}
                  onClear={fromText ? () => { setFromText(''); setFromId(null); } : undefined}
                />
                <FieldRow
                  label="To" dot={c.crimson} value={toText} placeholder="Room number or place"
                  active={focused === 'to'} resolved={!!toId || !toText}
                  onChange={v => onType('to', v)} onFocus={() => setFocused('to')} onSubmit={() => onSubmit('to')}
                  onClear={toText ? () => { setToText(''); setToId(null); } : undefined}
                />
              </View>
              <Pressable onPress={swap} hitSlop={8} accessibilityRole="button" accessibilityLabel="Swap from and to" style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: c.skyTint, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                <Icon name="swap" size={18} stroke={2} color={c.sky600} />
              </Pressable>
            </View>

            {focused && (suggestions.length > 0 || (focused === 'from' && !fromText)) && (
              <View style={{ paddingTop: 6 }}>
                {focused === 'from' && !fromText && (
                  <>
                    <SuggestRow name={ENTRANCE.name} sub="Default start" art={MAP_ART.door} onPress={() => pick('from', TARGETS[0])} />
                    {nowRoom && <SuggestRow name={`${nowRoom.name} · your class now`} sub={nowRoom.sub} art={artFor(nowRoom.id, nowRoom.kind)} onPress={() => pick('from', nowRoom)} />}
                  </>
                )}
                {suggestions.map(s => (
                  <SuggestRow key={s.id} name={s.name} sub={s.sub} art={artFor(s.id, s.kind)} onPress={() => pick(focused, s)} />
                ))}
              </View>
            )}
          </View>

          <Text style={{ fontSize: 12, color: c.ink4, marginTop: 8, lineHeight: 16, paddingHorizontal: 4 }}>
            Leave From empty to start at the front doors. Drag the map to move, pinch or double-tap to zoom, tap a room to pick it.
          </Text>
        </View>

        {/* Directions */}
        {toId && !route && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <View style={{ backgroundColor: effectiveFrom === toId ? c.mossTint : c.crimsonTint, borderRadius: 18, padding: 14 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink2, lineHeight: 20 }}>
                {effectiveFrom === toId ? "You're already there." : stepFree ? 'No step-free route reaches that spot. Turn Step-free off to use the stairs.' : 'No route found for that pair.'}
              </Text>
            </View>
          </View>
        )}
        {route && (
          <View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
            {/* the route card: the caf's blue card, with the walker bobbing */}
            <View style={[{ borderRadius: 24, overflow: 'hidden' }, shadow.md]}>
              <LinearGradient colors={[c.sky, c.sky600, c.navy700]} {...G155} style={{ padding: 18, flexDirection: 'row', alignItems: 'center' }}>
                <Blob size={200} style={{ top: -110, right: -40, opacity: 0.16 }} />
                <Blob size={120} style={{ bottom: -70, left: -10, opacity: 0.1 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>{stepFree ? 'Step-free route' : 'Your route'}</Text>
                  <Text style={[{ fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.8, marginTop: 2 }, tnum]}>About {route.minutes} min</Text>
                  <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: '600', color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 18 }}>
                    {targetName(route.from)} → {targetName(route.to)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
                    <InfoPill text={`${route.metres} m`} />
                    <InfoPill text={indoorFloors > 1 ? `${indoorFloors} floors` : 'One floor'} />
                  </View>
                </View>
                <Floaty>
                  <Image source={MAP_ART.walk} style={{ width: 76, height: 76 }} accessibilityIgnoresInvertColors />
                </Floaty>
              </LinearGradient>
            </View>

            <RowTitle title="Step by step" right={`${route.steps.length} steps`} inset={4} />
            <View style={[{ backgroundColor: c.surface, borderRadius: 22, paddingVertical: 6 }, shadow.sm]}>
              {route.steps.map((s, i) => (
                <StepRow key={i} s={s} first={i === 0} last={i === route.steps.length - 1} onPress={() => { if (s.at) goTo(s.at.x, s.at.y, s.floor === 0 ? floor : s.floor, 2.4); }} />
              ))}
            </View>
            <Text style={{ fontSize: 12, color: c.ink4, marginTop: 10, lineHeight: 16, paddingHorizontal: 4 }}>
              Tap a step to see it on the map. Distances are rough: the posted map isn't to scale. Traced from the 2014/2015 sheet, so tell the App Club if a room has moved.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── pieces ───────────────────────────────────────────────────
// `bare` = no fill or shadow, for buttons that sit inside the zoom capsule.
const RoundBtn = ({ icon, art, label, onPress, on, bare }: { icon?: any; art?: ImageSourcePropType; label: string; onPress: () => void; on?: boolean; bare?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress} hitSlop={4}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }}
      style={({ pressed }) => [{
        width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
        backgroundColor: bare ? 'transparent' : on ? c.gold : c.surface, opacity: pressed ? 0.65 : 1,
      }, !bare && shadow.sm]}
    >
      {art ? <Image source={art} style={{ width: 22, height: 22 }} /> : <Icon name={icon} size={17} stroke={2.1} color={on ? '#fff' : c.ink2} />}
    </Pressable>
  );
};

const RowTitle = ({ title, right, inset = 20 }: { title: string; right?: string; inset?: number }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: inset, paddingTop: 20, paddingBottom: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: c.ink }}>{title}</Text>
      {!!right && <Text style={[{ fontSize: 12, color: c.ink3, fontWeight: '500' }, tnum]}>{right}</Text>}
    </View>
  );
};

// One tile in the classes / places rows — the caf's category tile.
const ArtTile = ({ art, label, sub, subColor, hot, on, onPress, a11y }: {
  art: ImageSourcePropType; label: string; sub?: string; subColor?: string; hot?: boolean; on: boolean; onPress: () => void; a11y: string;
}) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={a11y}
      style={({ pressed }) => ({ alignItems: 'center', width: 78, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.skyTint : c.surface }}>
        <Image source={art} style={{ width: 40, height: 40 }} />
        {hot && (
          <View style={{ position: 'absolute', top: -6, right: -10, backgroundColor: c.goldTint, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', color: c.gold }}>Next</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: on ? '700' : '600', color: on ? c.navy700 : c.ink2, marginTop: 6, letterSpacing: -0.2 }}>{label}</Text>
      {!!sub && <Text numberOfLines={1} style={[{ fontSize: 11, fontWeight: '800', color: subColor || c.ink3, marginTop: 1 }, tnum]}>{sub}</Text>}
    </Pressable>
  );
};

const FieldRow = ({ label, dot, value, placeholder, active, resolved, onChange, onFocus, onSubmit, onClear }: {
  label: string; dot: string; value: string; placeholder: string; active: boolean; resolved: boolean;
  onChange: (v: string) => void; onFocus: () => void; onSubmit: () => void; onClear?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, paddingLeft: 12, paddingRight: 8, borderRadius: 15, backgroundColor: active ? c.skyTint : c.paper2 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: dot, marginRight: 8 }} />
      <Text style={{ width: 40, fontSize: 13, fontWeight: '700', color: active ? c.navy700 : c.ink3 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={c.ink4}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        style={{ flex: 1, fontSize: 16, fontWeight: '600', color: resolved ? c.ink : c.crimson, paddingVertical: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null) }}
      />
      {onClear && (
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Clear ${label}`} style={({ pressed }) => ({ width: 26, height: 26, borderRadius: 13, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Icon name="close" size={12} stroke={2.2} color={c.ink3} />
        </Pressable>
      )}
    </View>
  );
};

const SuggestRow = ({ name, sub, art, onPress }: { name: string; sub: string; art: ImageSourcePropType; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={art} style={{ width: 22, height: 22 }} />
      </View>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: c.ink }}>{name}</Text>
      <Text style={{ fontSize: 12, color: c.ink4 }}>{sub}</Text>
    </Pressable>
  );
};

const PillBtn = ({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ paddingHorizontal: 12, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? c.navy700 : c.skyTint, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: primary ? '#fff' : c.navy700 }}>{label}</Text>
    </Pressable>
  );
};

const InfoPill = ({ text }: { text: string }) => (
  <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
    <Text style={[{ fontSize: 12.5, fontWeight: '700', color: '#fff' }, tnum]}>{text}</Text>
  </View>
);

// Timeline row. The start and the end get 3D art (pin, flag); the steps in
// between get a line icon on a tint of their colour. A short rail joins them.
const StepRow = ({ s, first, last, onPress }: { s: Step; first: boolean; last: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  const tone = s.kind === 'walk' ? c.navy700 : s.kind === 'door' ? c.moss : c.gold;
  const tint = s.kind === 'walk' ? c.skyTint : s.kind === 'door' ? c.mossTint : c.goldTint;
  const icon = s.kind === 'walk' ? 'walk' : s.kind === 'elevator' ? 'elevator' : s.kind === 'door' ? 'door' : 'stairs';
  const art = s.kind === 'start' ? MAP_ART.pin : s.kind === 'arrive' ? MAP_ART.flag : null;
  const floorTag = s.floor === 0 ? 'Outside' : `${s.floor === 1 ? '1st' : s.floor === 2 ? '2nd' : '3rd'} fl`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      <View style={{ width: 36, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        {!first && <View style={{ position: 'absolute', top: -9, height: '50%', width: 2, backgroundColor: c.paper2 }} />}
        {!last && <View style={{ position: 'absolute', bottom: -9, height: '50%', width: 2, backgroundColor: c.paper2 }} />}
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: art ? c.paper2 : tint, alignItems: 'center', justifyContent: 'center' }}>
          {art ? <Image source={art} style={{ width: 24, height: 24 }} /> : <Icon name={icon as any} size={17} stroke={2} color={tone} />}
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: s.kind === 'walk' ? '500' : '700', color: c.ink, lineHeight: 19 }}>{s.text}</Text>
        {!!s.detail && <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{s.detail}</Text>}
      </View>
      <View style={{ backgroundColor: c.paper2, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
        <Text style={[{ fontSize: 11, fontWeight: '700', color: c.ink3 }, tnum]}>{floorTag}</Text>
      </View>
    </Pressable>
  );
};

const Blob = ({ size, style }: { size: number; style: any }) => (
  <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' }, style]} />
);

// Gentle bob (same as the caf gift card).
const Floaty = ({ children }: { children: React.ReactNode }) => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -5, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
};
