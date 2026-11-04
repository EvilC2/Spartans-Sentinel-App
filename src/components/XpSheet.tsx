// Spartans — XP & levels sheet. Opens from the XP bar on Home and Profile.
// XP only: badges have their own sheet behind the badge icon.
// Meant to feel like a game screen, not a stats page. Top to bottom:
//   1. Hero (dark, glowing in the rank's colour): rank emblem with a ring to
//      the next level, rank name, animated XP bar, total XP.
//   2. Streak (flame + this week's check-ins), today, this week.
//   3. Daily quests: built from today's log, reset at midnight.
//   4. Rank road: every rank's emblem, locked ones greyed.
//   5. Last 2 weeks: XP per day (tap a bar for the number).
//   6. Ways to earn, with what each has paid you so far.
//   7. Recent XP, newest first.
// All numbers come from src/xp.ts.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../ThemeContext';
import { fonts, tnum, G165, G90 } from '../theme';
import { Icon, IconName } from './Icon';
import { RankEmblem } from './RankEmblem';
import { useEarnedVersion } from '../earned';
import {
  levelState, xpLog, xpStats, useXpVersion, XP_RULES, XpKind,
  RANKS, rankIndex, rankFor, nextRank, QUESTS,
} from '../xp';

const KIND_ICON: Record<XpKind, IconName> = { daily: 'sun', trivia: 'sparkle', poll: 'chart', homework: 'tasks', read: 'news', badge: 'badge', grade: 'grad' };
export const KIND_COLOR: Record<XpKind, string> = {
  daily: '#E89A2C', trivia: '#8E5BE8', poll: '#3B8BD9', homework: '#4E9A4A', read: '#2A8C9C', badge: '#D2544A', grade: '#2A5687',
};
const FLAME = '#FF7A2F';
const RECENT = 8;
const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const XpSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const v = useXpVersion();
  const e = useEarnedVersion();
  const [all, setAll] = useState(false);
  const lv = levelState();
  const st = useMemo(() => xpStats(), [v, e, visible]);
  const log = useMemo(() => xpLog(), [v, e, visible]);
  const shown = all ? log : log.slice(0, RECENT);
  const rank = rankFor(lv.level);
  const nr = nextRank(lv.level);
  const questsDone = QUESTS.filter(q => st.todayCounts[q.kind] >= q.goal).length;

  // Entrance: emblem springs in, then the bar fills.
  const pop = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    pop.setValue(0); fill.setValue(0);
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(fill, { toValue: lv.progress, duration: 900, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {/* ── 1. Hero ───────────────────────────────────────── */}
          <LinearGradient colors={['#0B1626', '#14304E']} start={G165.start} end={G165.end} style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden' }}>
            <Svg width={420} height={420} style={{ position: 'absolute', top: -90, alignSelf: 'center' }}>
              <Defs>
                <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={rank.glow} stopOpacity={0.55} />
                  <Stop offset="1" stopColor={rank.glow} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={210} cy={210} r={210} fill="url(#heroGlow)" />
            </Svg>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                <Text style={{ fontSize: 12 }}>⚡</Text>
                <Text style={[{ fontSize: 13, fontWeight: '800', color: '#fff' }, tnum]}>{lv.xp.toLocaleString()} XP</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={({ pressed }) => ({
                width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)',
                alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
              })}>
                <Icon name="close" size={15} stroke={2} color="#fff" />
              </Pressable>
            </View>

            <Animated.View style={{ alignItems: 'center', marginTop: 4, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }], opacity: pop }}>
              <RankEmblem rank={rank} level={lv.level} size={112} ring={lv.progress} />
            </Animated.View>

            <Text style={{ marginTop: 6, textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 2, color: rank.colors[0] }}>LEVEL {lv.level}</Text>
            <Text style={{ textAlign: 'center', fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, color: '#fff', letterSpacing: -0.6 }}>{rank.title}</Text>

            <View style={{ marginTop: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', justifyContent: 'center' }}>
              <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8, overflow: 'hidden',
                width: fill.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }) }}>
                <LinearGradient colors={[rank.colors[0], rank.glow]} start={G90.start} end={G90.end} style={{ flex: 1 }} />
                <View style={{ position: 'absolute', left: 0, right: 0, top: 2, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 4 }} />
              </Animated.View>
              <Text style={[{ textAlign: 'center', fontSize: 10.5, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }, tnum]}>
                {lv.into.toLocaleString()} / {lv.span.toLocaleString()}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={[{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }, tnum]}>{lv.toNext.toLocaleString()} XP to Level {lv.level + 1}</Text>
              {nr && <Text style={[{ fontSize: 12.5, color: nr.colors[0], fontWeight: '700' }, tnum]}>{nr.title} at {nr.level}</Text>}
            </View>
          </LinearGradient>

          {/* ── 2. Streak / today / week ──────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginTop: 16 }}>
            <View style={{ flex: 1.4, padding: 14, borderRadius: 20, backgroundColor: st.streak ? '#FF7A2F1F' : c.paper2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 26, opacity: st.streak ? 1 : 0.35 }}>🔥</Text>
                <Text style={[{ fontSize: 30, fontWeight: '900', color: st.streak ? FLAME : c.ink4, letterSpacing: -1 }, tnum]}>{st.streak}</Text>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.ink2, marginLeft: 2 }}>day{'\n'}streak</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                {st.last7Active.map((on, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (6 - i));
                  return (
                    <View key={i} style={{ alignItems: 'center', gap: 3 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: on ? FLAME : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: c.line }}>
                        {on && <Icon name="check" size={11} stroke={3} color="#fff" />}
                      </View>
                      <Text style={{ fontSize: 9.5, fontWeight: i === 6 ? '800' : '600', color: i === 6 ? c.ink : c.ink4 }}>{DAY_LETTER[d.getDay()]}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={{ fontSize: 11, color: c.ink3, marginTop: 8 }}>Best {st.bestStreak} · +2 XP a day while it lasts</Text>
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              <Tile emoji="⚡" value={`+${st.today.toLocaleString()}`} label="today" tint={KIND_COLOR.trivia} />
              <Tile emoji="📈" value={`+${st.week.toLocaleString()}`} label="this week" tint={KIND_COLOR.poll} />
            </View>
          </View>

          {/* ── 3. Daily quests ───────────────────────────────── */}
          <Head title="Daily quests" note={questsDone === QUESTS.length ? 'All done! 🎉' : `${questsDone}/${QUESTS.length} done`} />
          <View style={{ marginHorizontal: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, overflow: 'hidden' }}>
            {QUESTS.map((q, i) => {
              const n = Math.min(q.goal, st.todayCounts[q.kind]);
              const done = n >= q.goal;
              const col = KIND_COLOR[q.kind];
              return (
                <View key={q.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? col : `${col}22` }}>
                    <Icon name={done ? 'check' : q.icon} size={18} stroke={done ? 3 : 2} color={done ? '#fff' : col} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: done ? c.ink3 : c.ink, textDecorationLine: done ? 'line-through' : 'none' }}>{q.label}</Text>
                    {q.goal > 1 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.line2, overflow: 'hidden' }}>
                          <View style={{ width: `${(n / q.goal) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: col }} />
                        </View>
                        <Text style={[{ fontSize: 11.5, fontWeight: '700', color: c.ink3 }, tnum]}>{n}/{q.goal}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 99, backgroundColor: done ? c.mossTint : c.goldTint }}>
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: done ? c.moss : c.gold }, tnum]}>{done ? '✓ ' : ''}{q.reward}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ── 4. Rank road ──────────────────────────────────── */}
          <Head title="Rank road" note={nr ? `${nr.level - lv.level} ${nr.level - lv.level === 1 ? 'level' : 'levels'} to ${nr.title}` : 'Top rank 👑'} />
          <RankRoad level={lv.level} progress={lv.progress} />

          {/* ── 5. Last 2 weeks ───────────────────────────────── */}
          <Head title="Last 2 weeks" />
          <DayBars days={st.last14} color={rank.glow} />

          {/* ── 6. Ways to earn ───────────────────────────────── */}
          <Head title="Ways to earn" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14 }}>
            {XP_RULES.map(r => {
              const col = KIND_COLOR[r.kind];
              return (
                <View key={r.kind} style={{ width: '47.5%', flexGrow: 1, padding: 12, borderRadius: 18, backgroundColor: `${col}14`, borderWidth: 1, borderColor: `${col}30` }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={r.icon} size={16} stroke={2.1} color="#fff" />
                    </View>
                    <Text numberOfLines={1} style={[{ flexShrink: 1, marginLeft: 6, fontSize: 13.5, fontWeight: '900', color: col }, tnum]}>{r.xp}</Text>
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.ink, marginTop: 8 }}>{r.label}</Text>
                  <Text style={{ fontSize: 11.5, color: c.ink3, marginTop: 2, lineHeight: 15 }}>{r.sub}</Text>
                  <Text style={[{ fontSize: 11, fontWeight: '700', color: st.byKind[r.kind] ? c.ink2 : c.ink4, marginTop: 6 }, tnum]}>
                    {st.byKind[r.kind] ? `You've earned ${st.byKind[r.kind].toLocaleString()}` : 'Not yet'}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ── 7. Recent XP ──────────────────────────────────── */}
          <Head title="Recent XP" trailing={log.length > RECENT ? (all ? 'Show less' : `All ${log.length}`) : undefined} onTrailing={() => setAll(a => !a)} />
          <View style={{ paddingHorizontal: 20 }}>
            {log.length === 0 ? (
              <Text style={{ fontSize: 13.5, color: c.ink3 }}>Nothing yet. Answer today's trivia to get started.</Text>
            ) : shown.map((x, i) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.line2 }}>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${KIND_COLOR[x.kind]}22`, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={KIND_ICON[x.kind]} size={15} stroke={2} color={KIND_COLOR[x.kind]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, color: c.ink, fontWeight: '600' }}>{x.label}</Text>
                  <Text style={{ fontSize: 11.5, color: c.ink4, marginTop: 1 }}>{when(x.at)}</Text>
                </View>
                <Text style={[{ fontSize: 14, fontWeight: '900', color: c.gold }, tnum]}>+{x.xp.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const when = (t: number) => {
  if (!t) return 'Earlier';
  const d = new Date(t);
  const today = new Date();
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  const clock = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days <= 0) return `Today · ${clock}`;
  if (days === 1) return `Yesterday · ${clock}`;
  return d.toLocaleDateString('en-US', days > 300 ? { month: 'short', year: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
};

const Head = ({ title, note, trailing, onTrailing }: { title: string; note?: string; trailing?: string; onTrailing?: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 12, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.4, color: c.ink }}>{title}</Text>
      {!!note && <Text style={[{ fontSize: 12.5, fontWeight: '700', color: c.ink3 }, tnum]}>{note}</Text>}
      {!!trailing && <Pressable onPress={onTrailing} hitSlop={8}><Text style={{ fontSize: 13, fontWeight: '700', color: c.sky600 }}>{trailing}</Text></Pressable>}
    </View>
  );
};

const Tile = ({ emoji, value, label, tint }: { emoji: string; value: string; label: string; tint: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: `${tint}18`, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 15 }}>{emoji}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[{ flexShrink: 1, fontSize: 20, fontWeight: '900', color: tint, letterSpacing: -0.5 }, tnum]}>{value}</Text>
      </View>
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: c.ink3, marginTop: 1 }}>{label}</Text>
    </View>
  );
};

// Every rank's emblem on one track. Reached ranks in full colour, the one
// you are on bigger with a ring, locked ones grey. Opens scrolled to you.
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
            accessibilityLabel={`${r.title}, level ${r.level}${here ? ', your rank' : reached ? ', reached' : ', locked'}`}>
            {!!next && (
              <View style={{ position: 'absolute', top: 37, left: STOP_W / 2 + 24, width: STOP_W - 48, height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(Math.min(1, fill) * 100)}%`, height: '100%', backgroundColor: r.glow }} />
              </View>
            )}
            <View style={{ height: 78, justifyContent: 'center' }}>
              {here
                ? <RankEmblem rank={r} level={level} size={56} ring={progress} track={c.line} />
                : <RankEmblem rank={r} size={44} locked={!reached} />}
            </View>
            <Text numberOfLines={1} style={{ fontSize: 13, marginTop: 2, fontWeight: here ? '800' : '600', color: reached ? c.ink : c.ink4 }}>{r.title}</Text>
            <Text style={[{ fontSize: 11, color: here ? r.colors[1] : c.ink4, fontWeight: here ? '800' : '500', marginTop: 1 }, tnum]}>{here ? 'You are here' : `Level ${r.level}`}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
};

// One bar per day, today on the right. Tap a bar to read its number.
const DayBars = ({ days, color }: { days: { iso: string; xp: number }[]; color: string }) => {
  const { c } = useTheme();
  const [sel, setSel] = useState(days.length - 1);
  const max = Math.max(10, ...days.map(d => d.xp));
  const H = 88;
  const pick = days[sel] || days[days.length - 1];
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <View style={{ marginHorizontal: 14, padding: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2 }}>
      <Text style={[{ fontSize: 13, color: c.ink3 }, tnum]}>
        <Text style={{ fontSize: 17, fontWeight: '900', color: c.ink }}>{pick.xp.toLocaleString()} XP</Text>  {sel === days.length - 1 ? 'today' : label(pick.iso)}
      </Text>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 10 }}>
        {days.map((d, i) => (
          <Pressable key={d.iso} onPress={() => setSel(i)} accessibilityLabel={`${label(d.iso)}, ${d.xp} XP`}
            style={{ flex: 1, height: H, justifyContent: 'flex-end', alignItems: 'center' }}>
            <View style={{
              width: '80%', maxWidth: 16, height: Math.max(4, Math.round((d.xp / max) * (H - 4))),
              borderRadius: 5,
              backgroundColor: d.xp ? color : c.line2, opacity: i === sel || !d.xp ? 1 : 0.55,
            }} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ fontSize: 11, color: c.ink4 }}>{label(days[0].iso)}</Text>
        <Text style={{ fontSize: 11, color: c.ink4 }}>Today</Text>
      </View>
    </View>
  );
};
