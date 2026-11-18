// Spartans — XP dashboard. Opens from the XP bar on Home and Profile. XP only:
// badges have their own sheet behind the badge icon.
//
// The rank header stays on top: emblem with a ring to the next level, level,
// rank, the bar, and how long the next level will take at this pace. Under it,
// three tabs, each with one job:
//   Today     What can I still earn? Every way to earn with what is really on
//             offer right now (open trivia, unread posts, open homework, daily
//             limits). A row that has something on offer goes there.
//   Progress  How am I doing? Rank road, XP per day over 7 or 30 days, where the
//             XP came from, personal records.
//   History   What did I earn? Every entry, by day, filtered by kind.
//
// All numbers come from src/xp.ts. Charts are one hue (XP gold) with text labels:
// the kind colours are only on icon tiles, next to their names, so nothing is
// told by colour alone.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../ThemeContext';
import { fonts, tnum, G165, G90 } from '../theme';
import { Icon, IconName } from './Icon';
import { RankEmblem } from './RankEmblem';
import { glow } from './ProgramIcon';
import { useEarnedVersion } from '../earned';
import { useContent } from '../content';
import { useHomework } from '../stores';
import { useNav } from '../nav';
import type { TabId } from './Chrome';
import {
  levelState, xpLog, xpStats, xpDays, bestXpDay, nextCheckInXp, useXpVersion, isoOf, XpKind, XpEntry, XpStats, LevelState,
  KIND_LABEL, DAILY_CAP, GRADE_XP, XP, RANKS, rankIndex, rankFor, nextRank,
} from '../xp';

const KIND_ICON: Record<XpKind, IconName> = { daily: 'sun', trivia: 'sparkle', poll: 'chart', homework: 'tasks', read: 'news', badge: 'badge', grade: 'grad' };
export const KIND_COLOR: Record<XpKind, string> = {
  daily: '#E89A2C', trivia: '#8E5BE8', poll: '#3B8BD9', homework: '#4E9A4A', read: '#2A8C9C', badge: '#D2544A', grade: '#2A5687',
};
const KINDS: XpKind[] = ['daily', 'trivia', 'poll', 'homework', 'read', 'badge', 'grade'];
const FIRE = require('../../assets/homework/fire.png');
const FLAME = '#E0641F';
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HISTORY_PAGE = 40;

type Tab = 'today' | 'progress' | 'history';
const TABS: [Tab, string][] = [['today', 'Today'], ['progress', 'Progress'], ['history', 'History']];

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const XpSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const nav = useNav();
  const v = useXpVersion();
  const e = useEarnedVersion();
  const [tab, setTab] = useState<Tab>('today');
  useEffect(() => { if (visible) setTab('today'); }, [visible]);
  const lv = levelState();
  const st = useMemo(() => xpStats(), [v, e, visible]);
  const go = (t: TabId) => { onClose(); nav.go(t); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <Hero lv={lv} st={st} visible={visible} onClose={onClose} />
          <View style={{ backgroundColor: c.paper, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Segmented options={TABS} value={tab} onChange={setTab} />
          </View>
          <View>
            {tab === 'today' && <TodayTab st={st} onGo={go} />}
            {tab === 'progress' && <ProgressTab lv={lv} st={st} version={v + e} />}
            {tab === 'history' && <HistoryTab version={v + e} />}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

// ── Rank header ─────────────────────────────────────────────────
const Hero = ({ lv, st, visible, onClose }: { lv: LevelState; st: XpStats; visible: boolean; onClose: () => void }) => {
  const rank = rankFor(lv.level);
  const nr = nextRank(lv.level);
  const fill = useRef(new Animated.Value(lv.progress)).current;

  // The bar fills on open, because this is the one moment it is worth watching.
  useEffect(() => {
    if (!visible) return;
    let live = true;
    fill.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(calm => {
      if (!live) return;
      if (calm) { fill.setValue(lv.progress); return; }
      Animated.timing(fill, { toValue: lv.progress, duration: 700, delay: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    });
    return () => { live = false; };
  }, [visible, lv.progress]);

  // Last two weeks' average, so one big day doesn't promise too much.
  const perDay = st.last14.reduce((a, d) => a + d.xp, 0) / st.last14.length;
  const daysLeft = perDay > 0 ? Math.ceil(lv.toNext / perDay) : 0;
  const pace = !daysLeft || daysLeft > 180 ? null : daysLeft === 1 ? 'About a day at your pace.' : `About ${daysLeft} days at your pace.`;
  const footnote = [pace, nr ? `${nr.title} at Level ${nr.level}.` : null].filter(Boolean).join(' ');

  return (
    <LinearGradient colors={['#0B1626', '#14304E']} start={G165.start} end={G165.end} style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden' }}>
      <Svg width={320} height={320} style={{ position: 'absolute', top: -96, left: -70 }}>
        <Defs>
          <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={rank.glow} stopOpacity={0.5} />
            <Stop offset="1" stopColor={rank.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={160} cy={160} r={160} fill="url(#heroGlow)" />
      </Svg>

      <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => ({
        position: 'absolute', top: 14, right: 14, zIndex: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)',
        alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
      })}>
        <Icon name="close" size={15} stroke={2} color="#fff" />
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 28 }}>
        <RankEmblem rank={rank} level={lv.level} size={92} ring={lv.progress} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 34, lineHeight: 39, fontWeight: '800', color: '#fff', letterSpacing: -1 }}>Level {lv.level}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, color: rank.colors[0] }}>{rank.title}</Text>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{lv.xp.toLocaleString()} XP total</Text>
        </View>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: lv.span, now: lv.into }}
        accessibilityLabel={`${lv.into} of ${lv.span} XP to level ${lv.level + 1}`}
        style={{ marginTop: 16, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}
      >
        <Animated.View style={{ height: '100%', borderRadius: 5, overflow: 'hidden', width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}>
          <LinearGradient colors={[rank.colors[0], rank.glow]} start={G90.start} end={G90.end} style={{ flex: 1 }} />
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <Text style={[{ flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: '#fff' }, tnum]}>{lv.toNext.toLocaleString()} XP to Level {lv.level + 1}</Text>
        <Text style={[{ fontSize: 13, lineHeight: 19, fontWeight: '600', color: 'rgba(255,255,255,0.72)' }, tnum]}>{lv.into.toLocaleString()} / {lv.span.toLocaleString()}</Text>
      </View>
      {!!footnote && <Text style={[{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: 'rgba(255,255,255,0.72)', marginTop: 2 }, tnum]}>{footnote}</Text>}
    </LinearGradient>
  );
};

// ── Today ───────────────────────────────────────────────────────
type Earn = { kind: XpKind; label: string; sub: string; reward: string; left: number; go?: TabId };

const TodayTab = ({ st, onGo }: { st: XpStats; onGo: (t: TabId) => void }) => {
  const { c, mode } = useTheme();
  const { live, inPlace, mine } = useContent();
  const hw = useHomework();
  const counts = st.todayCounts;

  const triviaOpen = live('trivia', 'buzz').filter(p => mine(p.id).choice === undefined).length;
  const pollsOpen = live('poll', 'buzz').filter(p => mine(p.id).choice === undefined).length;
  const hwOpen = hw.items.filter(h => !h.done).length;
  const unread = inPlace('news').filter(p => p.kind === 'news' && !mine(p.id).opens).length;
  const roomFor = (kind: XpKind) => Math.max(0, (DAILY_CAP[kind] ?? Infinity) - counts[kind]);
  const hwCan = Math.min(roomFor('homework'), hwOpen);
  const readCan = Math.min(roomFor('read'), unread);
  const capped = (kind: XpKind) => roomFor(kind) === 0;

  const rows: Earn[] = [
    {
      kind: 'trivia', label: 'Answer the trivia', reward: `+${XP.triviaRight}${triviaOpen > 1 ? ' each' : ''}`, left: triviaOpen * XP.triviaRight, go: triviaOpen ? 'home' : undefined,
      sub: triviaOpen ? `${plural(triviaOpen, 'question')} waiting. A wrong guess still gets +${XP.triviaWrong}` : counts.trivia ? 'Answered today' : 'No new question right now',
    },
    {
      kind: 'poll', label: 'Vote in a poll', reward: `+${XP.poll} each`, left: pollsOpen * XP.poll, go: pollsOpen ? 'home' : undefined,
      sub: pollsOpen ? `${plural(pollsOpen, 'poll')} open` : counts.poll ? 'Voted today' : 'None open right now',
    },
    {
      kind: 'homework', label: 'Finish homework', reward: `+${XP.homework} each`, left: hwCan * XP.homework, go: hwCan ? 'homework' : undefined,
      sub: capped('homework') ? `Daily limit reached, ${DAILY_CAP.homework} finished` : hwOpen ? `${counts.homework} of ${DAILY_CAP.homework} today. ${hwOpen} open` : counts.homework ? `${counts.homework} finished today` : 'Nothing open',
    },
    {
      kind: 'read', label: 'Read announcements', reward: `+${XP.read} each`, left: readCan * XP.read, go: readCan ? 'announcements' : undefined,
      sub: capped('read') ? `Daily limit reached, ${DAILY_CAP.read} read` : unread ? `${counts.read} of ${DAILY_CAP.read} today. ${unread} unread` : counts.read ? `${counts.read} read today` : 'Nothing unread',
    },
  ];
  // What can be done now first, then the ones with nothing on offer.
  const sorted = [...rows.filter(r => r.left > 0), ...rows.filter(r => r.left === 0)];
  const left = rows.reduce((a, r) => a + r.left, 0);
  const whole = st.today + left;
  const gold = glow(c.gold, mode);

  return (
    <View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: c.ink, letterSpacing: -0.8 }}>+{st.today.toLocaleString()} XP</Text>
          <Text style={{ flexShrink: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: left ? c.ink2 : c.ink3 }}>
            {left ? `${left.toLocaleString()} more up for grabs` : st.today ? 'All done for now' : 'Nothing on offer yet'}
          </Text>
        </View>
        {whole > 0 && (
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: whole, now: st.today }}
            accessibilityLabel={`${st.today} of ${whole} XP on offer today`}
            style={{ marginTop: 8, height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}
          >
            <View style={{ width: `${(st.today / whole) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: gold }} />
          </View>
        )}
      </View>

      <View style={{ marginHorizontal: 14, marginTop: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, overflow: 'hidden' }}>
        {sorted.map((r, i) => <EarnRow key={r.kind} r={r} earned={counts[r.kind] > 0} first={i === 0} onGo={onGo} />)}
      </View>

      <Streak st={st} />

      <Text style={[{ paddingHorizontal: 20, marginTop: 18, fontSize: 13, lineHeight: 19, color: c.ink3 }, tnum]}>
        Badges pay +10 to +400, more for rarer ones. Moving up a grade pays +{GRADE_XP.toLocaleString()} every September.
      </Text>
    </View>
  );
};

const EarnRow = ({ r, earned, first, onGo }: { r: Earn; earned: boolean; first: boolean; onGo: (t: TabId) => void }) => {
  const { c } = useTheme();
  const col = KIND_COLOR[r.kind];
  const done = earned && r.left === 0;
  const idle = !earned && r.left === 0;
  return (
    <Pressable
      onPress={r.go ? () => onGo(r.go!) : undefined}
      disabled={!r.go}
      accessibilityRole={r.go ? 'button' : undefined}
      accessibilityLabel={`${r.label}, ${r.reward} XP. ${r.sub}${done ? '. Done' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingLeft: 12, paddingRight: 10,
        borderTopWidth: first ? 0 : 1, borderTopColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent',
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? col : idle ? c.paper2 : `${col}22` }}>
        <Icon name={done ? 'check' : KIND_ICON[r.kind]} size={18} stroke={done ? 3 : 2} color={done ? '#fff' : idle ? c.ink3 : col} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', letterSpacing: -0.2, color: idle ? c.ink2 : c.ink }}>{r.label}</Text>
        <Text style={[{ fontSize: 13, lineHeight: 17, color: c.ink3, marginTop: 1 }, tnum]}>{r.sub}</Text>
      </View>
      <Text style={[{ fontSize: 13.5, fontWeight: '800', color: r.left ? c.ink : c.ink3 }, tnum]}>{r.reward}</Text>
      {r.go ? <Icon name="chev-r" size={15} stroke={2} color={c.ink3} /> : <View style={{ width: 15 }} />}
    </Pressable>
  );
};

const Streak = ({ st }: { st: XpStats }) => {
  const { c } = useTheme();
  const alive = st.streak > 0;
  return (
    <View style={{ marginHorizontal: 14, marginTop: 12, padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Image source={FIRE} style={{ width: 34, height: 34, opacity: alive ? 1 : 0.35 }} accessibilityIgnoresInvertColors />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: c.ink }}>{alive ? `${plural(st.streak, 'day')} in a row` : 'No streak yet'}</Text>
          <Text style={[{ fontSize: 13, lineHeight: 17, color: c.ink3, marginTop: 1 }, tnum]}>
            Open Spartans tomorrow for +{nextCheckInXp(st.streak)} XP. Best {plural(st.bestStreak, 'day')}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
        {st.last7Active.map((on, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i));
          const today = i === 6;
          return (
            <View key={i} accessible accessibilityLabel={`${dayLabel(isoOf(d.getTime()))}: ${on ? 'opened' : 'missed'}`} style={{ alignItems: 'center', gap: 4 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? FLAME : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: c.line }}>
                {on && <Icon name="check" size={13} stroke={3} color="#fff" />}
              </View>
              <Text style={{ fontSize: 11.5, fontWeight: today ? '800' : '500', color: today ? c.ink : c.ink3 }}>{DAY_LETTER[d.getDay()]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ── Progress ────────────────────────────────────────────────────
const ProgressTab = ({ lv, st, version }: { lv: LevelState; st: XpStats; version: number }) => {
  const nr = nextRank(lv.level);
  const best = useMemo(() => bestXpDay(), [version]);
  const records: [string, string][] = [
    ['Best day', best ? `${best.xp.toLocaleString()} XP, ${dayLabel(best.iso)}` : 'Not yet'],
    ['Longest streak', plural(st.bestStreak, 'day')],
    ['Days opened', st.daysActive.toLocaleString()],
    ['Trivia right', st.counts.trivia ? `${st.triviaRight} of ${st.counts.trivia}` : 'Not yet'],
    ['Homework finished', st.counts.homework.toLocaleString()],
    ['Badges unlocked', st.counts.badge.toLocaleString()],
  ];
  return (
    <View>
      <Head title="Rank road" note={nr ? `${plural(nr.level - lv.level, 'level')} to ${nr.title}` : 'Top rank'} first />
      <RankRoad level={lv.level} progress={lv.progress} />
      <Head title="XP earned" />
      <DayChart version={version} />
      <Head title="Where it came from" />
      <Sources st={st} />
      <Head title="Records" />
      <Table rows={records} />
    </View>
  );
};

// Every rank's emblem on one track. Reached ranks in full colour, the one you
// are on bigger with a ring, locked ones grey. Opens scrolled to you.
const STOP_W = 96;
const RankRoad = ({ level, progress }: { level: number; progress: number }) => {
  const { c } = useTheme();
  const cur = rankIndex(level);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentOffset={{ x: Math.max(0, (cur - 1) * STOP_W), y: 0 }} contentContainerStyle={{ paddingHorizontal: 14 }}>
      {RANKS.map((r, i) => {
        const reached = i <= cur;
        const here = i === cur;
        const next = RANKS[i + 1];
        const fill = !next ? 0 : i < cur ? 1 : here ? (level - r.level + progress) / (next.level - r.level) : 0;
        return (
          <View key={r.title} style={{ width: STOP_W, alignItems: 'center' }}
            accessible accessibilityLabel={`${r.title}, level ${r.level}${here ? ', your rank' : reached ? ', reached' : ', locked'}`}>
            {!!next && (
              <View style={{ position: 'absolute', top: 37, left: STOP_W / 2 + 24, width: STOP_W - 48, height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(Math.min(1, fill) * 100)}%`, height: '100%', backgroundColor: r.colors[1] }} />
              </View>
            )}
            <View style={{ height: 78, justifyContent: 'center' }}>
              {here
                ? <RankEmblem rank={r} level={level} size={56} ring={progress} track={c.line} />
                : <RankEmblem rank={r} size={44} locked={!reached} />}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 13, marginTop: 2, fontWeight: here ? '800' : '600', color: reached ? c.ink : c.ink3 }}>{r.title}</Text>
            <Text style={[{ fontSize: 11.5, color: here ? c.ink2 : c.ink3, fontWeight: here ? '700' : '500', marginTop: 1 }, tnum]}>{here ? 'You are here' : `Level ${r.level}`}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

// Clean number at or above n, for the top line of the chart.
const niceTop = (n: number) => {
  const m = Math.max(n, 10);
  const p = 10 ** Math.floor(Math.log10(m));
  return [1, 2, 2.5, 5, 10].find(x => x * p >= m)! * p;
};

const CHART_H = 120;

// One column per day, today on the right. Tap a column: the list under it gives
// that day's exact numbers, so nothing is only readable from the bar's height.
const DayChart = ({ version }: { version: number }) => {
  const { c, mode } = useTheme();
  const [range, setRange] = useState<'7' | '30'>('7');
  const n = Number(range);
  const both = useMemo(() => xpDays(n * 2), [n, version]);
  const days = both.slice(n);
  const [picked, setPicked] = useState<string | null>(null);
  const pick = days.find(d => d.iso === picked) || days[days.length - 1];
  const sum = days.reduce((a, d) => a + d.xp, 0);
  const before = both.slice(0, n).reduce((a, d) => a + d.xp, 0);
  const pct = before ? Math.round(((sum - before) / before) * 100) : null;
  const top = niceTop(Math.max(...days.map(d => d.xp)));
  const gold = glow(c.gold, mode);
  const lastIso = days[days.length - 1].iso;
  const gap = n === 7 ? 10 : 2;
  const parts = KINDS.filter(k => pick.byKind[k]);

  return (
    <View style={{ marginHorizontal: 14, padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: c.ink, letterSpacing: -0.6 }}>{sum.toLocaleString()} XP</Text>
          <Text style={[{ fontSize: 13, lineHeight: 17, color: c.ink3, marginTop: 1 }, tnum]}>
            {pct === null ? `Last ${n} days` : pct === 0 ? `Same as the ${n} days before` : `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% on the ${n} days before`}
          </Text>
        </View>
        <View style={{ width: 112 }}>
          <Segmented small options={[['7', '7 days'], ['30', '30 days']]} value={range} onChange={setRange} />
        </View>
      </View>

      <Text style={[{ textAlign: 'right', fontSize: 11.5, color: c.ink3, marginTop: 12, marginBottom: 3 }, tnum]}>{top.toLocaleString()}</Text>
      <View style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap, borderTopWidth: 1, borderTopColor: c.line2, borderBottomWidth: 1, borderBottomColor: c.line }}>
        {days.map(d => {
          const on = d.iso === pick.iso;
          return (
            <Pressable key={d.iso} onPress={() => setPicked(d.iso)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${dayLabel(d.iso)}, ${d.xp} XP`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
              {d.xp > 0 && (
                <View style={{
                  width: '100%', maxWidth: 24, height: Math.max(3, Math.round((d.xp / top) * (CHART_H - 2))),
                  borderTopLeftRadius: n === 7 ? 4 : 2, borderTopRightRadius: n === 7 ? 4 : 2,
                  backgroundColor: on ? c.link : gold,
                }} />
              )}
            </Pressable>
          );
        })}
      </View>
      {n === 7 ? (
        <View style={{ flexDirection: 'row', gap, marginTop: 5 }}>
          {days.map(d => {
            const on = d.iso === pick.iso;
            return <Text key={d.iso} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: on ? '800' : '500', color: on ? c.ink : c.ink3 }}>{DAY_LETTER[new Date(`${d.iso}T12:00:00`).getDay()]}</Text>;
          })}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
          <Text style={{ fontSize: 11.5, color: c.ink3 }}>{dayLabel(days[0].iso)}</Text>
          <Text style={{ fontSize: 11.5, color: c.ink3 }}>Today</Text>
        </View>
      )}

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.ink }}>{pick.iso === lastIso ? 'Today' : dayLabel(pick.iso)}</Text>
          <Text style={[{ fontSize: 14, fontWeight: '800', color: c.ink }, tnum]}>{pick.xp.toLocaleString()} XP</Text>
        </View>
        {parts.length === 0 && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 3 }}>Nothing earned this day.</Text>}
        {parts.map(k => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
            <Text style={{ fontSize: 13, color: c.ink2 }}>{KIND_LABEL[k]}</Text>
            <Text style={[{ fontSize: 13, color: c.ink2 }, tnum]}>{pick.byKind[k]!.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Ranked bars, biggest first. Grade XP sits apart: one move up a grade outweighs
// everything else, so it would flatten every other bar.
const Sources = ({ st }: { st: XpStats }) => {
  const { c, mode } = useTheme();
  const rows = KINDS.filter(k => k !== 'grade' && st.byKind[k] > 0).sort((a, b) => st.byKind[b] - st.byKind[a]);
  const top = rows.length ? st.byKind[rows[0]] : 0;
  const gold = glow(c.gold, mode);
  return (
    <View style={{ paddingHorizontal: 20, gap: 14 }}>
      {rows.length === 0 && <Text style={{ fontSize: 14, lineHeight: 20, color: c.ink3 }}>Nothing yet. Answer today's trivia to get started.</Text>}
      {rows.map(k => (
        <View key={k} accessible accessibilityLabel={`${KIND_LABEL[k]}: ${st.byKind[k]} XP from ${plural(st.counts[k], 'entry', 'entries')}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: `${KIND_COLOR[k]}22`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={KIND_ICON[k]} size={16} stroke={2} color={KIND_COLOR[k]} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink }}>{KIND_LABEL[k]}</Text>
              <Text style={[{ fontSize: 14, fontWeight: '800', color: c.ink }, tnum]}>{st.byKind[k].toLocaleString()}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line2, overflow: 'hidden', marginTop: 5 }}>
              <View style={{ width: `${Math.max(2, (st.byKind[k] / top) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: gold }} />
            </View>
          </View>
        </View>
      ))}
      {st.byKind.grade > 0 && (
        <Text style={[{ fontSize: 13, lineHeight: 19, color: c.ink3 }, tnum]}>
          Plus {st.byKind.grade.toLocaleString()} XP from moving up {plural(st.counts.grade, 'grade')}.
        </Text>
      )}
    </View>
  );
};

const Table = ({ rows }: { rows: [string, string][] }) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {rows.map(([k, val], i) => (
        <View key={k} accessible style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
          <Text style={{ fontSize: 14.5, color: c.ink2 }}>{k}</Text>
          <Text style={[{ flexShrink: 1, textAlign: 'right', fontSize: 14.5, fontWeight: '700', color: c.ink }, tnum]}>{val}</Text>
        </View>
      ))}
    </View>
  );
};

// ── History ─────────────────────────────────────────────────────
const groupLabel = (key: string) => {
  if (key === 'earlier') return 'Earlier';
  const t = new Date();
  const y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
  if (key === isoOf(t.getTime())) return 'Today';
  if (key === isoOf(y.getTime())) return 'Yesterday';
  const d = new Date(`${key}T12:00:00`);
  return d.getFullYear() === t.getFullYear() ? dayLabel(key) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const HistoryTab = ({ version }: { version: number }) => {
  const { c } = useTheme();
  const log = useMemo(() => xpLog(), [version]);
  const [kind, setKind] = useState<XpKind | 'all'>('all');
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const have = KINDS.filter(k => log.some(e => e.kind === k));
  const list = kind === 'all' ? log : log.filter(e => e.kind === kind);
  const groups: { key: string; items: XpEntry[]; sum: number }[] = [];
  for (const e of list.slice(0, limit)) {
    const key = e.at ? isoOf(e.at) : 'earlier';
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, items: [], sum: 0 }; groups.push(g); }
    g.items.push(e);
    g.sum += e.xp;
  }
  if (!log.length) {
    return <Text style={{ paddingHorizontal: 20, paddingTop: 16, fontSize: 14, lineHeight: 20, color: c.ink3 }}>Nothing yet. Answer today's trivia to get started.</Text>;
  }
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 6 }}>
        {(['all', ...have] as (XpKind | 'all')[]).map(k => {
          const on = kind === k;
          return (
            <Pressable key={k} onPress={() => { setKind(k); setLimit(HISTORY_PAGE); }} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => ({ height: 34, paddingHorizontal: 13, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? c.action : c.paper2, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? '#fff' : c.ink2 }}>{k === 'all' ? 'All' : KIND_LABEL[k]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {groups.map(g => (
        <View key={g.key} style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
            <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: c.ink }}>{groupLabel(g.key)}</Text>
            <Text style={[{ fontSize: 13.5, fontWeight: '700', color: c.ink2 }, tnum]}>+{g.sum.toLocaleString()}</Text>
          </View>
          {g.items.map((x, i) => (
            <View key={x.id} accessible style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${KIND_COLOR[x.kind]}22`, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={KIND_ICON[x.kind]} size={15} stroke={2} color={KIND_COLOR[x.kind]} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 18, color: c.ink, fontWeight: '600' }}>{x.label}</Text>
                {!!x.at && <Text style={[{ fontSize: 12.5, color: c.ink3, marginTop: 1 }, tnum]}>{new Date(x.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>}
              </View>
              <Text style={[{ fontSize: 14, fontWeight: '800', color: c.ink }, tnum]}>+{x.xp.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ))}
      {list.length > limit && (
        <Pressable onPress={() => setLimit(l => l + HISTORY_PAGE)} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'center', height: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8, opacity: pressed ? 0.6 : 1 })}>
          <Text style={[{ fontSize: 14, fontWeight: '700', color: c.link }, tnum]}>Show {Math.min(HISTORY_PAGE, list.length - limit)} more</Text>
        </Pressable>
      )}
    </View>
  );
};

// ── Bits ────────────────────────────────────────────────────────
const Head = ({ title, note, first }: { title: string; note?: string; first?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: first ? 10 : 26, marginBottom: 12, paddingHorizontal: 20 }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: c.ink }}>{title}</Text>
      {!!note && <Text style={[{ flexShrink: 1, textAlign: 'right', fontSize: 13, fontWeight: '600', color: c.ink3 }, tnum]}>{note}</Text>}
    </View>
  );
};

// Same control as the Calendar's Month / Week / Day.
const Segmented = <T extends string,>({ options, value, onChange, small }: { options: [T, string][]; value: T; onChange: (v: T) => void; small?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.paper2, borderRadius: small ? 10 : 12, padding: 3, gap: 2 }}>
      {options.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => onChange(k)} hitSlop={small ? 6 : 0} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{
            flex: 1, borderRadius: small ? 7 : 9, paddingVertical: small ? 5 : 8, alignItems: 'center',
            backgroundColor: on ? c.surface : 'transparent',
          }}>
            <Text numberOfLines={1} style={[{ fontSize: small ? 12 : 14, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink3 }, tnum]}>{small ? label.replace(' days', 'd') : label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};
