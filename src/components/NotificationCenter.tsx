// Spartans — the notification centre. Opens from the bell on every screen.
//
// Sorted by what it wants from you, not just by date:
//   To do       friend requests (accept or decline right here) and homework
//               that's coming due (tick it off right here). Stays until done.
//   New         everything else you haven't read
//   Earlier     what you have, by day
//
// Around that: a gear for the settings, topic filters once there's enough to
// filter, today's event-day banner (tap to see it again), and one quiet line
// when phone notifications are off or paused.
//
// Tap a row to open the exact thing it's about. Swipe a row left to remove it
// (or use the screen reader's Remove action); anything done here can be undone
// from the bar at the bottom.
//
// Everything comes from useNotify(); this file only draws.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, LayoutAnimation, Modal, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G135, G155 } from '../theme';
import { Icon, Check, IconName } from './Icon';
import { Avatar } from './Avatar';
import { BadgeArt } from './BadgeArt';
import { dayLabel, useKindColor } from './HomeworkList';
import { HW_KIND_LABEL } from '../programs';
import { glow, wash } from './ProgramIcon';
import { BADGES } from '../badges';
import { toISO, fromISO } from '../calendar';
import { useNotifyPrefs } from '../settings';
import { useSocial, peerInitials, fullName, Request } from '../social';
import { useHomework } from '../stores';
import { useNotify } from '../notify/context';
import { TOPIC_LOOK, Notice, Topic } from '../notify/feed';
import { addDays, EventDay } from '../notify/eventDays';
import { NotifySheet } from '../screens/Settings';

type Palette = ReturnType<typeof useTheme>['c'];
type Filter = 'all' | Topic;
type Undo = { text: string; undo?: () => void; at: number };

const PAD = 16;
const TILE = 42;

const toneOf = (topic: Topic, c: Palette) => ({
  announcements: c.navy700, homework: c.crimson, classes: c.navy700, events: c.sky600,
  buzz: c.gold, friends: c.moss, badges: c.gold,
}[topic]);

const timeLabel = (at: number, now: number) => {
  const mins = Math.round((now - at) / 60_000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const d = new Date(at);
  const days = Math.round((fromISO(toISO(new Date(now))).getTime() - fromISO(toISO(d)).getTime()) / 86_400_000);
  if (days <= 1) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const GROUPS = ['Earlier today', 'Yesterday', 'This week', 'Older'];
const groupOf = (at: number, now: number) => {
  const today = toISO(new Date(now));
  const iso = toISO(new Date(at));
  if (iso === today) return GROUPS[0];
  if (iso === addDays(today, -1)) return GROUPS[1];
  if (iso > addDays(today, -7)) return GROUPS[2];
  return GROUPS[3];
};

const ease = () => {
  if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
};

// ── Pieces ───────────────────────────────────────────────────────
const NoticeIcon = ({ n }: { n: Notice }) => {
  const { c, mode } = useTheme();
  if (n.event) {
    return (
      <LinearGradient colors={n.event.template.colors as [string, string, ...string[]]} start={G135.start} end={G135.end}
        style={{ width: TILE, height: TILE, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={n.event.template.art} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </LinearGradient>
    );
  }
  const badge = n.badgeId ? BADGES.find(b => b.id === n.badgeId) : undefined;
  if (badge) return <View style={{ width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' }}><BadgeArt badge={badge} size={TILE} /></View>;
  const tone = glow(toneOf(n.topic, c), mode);
  return (
    <View style={{ width: TILE, height: TILE, borderRadius: 13, backgroundColor: wash(tone, mode === 'dark' ? 0.2 : 0.11), alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={n.icon} size={20} stroke={1.9} color={tone} />
    </View>
  );
};

const Dot = () => {
  const { c } = useTheme();
  return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.sky }} />;
};

// Drag a row left to take it off the list. Past a third of its width it goes.
const SwipeRow = ({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(width);
  const remove = useRef(onRemove);
  remove.current = onRemove;
  const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => g.numberActiveTouches === 1 && g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
    onPanResponderMove: (_e, g) => x.setValue(Math.min(0, g.dx + 10)),
    onPanResponderRelease: (_e, g) => {
      if (g.dx < -w.current / 3 || (g.vx < -0.8 && g.dx < -40)) {
        Animated.timing(x, { toValue: -w.current, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => remove.current());
      } else back();
    },
    onPanResponderTerminate: back,
    onPanResponderTerminationRequest: () => false,
  })).current;
  return (
    <View onLayout={e => { w.current = e.nativeEvent.layout.width; }} style={{ overflow: 'hidden' }}>
      <Animated.View style={[StyleSheet.absoluteFill, {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, paddingRight: 20, backgroundColor: c.crimson,
        opacity: x.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
      }]}>
        <Icon name="trash" size={17} stroke={2} color="#fff" />
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#fff' }}>Remove</Text>
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{ backgroundColor: c.surface, transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
};

// The part every row shares: icon, words, and what sits on the right.
const Line = ({ icon, title, body, top, right, strong, label, hint, onPress, onRemove }: {
  icon: React.ReactNode; title: string; body?: React.ReactNode; top?: boolean; right?: React.ReactNode; strong: boolean; label: string; hint: string; onPress: () => void; onRemove?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityActions={onRemove ? [{ name: 'remove', label: 'Remove' }] : undefined}
      onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'remove') onRemove?.(); }}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: top ? 'flex-start' : 'center', gap: 12, minHeight: 66, paddingVertical: 11, paddingLeft: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontSize: 15.5, lineHeight: 20, fontWeight: strong ? '700' : '500', letterSpacing: -0.2, color: strong ? c.ink : c.ink2 }}>{title}</Text>
        {!!body && <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 18, color: c.ink3, marginTop: 2 }}>{body}</Text>}
      </View>
      {right}
    </Pressable>
  );
};

// A plain notice: time on the right, a dot under it while it's unread.
const NoticeRow = ({ n, unread, now, onPress, onRemove }: { n: Notice; unread: boolean; now: number; onPress: () => void; onRemove: () => void }) => {
  const { c } = useTheme();
  const title = n.later && now > n.later.after ? n.later.title : n.title;
  return (
    <SwipeRow onRemove={onRemove}>
      <Line
        top
        icon={<NoticeIcon n={n} />}
        title={title}
        body={n.body}
        strong={unread}
        label={`${unread ? 'Unread. ' : ''}${title}. ${n.body}`}
        hint="Opens it"
        onPress={onPress}
        onRemove={onRemove}
        right={(
          <View style={{ alignSelf: 'stretch', alignItems: 'flex-end', gap: 8, paddingTop: 2, paddingRight: 14 }}>
            <Text style={[{ fontSize: 12.5, color: unread ? c.ink2 : c.ink3, fontWeight: unread ? '600' : '400' }, tnum]}>{timeLabel(n.at, now)}</Text>
            {unread && <Dot />}
          </View>
        )}
      />
    </SwipeRow>
  );
};

// Homework coming due: says when, in today's words, with a tick to finish it.
const HomeworkRow = ({ n, todayIso, unread, onPress, onDone, onRemove }: {
  n: Notice; todayIso: string; unread: boolean; onPress: () => void; onDone: () => void; onRemove: () => void;
}) => {
  const { c } = useTheme();
  const h = n.homework!;
  const day = dayLabel(h.due, todayIso);
  const kindColor = useKindColor();
  const kind = h.kind ? HW_KIND_LABEL[h.kind] : '';
  const when = `${kind ? `${kind} due` : 'Due'} ${day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day}`;
  return (
    <SwipeRow onRemove={onRemove}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Line
          icon={<NoticeIcon n={n} />}
          title={h.title}
          body={(
            <>
              {!!h.kind && <Text style={{ fontWeight: '700', color: kindColor(h.kind) }}>{kind}</Text>}
              {when.slice(kind.length)}{h.where ? ` · ${h.where}` : ''}
            </>
          )}
          strong={unread}
          label={`${unread ? 'Unread. ' : ''}${h.title}. ${when}. ${h.where}`}
          hint="Opens it in Homework"
          onPress={onPress}
          onRemove={onRemove}
        />
        <Pressable onPress={onDone} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Done: ${h.title}`}
          style={({ pressed }) => ({ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
          {({ pressed }) => (
            <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: c.ink3, backgroundColor: pressed ? c.ink3 : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {pressed && <Check size={13} color={c.surface} width={3.5} />}
            </View>
          )}
        </Pressable>
      </View>
    </SwipeRow>
  );
};

// A friend request, answered where it is.
const RequestRow = ({ n, r, unread, busy, onPress, onAnswer }: {
  n: Notice; r: Request; unread: boolean; busy: boolean; onPress: () => void; onAnswer: (accept: boolean) => void;
}) => {
  const { c } = useTheme();
  const name = fullName(r.peer);
  const btn = (text: string, main: boolean, accept: boolean) => (
    <Pressable onPress={() => onAnswer(accept)} disabled={busy} accessibilityRole="button" accessibilityLabel={`${text} ${name}`} accessibilityState={{ disabled: busy }}
      style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: main ? c.action : c.paper2, opacity: pressed ? 0.75 : 1 })}>
      <Text style={{ fontSize: 14.5, fontWeight: '700', color: main ? '#fff' : c.ink2 }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={{ backgroundColor: c.surface, opacity: busy ? 0.5 : 1 }}>
      <Line
        icon={<Avatar spec={r.peer.avatar} uri={r.peer.photo} initials={peerInitials(r.peer)} size={TILE} />}
        title={n.title}
        body={`Grade ${r.peer.grade}`}
        strong={unread}
        label={`${unread ? 'Unread. ' : ''}${n.title}. Grade ${r.peer.grade}`}
        hint="Opens it in Social"
        onPress={onPress}
        right={unread ? <View style={{ paddingRight: 16 }}><Dot /></View> : undefined}
      />
      <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 14 + TILE + 12, paddingRight: 14, paddingBottom: 13 }}>
        {btn('Decline', false, false)}
        {btn('Accept', true, true)}
      </View>
    </View>
  );
};

// Rows on one surface, hairlines lined up with the words.
const Group = ({ title, action, onAction, rows }: { title: string; action?: string; onAction?: () => void; rows: React.ReactElement[] }) => {
  const { c } = useTheme();
  if (!rows.length) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: 4 }}>
        <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: c.ink }}>{title}</Text>
        {!!action && (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>{action}</Text>
          </Pressable>
        )}
      </View>
      <View style={[{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, shadow.sm]}>
        {rows.map((row, i) => (
          <View key={row.key}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: 14 + TILE + 12 }} />}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
};

const Chip = ({ label, icon, on, count, onPress }: { label: string; icon?: IconName; on: boolean; count: number; onPress: () => void }) => {
  const { c } = useTheme();
  const fg = on ? '#fff' : c.ink2;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${label}${count ? `, ${count} new` : ''}`} hitSlop={{ top: 5, bottom: 5 }}
      style={({ pressed }) => ({
        height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, borderRadius: 18,
        backgroundColor: on ? c.action : c.surface, borderWidth: 1, borderColor: on ? c.action : c.line, opacity: pressed ? 0.8 : 1,
      })}>
      {!!icon && <Icon name={icon} size={14} stroke={2} color={on ? '#fff' : c.ink3} />}
      <Text style={{ fontSize: 14, fontWeight: '600', color: fg }}>{label}</Text>
      {count > 0 && <Text style={[{ fontSize: 13, fontWeight: '700', color: on ? '#fff' : c.link }, tnum]}>{count}</Text>}
    </Pressable>
  );
};

// One line when the phone isn't getting these, with the button that fixes it.
const PhoneLine = ({ paused, onResume }: { paused: boolean; onResume: () => void }) => {
  const { c } = useTheme();
  const { permission, requestPermission } = useNotify();
  const off = permission === 'undetermined' || permission === 'denied';
  if (!paused && !off) return null;
  const text = paused ? 'Paused. Nothing reaches your phone.'
    : permission === 'denied' ? 'Off in your phone\'s Settings.' : 'Get these on your lock screen';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingLeft: 14, paddingRight: 8, borderRadius: 16, backgroundColor: c.skyTint }}>
      <Icon name={paused ? 'moon' : 'bell'} size={19} stroke={2} color={c.link} />
      <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 19, fontWeight: '500', color: c.ink }}>{text}</Text>
      <Pressable onPress={paused ? onResume : requestPermission} accessibilityRole="button" hitSlop={4}
        style={({ pressed }) => ({ height: 40, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.action, opacity: pressed ? 0.8 : 1 })}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{paused ? 'Resume' : permission === 'denied' ? 'Settings' : 'Turn on'}</Text>
      </Pressable>
    </View>
  );
};

// Today's event days: tap to see the banner again.
const TodayCard = ({ d, onPress }: { d: EventDay; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Today: ${d.title}. Show banner`}
    style={({ pressed }) => [{ borderRadius: 18, overflow: 'hidden', opacity: pressed ? 0.9 : 1 }, shadow.sm]}>
    <LinearGradient colors={d.template.colors as [string, string, ...string[]]} start={G155.start} end={G155.end}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68, paddingVertical: 10, paddingHorizontal: 14 }}>
      <Image source={d.template.art} style={{ width: 44, height: 44 }} resizeMode="contain" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}>{d.title}</Text>
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, marginTop: 1 }}>{['Today', ...d.chips].join(' · ')}</Text>
      </View>
      <Icon name="chev-r" size={16} stroke={2.2} color="#fff" />
    </LinearGradient>
  </Pressable>
);

// What just happened, and the way back.
const UndoBar = ({ u, onClose }: { u: Undo; onClose: () => void }) => {
  const { c, mode } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    AccessibilityInfo.announceForAccessibility(u.text);
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [u.at]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[{
      position: 'absolute', left: 16, right: 16, bottom: 30, minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6,
      borderRadius: 16, backgroundColor: mode === 'dark' ? '#263243' : c.navy900, opacity: a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
    }, shadow.lg]}>
      <Text numberOfLines={2} style={{ flex: 1, fontSize: 14.5, fontWeight: '500', color: '#fff', paddingVertical: 8 }}>{u.text}</Text>
      {!!u.undo && (
        <Pressable onPress={() => { ease(); u.undo!(); onClose(); }} accessibilityRole="button" accessibilityLabel="Undo"
          style={({ pressed }) => ({ height: 44, paddingHorizontal: 14, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 14.5, fontWeight: '700', color: '#8FBDF0' }}>Undo</Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

const RoundBtn = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper2, opacity: pressed ? 0.6 : 1 })}>
      {icon}
    </Pressable>
  );
};

// ── Sheet ────────────────────────────────────────────────────────
export const NotificationCenter = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const prefsApi = useNotifyPrefs();
  const { notices, isRead, unread, markRead, markAllRead, dismiss, restore, open, now, today, showBanner } = useNotify();
  const social = useSocial();
  const hw = useHomework();
  const [filter, setFilter] = useState<Filter>('all');
  const [settings, setSettings] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [bar, setBar] = useState<Undo | null>(null);
  const todayIso = toISO(new Date(now));
  const say = (text: string, undo?: () => void) => setBar({ text, undo, at: Date.now() });

  useEffect(() => { if (!visible) { setFilter('all'); setBar(null); } }, [visible]);

  // Today's banner has its own card on top, so its notice would say it twice.
  const all = useMemo(() => {
    const shown = new Set(today.map(d => `day:${d.key}`));
    return notices.filter(n => !shown.has(n.id));
  }, [notices, today]);
  const topics = useMemo(() => (Object.keys(TOPIC_LOOK) as Topic[]).filter(t => all.some(n => n.topic === t)), [all]);
  const filtering = topics.length > 1 && (all.length > 6 || filter !== 'all');
  useEffect(() => { if (filter !== 'all' && !topics.includes(filter)) setFilter('all'); }, [filter, topics]);

  const list = all.filter(n => filter === 'all' || n.topic === filter);
  // A test has two reminders (3 days before and the night before): one row.
  const seenHw = new Set<string>();
  const todo: Notice[] = [];
  const rest: Notice[] = [];
  for (const n of list) {
    if (n.homework) {
      if (seenHw.has(n.homework.id)) continue;
      seenHw.add(n.homework.id);
      todo.push(n);
    } else if (n.requestId && social.requests.some(r => r.id === n.requestId)) todo.push(n);
    else rest.push(n);
  }
  // Requests first (someone's waiting), then homework by due date.
  todo.sort((a, b) => Number(!!a.homework) - Number(!!b.homework) || (a.homework?.due || '').localeCompare(b.homework?.due || '') || b.at - a.at);
  const fresh = rest.filter(n => !isRead(n));
  const old = rest.filter(isRead);
  const groups = GROUPS.map(g => ({ g, items: old.filter(n => groupOf(n.at, now) === g) })).filter(x => x.items.length);
  const banners = filter === 'all' || filter === 'events' ? today : [];
  const empty = !todo.length && !rest.length;

  const remove = (n: Notice) => {
    // Both reminders for the same test go together.
    const ids = n.homework ? notices.filter(x => x.homework?.id === n.homework!.id).map(x => x.id) : [n.id];
    ease();
    dismiss(ids);
    say('Removed', () => restore(ids));
  };
  const clear = (ids: string[]) => { ease(); dismiss(ids); say(`Cleared ${ids.length}`, () => restore(ids)); };
  const finish = (n: Notice) => {
    const h = n.homework!;
    ease();
    notices.filter(x => x.homework?.id === h.id).forEach(x => markRead(x.id));
    hw.toggle(h.id, todayIso);
    say(`Done: ${h.title}`, () => hwRef.current.toggle(h.id, todayIso));
  };
  const hwRef = useRef(hw);
  hwRef.current = hw;   // Undo has to see it as done, not as it was when tapped
  const answer = async (n: Notice, r: Request, accept: boolean) => {
    setBusy(r.id);
    try {
      await social.respond(r, accept);
      markRead(n.id);
      ease();
      say(accept ? `You and ${r.peer.firstName} are friends` : 'Request declined');
    } catch (e: any) {
      say(String(e?.message || 'Could not answer that. Try again.'));
    } finally { setBusy(null); }
  };

  const row = (n: Notice) => <NoticeRow key={n.id} n={n} unread={!isRead(n)} now={now} onPress={() => open(n)} onRemove={() => remove(n)} />;
  const todoRow = (n: Notice) => {
    const r = n.requestId ? social.requests.find(x => x.id === n.requestId) : undefined;
    return r
      ? <RequestRow key={n.id} n={n} r={r} unread={!isRead(n)} busy={busy === r.id} onPress={() => open(n)} onAnswer={yes => answer(n, r, yes)} />
      : <HomeworkRow key={n.id} n={n} todayIso={todayIso} unread={!isRead(n)} onPress={() => open(n)} onDone={() => finish(n)} onRemove={() => remove(n)} />;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: PAD + 4, paddingTop: 10, paddingBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, letterSpacing: -0.6, color: c.ink }}>Notifications</Text>
            <Text style={[{ fontSize: 14, color: c.ink3 }, tnum]}>{unread ? `${unread} new` : 'All caught up'}</Text>
          </View>
          <RoundBtn icon={<SettingsGlyph color={c.ink2} />} label="Notification settings" onPress={() => setSettings(true)} />
          <RoundBtn icon={<Icon name="close" size={16} stroke={2.2} color={c.ink2} />} label="Close" onPress={onClose} />
        </View>

        {filtering && (
          <View style={{ paddingBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: PAD }}>
              <Chip label="All" on={filter === 'all'} count={0} onPress={() => setFilter('all')} />
              {topics.map(t => (
                <Chip key={t} label={TOPIC_LOOK[t].label} icon={TOPIC_LOOK[t].icon} on={filter === t}
                  count={all.filter(n => n.topic === t && !isRead(n)).length} onPress={() => setFilter(filter === t ? 'all' : t)} />
              ))}
            </ScrollView>
          </View>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 110, gap: 14 }} showsVerticalScrollIndicator={false}>
          {filter === 'all' && <PhoneLine paused={prefsApi.prefs.paused} onResume={() => prefsApi.setPaused(false)} />}
          {banners.map(d => <TodayCard key={d.key} d={d} onPress={() => showBanner(d)} />)}

          <Group title="To do" rows={todo.map(todoRow)} />
          <Group title="New" action="Mark all read" onAction={() => { ease(); markAllRead(); }} rows={fresh.map(row)} />
          {groups.map(({ g, items }, i) => (
            <Group key={g} title={g} action={i === 0 ? 'Clear read' : undefined} onAction={() => clear(old.map(n => n.id))} rows={items.map(row)} />
          ))}

          {empty && (
            <View style={{ alignItems: 'center', paddingTop: 56, paddingHorizontal: 24 }}>
              <Image source={require('../../assets/homework/checkmark.png')} style={{ width: 88, height: 88 }} resizeMode="contain" />
              <Text style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: c.ink, marginTop: 14 }}>All caught up</Text>
              <Text style={{ fontSize: 14.5, lineHeight: 21, color: c.ink3, textAlign: 'center', maxWidth: 280, marginTop: 5 }}>
                Homework coming due, school news, friend requests and badges land here.
              </Text>
            </View>
          )}
        </ScrollView>

        {!!bar && <UndoBar u={bar} onClose={() => setBar(null)} />}
        <NotifySheet visible={settings} onClose={() => setSettings(false)} notify={prefsApi} />
      </View>
    </Modal>
  );
};

// Two sliders: the settings mark (the icon set has no gear).
const SettingsGlyph = ({ color }: { color: string }) => {
  const line = (knob: number) => (
    <View style={{ width: 16, height: 6, justifyContent: 'center' }}>
      <View style={{ height: 2, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: knob, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
  return <View style={{ gap: 4 }}>{line(8)}{line(2)}</View>;
};
