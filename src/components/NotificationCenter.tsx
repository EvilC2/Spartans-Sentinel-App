// Spartans — the notification centre. Opens from the bell on every screen.
//
// Top to bottom:
//   header        title, "Mark all read", Done
//   filters       All · Unread · one chip per topic that has something
//   phone card    "Get these on your lock screen" until notifications are on
//   today         today's event-day banner(s), tap to see it again
//   list          grouped Today / Yesterday / This week / Earlier; unread rows
//                 are tinted with a dot. Tap opens the thing it's about;
//                 long-press removes it.
//   footer        Notification settings (the same sheet as Settings)
//
// Everything comes from useNotify(); this file only draws.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, G135, G155 } from '../theme';
import { Icon } from './Icon';
import { BadgeArt } from './BadgeArt';
import { BADGES } from '../badges';
import { toISO, fromISO } from '../calendar';
import { ask } from '../confirm';
import { useNotifyPrefs } from '../settings';
import { useNotify } from '../notify/context';
import { TOPIC_LOOK, Notice, Topic } from '../notify/feed';
import { addDays } from '../notify/eventDays';
import { NotifySheet } from '../screens/Settings';

type Palette = ReturnType<typeof useTheme>['c'];
type Filter = 'all' | 'unread' | Topic;

const tintFor = (topic: Topic, c: Palette) => ({
  announcements: { bg: c.navy50, fg: c.navy700 },
  homework: { bg: c.crimsonTint, fg: c.crimson },
  classes: { bg: c.navy50, fg: c.navy700 },
  events: { bg: c.skyTint, fg: c.sky600 },
  buzz: { bg: c.goldTint, fg: c.gold },
  friends: { bg: c.navy50, fg: c.moss },
  badges: { bg: c.goldTint, fg: c.gold },
}[topic]);

const timeLabel = (at: number, now: number) => {
  const mins = Math.round((now - at) / 60_000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const d = new Date(at);
  const days = Math.round((fromISO(toISO(new Date(now))).getTime() - fromISO(toISO(d)).getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const groupOf = (at: number, now: number) => {
  const today = toISO(new Date(now));
  const iso = toISO(new Date(at));
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso > addDays(today, -7)) return 'This week';
  return 'Earlier';
};
const GROUPS = ['Today', 'Yesterday', 'This week', 'Earlier'];

// ── Pieces ───────────────────────────────────────────────────────
const NoticeIcon = ({ n }: { n: Notice }) => {
  const { c } = useTheme();
  if (n.event) {
    return (
      <LinearGradient colors={n.event.template.colors as [string, string, ...string[]]} start={G135.start} end={G135.end}
        style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={n.event.template.art} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </LinearGradient>
    );
  }
  const badge = n.badgeId ? BADGES.find(b => b.id === n.badgeId) : undefined;
  if (badge) {
    return <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}><BadgeArt badge={badge} size={42} /></View>;
  }
  const t = tintFor(n.topic, c);
  return (
    <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={n.icon} size={19} stroke={1.9} color={t.fg} />
    </View>
  );
};

const Row = ({ n, unread, last, now, onPress, onRemove }: {
  n: Notice; unread: boolean; last: boolean; now: number; onPress: () => void; onRemove: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onRemove}
      delayLongPress={380}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}
      accessibilityHint="Long press to remove"
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14,
        backgroundColor: pressed ? c.paper2 : unread ? c.skyTint : 'transparent',
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line2,
      })}
    >
      <View>
        <NoticeIcon n={n} />
        {unread && <View style={{ position: 'absolute', left: -5, top: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: c.sky, borderWidth: 2, borderColor: c.surface }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 14.5, lineHeight: 19, fontWeight: unread ? '700' : '500', color: unread ? c.ink : c.ink2, letterSpacing: -0.1 }}>{n.title}</Text>
          <Text style={{ fontSize: 12, color: unread ? c.sky600 : c.ink4, fontWeight: unread ? '600' : '400' }}>{timeLabel(n.at, now)}</Text>
        </View>
        {!!n.body && <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, color: c.ink3, marginTop: 2 }}>{n.body}</Text>}
      </View>
    </Pressable>
  );
};

const Chip = ({ label, on, onPress, count }: { label: string; on: boolean; onPress: () => void; count?: number }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
        backgroundColor: on ? c.navy700 : c.surface, borderWidth: 1, borderColor: on ? c.navy700 : c.line,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{label}</Text>
      {!!count && (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: on ? 'rgba(255,255,255,0.25)' : c.sky, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
};

// Soft ask before the system prompt, so the one-shot prompt isn't wasted.
const PhoneCard = () => {
  const { permission, requestPermission } = useNotify();
  if (permission === 'granted' || permission === 'unsupported') return null;
  const denied = permission === 'denied';
  return (
    <LinearGradient colors={['#4FA3E8', '#2E74BD']} start={G135.start} end={G135.end} style={[{ borderRadius: 18, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }, shadow.md]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" size={22} stroke={2} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Get these on your lock screen</Text>
        <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>
          {denied ? 'Notifications are off for Spartans in your phone\'s Settings.' : 'Homework the night before, days off, and snow days the moment they\'re called.'}
        </Text>
      </View>
      <Pressable onPress={requestPermission} accessibilityRole="button"
        style={({ pressed }) => ({ backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ color: '#2E74BD', fontWeight: '700', fontSize: 14 }}>{denied ? 'Settings' : 'Turn on'}</Text>
      </Pressable>
    </LinearGradient>
  );
};

// Today's event days: tap to see the banner again.
const TodayCards = () => {
  const { today, showBanner } = useNotify();
  if (!today.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {today.map(d => (
        <Pressable key={d.key} onPress={() => showBanner(d)} accessibilityRole="button" accessibilityLabel={`Today: ${d.title}. Show banner`}
          style={({ pressed }) => [{ borderRadius: 18, overflow: 'hidden', opacity: pressed ? 0.9 : 1 }, shadow.md]}>
          <LinearGradient colors={d.template.colors as [string, string, ...string[]]} start={G155.start} end={G155.end}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <Image source={d.template.art} style={{ width: 46, height: 46 }} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>Today</Text>
              <Text style={{ color: '#fff', fontFamily: fonts.serif, fontSize: 21 }}>{d.title}</Text>
            </View>
            <Icon name="chev-r" size={18} stroke={2} color="#fff" />
          </LinearGradient>
        </Pressable>
      ))}
    </View>
  );
};

// ── Sheet ────────────────────────────────────────────────────────
export const NotificationCenter = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const notify = useNotify();
  const prefsApi = useNotifyPrefs();
  const { notices, isRead, unread, markAllRead, dismiss, open, now } = notify;
  const [filter, setFilter] = useState<Filter>('all');
  const [settings, setSettings] = useState(false);

  const topics = useMemo(() => (Object.keys(TOPIC_LOOK) as Topic[]).filter(t => notices.some(n => n.topic === t)), [notices]);
  const shown = notices.filter(n => filter === 'all' ? true : filter === 'unread' ? !isRead(n) : n.topic === filter);
  const groups = GROUPS.map(g => ({ g, list: shown.filter(n => groupOf(n.at, now) === g) })).filter(x => x.list.length);

  const remove = async (n: Notice) => {
    if (await ask('Remove this notification?', n.title, 'Remove')) dismiss(n.id);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, paddingBottom: 60, gap: 14 }} stickyHeaderIndices={[1]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: c.ink }}>Notifications</Text>
              <Text style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>
                {prefsApi.prefs.paused ? 'Paused: nothing reaches your phone' : unread ? `${unread} new` : 'All caught up'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={{ fontSize: 15, color: c.navy700, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>

          {/* Sticky filter bar */}
          <View style={{ backgroundColor: c.paper, marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 6 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
              <Chip label="All" on={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label="Unread" on={filter === 'unread'} onPress={() => setFilter('unread')} count={unread} />
              {topics.map(t => <Chip key={t} label={TOPIC_LOOK[t].label} on={filter === t} onPress={() => setFilter(t)} />)}
            </ScrollView>
          </View>

          <PhoneCard />
          {filter === 'all' && <TodayCards />}

          {groups.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
              <Image source={require('../../assets/homework/checkmark.png')} style={{ width: 84, height: 84 }} resizeMode="contain" />
              <Text style={{ fontSize: 17, fontWeight: '600', color: c.ink }}>{filter === 'unread' ? 'Nothing new' : 'Nothing here yet'}</Text>
              <Text style={{ fontSize: 13, color: c.ink3, textAlign: 'center', maxWidth: 260 }}>
                Homework reminders, school news, friend requests and badges show up here.
              </Text>
            </View>
          ) : groups.map(({ g, list }) => (
            <View key={g} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: c.ink3 }}>{g}</Text>
                {g === groups[0].g && unread > 0 && (
                  <Pressable onPress={markAllRead} hitSlop={8} accessibilityRole="button">
                    <Text style={{ fontSize: 13, color: c.navy700, fontWeight: '600' }}>Mark all read</Text>
                  </Pressable>
                )}
              </View>
              <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
                {list.map((n, i) => (
                  <Row key={n.id} n={n} unread={!isRead(n)} last={i === list.length - 1} now={now}
                    onPress={() => open(n)} onRemove={() => remove(n)} />
                ))}
              </View>
            </View>
          ))}

          <Pressable onPress={() => setSettings(true)} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
            <Icon name="bell" size={16} stroke={1.9} color={c.ink3} />
            <Text style={{ fontSize: 14, color: c.ink3, fontWeight: '600' }}>Notification settings</Text>
          </Pressable>
        </ScrollView>
        <NotifySheet visible={settings} onClose={() => setSettings(false)} notify={prefsApi} />
      </View>
    </Modal>
  );
};
