// Spartans — one class's homework: the rows, how they open and edit in place, the
// line to write on at the bottom, and drag to reorder. The Homework page and a
// program's Homework tab both draw these, so the two always work the same.
//
// A row: tick (the only way to complete it) · task · drag handle. Tap the task to
// edit it where it is: the row opens with notes, due date, time, class, up/down,
// mark done and delete. A ticked task moves straight to the class's Completed
// list, which still opens to edit or untick. Everything saves as it changes; there is no Save button.
//
// The screen around it wraps its ScrollView in useHomeworkScroller, which keeps
// the input being typed in above the keyboard and lets a drag lock the list.
//
// Dragging is plain PanResponder + Animated: the handle takes the touch and
// locks the ScrollView, the row follows the finger, its neighbours slide out of
// the way, and the new order is written on release.

import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityActionEvent, AccessibilityInfo, Animated, Easing, Keyboard, LayoutAnimation, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TextInputProps, View,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { radii, shadow, tnum } from '../theme';
import { Icon, Check } from './Icon';
import { useProfile, teacherShort } from '../ProfileContext';
import { useHomework } from '../stores';
import { useKeyboardHeight } from '../useKeyboard';
import { toISO, fromISO, MONTH_NAMES } from '../calendar';
import { fmt12 } from '../bell';
import { programsFor, groupPrograms, HomeworkItem, KIND_ONE } from '../programs';

export const UNSORTED = 'unsorted';
// The tick column: a 44pt target whose 24pt circle lines up with the headings.
const TICK_W = 44;
const GUTTER = 20;
const ROW_LEFT = GUTTER - (TICK_W - 24) / 2;
const ROW_RIGHT = 8;
// The tab bar covers this much of the bottom of the screen.
const BAR_ROOM = 110;
const EDGE_SCROLL = 64;

const WEB_INPUT = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {};

// A section is Unsorted or one program.
export type Section = { id: string; name: string; sub: string; color?: string; program: string };

// Every program, in Programs-tab order, then Unsorted.
export const useHomeworkSections = () => {
  const { profile } = useProfile();
  const programs = useMemo(() => groupPrograms(programsFor(profile)).flatMap(g => g.items), [profile]);
  const sections = useMemo<Section[]>(() => [
    ...programs.map(p => ({
      id: p.id, name: p.name, color: p.color, program: p.name,
      sub: p.kind === 'class'
        ? [`Block ${p.slots.join(', ')}`, teacherShort(p.teacher || '')].filter(Boolean).join(' · ')
        : [KIND_ONE[p.kind], teacherShort(p.teacher || '')].filter(Boolean).join(' · '),
    })),
    { id: UNSORTED, name: 'Unsorted', sub: 'Anything without a class', program: '' },
  ], [programs]);
  return { programs, sections };
};

// Fills for the opened row and its controls, for a list sitting on a tinted panel.
export const HomeworkTone = createContext<{ panel?: string; field?: string }>({});

const titleType = { fontSize: 17, lineHeight: 23, fontWeight: '500' } as const;
const metaType = { fontSize: 14, lineHeight: 19 } as const;

// ── Dates ───────────────────────────────────────────────────────
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const addDays = (iso: string, n: number) => { const d = fromISO(iso); return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const daysBetween = (a: string, b: string) => Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
const shortDate = (iso: string) => { const d = fromISO(iso); return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };

const dayLabel = (iso: string, todayIso: string) => {
  const diff = daysBetween(todayIso, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return DOW3[fromISO(iso).getDay()];
  return shortDate(iso);
};

// The due line under a task, in words so it never depends on colour.
const dueText = (h: HomeworkItem, todayIso: string) => {
  const late = !h.done && h.due < todayIso;
  const day = late ? `Late, ${shortDate(h.due)}` : dayLabel(h.due, todayIso);
  return h.time ? `${day} · ${fmt12(h.time, true)}` : day;
};

// ── Scrolling: keep the input being typed in above the keyboard, and let a drag
// lock the list or push it along when the finger reaches an edge. ──────────────
export type Scroller = {
  reveal: () => void;
  focus: (node: TextInput | null) => void;
  blur: (node: TextInput | null) => void;
  lock: (on: boolean) => void;
  scrollBy: (dy: number) => number;        // returns how far it really moved
  edges: () => { top: number; bottom: number };
};
export const ScrollerCtx = createContext<Scroller>({ reveal: () => {}, focus: () => {}, blur: () => {}, lock: () => {}, scrollBy: () => 0, edges: () => ({ top: 0, bottom: 0 }) });

// Wire a screen's ScrollView up: spread rootProps on a View around it and
// scrollProps on it, and put `scroller` in ScrollerCtx above both.
export const useHomeworkScroller = (topInset: number) => {
  const hw = useHomework();
  const kb = useKeyboardHeight();
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const contentH = useRef(0);
  const viewH = useRef(0);
  const frame = useRef({ y: 0, h: 0 });
  const focused = useRef<TextInput | null>(null);
  const kbNow = useRef(0);
  kbNow.current = kb;

  const scroller = useMemo<Scroller>(() => {
    const room = () => (kbNow.current > 0 ? kbNow.current : BAR_ROOM);
    const reveal = () => {
      focused.current?.measureInWindow((_x, y, _w, h) => {
        const top = frame.current.y + topInset + 12;
        const bottom = frame.current.y + frame.current.h - room() - 16;
        const d = y + h > bottom ? y + h - bottom : y < top ? y - top : 0;
        if (d) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + d), animated: true });
      });
    };
    return {
      reveal,
      focus: node => { focused.current = node; setTimeout(reveal, 80); },
      blur: node => { if (focused.current === node) focused.current = null; },
      lock: setDragging,
      scrollBy: dy => {
        const max = Math.max(0, contentH.current - viewH.current);
        const next = Math.min(max, Math.max(0, scrollY.current + dy));
        const moved = next - scrollY.current;
        if (moved) { scrollRef.current?.scrollTo({ y: next, animated: false }); scrollY.current = next; }
        return moved;
      },
      edges: () => ({ top: frame.current.y + topInset, bottom: frame.current.y + frame.current.h - room() }),
    };
  }, [topInset]);

  // The keyboard coming up, or a new task pushing the line down, can both cover
  // the input being typed in.
  useEffect(() => {
    const t = setTimeout(scroller.reveal, 80);
    return () => clearTimeout(t);
  }, [kb, hw.items.length, scroller]);

  return {
    scroller, kb, scrollRef,
    rootProps: {
      ref: rootRef,
      onLayout: () => rootRef.current?.measureInWindow((_x, y, _w, h) => { frame.current = { y, h }; }),
    },
    scrollProps: {
      ref: scrollRef,
      keyboardShouldPersistTaps: 'handled' as const,
      // Web treats any scroll as a drag, which would drop focus when the list
      // moves to keep an input in view.
      keyboardDismissMode: Platform.OS === 'web' ? 'none' as const : 'on-drag' as const,
      scrollEnabled: !dragging,
      canCancelContentTouches: !dragging,
      scrollEventThrottle: 16,
      onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => { scrollY.current = e.nativeEvent.contentOffset.y; },
      onLayout: (e: { nativeEvent: { layout: { height: number } } }) => { viewH.current = e.nativeEvent.layout.height; },
      onContentSizeChange: (_w: number, h: number) => { contentH.current = h; },
    },
  };
};

// ────────────────────────────────────────────────────────────────
// One class's list: its open tasks in the student's order, the line to write
// on, then "Completed" — everything ticked off, newest first, folded away until
// opened. Completed rows still open to edit (or untick).
// ────────────────────────────────────────────────────────────────
export const ClassHomework = ({ s, list, completed, sections, todayIso, openId, setOpenId, showDone, onToggleDone }: {
  s: Section; list: HomeworkItem[]; completed: HomeworkItem[]; sections: Section[]; todayIso: string;
  openId: string | null; setOpenId: (id: string | null) => void; showDone: boolean; onToggleDone: () => void;
}) => {
  const hw = useHomework();
  const drag = useReorder(list, hw.reorder);

  const moveBy = (id: string, delta: number) => {
    const ids = list.map(h => h.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    hw.reorder(ids);
    AccessibilityInfo.announceForAccessibility(`Moved to ${to + 1} of ${ids.length}`);
  };

  const rowProps = {
    sections, todayIso, section: s,
    onOpen: setOpenId,
    onClose: () => setOpenId(null),
    onMoved: () => setOpenId(null),
  };

  return (
    <>
      <View style={{ zIndex: drag.activeId ? 1 : 0 }}>
        {list.map((h, i) => (
          <Row
            key={h.id}
            h={h}
            {...rowProps}
            open={openId === h.id}
            drag={drag}
            canDrag={list.length > 1}
            index={i}
            count={list.length}
            onMove={delta => moveBy(h.id, delta)}
          />
        ))}
      </View>

      <AddRow s={s} onAdd={title => hw.add(s.program, title, addDays(todayIso, 1))} />

      {completed.length > 0 && <DoneToggle count={completed.length} name={s.name} open={showDone} onPress={onToggleDone} />}
      {showDone && completed.map(h => (
        <Row key={h.id} h={h} {...rowProps} open={openId === h.id} older />
      ))}
    </>
  );
};

// Split a class's homework: open tasks (store order) and completed (newest
// first). Ticking moves a task straight to Completed.
export const splitDone = (items: HomeworkItem[]) => ({
  list: items.filter(h => !h.done),
  completed: items.filter(h => h.done).sort((a, z) => (z.doneOn || '').localeCompare(a.doneOn || '')),
});

// Ticking (or unticking) slides the row between the lists instead of jumping.
const animateMove = () => {
  if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

// "Completed · 3" under a class's list; opens what has been ticked off.
export const DoneToggle = ({ count, name, open, onPress }: { count: number; name: string; open: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { animateMove(); onPress(); }}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${count} completed in ${name}`}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: ROW_LEFT + TICK_W, paddingRight: 20, marginTop: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name="check-circle" size={15} stroke={2} color={c.ink3} />
      <Text style={[{ fontSize: 14, fontWeight: '600', color: c.ink3 }, tnum]}>Completed · {count}</Text>
      <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
        <Icon name="chev-d" size={12} stroke={2} color={c.ink3} />
      </View>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// The line at the bottom of every class. Return adds it and stays here.
// ────────────────────────────────────────────────────────────────
const AddRow = ({ s, onAdd }: { s: Section; onAdd: (title: string) => void }) => {
  const { c } = useTheme();
  const scroller = useContext(ScrollerCtx);
  const input = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  // Never lose what someone wrote: leaving the line or the screen adds it too.
  const latest = useRef({ draft, onAdd });
  latest.current = { draft, onAdd };
  const commit = () => {
    const t = latest.current.draft.trim();
    if (!t) return;
    latest.current.onAdd(t);
    latest.current.draft = '';
    setDraft('');
  };
  useEffect(() => () => commit(), []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: ROW_LEFT, paddingRight: ROW_RIGHT }}>
      <Pressable
        onPress={() => input.current?.focus()}
        accessible={false}
        importantForAccessibility="no"
        style={{ width: TICK_W, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="plus" size={16} stroke={1.8} color={c.ink3} />
      </Pressable>
      <View style={{
        flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center',
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line,
        borderBottomWidth: focused ? 1 : StyleSheet.hairlineWidth, borderBottomColor: focused ? c.ink3 : c.line,
      }}>
        <TextInput
          ref={input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onFocus={() => { setFocused(true); scroller.focus(input.current); }}
          onBlur={() => { setFocused(false); scroller.blur(input.current); commit(); }}
          placeholder="Add homework"
          placeholderTextColor={c.ink3}
          accessibilityLabel={`Add homework to ${s.name}`}
          returnKeyType="next"
          enablesReturnKeyAutomatically
          autoCapitalize="sentences"
          // Return must add the task and keep the keyboard up, on a line that
          // still wraps. Web only submits from a single-line field.
          multiline={Platform.OS !== 'web'}
          scrollEnabled={false}
          submitBehavior="submit"
          {...(Platform.OS === 'web' ? ({ blurOnSubmit: false } as object) : {})}
          style={[fieldStyle(c.ink), { paddingTop: 12, paddingBottom: 12, paddingRight: 12, fontWeight: draft ? '500' : '400' }]}
        />
      </View>
    </View>
  );
};

const fieldStyle = (color: string) => ({
  ...titleType, color, padding: 0, paddingTop: 0, margin: 0, textAlignVertical: 'top' as const, ...WEB_INPUT,
});

// A text field that saves when you leave it, or leave the screen. An emptied
// title goes back to what it was rather than deleting the task.
const DraftField = ({ initial, onSave, allowEmpty, inputRef, ...props }: Omit<TextInputProps, 'value' | 'onChangeText'> & {
  initial: string; onSave: (v: string) => void; allowEmpty?: boolean; inputRef?: React.Ref<TextInput>;
}) => {
  const [draft, setDraft] = useState(initial);
  const scroller = useContext(ScrollerCtx);
  const own = useRef<TextInput | null>(null);
  const latest = useRef({ draft, initial, onSave, allowEmpty });
  latest.current = { draft, initial, onSave, allowEmpty };
  const save = () => {
    const l = latest.current;
    const t = l.draft.trim();
    if (t === l.initial.trim()) return;
    if (!t && !l.allowEmpty) { setDraft(l.initial); return; }
    l.onSave(t);
  };
  useEffect(() => () => save(), []);   // eslint-disable-line react-hooks/exhaustive-deps
  // A web textarea focuses with the caret at the start; phones put it at the end.
  useEffect(() => {
    if (Platform.OS === 'web' && props.autoFocus) (own.current as unknown as HTMLTextAreaElement | null)?.setSelectionRange?.(initial.length, initial.length);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // Phones grow a multiline field by themselves; a web textarea has to be told.
  const [webH, setWebH] = useState<number | undefined>();
  const web = Platform.OS === 'web' ? { rows: 1, onContentSizeChange: (e: { nativeEvent: { contentSize: { height: number } } }) => setWebH(e.nativeEvent.contentSize.height) } : {};
  return (
    <TextInput
      {...props}
      {...web}
      style={[props.style, webH ? { height: webH } : null]}
      ref={node => {
        own.current = node;
        if (typeof inputRef === 'function') inputRef(node);
        else if (inputRef) (inputRef as React.RefObject<TextInput | null>).current = node;
      }}
      value={draft}
      onChangeText={setDraft}
      onFocus={e => { scroller.focus(own.current); props.onFocus?.(e); }}
      onBlur={e => { scroller.blur(own.current); save(); props.onBlur?.(e); }}
    />
  );
};

// ────────────────────────────────────────────────────────────────
// Drag to reorder, within one class. Row heights vary, so each row reports its
// own; the dragged row follows the finger and the rows it passes slide by its
// height. Nothing is written until release.
// ────────────────────────────────────────────────────────────────
type Drag = {
  activeId: string | null;
  translateOf: (id: string) => Animated.Value;
  setHeight: (id: string, h: number) => void;
  begin: (id: string) => void;
  move: (id: string, dy: number, moveY: number) => void;
  end: (id: string, commit: boolean) => void;
};

const useReorder = (rows: HomeworkItem[], commit: (ids: string[]) => void): Drag => {
  const scroller = useContext(ScrollerCtx);
  const [activeId, setActiveId] = useState<string | null>(null);
  const heights = useRef<Record<string, number>>({}).current;
  const shifts = useRef<Record<string, Animated.Value>>({}).current;
  const shiftOf = (id: string) => (shifts[id] ||= new Animated.Value(0));
  const settling = useRef(false);
  const awaitingStore = useRef(false);
  const current = useRef<null | {
    id: string; ids: string[]; hs: number[]; from: number; to: number; top: number; total: number;
    dy: number; moveY: number; scrolled: number; timer: ReturnType<typeof setInterval> | null;
  }>(null);
  const rowsNow = useRef(rows);
  rowsNow.current = rows;

  const slide = (v: Animated.Value, toValue: number, duration = 160, done?: () => void) =>
    Animated.timing(v, { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(done);

  const place = () => {
    const d = current.current;
    if (!d) return;
    const h = d.hs[d.from];
    const top = Math.max(0, Math.min(d.total - h, d.top + d.dy + d.scrolled));
    shiftOf(d.id).setValue(top - d.top);
    // Where it would sit closest to, among the other rows.
    let sum = 0, to = 0, best = Math.abs(top);
    let k = 0;
    d.ids.forEach((_, i) => {
      if (i === d.from) return;
      sum += d.hs[i];
      k++;
      const dist = Math.abs(top - sum);
      if (dist < best) { best = dist; to = k; }
    });
    if (to === d.to) return;
    d.to = to;
    d.ids.forEach((other, i) => {
      if (i === d.from) return;
      slide(shiftOf(other), i > d.from && i <= to ? -h : i < d.from && i >= to ? h : 0);
    });
  };

  const stopTimer = () => {
    const d = current.current;
    if (d?.timer) { clearInterval(d.timer); d.timer = null; }
  };

  const reset = (ids: string[]) => {
    ids.forEach(id => shiftOf(id).setValue(0));
    settling.current = false;
    setActiveId(null);
  };

  // Hold the slid-out rows where they are until the new order has rendered, so
  // the list doesn't flash the old order for a frame.
  const key = rows.map(r => r.id).join();
  useLayoutEffect(() => {
    if (!awaitingStore.current) return;
    awaitingStore.current = false;
    reset(rowsNow.current.map(r => r.id));
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    stopTimer();
    if (current.current) scroller.lock(false);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return {
    activeId,
    translateOf: shiftOf,
    setHeight: (id, h) => { heights[id] = h; },
    begin: id => {
      if (current.current || settling.current) return;
      const ids = rowsNow.current.map(r => r.id);
      const from = ids.indexOf(id);
      if (from < 0) return;
      const hs = ids.map(x => heights[x] || 0);
      current.current = {
        id, ids, hs, from, to: from,
        top: hs.slice(0, from).reduce((a, b) => a + b, 0),
        total: hs.reduce((a, b) => a + b, 0),
        dy: 0, moveY: 0, scrolled: 0, timer: null,
      };
      setActiveId(id);
      scroller.lock(true);
    },
    move: (id, dy, moveY) => {
      const d = current.current;
      if (!d || d.id !== id) return;
      d.dy = dy;
      d.moveY = moveY;
      place();
      // Near an edge of the visible list, push the list along under the finger.
      if (d.timer) return;
      const direction = () => {
        const e = scroller.edges();
        return d.moveY < e.top + EDGE_SCROLL ? -1 : d.moveY > e.bottom - EDGE_SCROLL ? 1 : 0;
      };
      if (!direction()) return;
      d.timer = setInterval(() => {
        const dir = direction();
        if (!dir) { stopTimer(); return; }
        const raw = d.top + d.dy + d.scrolled;
        if ((dir < 0 && raw <= 0) || (dir > 0 && raw >= d.total - d.hs[d.from])) return;
        const moved = scroller.scrollBy(dir * 7);
        if (moved) { d.scrolled += moved; place(); }
      }, 16);
    },
    end: (id, keep) => {
      const d = current.current;
      if (!d || d.id !== id) return;
      stopTimer();
      current.current = null;
      settling.current = true;
      scroller.lock(false);
      const to = keep ? d.to : d.from;
      if (!keep) d.ids.forEach((other, i) => { if (i !== d.from) slide(shiftOf(other), 0); });
      const others = d.ids.filter(x => x !== id);
      const landed = others.slice(0, to).reduce((sum, x) => sum + d.hs[d.ids.indexOf(x)], 0);
      slide(shiftOf(id), landed - d.top, 140, () => {
        if (to === d.from) { reset(d.ids); return; }
        const next = [...others];
        next.splice(to, 0, id);
        awaitingStore.current = true;
        commit(next);
        AccessibilityInfo.announceForAccessibility(`Moved to ${to + 1} of ${next.length}`);
      });
    },
  };
};

const DragHandle = ({ id, title, drag, actions }: { id: string; title: string; drag: Drag; actions: A11yMove }) => {
  const { c } = useTheme();
  const api = useRef(drag);
  api.current = drag;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: () => api.current.begin(id),
    onPanResponderMove: (_e, g) => api.current.move(id, g.dy, g.moveY),
    onPanResponderRelease: () => api.current.end(id, true),
    onPanResponderTerminate: () => api.current.end(id, false),
  })).current;
  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Reorder ${title}`}
      accessibilityHint="Drag up or down, or use the actions to move it"
      {...actions}
      style={[
        { width: 44, height: 47, alignItems: 'center', justifyContent: 'center' },
        Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object) : null,
      ]}
    >
      <View style={{ flexDirection: 'row', gap: 3 }} pointerEvents="none">
        {[0, 1].map(col => (
          <View key={col} style={{ gap: 3 }}>
            {[0, 1, 2].map(dot => <View key={dot} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.ink3 }} />)}
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Move up / down for screen readers ───────────────────────────
type A11yMove = {
  accessibilityActions?: { name: string; label: string }[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
};
const moveActions = (index: number, count: number, onMove?: (delta: number) => void): A11yMove => {
  if (!onMove || count < 2) return {};
  return {
    accessibilityActions: [
      ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
      ...(index < count - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
    ],
    onAccessibilityAction: e => {
      if (e.nativeEvent.actionName === 'moveUp') onMove(-1);
      if (e.nativeEvent.actionName === 'moveDown') onMove(1);
    },
  };
};

// ────────────────────────────────────────────────────────────────
// Row: tick · task (tap to edit in place) · handle. Opens where it is.
// ────────────────────────────────────────────────────────────────
const Row = ({ h, section, sections, todayIso, open, older, drag, canDrag, index = 0, count = 0, onMove, onOpen, onClose, onMoved }: {
  h: HomeworkItem; section: Section; sections: Section[]; todayIso: string; open: boolean; older?: boolean;
  drag?: Drag; canDrag?: boolean; index?: number; count?: number; onMove?: (delta: number) => void;
  onOpen: (id: string) => void; onClose: () => void; onMoved: () => void;
}) => {
  const { c } = useTheme();
  const hw = useHomework();
  const active = drag?.activeId === h.id;
  const late = !h.done && h.due < todayIso;
  const dueToday = !h.done && h.due === todayIso;
  const a11yMove = moveActions(index, count, onMove);
  const due = h.done ? (h.doneOn === todayIso ? 'Done today' : h.doneOn ? `Done ${shortDate(h.doneOn)}` : 'Done') : dueText(h, todayIso);

  return (
    <Animated.View
      onLayout={e => drag?.setHeight(h.id, e.nativeEvent.layout.height)}
      style={[
        { transform: [{ translateY: drag ? drag.translateOf(h.id) : 0 }] },
        active ? [{ zIndex: 10, backgroundColor: c.surface, borderRadius: radii.sm }, shadow.md] : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingLeft: ROW_LEFT, paddingRight: ROW_RIGHT }}>
        <Pressable
          onPress={() => { animateMove(); if (open) onClose(); hw.toggle(h.id, todayIso); }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: h.done }}
          accessibilityLabel={`Done: ${h.title}`}
          style={({ pressed }) => ({ width: TICK_W, height: 47, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{
            width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
            borderColor: c.ink3, backgroundColor: h.done ? c.ink3 : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {h.done && <Check size={12} color={c.paper} width={3.5} />}
          </View>
        </Pressable>

        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: active ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.line }}>
          {open ? (
            <View style={{ flex: 1, minWidth: 0, paddingVertical: 12, paddingRight: 14 }}>
              <DraftField
                initial={h.title}
                onSave={title => hw.update(h.id, { title })}
                autoFocus
                multiline
                scrollEnabled={false}
                returnKeyType="done"
                submitBehavior="submit"
                {...(Platform.OS === 'web' ? ({ blurOnSubmit: true } as object) : {})}
                onSubmitEditing={onClose}
                accessibilityLabel="Homework"
                style={fieldStyle(h.done ? c.ink3 : c.ink)}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => onOpen(h.id)}
              accessibilityRole="button"
              accessibilityLabel={`${h.title}. ${due}${h.done ? '. Done' : ''}${h.notes ? `. ${h.notes}` : ''}`}
              accessibilityHint="Edit"
              {...a11yMove}
              style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 47, paddingVertical: 12, paddingRight: canDrag ? 0 : 14, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[titleType, { color: h.done ? c.ink3 : c.ink, textDecorationLine: h.done ? 'line-through' : 'none' }]}>{h.title}</Text>
              <Text style={[metaType, tnum, {
                marginTop: 2,
                color: late ? c.danger : dueToday ? c.ink2 : c.ink3,
                fontWeight: late || dueToday ? '600' : '400',
              }]}>{due}</Text>
              {!!h.notes && <Text numberOfLines={2} style={[metaType, { color: c.ink3, marginTop: 2 }]}>{h.notes}</Text>}
            </Pressable>
          )}
          {!open && canDrag && drag && <DragHandle id={h.id} title={h.title} drag={drag} actions={a11yMove} />}
        </View>
      </View>

      {open && (
        <Details
          h={h}
          section={section}
          sections={sections}
          todayIso={todayIso}
          index={index}
          count={count}
          onMove={onMove}
          onClose={onClose}
          onMoved={onMoved}
        />
      )}
    </Animated.View>
  );
};

// ────────────────────────────────────────────────────────────────
// The opened row: notes, due, time, class, move, delete. One thing unfolds at a
// time so it never turns into a form. Changes save as they're made.
// ────────────────────────────────────────────────────────────────
type Fold = 'due' | 'time' | 'class' | null;

const Details = ({ h, section, sections, todayIso, index, count, onMove, onClose, onMoved }: {
  h: HomeworkItem; section: Section; sections: Section[]; todayIso: string; index: number; count: number;
  onMove?: (delta: number) => void; onClose: () => void; onMoved: () => void;
}) => {
  const { c } = useTheme();
  const hw = useHomework();
  const tone = useContext(HomeworkTone);
  const [fold, setFold] = useState<Fold>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Unfolding needs the room the keyboard is taking.
  const toggle = (f: Fold) => { Keyboard.dismiss(); setFold(cur => cur === f ? null : f); };

  return (
    <View style={{ marginHorizontal: 6, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 4, backgroundColor: tone.panel ?? c.paper2, borderRadius: radii.md }}>
      <View style={{ paddingVertical: 10 }}>
        <DraftField
          initial={h.notes || ''}
          allowEmpty
          onSave={notes => hw.update(h.id, { notes })}
          multiline
          scrollEnabled={false}
          placeholder="Add notes"
          placeholderTextColor={c.ink3}
          accessibilityLabel="Notes"
          style={{ fontSize: 16, lineHeight: 22, color: c.ink, padding: 0, paddingTop: 0, minHeight: 24, textAlignVertical: 'top', ...WEB_INPUT }}
        />
      </View>

      <FoldRow label="Due" value={dayLabel(h.due, todayIso)} open={fold === 'due'} onPress={() => toggle('due')} />
      {fold === 'due' && <DueFields due={h.due} todayIso={todayIso} onDue={due => hw.update(h.id, { due })} />}

      <FoldRow label="Time" value={h.time ? fmt12(h.time, true) : 'Any time'} open={fold === 'time'} onPress={() => toggle('time')} />
      {fold === 'time' && <TimeFields time={h.time} onTime={time => hw.update(h.id, { time })} />}

      <FoldRow label="Class" value={section.name} open={fold === 'class'} onPress={() => toggle('class')} />
      {fold === 'class' && (
        <View style={{ paddingBottom: 4 }}>
          {sections.map(s => {
            const on = s.id === section.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => { if (!on) { hw.update(h.id, { program: s.program }); onMoved(); } }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={on ? `In ${s.name}` : `Move to ${s.name}`}
                style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={{ flex: 1, fontSize: 15, lineHeight: 20, paddingVertical: 8, color: c.ink, fontWeight: on ? '600' : '400' }}>{s.name}</Text>
                {on && <Icon name="check" size={16} stroke={2} color={c.ink2} />}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, marginTop: fold ? 0 : 2 }}>
        {!!onMove && count > 1 && (
          <>
            <TextAction label="Up" a11y="Move up" disabled={index === 0} onPress={() => onMove(-1)} />
            <TextAction label="Down" a11y="Move down" disabled={index === count - 1} onPress={() => onMove(1)} />
          </>
        )}
        <TextAction
          label={h.done ? 'Not done' : 'Mark done'}
          a11y={h.done ? `Mark ${h.title} not done` : `Mark ${h.title} done`}
          color={h.done ? c.ink2 : c.moss}
          strong
          onPress={() => { animateMove(); onClose(); hw.toggle(h.id, todayIso); }}
        />
        <TextAction
          label={confirmDelete ? 'Tap again to delete' : 'Delete'}
          a11y={confirmDelete ? 'Tap again to delete' : `Delete ${h.title}`}
          color={c.danger}
          onPress={() => { if (confirmDelete) hw.remove(h.id); else setConfirmDelete(true); }}
        />
        <View style={{ flex: 1 }} />
        <TextAction label="Close" a11y="Close" color={c.link} strong onPress={onClose} />
      </View>
    </View>
  );
};

const FoldRow = ({ label, value, open, onPress }: { label: string; value: string; open: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ width: 44, fontSize: 14, color: c.ink3 }}>{label}</Text>
      <Text numberOfLines={1} style={[{ flex: 1, fontSize: 15, fontWeight: '500', color: c.ink }, tnum]}>{value}</Text>
      <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
        <Icon name="chev-d" size={12} stroke={2} color={c.ink3} />
      </View>
    </Pressable>
  );
};

const TextAction = ({ label, a11y, color, strong, disabled, onPress }: {
  label: string; a11y: string; color?: string; strong?: boolean; disabled?: boolean; onPress: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, marginRight: 2, opacity: disabled ? 0.45 : pressed ? 0.6 : 1 })}
    >
      <Text style={{ fontSize: 15, fontWeight: strong ? '600' : '500', color: color || c.ink2 }}>{label}</Text>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Date and time pickers (plain RN, so they work in Expo Go and on web)
// ────────────────────────────────────────────────────────────────
const TIME_PRESETS = ['08:00', '15:00', '18:00', '21:00', '23:59'];

const DueFields = ({ due, todayIso, onDue }: { due: string; todayIso: string; onDue: (iso: string) => void }) => {
  // The Monday after this one, for "Next Mon".
  const nextMon = addDays(todayIso, ((8 - fromISO(todayIso).getDay()) % 7) || 7);
  const quick: [string, string][] = [['Today', todayIso], ['Tomorrow', addDays(todayIso, 1)], ['Next Mon', nextMon]];
  return (
    <View style={{ paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {quick.map(([label, iso]) => <SmallChip key={label} label={label} on={due === iso} onPress={() => onDue(iso)} grow />)}
      </View>
      <MiniCal iso={due} todayIso={todayIso} onPick={onDue} />
    </View>
  );
};

const TimeFields = ({ time, onTime }: { time?: string; onTime: (t: string | undefined) => void }) => {
  const { c } = useTheme();
  const tone = useContext(HomeworkTone);
  const [h, m] = (time || '15:00').split(':').map(Number);
  const setMins = (total: number) => { const t = ((total % 1440) + 1440) % 1440; onTime(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`); };
  return (
    <View style={{ paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <SmallChip label="Any time" on={!time} onPress={() => onTime(undefined)} />
        {TIME_PRESETS.map(t => <SmallChip key={t} label={fmt12(t, true)} on={time === t} onPress={() => onTime(t)} />)}
      </View>
      {!!time && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <Stepper value={String(((h + 11) % 12) + 1)} onMinus={() => setMins(h * 60 + m - 60)} onPlus={() => setMins(h * 60 + m + 60)} label="hour" />
          <Stepper value={String(m).padStart(2, '0')} onMinus={() => setMins(h * 60 + m - (m % 5 || 5))} onPlus={() => setMins(h * 60 + m + 5 - (m % 5))} label="minutes" />
          <View style={{ flexDirection: 'row', borderRadius: 12, backgroundColor: tone.field ?? c.surface, overflow: 'hidden' }}>
            {(['AM', 'PM'] as const).map(p => {
              const on = (h < 12) === (p === 'AM');
              return (
                <Pressable key={p} onPress={() => { if (!on) setMins(h * 60 + m + (p === 'AM' ? -720 : 720)); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 12, minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: on ? c.action : 'transparent' }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{p}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

const MiniCal = ({ iso, todayIso, onPick }: { iso: string; todayIso: string; onPick: (iso: string) => void }) => {
  const { c } = useTheme();
  const start = fromISO(iso || todayIso);
  const [ym, setYm] = useState<[number, number]>([start.getFullYear(), start.getMonth()]);
  // Follow the quick chips when they jump to another month.
  const [lastIso, setLastIso] = useState(iso);
  if (iso !== lastIso) { setLastIso(iso); const d = fromISO(iso); if (d.getFullYear() !== ym[0] || d.getMonth() !== ym[1]) setYm([d.getFullYear(), d.getMonth()]); }

  const [y, mo] = ym;
  const lead = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => { const d = new Date(y, mo + n, 1); setYm([d.getFullYear(), d.getMonth()]); };

  // Runs out to the panel's edges so a day is 44pt wide even on a 320pt phone.
  return (
    <View style={{ marginTop: 8, marginHorizontal: -14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chev-l" size={16} stroke={2} color={c.ink2} />
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink }}>{MONTH_NAMES[mo]} {y}</Text>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Next month" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chev-r" size={16} stroke={2} color={c.ink2} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '500', color: c.ink3, paddingVertical: 4 }}>{d}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
          const cellIso = toISO(new Date(y, mo, d));
          const on = cellIso === iso;
          const isToday = cellIso === todayIso;
          return (
            <Pressable key={i} onPress={() => onPick(cellIso)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${DOW3[fromISO(cellIso).getDay()]} ${shortDate(cellIso)}`} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? c.action : 'transparent', borderWidth: isToday && !on ? 1.5 : 0, borderColor: c.ink3,
              }}>
                <Text style={[{ fontSize: 15, fontWeight: on || isToday ? '600' : '400', color: on ? '#fff' : cellIso < todayIso ? c.ink3 : c.ink }, tnum]}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ── Bits ────────────────────────────────────────────────────────
const SmallChip = ({ label, on, onPress, grow }: { label: string; on: boolean; onPress: () => void; grow?: boolean }) => {
  const { c } = useTheme();
  const tone = useContext(HomeworkTone);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({
      flexGrow: grow ? 1 : 0, alignItems: 'center', justifyContent: 'center', height: 44, paddingHorizontal: 10, borderRadius: radii.sm,
      backgroundColor: on ? c.action : tone.field ?? c.surface, opacity: pressed ? 0.75 : 1,
    })}>
      <Text numberOfLines={1} style={[{ fontSize: 14, fontWeight: '500', color: on ? '#fff' : c.ink }, tnum]}>{label}</Text>
    </Pressable>
  );
};

const Stepper = ({ value, onMinus, onPlus, label }: { value: string; onMinus: () => void; onPlus: () => void; label: string }) => {
  const { c } = useTheme();
  const tone = useContext(HomeworkTone);
  const btn = { width: 36, height: 44, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: tone.field ?? c.surface }} accessibilityLabel={`${label} ${value}`}>
      <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel={`Earlier ${label}`} style={btn}><Icon name="minus" size={13} stroke={2} color={c.ink2} /></Pressable>
      <Text style={[{ fontSize: 16, fontWeight: '600', color: c.ink, minWidth: 24, textAlign: 'center' }, tnum]}>{value}</Text>
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel={`Later ${label}`} style={btn}><Icon name="plus" size={13} stroke={2} color={c.ink2} /></Pressable>
    </View>
  );
};
