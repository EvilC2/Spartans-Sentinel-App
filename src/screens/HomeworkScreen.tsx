// Spartans — Homework (from More, Quick links, a class card or a program page).
//
// Top: Quick type. A pinned panel for getting a task down fast without picking
// a class ("Unsorted tasks"). It holds a line to type on and whatever hasn't
// been filed yet. It grows with its tasks up to a third of the screen, then
// scrolls inside itself; with nothing in it, it is just the line.
//
// Below: one heading per class, the tasks in the order the student wants them,
// and a line to write on at the bottom of every class.
//
// Filing a quick task: drag its handle (or tap the arrow). The class lists
// give way to one tile per class, squeezed to fit the screen, so every class
// is a drop target without scrolling. Let go on a tile (or tap it) and the
// task lands in that class.
//
// The class rows live in src/components/HomeworkList.tsx, shared with a
// program's Homework tab. State lives in HomeworkProvider (src/stores.tsx).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Keyboard, LayoutAnimation, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, useWindowDimensions,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { AppHeader } from '../components/AppHeader';
import { Icon, Check } from '../components/Icon';
import { glow, wash } from '../components/ProgramIcon';
import {
  ClassHomework, KindChip, ScrollerCtx, Section, UNSORTED, addDays, splitDone, useHomeworkScroller, useHomeworkSections,
} from '../components/HomeworkList';
import { useHomework, classKey } from '../stores';
import { useFocus } from '../nav';
import { Spot } from '../components/Spot';
import { useNow } from '../useToday';
import { toISO } from '../calendar';
import { HomeworkItem, Program } from '../programs';
import type { ScreenProps } from '../../App';

const GUTTER = 20;
const WEB_INPUT = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {};
const ease = () => { if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); };
const isHex = (s?: string) => !!s && /^#[0-9a-f]{6}$/i.test(s);

type Rect = { x: number; y: number; w: number; h: number };
// A quick task being filed: `drag` while a finger is carrying it.
type Moving = { id: string; title: string; drag: boolean };

// ────────────────────────────────────────────────────────────────
export default function HomeworkScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const hw = useHomework();
  const todayIso = toISO(useNow());
  const { height: screenH } = useWindowDimensions();
  const { scroller, kb, rootProps, scrollProps } = useHomeworkScroller(topInset);

  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState<Record<string, boolean>>({});

  const { programs, sections } = useHomeworkSections();
  const classes = useMemo(() => sections.filter(s => s.id !== UNSORTED), [sections]);

  // Open tasks keep the store's order; done ones go to Completed, newest first.
  const bySection = useMemo(() => {
    const sectionOf = (h: HomeworkItem): string => {
      let p: Program | undefined;
      if (h.program) p = programs.find(x => classKey(x.name) === classKey(h.program!));
      else if (h.slot) p = programs.find(x => x.slots.includes(h.slot!));
      return p ? p.id : UNSORTED;
    };
    const all: Record<string, HomeworkItem[]> = {};
    for (const s of sections) all[s.id] = [];
    for (const h of hw.items) (all[sectionOf(h)] || all[UNSORTED]).push(h);
    const out: Record<string, { list: HomeworkItem[]; completed: HomeworkItem[] }> = {};
    for (const id of Object.keys(all)) out[id] = splitDone(all[id]);
    return out;
  }, [hw.items, sections, programs]);
  const quick = bySection[UNSORTED]?.list || [];

  // ── Opened from a notification: that task, unfolded and marked ──
  const [spotId, setSpotId] = useState<string | null>(null);
  useFocus('homework', f => {
    const sid = Object.keys(bySection).find(id => [...bySection[id].list, ...bySection[id].completed].some(h => h.id === f.id));
    if (!sid) return false;
    setMoving(null);
    if (bySection[sid].completed.some(h => h.id === f.id)) setShowDone(m => ({ ...m, [sid]: true }));
    if (sid !== UNSORTED) setOpenId(f.id);
    setSpotId(f.id);
    return true;
  }, [bySection]);
  useEffect(() => {
    if (!spotId) return;
    const t = setTimeout(() => setSpotId(null), 3500);
    return () => clearTimeout(t);
  }, [spotId]);

  // ── Filing a quick task into a class ──
  const [moving, setMoving] = useState<Moving | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const rects = useRef<Record<string, Rect>>({}).current;
  const hoverRef = useRef<string | null>(null);
  const ghost = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const rootY = useRef(0);

  const tileAt = (x: number, y: number) =>
    classes.find(s => { const r = rects[s.id]; return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; })?.id || null;
  const setHoverId = (id: string | null) => { if (hoverRef.current !== id) { hoverRef.current = id; setHover(id); } };

  const fileInto = (taskId: string, s: Section) => {
    ease();
    hw.update(taskId, { program: s.program });
  };
  const stopMoving = () => { ease(); setMoving(null); setHoverId(null); };

  const dragApi = {
    begin: (h: HomeworkItem, x: number, y: number) => {
      Keyboard.dismiss();
      ghost.setValue({ x, y: y - rootY.current });
      ease();
      setOpenId(null);
      setMoving({ id: h.id, title: h.title, drag: true });
    },
    move: (x: number, y: number) => {
      ghost.setValue({ x, y: y - rootY.current });
      setHoverId(tileAt(x, y));
    },
    end: (taskId: string, commit: boolean) => {
      const s = commit ? classes.find(k => k.id === hoverRef.current) : undefined;
      if (s) fileInto(taskId, s);
      stopMoving();
    },
  };
  const dragRef = useRef(dragApi);
  dragRef.current = dragApi;

  return (
    <ScrollerCtx.Provider value={scroller}>
      <View
        {...rootProps}
        onLayout={() => { rootProps.onLayout(); rootProps.ref.current?.measureInWindow((_x, y) => { rootY.current = y; }); }}
        style={{ flex: 1, backgroundColor: c.paper }}
      >
        <AppHeader topInset={topInset} title="Homework" back />

        <QuickType
          items={quick}
          todayIso={todayIso}
          maxList={Math.round(screenH / 3) - 112}
          moving={moving}
          spotId={spotId}
          canFile={classes.length > 0}
          onAdd={title => hw.add('', title, addDays(todayIso, 1))}
          onPick={h => { Keyboard.dismiss(); ease(); setMoving(m => (m?.id === h.id ? null : { id: h.id, title: h.title, drag: false })); }}
          drag={dragRef}
        />

        {moving ? (
          <ClassTiles
            classes={classes}
            counts={Object.fromEntries(classes.map(s => [s.id, bySection[s.id]?.list.length || 0]))}
            hover={hover}
            dragging={moving.drag}
            title={moving.title}
            onRect={(id, r) => { rects[id] = r; }}
            onPick={s => { fileInto(moving.id, s); stopMoving(); }}
            onCancel={stopMoving}
          />
        ) : (
          <ScrollView
            {...scrollProps}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: kb ? kb + 40 : 130 }}
            showsVerticalScrollIndicator={false}
          >
            {classes.map((s, i) => (
              <ClassBlock
                key={s.id}
                s={s}
                first={i === 0}
                list={bySection[s.id].list}
                completed={bySection[s.id].completed}
                sections={sections}
                todayIso={todayIso}
                openId={openId}
                setOpenId={setOpenId}
                spotId={spotId}
                showDone={!!showDone[s.id]}
                onToggleDone={() => setShowDone(m => ({ ...m, [s.id]: !m[s.id] }))}
              />
            ))}
            {!classes.length && (
              <Text style={{ paddingHorizontal: GUTTER, paddingTop: 24, fontSize: 14, lineHeight: 20, color: c.ink3 }}>
                Add your classes on the Programs tab and each one gets its own list here.
              </Text>
            )}
          </ScrollView>
        )}

        {/* What the finger is carrying. */}
        {!!moving?.drag && (
          <Animated.View pointerEvents="none" style={[{
            position: 'absolute', left: 0, top: 0, maxWidth: 240,
            transform: [{ translateX: Animated.subtract(ghost.x, 24) }, { translateY: Animated.subtract(ghost.y, 54) }, { rotate: '-2deg' }],
            paddingVertical: 9, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
          }, shadow.lg]}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: c.ink }}>{moving.title}</Text>
          </Animated.View>
        )}
      </View>
    </ScrollerCtx.Provider>
  );
}

// ────────────────────────────────────────────────────────────────
// Quick type: the pinned panel at the top
// ────────────────────────────────────────────────────────────────
type DragApi = React.MutableRefObject<{
  begin: (h: HomeworkItem, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: (taskId: string, commit: boolean) => void;
}>;

const QuickType = ({ items, todayIso, maxList, moving, spotId, canFile, onAdd, onPick, drag }: {
  items: HomeworkItem[]; todayIso: string; maxList: number; moving: Moving | null; spotId: string | null; canFile: boolean;
  onAdd: (title: string) => void; onPick: (h: HomeworkItem) => void; drag: DragApi;
}) => {
  const { c, mode } = useTheme();
  const input = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const list = useRef<ScrollView>(null);
  const spotAt = items.findIndex(h => h.id === spotId);
  useEffect(() => {
    if (spotAt < 0) return;
    const t = setTimeout(() => list.current?.scrollTo({ y: Math.max(0, spotAt * 48 - 48), animated: true }), 300);
    return () => clearTimeout(t);
  }, [spotAt]);
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    ease();
    onAdd(t);
    setDraft('');
  };

  return (
    <View style={[{
      marginHorizontal: 12, marginTop: 10, marginBottom: 6, borderRadius: 20, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.line, overflow: 'hidden',
    }, shadow.sm]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, letterSpacing: -0.3, color: c.ink }}>Quick type</Text>
        <Text style={{ flex: 1, fontSize: 13, color: c.ink3 }}>Unsorted tasks</Text>
        {items.length > 0 && <Text style={[{ fontSize: 13, fontWeight: '600', color: c.ink3 }, tnum]}>{items.length}</Text>}
      </View>

      {/* The line to type on. Return adds it and keeps the keyboard up. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 8, marginBottom: 10, paddingLeft: 14, paddingRight: 6, minHeight: 46, borderRadius: 14, backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : c.paper2 }}>
        <TextInput
          ref={input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Type a task, sort it later"
          placeholderTextColor={c.ink3}
          accessibilityLabel="Quick type: add a task"
          returnKeyType="done"
          submitBehavior="submit"
          {...(Platform.OS === 'web' ? ({ blurOnSubmit: false } as object) : {})}
          autoCapitalize="sentences"
          style={{ flex: 1, fontSize: 17, color: c.ink, paddingVertical: 10, ...WEB_INPUT }}
        />
        <Pressable onPress={add} disabled={!draft.trim()} accessibilityRole="button" accessibilityLabel="Add"
          style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: draft.trim() ? c.action : 'transparent', opacity: pressed ? 0.7 : 1 })}>
          <Icon name="plus" size={16} stroke={2.4} color={draft.trim() ? '#fff' : c.ink4} />
        </Pressable>
      </View>

      {items.length > 0 && (
        <ScrollView
          ref={list}
          style={{ maxHeight: Math.max(96, maxList), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!moving?.drag}
          showsVerticalScrollIndicator={items.length > 3}
        >
          {items.map((h, i) => (
            <QuickRow key={h.id} h={h} first={i === 0} todayIso={todayIso} active={moving?.id === h.id} spot={spotId === h.id} canFile={canFile} onPick={() => onPick(h)} drag={drag} />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// One unsorted task: tick, text (tap to edit; emptied = deleted), type chip,
// and the handle that carries it to a class (drag it, or tap it).
const QuickRow = ({ h, first, todayIso, active, spot, canFile, onPick, drag }: {
  h: HomeworkItem; first: boolean; todayIso: string; active: boolean; spot: boolean; canFile: boolean; onPick: () => void; drag: DragApi;
}) => {
  const { c } = useTheme();
  const hw = useHomework();
  const [text, setText] = useState(h.title);
  const latest = useRef(h);
  latest.current = h;
  const save = () => {
    const t = text.trim();
    if (!t) { ease(); hw.remove(h.id); return; }
    if (t !== h.title) hw.update(h.id, { title: t });
  };

  // The handle: a tap opens the class tiles; a drag carries the task to one.
  const moved = useRef(false);
  const pan = useRef(PanResponder.create({
    // Capture too, so the panel's own scrolling can't take the touch mid-drag.
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { moved.current = false; },
    onPanResponderMove: (e, g) => {
      if (!moved.current) {
        if (Math.abs(g.dx) + Math.abs(g.dy) < 6) return;
        moved.current = true;
        drag.current.begin(latest.current, e.nativeEvent.pageX, e.nativeEvent.pageY);
      }
      drag.current.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
    },
    onPanResponderRelease: () => { if (moved.current) drag.current.end(latest.current.id, true); else pickRef.current(); },
    onPanResponderTerminate: () => { if (moved.current) drag.current.end(latest.current.id, false); },
  })).current;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 4, minHeight: 48, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: active ? wash(c.action, 0.08) : 'transparent' }}>
      <Spot on={spot} />
      <Pressable
        onPress={() => { ease(); hw.toggle(h.id, todayIso); }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: h.done }}
        accessibilityLabel={`Done: ${h.title}`}
        style={({ pressed }) => ({ width: 40, height: 46, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' }}>
          {h.done && <Check size={11} color={c.ink3} width={3.5} />}
        </View>
      </Pressable>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={save}
        onSubmitEditing={() => Keyboard.dismiss()}
        returnKeyType="done"
        accessibilityLabel="Task"
        style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '500', color: c.ink, paddingVertical: 10, ...WEB_INPUT }}
      />
      <KindChip kind={h.kind} onKind={kind => hw.update(h.id, { kind })} />
      {canFile && (
        <View
          {...pan.panHandlers}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Move ${h.title} to a class`}
          style={{ width: 44, height: 46, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.action : c.paper2 }}>
            <Icon name="chev-d" size={14} stroke={2.4} color={active ? '#fff' : c.ink2} />
          </View>
        </View>
      )}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Class tiles: every class on one screen, as somewhere to drop a task
// ────────────────────────────────────────────────────────────────
const ClassTiles = ({ classes, counts, hover, dragging, title, onRect, onPick, onCancel }: {
  classes: Section[]; counts: Record<string, number>; hover: string | null; dragging: boolean; title: string;
  onRect: (id: string, r: Rect) => void; onPick: (s: Section) => void; onCancel: () => void;
}) => {
  const { c } = useTheme();
  const rows: Section[][] = [];
  for (let i = 0; i < classes.length; i += 2) rows.push(classes.slice(i, i + 2));

  return (
    <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 118 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 8, minHeight: 36 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: c.ink3 }}>
          {dragging ? 'Drop it on a class' : 'Pick a class for '}
          {!dragging && <Text style={{ fontWeight: '700', color: c.ink }}>{title}</Text>}
        </Text>
        {!dragging && (
          <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button" style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 14.5, fontWeight: '600', color: c.link }}>Cancel</Text>
          </Pressable>
        )}
      </View>
      {/* Rows share the height, so any number of classes fits without scrolling. */}
      <View style={{ flex: 1, gap: 8 }}>
        {rows.map((row, i) => (
          <View key={i} style={{ flex: 1, maxHeight: 92, flexDirection: 'row', gap: 8 }}>
            {row.map(s => <Tile key={s.id} s={s} count={counts[s.id] || 0} on={hover === s.id} onRect={onRect} onPress={() => onPick(s)} />)}
            {row.length === 1 && <View style={{ flex: 1 }} />}
          </View>
        ))}
      </View>
    </View>
  );
};

const Tile = ({ s, count, on, onRect, onPress }: { s: Section; count: number; on: boolean; onRect: (id: string, r: Rect) => void; onPress: () => void }) => {
  const { c, mode } = useTheme();
  const ref = useRef<View>(null);
  const tone = isHex(s.color) ? glow(s.color!, mode) : c.ink3;
  const measure = () => ref.current?.measureInWindow((x, y, w, h) => onRect(s.id, { x, y, w, h }));
  return (
    <Pressable
      ref={ref}
      onLayout={measure}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Move to ${s.name}`}
      style={({ pressed }) => [{
        flex: 1, minWidth: 0, borderRadius: 16, paddingHorizontal: 14, justifyContent: 'center',
        backgroundColor: on ? tone : isHex(s.color) ? wash(tone, mode === 'dark' ? 0.16 : 0.09) : c.paper2,
        borderWidth: 1.5, borderColor: on ? tone : isHex(s.color) ? wash(tone, 0.28) : c.line,
        transform: [{ scale: on ? 1.03 : pressed ? 0.98 : 1 }],
      }, on ? shadow.md : shadow.none]}
    >
      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: on ? (mode === 'dark' ? '#0C1117' : '#fff') : c.ink }}>{s.name}</Text>
      <Text numberOfLines={1} style={[{ fontSize: 12.5, marginTop: 2, color: on ? (mode === 'dark' ? 'rgba(12,17,23,0.7)' : 'rgba(255,255,255,0.8)') : c.ink3 }, tnum]}>
        {count ? `${count} to do` : 'Nothing due'}
      </Text>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// One class: heading, then its tasks and the line to write on.
// ────────────────────────────────────────────────────────────────
const ClassBlock = ({ s, first, list, completed, sections, todayIso, openId, setOpenId, showDone, onToggleDone, spotId }: {
  s: Section; first: boolean; list: HomeworkItem[]; completed: HomeworkItem[]; sections: Section[]; todayIso: string;
  openId: string | null; setOpenId: (id: string | null) => void; showDone: boolean; onToggleDone: () => void; spotId: string | null;
}) => {
  const { c, mode } = useTheme();
  return (
    <View style={{ paddingTop: first ? 8 : 28 }}>
      {/* A faint wash of the class's colour behind its heading, so each class
          reads as its own group without a hard box. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 8, marginBottom: 4, paddingLeft: GUTTER - 8, paddingRight: 8, paddingTop: 10, paddingBottom: 9, borderRadius: 14, backgroundColor: isHex(s.color) ? wash(glow(s.color!, mode), mode === 'dark' ? 0.1 : 0.06) : mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(14,34,56,0.025)' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 23, lineHeight: 29, letterSpacing: -0.3, color: c.ink }}>{s.name}</Text>
          {!!s.sub && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 }}>
              {!!s.color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: glow(s.color, mode) }} />}
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13.5, lineHeight: 18, color: c.ink3 }}>{s.sub}</Text>
            </View>
          )}
        </View>
      </View>

      <ClassHomework s={s} list={list} completed={completed} sections={sections} todayIso={todayIso} openId={openId} setOpenId={setOpenId} showDone={showDone} onToggleDone={onToggleDone} spotId={spotId} />
    </View>
  );
};
