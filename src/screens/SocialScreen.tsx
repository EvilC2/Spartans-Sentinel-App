// Spartans — Social tab. Same look as the Cafeteria menu (LunchScreen).
// Friends by friend code (opt-in both ways). A friend sees your profile
// photo (or colour + emoji if you have none), level, grade, pinned badges, full badge
// list, how long you've been friends, the blocks you SHARE (never your
// timetable) and homework you wrote for a shared class. No chat, on purpose
// (SCOPE-v3 phase 3). Rules: district approval, Oct 2026.
//
// Page order (mirrors the caf menu): title → gradient "you" card (avatar,
// level, pinned badges, friend code) → Requests strip → Today strip (who
// you're with each period, like the caf's specials) → class row (3D icons,
// filters friends to one class) → two-column friend cards → small print.
// A friend card opens FriendSheet. Logic lives in src/social.ts.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, TextInput, Share, Platform, Image, Animated, Easing, useWindowDimensions, ActivityIndicator,
  ImageSourcePropType, StyleProp, ViewStyle, TextStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { useKeyboardHeight, sheetHeight } from '../useKeyboard';
import { fonts, shadow, tnum, G155, G90, PNG_SHADOW } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { BadgeArt, RarityPill, TiltBadge } from '../components/BadgeArt';
import { RankEmblem } from '../components/RankEmblem';
import { Avatar, AvatarSpec, AVATAR_TONES, AVATAR_GLYPHS, wash } from '../components/Avatar';
import { XP_GOLD } from '../components/XpBar';
import { BadgesSheet } from './BadgesScreen';
import { Badge, BADGES, sortByRarity, tintOf, isUnlocked } from '../badges';
import { useProfile, roomShort, teacherShort, StudentProfile, Course } from '../ProfileContext';
import { useToday } from '../useToday';
import { useHomework } from '../stores';
import { fmt12 } from '../bell';
import { subjectImage } from '../programIcons';
import { levelState, levelTitle, rankFor, useXpVersion, LevelState } from '../xp';
import { useEarnedVersion } from '../earned';
import {
  useSocial, Friend, Request, Peer, FindResult, Social, SharedHomework,
  compareSchedules, todayTogether, friendsInPeriod, sortFriends, fullName, peerInitials, badgeOf, friendXp,
  myFriendCode, formatCode, cleanCode, friendsForDays, sharedClassNames, DEMO_CODE, MAX_PINNED, myAvatar, mePeer, blockName,
} from '../social';
import type { ScreenProps } from '../../App';

const FRAME = 430;

// ────────────────────────────────────────────────────────────────
// Bits shared with the caf menu's look
// ────────────────────────────────────────────────────────────────
const Blob = ({ size, style }: { size: number; style: StyleProp<ViewStyle> }) => (
  <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' }, style]} />
);

// Gentle bob, same as the caf's gift card.
const Floaty = ({ children, amount = 6 }: { children: React.ReactNode; amount?: number }) => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -amount, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y, amount]);
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
};

// Translucent pill on the gradient (the caf's "we take" pills).
const GlassPill = ({ icon, art, label, onPress, a11y }: { icon?: IconName; art?: ImageSourcePropType; label: string; onPress?: () => void; a11y?: string }) => {
  const body = (pressed: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
      {art ? <Image source={art} style={{ width: 16, height: 16 }} /> : icon ? <Icon name={icon} size={14} stroke={2.2} color="#fff" /> : null}
      <Text numberOfLines={1} style={[{ fontSize: 12.5, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }, tnum]}>{label}</Text>
    </View>
  );
  if (!onPress) return <View style={{ flexGrow: 1 }}>{body(false)}</View>;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} style={{ flexGrow: 1 }}>{({ pressed }) => body(pressed)}</Pressable>;
};

// Small uppercase tag, like Popular / GF on a food card.
const Tag = ({ text, tint, ink }: { text: string; tint: string; ink: string }) => (
  <View style={{ backgroundColor: tint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
    <Text style={[{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: ink }, tnum]}>{text}</Text>
  </View>
);

// Section title, caf style: 18 semibold, count on the right.
const Heading = ({ text, right, onRight }: { text: string; right?: string; onRight?: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: c.ink }}>{text}</Text>
      {!!right && (onRight ? (
        <Pressable onPress={onRight} hitSlop={8} accessibilityRole="button" accessibilityLabel={`See all ${right}`}>
          <Text style={[{ fontSize: 12.5, fontWeight: '700', color: c.sky600 }, tnum]}>See all {right}</Text>
        </Pressable>
      ) : <Text style={[{ fontSize: 12, color: c.ink3, fontWeight: '500' }, tnum]}>{right}</Text>)}
    </View>
  );
};

// Round "+" / "›" button at the bottom right of a card.
const RoundAction = ({ icon, done, onPress, label }: { icon: IconName; done?: boolean; onPress?: () => void; label?: string }) => {
  const { c } = useTheme();
  const dot = (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? c.mossTint : c.skyTint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={done ? 'check' : icon} size={13} stroke={2.4} color={done ? c.moss : c.sky600} />
    </View>
  );
  if (!onPress) return <View accessibilityLabel={label}>{dot}</View>;
  return <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}>{dot}</Pressable>;
};

// Pill button: navy (main), sky, white (plain) or crimson.
const PillBtn = ({ text, icon, onPress, kind = 'navy', label, disabled, grow = true, style }: {
  text: string; icon?: IconName; onPress: () => void; kind?: 'navy' | 'sky' | 'plain' | 'danger'; label?: string; disabled?: boolean; grow?: boolean; style?: StyleProp<ViewStyle>;
}) => {
  const { c } = useTheme();
  const bg = kind === 'navy' ? c.navy700 : kind === 'sky' ? c.sky : kind === 'danger' ? c.crimson : c.surface;
  const fg = kind === 'plain' ? c.ink : '#fff';
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label ?? text} accessibilityState={{ disabled }}
      style={({ pressed }) => [{
        flexGrow: grow ? 1 : 0, height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderWidth: kind === 'plain' ? 1 : 0, borderColor: c.line, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }],
      }, style]}>
      {icon && <Icon name={icon} size={15} stroke={2.4} color={fg} />}
      <Text style={{ fontSize: 13.5, fontWeight: '700', color: fg, letterSpacing: -0.2 }}>{text}</Text>
    </Pressable>
  );
};

const PeerAvatar = ({ peer, size, ring, onPress, label }: { peer: Peer; size: number; ring?: string; onPress?: () => void; label?: string }) => (
  <Avatar spec={peer.avatar} uri={peer.photo} initials={peerInitials(peer)} size={size} ring={ring} onPress={onPress} label={label} />
);

const useCopied = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async (key: string, value: string) => {
    try { await Clipboard.setStringAsync(value); } catch { /* web without permission: nothing to do */ }
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1600);
  };
  return { copied, copy };
};

const myPinned = (p: StudentProfile) =>
  (p.pinnedBadges || []).map(badgeOf).filter((b): b is Badge => !!b && isUnlocked(b)).slice(0, MAX_PINNED);

const withWho = (fs: Friend[]) =>
  fs.length === 1 ? `With ${fs[0].firstName}` : fs.length === 2 ? `With ${fs[0].firstName} and ${fs[1].firstName}` : `With ${fs.length} friends`;

const dueLabel = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

// ────────────────────────────────────────────────────────────────
// Screen
// ────────────────────────────────────────────────────────────────
export default function SocialScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const social = useSocial();
  // Quiet re-check each time the tab opens; the list itself loads at launch.
  useEffect(() => { social.refresh(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const t = useToday(profile?.courses || []);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Friend | null>(null);
  const [preview, setPreview] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pins, setPins] = useState(false);
  const [cls, setCls] = useState<string>('all');   // a course name (lower case), or 'all'

  const mine = profile?.courses || [];
  const friends = useMemo(() => sortFriends(social.friends, mine), [social.friends, mine]);
  const incoming = social.requests.filter(r => r.direction === 'in');
  const outgoing = social.requests.filter(r => r.direction === 'out');
  const openFriend = open ? social.friends.find(f => f.id === open.id) || null : null;

  // The class row (the caf's category row): my classes, one per name, spares too.
  const classes = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; name: string }[] = [];
    for (const k of mine) {
      const name = blockName(k);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, name });
    }
    return out;
  }, [mine]);
  const picked = classes.find(k => k.key === cls);
  const shown = picked
    ? friends.filter(f => compareSchedules(mine, f.shared).sharedBlocks.some(s => blockName(s.mine).toLowerCase() === picked.key))
    : friends;
  // Who's with you this block (the "Now" tag on cards). Only blocks: lunch and
  // FIT are shared with everyone, so the tag would mean nothing.
  const nowPeriod = t.phase !== 'before' && t.phase !== 'after' && t.phase !== 'none' && t.current?.kind === 'block' ? t.current : null;
  const nowIds = new Set(nowPeriod ? friendsInPeriod(nowPeriod, mine, friends).map(x => x.friend.id) : []);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <AppHeader topInset={topInset} title="Social" />
        <View style={{ height: 14 }} />

        {profile && <YouCard profile={profile} friendCount={friends.length} onPreview={() => setPreview(true)} onAvatar={() => setPicking(true)} onPins={() => setPins(true)} />}

        {social.mode === 'signed-out' && <SmallNote icon="users" text="Sign in to add friends." />}
        {social.mode === 'demo' && (
          <SmallNote icon="sparkle" text={<>Sample friends. Try code <Text style={[{ fontWeight: '700', color: c.ink2 }, tnum]}>{formatCode(DEMO_CODE)}</Text></>} />
        )}
        {!!social.error && <Text style={{ paddingHorizontal: 20, paddingTop: 10, fontSize: 12.5, color: c.crimson, fontWeight: '600' }}>{social.error}</Text>}

        {incoming.length + outgoing.length > 0 && (
          <View style={{ paddingTop: 22 }}>
            <Heading text="Requests" right={incoming.length ? `${incoming.length} new` : undefined} />
            <RequestStrip incoming={incoming} outgoing={outgoing} social={social} />
          </View>
        )}

        {friends.length > 0 && <TodayStrip t={t} me={mine} friends={friends} onOpen={setOpen} />}

        {friends.length > 0 && classes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, gap: 4 }}>
            {[{ key: 'all', name: 'Everyone' }, ...classes].map(k => {
              const on = k.key === cls;
              return (
                <Pressable key={k.key} onPress={() => setCls(k.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  accessibilityLabel={k.key === 'all' ? 'All friends' : `Friends in ${k.name}`}
                  style={({ pressed }) => ({ alignItems: 'center', width: 76, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{
                    width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: on ? c.skyTint : c.surface, borderWidth: on ? 2 : 1, borderColor: on ? c.sky : c.line,
                  }}>
                    {k.key === 'all'
                      ? <Icon name="users" size={26} stroke={2} color={on ? c.sky600 : c.ink2} />
                      : <Image source={subjectImage(k.name)} style={{ width: 40, height: 40 }} />}
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: on ? '700' : '500', color: on ? c.navy700 : c.ink2, marginTop: 6, letterSpacing: -0.2 }}>{k.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ── Grid ───────────────────────────────────────────── */}
        <View style={{ paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: c.ink }}>{picked ? picked.name : 'Friends'}</Text>
            {social.loading
              ? <ActivityIndicator size="small" color={c.ink4} />
              : <Text style={[{ fontSize: 12, color: c.ink3, fontWeight: '500' }, tnum]}>{shown.length} {shown.length === 1 ? 'friend' : 'friends'}</Text>}
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            {friends.length === 0 && !social.ready ? (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}><ActivityIndicator color={c.navy700} /></View>
            ) : (
              <>
                {picked && shown.length === 0 && (
                  <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                    <Image source={subjectImage(picked.name)} style={{ width: 64, height: 64, opacity: 0.6 }} />
                    <Text style={{ fontSize: 13, color: c.ink3, marginTop: 10 }}>No friends in {picked.name} yet.</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <AddCard first={friends.length === 0} onPress={() => setAdding(true)} />
                  {shown.map(f => <FriendCard key={f.id} f={f} me={mine} now={nowIds.has(f.id)} onPress={() => setOpen(f)} />)}
                </View>
              </>
            )}
          </View>
        </View>

        <Text style={{ paddingTop: 20, paddingHorizontal: 20, textAlign: 'center', fontSize: 12, color: c.ink4, letterSpacing: 0.2, lineHeight: 17 }}>
          Friends only see the classes and spares you share.{'\n'}Never your timetable or student number.
        </Text>
      </ScrollView>

      <AddFriendSheet visible={adding} onClose={() => setAdding(false)} social={social} />
      <FriendSheet friend={openFriend} me={profile} plan={t.plan} isSchoolDay={!!t.plan} onClose={() => setOpen(null)} social={social} />
      {profile && <YouSheet visible={preview} profile={profile} friendCount={friends.length} onClose={() => setPreview(false)} onAvatar={() => { setPreview(false); setPicking(true); }} />}
      {profile && <AvatarSheet visible={picking} profile={profile} onClose={() => setPicking(false)} />}
      <BadgesSheet visible={pins} onClose={() => setPins(false)} />
    </View>
  );
}

const SmallNote = ({ icon, text }: { icon: IconName; text: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingTop: 12 }}>
      <Icon name={icon} size={13} stroke={2} color={c.ink4} />
      <Text style={{ fontSize: 12, color: c.ink3, flexShrink: 1 }}>{text}</Text>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// You — the gradient card at the top, like the caf's "we take" card.
// Avatar → pick a new one. Badge plates → choose pins. Code → copy / share.
// ────────────────────────────────────────────────────────────────
const YouCard = ({ profile, friendCount, onPreview, onAvatar, onPins }: { profile: StudentProfile; friendCount: number; onPreview: () => void; onAvatar: () => void; onPins: () => void }) => {
  const { c } = useTheme();
  useXpVersion(); useEarnedVersion();
  const { copied, copy } = useCopied();
  const me = mePeer(profile);
  const lv = levelState();
  const pinned = myPinned(profile);
  const code = myFriendCode(profile);
  const share = async () => {
    try { await Share.share({ message: `Add me on Spartans. My friend code is ${formatCode(code)}` }); } catch { /* dismissed */ }
  };
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={[{ borderRadius: 24, overflow: 'hidden' }, shadow.md]}>
        <LinearGradient colors={[c.sky, c.sky600, c.navy700]} {...G155} style={{ padding: 18 }}>
          <Blob size={240} style={{ top: -120, right: -80, opacity: 0.16 }} />
          <Blob size={140} style={{ bottom: -70, left: 10, opacity: 0.12 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Floaty>
              <View>
                <PeerAvatar peer={me} size={72} ring={me.photo ? '#fff' : 'rgba(255,255,255,0.45)'} onPress={onAvatar} label={me.photo ? 'Your profile photo' : 'Change your avatar'} />
                <View pointerEvents="none" style={[{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, shadow.sm]}>
                  <Icon name="edit" size={13} stroke={2.2} color={c.navy700} />
                </View>
              </View>
            </Floaty>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>{fullName(me) || 'You'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <RankEmblem rank={rankFor(lv.level)} level={lv.level} size={20} />
                <Text numberOfLines={1} style={[{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.9)', flexShrink: 1 }, tnum]}>Level {lv.level} · {levelTitle(lv.level)}</Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden', marginTop: 9 }} accessibilityLabel={`${lv.toNext} XP to level ${lv.level + 1}`}>
                <LinearGradient colors={[XP_GOLD, c.gold]} start={G90.start} end={G90.end}
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(4, Math.round(lv.progress * 100))}%`, borderRadius: 3 }} />
              </View>
            </View>
          </View>

          {/* Pinned badges: the art itself with a drop shadow, no plate.
              Empty slots keep a dashed "Pin a badge" plate. */}
          <Pressable onPress={onPins} accessibilityRole="button" accessibilityLabel={pinned.length ? 'Your pinned badges. Change' : 'Pin up to four badges'}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 6, marginTop: 14, opacity: pressed ? 0.8 : 1 })}>
            {Array.from({ length: MAX_PINNED }, (_, i) => {
              const b = pinned[i];
              return b ? (
                <View key={b.id} style={[{ flex: 1, height: 76, alignItems: 'center', justifyContent: 'center' }, PNG_SHADOW]}>
                  <BadgeArt badge={b} size={70} />
                </View>
              ) : (
                <View key={i} style={{
                  flex: 1, height: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2,
                  backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderStyle: 'dashed',
                }}>
                  <Icon name="plus" size={16} stroke={2.2} color="#fff" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>Pin a badge</Text>
                </View>
              );
            })}
          </Pressable>

          {/* Friend code: white ticket with copy / share */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 10, paddingLeft: 14, paddingRight: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: '#2E74BD' }}>Your friend code</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[{ fontFamily: fonts.mono, fontSize: 21, lineHeight: 27, color: '#1A3A5C', letterSpacing: 1.5, fontWeight: '700' }, tnum]}>{formatCode(code) || '-'}</Text>
            </View>
            <Pressable onPress={() => copy('code', formatCode(code))} accessibilityRole="button" accessibilityLabel={copied === 'code' ? 'Copied' : 'Copy friend code'} hitSlop={4}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: copied === 'code' ? '#E6EFDF' : '#E4F1FC', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Icon name={copied === 'code' ? 'check' : 'copy'} size={17} stroke={2.2} color={copied === 'code' ? '#5B7A4E' : '#2E74BD'} />
            </Pressable>
            <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Share friend code" hitSlop={4}
              style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E4F1FC', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Icon name="share" size={17} stroke={2.2} color="#2E74BD" />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
            <GlassPill icon="eye" label="What friends see" onPress={onPreview} a11y="See what friends see" />
            <GlassPill icon="users" label={`${friendCount} ${friendCount === 1 ? 'friend' : 'friends'}`} />
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Requests — the caf's gold "Today" cards, with Accept / Decline.
// ────────────────────────────────────────────────────────────────
const RequestStrip = ({ incoming, outgoing, social }: { incoming: Request[]; outgoing: Request[]; social: Social }) => {
  const { c } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (r: Request, fn: () => Promise<void>) => { setBusy(r.id); try { await fn(); } finally { setBusy(null); } };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
      {[...incoming, ...outgoing].map(r => {
        const inc = r.direction === 'in';
        return (
          <View key={r.id} style={[{ width: 270, padding: 12, borderRadius: 20, backgroundColor: inc ? c.goldTint : c.surface, borderWidth: 1, borderColor: inc ? '#E7D2A0' : c.line, opacity: busy === r.id ? 0.5 : 1 }, shadow.sm]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PeerAvatar peer={r.peer} size={48} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: inc ? c.gold : c.ink3 }}>{inc ? 'Wants to be friends' : 'Waiting for a yes'}</Text>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 1 }}>{fullName(r.peer)}</Text>
                <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>Grade {r.peer.grade}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {inc ? (
                <>
                  <PillBtn text="Decline" kind="plain" onPress={() => act(r, () => social.respond(r, false))} label={`Decline ${fullName(r.peer)}`} />
                  <PillBtn text="Accept" icon="check" onPress={() => act(r, () => social.respond(r, true))} label={`Accept ${fullName(r.peer)}`} />
                </>
              ) : (
                <PillBtn text="Cancel request" kind="plain" onPress={() => act(r, () => social.cancel(r))} label={`Cancel request to ${fullName(r.peer)}`} />
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

// ────────────────────────────────────────────────────────────────
// Today — the caf's specials strip: each block left today that you share
// with friends, spares included. Tap opens the first friend.
// ────────────────────────────────────────────────────────────────
type Today = ReturnType<typeof useToday>;
const TodayStrip = ({ t, me, friends, onOpen }: { t: Today; me: Course[]; friends: Friend[]; onOpen: (f: Friend) => void }) => {
  const { c } = useTheme();
  if (!t.plan || t.phase === 'after' || t.phase === 'none') return null;
  const from = t.currentIndex >= 0 ? t.currentIndex : 0;
  const rows = t.plan.periods
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i >= from && p.kind === 'block')
    .map(({ p, i }) => ({ p, i, with_: friendsInPeriod(p, me, friends).map(x => x.friend) }))
    .filter(r => r.with_.length > 0);
  if (!rows.length) return null;
  return (
    <View style={{ paddingTop: 22 }}>
      <Heading text="Today together" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {rows.map(({ p, i, with_ }) => {
          const now = i === t.currentIndex && t.phase !== 'before';
          const name = blockName(p.course) || blockName(me.find(k => k.slot === p.slot)) || `Block ${p.slot}`;
          return (
            <Pressable key={i} onPress={() => onOpen(with_[0])} accessibilityRole="button" accessibilityLabel={`${name}, ${fmt12(p.start)}, ${withWho(with_)}`}
              style={({ pressed }) => [{
                width: 250, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20,
                backgroundColor: c.skyTint, borderWidth: 1, borderColor: '#BFDDF7', opacity: pressed ? 0.85 : 1,
              }, shadow.sm]}>
              <Image source={subjectImage(name)} style={{ width: 56, height: 56 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[{ fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: c.sky600 }, tnum]}>
                  {now ? `Now · till ${fmt12(p.end)}` : fmt12(p.start)}{p.slot ? ` · ${p.slot}` : ''}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 1 }}>{name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {with_.slice(0, 3).map((f, j) => (
                      <View key={f.id} style={{ marginLeft: j ? -8 : 0, zIndex: 5 - j }}><PeerAvatar peer={f} size={20} ring={c.skyTint} /></View>
                    ))}
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3, flexShrink: 1 }}>{withWho(with_)}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Friend card — the caf's food card: art tile (their avatar), tags top
// right, name, the classes you share, level where the price goes.
// ────────────────────────────────────────────────────────────────
const FriendCard = ({ f, me, now, onPress }: { f: Friend; me: Course[]; now: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  const shared = compareSchedules(me, f.shared).sharedBlocks;
  const names = Array.from(new Set(shared.map(s => blockName(s.mine))));
  const level = levelState(friendXp(f)).level;
  const scale = useRef(new Animated.Value(1)).current;
  const bump = () => {
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
    ]).start();
  };
  return (
    <Pressable onPress={() => { bump(); onPress(); }} accessibilityRole="button"
      accessibilityLabel={`${fullName(f)}, level ${level}, ${shared.length} ${shared.length === 1 ? 'class' : 'classes'} together. Open`}
      style={({ pressed }) => [{
        width: '48.2%', marginBottom: 12, borderRadius: 20, padding: 14, paddingTop: 12,
        backgroundColor: c.surface, borderWidth: now ? 2 : 1, borderColor: now ? c.sky : c.line,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }, shadow.sm]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: wash(f.avatar, '26'), alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ scale }] }}><PeerAvatar peer={f} size={50} /></Animated.View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {now && <Tag text="Now" tint={c.skyTint} ink={c.sky600} />}
          {shared.length > 0
            ? <Tag text={`${shared.length} ${shared.length === 1 ? 'class' : 'classes'}`} tint={c.mossTint} ink={c.moss} />
            : <Tag text="No classes" tint={c.paper2} ink={c.ink3} />}
          {f.badgeIds.length > 0 && <Tag text={`${f.badgeIds.length} badges`} tint={c.goldTint} ink={c.gold} />}
        </View>
      </View>
      <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 12, lineHeight: 19, minHeight: 38 }}>{fullName(f)}</Text>
      <Text numberOfLines={2} style={{ fontSize: 12, color: c.ink3, marginTop: 3, lineHeight: 16, minHeight: 32 }}>{names.length ? names.join(' · ') : 'Different classes'}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={[{ fontSize: 17, fontWeight: '800', color: c.navy700, letterSpacing: -0.4 }, tnum]}>Lv {level}</Text>
        <RoundAction icon="chev-r" />
      </View>
    </Pressable>
  );
};

const AddCard = ({ first, onPress }: { first: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Add friend"
      style={({ pressed }) => ({
        width: '48.2%', marginBottom: 12, borderRadius: 20, padding: 14, paddingTop: 12,
        borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.sky, backgroundColor: pressed ? c.skyTint : 'transparent',
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.skyTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={28} stroke={2.4} color={c.sky600} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 12, lineHeight: 19, minHeight: 38 }}>{first ? 'Add your first friend' : 'Add friend'}</Text>
      <Text style={{ fontSize: 12, color: c.ink3, marginTop: 3, lineHeight: 16, minHeight: 32 }}>Swap friend codes. Both of you say yes.</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.navy700, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={13} stroke={2.4} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Sheet frame.
// ────────────────────────────────────────────────────────────────
const Sheet = ({ visible, onClose, title, children, flush, frac = 0.9 }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; flush?: boolean; frac?: number }) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const kb = useKeyboardHeight();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(14,34,56,0.35)' }} accessibilityLabel="Close" />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: kb }}>
        <View style={[{ height: sheetHeight(height, kb, frac), backgroundColor: c.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }, shadow.lg]}>
          {!flush && (
            <>
              <View style={{ alignItems: 'center', paddingTop: 10 }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
              </View>
              <View style={{ paddingHorizontal: 20, paddingTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: c.ink }}>{title}</Text>
                <CloseBtn onPress={onClose} />
              </View>
            </>
          )}
          {children}
        </View>
      </View>
    </Modal>
  );
};

const CloseBtn = ({ onPress, light }: { onPress: () => void; light?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => ({
      width: 32, height: 32, borderRadius: 16, backgroundColor: light ? 'rgba(255,255,255,0.22)' : c.paper2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
    })}>
      <Icon name="close" size={16} stroke={2} color={light ? '#fff' : c.ink2} />
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Avatar picker — a colour, then an emoji (or your initials).
// ────────────────────────────────────────────────────────────────
const AvatarSheet = ({ visible, profile, onClose }: { visible: boolean; profile: StudentProfile; onClose: () => void }) => {
  const { c } = useTheme();
  const { setAvatar } = useProfile();
  const [draft, setDraft] = useState<AvatarSpec>(myAvatar(profile));
  useEffect(() => { if (visible) setDraft(myAvatar(profile)); }, [visible]);   // eslint-disable-line react-hooks/exhaustive-deps
  const { width } = useWindowDimensions();
  const cols = 6, gap = 8;
  const cell = Math.floor((Math.min(width, FRAME) - 40 - gap * (cols - 1)) / cols);
  const ini = peerInitials(mePeer(profile));
  const save = () => { setAvatar(draft); onClose(); };
  return (
    <Sheet visible={visible} onClose={onClose} title="Your avatar">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: 18 }}>
          <Floaty><Avatar spec={draft} initials={ini} size={112} ring={c.surface} /></Floaty>
          <Text style={{ fontSize: 12, color: c.ink3, marginTop: 12, textAlign: 'center' }}>{profile.photoUri ? 'Friends see your photo. This shows if you remove it.' : 'Friends see this. Add a photo in Edit profile to use that instead.'}</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', alignSelf: 'center', maxWidth: 5 * 44 + 4 * 12 }}>
          {AVATAR_TONES.map((t, i) => {
            const on = draft.tone === i;
            return (
              <Pressable key={t.name} onPress={() => setDraft(d => ({ ...d, tone: i }))} accessibilityRole="button" accessibilityLabel={`${t.name} colour`} accessibilityState={{ selected: on }}
                style={{ width: 44, height: 44, borderRadius: 22, padding: 3, borderWidth: 2.5, borderColor: on ? c.sky : 'transparent' }}>
                <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 20 }} />
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, marginTop: 20 }}>
          {[undefined, ...AVATAR_GLYPHS].map(g => {
            const on = draft.glyph === g;
            return (
              <Pressable key={g || 'initials'} onPress={() => setDraft(d => (g ? { tone: d.tone, glyph: g } : { tone: d.tone }))}
                accessibilityRole="button" accessibilityLabel={g ? `Emoji ${g}` : 'Your initials'} accessibilityState={{ selected: on }}
                style={({ pressed }) => ({
                  width: cell, height: cell, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? c.skyTint : c.surface, borderWidth: on ? 2 : 1, borderColor: on ? c.sky : c.line, opacity: pressed ? 0.6 : 1,
                })}>
                {g ? <Text style={{ fontSize: cell * 0.48 }}>{g}</Text> : <Text style={{ fontSize: 15, fontWeight: '800', color: c.ink2 }}>{ini}</Text>}
              </Pressable>
            );
          })}
        </View>

        <PillBtn text="Save" icon="check" kind="navy" label="Save avatar" onPress={save} style={{ marginTop: 22, height: 50 }} />
      </ScrollView>
    </Sheet>
  );
};

// ────────────────────────────────────────────────────────────────
// Add friend — type a code, then send a request.
// ────────────────────────────────────────────────────────────────
const AddFriendSheet = ({ visible, onClose, social }: { visible: boolean; onClose: () => void; social: Social }) => {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [result, setResult] = useState<FindResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Peer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setQ(''); setResult(null); setSent(null); setError(null); onClose(); };
  const look = async () => {
    if (cleanCode(q).length < 4) return;
    setBusy(true); setError(null); setSent(null);
    try { setResult(await social.find(q)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const send = async (peer: Peer) => {
    setBusy(true); setError(null);
    try { await social.request(peer); setSent(peer); setResult(null); setQ(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const paste = async () => {
    try { const v = await Clipboard.getStringAsync(); if (v) { setQ(formatCode(v)); setResult(null); } } catch { /* no clipboard */ }
  };
  const ready = cleanCode(q).length === 8;

  return (
    <Sheet visible={visible} onClose={close} title="Add friend">
      <View style={[{ marginHorizontal: 20, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, height: 58, borderRadius: 18, paddingLeft: 16, paddingRight: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, shadow.sm]}>
        <TextInput
          value={q}
          onChangeText={v => { setQ(formatCode(v)); setResult(null); }}
          onSubmitEditing={look}
          placeholder="XXXX-XXXX"
          placeholderTextColor={c.ink4}
          autoFocus
          autoCorrect={false}
          autoCapitalize="characters"
          returnKeyType="search"
          maxLength={9}
          style={[{ flex: 1, minWidth: 0, fontSize: 22, fontFamily: fonts.mono, letterSpacing: 2, color: c.ink, paddingVertical: 8 }, tnum, Platform.OS === 'web' && ({ outlineWidth: 0, outlineStyle: 'none' } as unknown as TextStyle)]}
          accessibilityLabel="Friend code"
        />
        {q ? (
          <Pressable onPress={() => { setQ(''); setResult(null); }} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={6} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={16} stroke={2.2} color={c.ink4} />
          </Pressable>
        ) : (
          <Pressable onPress={paste} accessibilityRole="button" accessibilityLabel="Paste" style={({ pressed }) => ({ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: c.skyTint, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.sky600 }}>Paste</Text>
          </Pressable>
        )}
        <Pressable onPress={look} disabled={!ready || busy} accessibilityRole="button" accessibilityLabel="Find" style={({ pressed }) => ({
          width: 44, height: 44, borderRadius: 22, backgroundColor: ready && !busy ? c.navy700 : c.paper2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1,
        })}>
          <Icon name="search" size={19} stroke={2.2} color={ready && !busy ? '#fff' : c.ink4} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {busy && <ActivityIndicator color={c.navy700} style={{ marginVertical: 12 }} />}
        {!!error && <Text style={{ fontSize: 12.5, color: c.crimson, fontWeight: '600', marginBottom: 10 }}>{error}</Text>}

        {sent && (
          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, backgroundColor: c.mossTint }, shadow.sm]}>
            <PeerAvatar peer={sent} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: c.moss }}>Request sent</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 1 }}>{fullName(sent)}</Text>
              <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>Shows up in Friends once they say yes.</Text>
            </View>
          </View>
        )}

        {result?.state === 'found' && (
          <View style={[{ alignItems: 'center', padding: 20, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, shadow.sm]}>
            <Floaty><PeerAvatar peer={result.peer} size={84} ring={c.skyTint} /></Floaty>
            <Text style={{ fontSize: 20, fontWeight: '800', color: c.ink, letterSpacing: -0.4, marginTop: 12 }}>{fullName(result.peer)}</Text>
            <Text style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>Grade {result.peer.grade}</Text>
            <PillBtn text="Send request" icon="plus" kind="sky" label="Send friend request" onPress={() => send(result.peer)} disabled={busy} grow={false} style={{ marginTop: 16, height: 46, alignSelf: 'stretch' }} />
          </View>
        )}
        {result?.state === 'none' && <Hint icon="search" text="No one with that code" />}
        {result?.state === 'self' && <Hint icon="me" text="That's your own code" />}
        {result?.state === 'friend' && <Hint icon="users" text="Already friends" />}
        {result?.state === 'pending' && <Hint icon="clock" text="Request already waiting" />}

        {!result && !sent && !busy && (
          <View style={{ gap: 10, marginTop: 4 }}>
            {([
              ['1', 'Ask a friend for their code', "It's on their Social tab."],
              ['2', 'Type it above', 'Then send a request.'],
              ['3', 'They say yes', 'You both see the classes you share.'],
            ] as const).map(([n, a, b]) => (
              <View key={n} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, shadow.sm]}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.skyTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: c.sky600 }}>{n}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>{a}</Text>
                  <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{b}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
};

const Hint = ({ icon, text }: { icon: IconName; text: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 18, gap: 10 }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} stroke={1.9} color={c.ink3} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink2 }}>{text}</Text>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Profile hero — the caf's gradient card as a sheet header. Shared by a
// friend's sheet and your own preview.
// ────────────────────────────────────────────────────────────────
type Stat = { icon: IconName; label: string };
const ProfileHero = ({ peer, lv, pinned, stats, onBadge, onClose, preview, onAvatar }: {
  peer: Peer; lv: LevelState; pinned: Badge[]; stats: Stat[]; onBadge: (b: Badge) => void; onClose: () => void; preview?: boolean; onAvatar?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <LinearGradient colors={[c.sky, c.sky600, c.navy700]} {...G155} style={{ paddingTop: 10, paddingBottom: 20, paddingHorizontal: 20, overflow: 'hidden' }}>
      <Blob size={260} style={{ top: -130, right: -90, opacity: 0.16 }} />
      <Blob size={150} style={{ bottom: -80, left: -20, opacity: 0.12 }} />
      <View style={{ alignItems: 'center' }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' }} /></View>
      <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}><CloseBtn onPress={onClose} light /></View>
      {preview && (
        <View style={{ position: 'absolute', top: 18, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#fff' }}>
          <Icon name="eye" size={13} stroke={2.2} color="#1A3A5C" />
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#1A3A5C' }}>What friends see</Text>
        </View>
      )}

      <View style={{ alignItems: 'center', marginTop: 26 }}>
        <Floaty>
          <View>
            <PeerAvatar peer={peer} size={100} ring={peer.photo ? '#fff' : 'rgba(255,255,255,0.45)'} onPress={onAvatar} label={onAvatar ? 'Change your avatar' : undefined} />
            <View style={{ position: 'absolute', right: -10, bottom: -6 }}><RankEmblem rank={rankFor(lv.level)} level={lv.level} size={38} /></View>
          </View>
        </Floaty>
        <Text numberOfLines={1} style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: '#fff', marginTop: 12 }}>{fullName(peer)}</Text>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>Grade {peer.grade} · {levelTitle(lv.level)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {stats.map(s => <GlassPill key={s.label} icon={s.icon} label={s.label} />)}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden', marginTop: 12 }} accessibilityLabel={`${lv.toNext} XP to level ${lv.level + 1}`}>
        <LinearGradient colors={[XP_GOLD, c.gold]} start={G90.start} end={G90.end}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(4, Math.round(lv.progress * 100))}%`, borderRadius: 3 }} />
      </View>
      <Text style={[{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 6, textAlign: 'center' }, tnum]}>{lv.toNext} XP to level {lv.level + 1}</Text>

      {/* Pinned badges: small, all in one row, drop shadow, no label or names. */}
      {pinned.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 16 }}>
          {pinned.map(x => (
            <Pressable key={x.id} onPress={() => onBadge(x)} accessibilityRole="button" accessibilityLabel={x.title}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
              <View style={PNG_SHADOW}><BadgeArt badge={x} size={54} /></View>
            </Pressable>
          ))}
        </View>
      )}
    </LinearGradient>
  );
};

// ────────────────────────────────────────────────────────────────
// Friend sheet — hero, today together, classes you share (as food-style
// cards), their badges, their homework for those classes.
// ────────────────────────────────────────────────────────────────
type Plan = ReturnType<typeof useToday>['plan'];
const FriendSheet = ({ friend, me, plan, isSchoolDay, onClose, social }: { friend: Friend | null; me: StudentProfile | null; plan: Plan; isSchoolDay: boolean; onClose: () => void; social: Social }) => {
  const { c } = useTheme();
  const hw = useHomework();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const [allBadges, setAllBadges] = useState(false);
  const [copied, setCopied] = useState<Record<string, true>>({});
  useEffect(() => { setConfirm(false); setShown(null); setAllBadges(false); setCopied({}); }, [friend?.id]);
  if (!friend || !me) return null;

  const cmp = compareSchedules(me.courses, friend.shared);
  const today = isSchoolDay ? todayTogether(plan, cmp) : [];
  const lv = levelState(friendXp(friend));
  const badges = sortByRarity(friend.badgeIds.map(badgeOf).filter(Boolean) as Badge[]);
  const pinned = friend.pinned.map(badgeOf).filter((b): b is Badge => !!b);
  const days = friendsForDays(friend.since);
  const classes = sharedClassNames(me.courses, friend);
  const theirHw = social.homework.filter(h => h.friendId === friend.id && classes.some(k => k.toLowerCase() === h.className.toLowerCase()));
  // Their homework, one group per shared class, classes in timetable order.
  const hwByClass = classes
    .map(k => [k, theirHw.filter(h => h.className.toLowerCase() === k.toLowerCase()).sort((a, b) => a.due.localeCompare(b.due))] as const)
    .filter(([, items]) => items.length > 0);
  const mineTitles = new Set(hw.items.map(h => `${(h.program || '').toLowerCase()}|${h.title.trim().toLowerCase()}|${h.due}`));
  const openBadge = (b: Badge) => { const i = badges.findIndex(x => x.id === b.id); if (i >= 0) setShown(i); };
  const copyHw = (h: SharedHomework) => {
    const course = me.courses.find(k => k.name.trim().toLowerCase() === h.className.toLowerCase());
    hw.add(h.className, h.title, h.due, { ...(h.time ? { time: h.time } : {}), ...(h.notes ? { notes: h.notes } : {}), ...(course ? { slot: course.slot } : {}) });
    setCopied(m => ({ ...m, [h.id]: true }));
  };
  const remove = async () => {
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try { await social.unfriend(friend); onClose(); } finally { setBusy(false); setConfirm(false); }
  };

  return (
    <Sheet visible onClose={onClose} flush frac={0.94}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <ProfileHero peer={friend} lv={lv} pinned={pinned} onBadge={openBadge} onClose={onClose} stats={[
          { icon: 'chart', label: `Level ${lv.level}` },
          { icon: 'badge', label: `${badges.length} ${badges.length === 1 ? 'badge' : 'badges'}` },
          { icon: 'users', label: `${days} ${days === 1 ? 'day' : 'days'}` },
        ]} />

        {today.length > 0 && (
          <View style={{ paddingTop: 22 }}>
            <Heading text="Today together" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {today.map((row, i) => {
                const m = cmp.slots.find(s => s.slot === row.period.slot)?.mine;
                const name = blockName(m) || 'Class';
                return (
                  <View key={i} style={[{ width: 220, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: c.skyTint, borderWidth: 1, borderColor: '#BFDDF7' }, shadow.sm]}>
                    <Image source={subjectImage(name)} style={{ width: 48, height: 48 }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[{ fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: c.sky600 }, tnum]}>{fmt12(row.period.start)}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 1 }}>{name}</Text>
                      {!!m?.room && <Text style={[{ fontSize: 12.5, color: c.ink3, marginTop: 1 }, tnum]}>{roomShort(m.room)}</Text>}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Classes you share — only these. Never their timetable. */}
        <View style={{ paddingTop: 22 }}>
          <Heading text="Classes together" right={`${cmp.sharedBlocks.length} ${cmp.sharedBlocks.length === 1 ? 'class' : 'classes'}`} />
          <View style={{ paddingHorizontal: 20 }}>
            {cmp.sharedBlocks.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <Image source={subjectImage('books')} style={{ width: 56, height: 56, opacity: 0.6 }} />
                <Text style={{ fontSize: 13, color: c.ink3, marginTop: 8 }}>No classes together</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {cmp.sharedBlocks.map(r => {
                  const name = blockName(r.mine);
                  const sub = [r.mine!.room ? roomShort(r.mine!.room) : '', r.mine!.teacher ? teacherShort(r.mine!.teacher) : ''].filter(Boolean).join(' · ');
                  return (
                    <View key={r.slot} style={[{ width: '48.2%', marginBottom: 12, borderRadius: 20, padding: 14, paddingTop: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, shadow.sm]}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
                          <Image source={subjectImage(name)} style={{ width: 42, height: 42 }} />
                        </View>
                        <Tag text={r.slot} tint={c.skyTint} ink={c.sky600} />
                      </View>
                      <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 10, lineHeight: 19 }}>{name}</Text>
                      {!!sub && <Text numberOfLines={1} style={[{ fontSize: 12, color: c.ink3, marginTop: 3 }, tnum]}>{sub}</Text>}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Badges */}
        <View style={{ paddingTop: 10 }}>
          <Heading text="Badges" right={badges.length ? `${badges.length}` : undefined} onRight={badges.length ? () => setAllBadges(true) : undefined} />
          {badges.length === 0
            ? <Text style={{ paddingHorizontal: 20, fontSize: 13, color: c.ink3 }}>None yet</Text>
            : <BadgeStrip badges={badges} onOpen={setShown} />}
        </View>

        {/* Homework they wrote for classes you share */}
        {classes.length > 0 && (
          <View style={{ paddingTop: 22 }}>
            <Heading text="Their homework" right={theirHw.length ? `${theirHw.length}` : undefined} />
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              {theirHw.length === 0 ? (
                <Text style={{ fontSize: 13, color: c.ink3 }}>Nothing written down yet</Text>
              ) : hwByClass.map(([cls, items]) => (
                // One card per class: subject art + class name as the header, its homework under it.
                <View key={cls} style={[{ borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, shadow.sm]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.skyTint }}>
                    <Image source={subjectImage(cls)} style={{ width: 34, height: 34 }} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: '800', color: c.navy700, letterSpacing: -0.3 }}>{items[0].className}</Text>
                    <Tag text={`${items.length}`} tint={c.surface} ink={c.sky600} />
                  </View>
                  {items.map((h, i) => {
                    const have = copied[h.id] || mineTitles.has(`${h.className.toLowerCase()}|${h.title.trim().toLowerCase()}|${h.due}`);
                    return (
                      <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '700', color: c.ink, letterSpacing: -0.2, lineHeight: 19 }}>{h.title}</Text>
                          <Text numberOfLines={1} style={[{ fontSize: 12, color: c.ink3, marginTop: 2 }, tnum]}>Due {dueLabel(h.due)}{h.time ? ` ${fmt12(h.time)}` : ''}</Text>
                        </View>
                        <RoundAction icon="plus" done={!!have} label={have ? 'In your homework' : `Copy ${h.title} to your homework`} onPress={have ? undefined : () => copyHw(h)} />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Remove — two taps, no alert */}
        <View style={{ alignItems: 'center', marginTop: 30, gap: 6 }}>
          {confirm ? (
            <PillBtn text="Tap again to remove" icon="trash" kind="danger" grow={false} label="Confirm remove friend" onPress={remove} disabled={busy} />
          ) : (
            <Pressable onPress={remove} disabled={busy} accessibilityRole="button" accessibilityLabel="Remove friend" hitSlop={6}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="trash" size={14} stroke={2} color={c.crimson} />
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.crimson }}>Remove friend</Text>
            </Pressable>
          )}
          {confirm && <Text style={{ fontSize: 12, color: c.ink3 }}>They won't be told.</Text>}
        </View>
      </ScrollView>

      <AllBadges visible={allBadges} owner={friend.firstName} badges={badges} onClose={() => setAllBadges(false)} onOpen={i => { setAllBadges(false); setShown(i); }} />
      <FriendBadge badges={badges} index={shown} owner={friend.firstName} onIndex={setShown} />
    </Sheet>
  );
};

// ────────────────────────────────────────────────────────────────
// You, as a friend sees you — same hero, your badges, and what a friend
// gets and never gets.
// ────────────────────────────────────────────────────────────────
const YouSheet = ({ visible, profile, friendCount, onClose, onAvatar }: { visible: boolean; profile: StudentProfile; friendCount: number; onClose: () => void; onAvatar: () => void }) => {
  const { c } = useTheme();
  useXpVersion(); useEarnedVersion();
  const [shown, setShown] = useState<number | null>(null);
  const [allBadges, setAllBadges] = useState(false);
  useEffect(() => { if (!visible) { setShown(null); setAllBadges(false); } }, [visible]);
  if (!visible) return null;
  const peer = mePeer(profile);
  const lv = levelState();
  const badges = sortByRarity(BADGES.filter(b => isUnlocked(b)));
  const pinned = myPinned(profile);
  const openBadge = (b: Badge) => { const i = badges.findIndex(x => x.id === b.id); if (i >= 0) setShown(i); };
  const sees: [boolean, string][] = [
    [true, 'Your name, grade and profile photo'],
    [true, 'Your level, XP and badges'],
    [true, 'Classes and spares you share with them'],
    [true, 'Homework you wrote for those classes'],
    [false, 'Your timetable'],
    [false, 'Your student number'],
  ];
  return (
    <Sheet visible onClose={onClose} flush frac={0.94}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <ProfileHero peer={peer} lv={lv} pinned={pinned} onBadge={openBadge} onClose={onClose} preview onAvatar={onAvatar} stats={[
          { icon: 'chart', label: `Level ${lv.level}` },
          { icon: 'badge', label: `${badges.length} ${badges.length === 1 ? 'badge' : 'badges'}` },
          { icon: 'users', label: `${friendCount} ${friendCount === 1 ? 'friend' : 'friends'}` },
        ]} />

        <View style={{ paddingTop: 22 }}>
          <Heading text="Badges" right={badges.length ? `${badges.length}` : undefined} onRight={badges.length ? () => setAllBadges(true) : undefined} />
          {badges.length === 0
            ? <Text style={{ paddingHorizontal: 20, fontSize: 13, color: c.ink3 }}>None yet</Text>
            : <BadgeStrip badges={badges} onOpen={setShown} />}
        </View>

        <View style={{ paddingTop: 22 }}>
          <Heading text="What a friend sees" />
          <View style={[{ marginHorizontal: 20, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, shadow.sm]}>
            {sees.map(([yes, t], i) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: yes ? c.mossTint : c.paper2, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={yes ? 'check' : 'close'} size={13} stroke={2.6} color={yes ? c.moss : c.ink4} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: yes ? '600' : '500', color: yes ? c.ink : c.ink3 }}>{yes ? t : `Never: ${t.charAt(0).toLowerCase()}${t.slice(1)}`}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <AllBadges visible={allBadges} owner={profile.firstName} badges={badges} onClose={() => setAllBadges(false)} onOpen={i => { setAllBadges(false); setShown(i); }} />
      <FriendBadge badges={badges} index={shown} owner={profile.firstName} onIndex={setShown} />
    </Sheet>
  );
};

// Their badges, rarest first, one scrolling row. Tap one to open it.
const BadgeStrip = ({ badges, onOpen }: { badges: Badge[]; onOpen: (i: number) => void }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2, paddingHorizontal: 20 }}>
    {badges.map((b, i) => (
      <Pressable key={b.id} onPress={() => onOpen(i)} accessibilityRole="button" accessibilityLabel={b.title}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
        <BadgeArt badge={b} size={72} />
      </Pressable>
    ))}
  </ScrollView>
);

// Every badge they have, four across, in a page sheet.
const AllBadges = ({ visible, owner, badges, onClose, onOpen }: { visible: boolean; owner: string; badges: Badge[]; onClose: () => void; onOpen: (i: number) => void }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const cols = 4, gap = 10;
  const w = Math.floor((Math.min(width, FRAME) - 40 - gap * (cols - 1)) / cols);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: c.ink }}>{owner}'s badges</Text>
            <Text style={[{ fontSize: 12.5, color: c.ink3, marginTop: 2 }, tnum]}>{badges.length} of {BADGES.length} unlocked</Text>
          </View>
          <CloseBtn onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, flexDirection: 'row', flexWrap: 'wrap', gap }} showsVerticalScrollIndicator={false}>
          {badges.map((b, i) => (
            <Pressable key={b.id} onPress={() => onOpen(i)} accessibilityRole="button" accessibilityLabel={b.title}
              style={({ pressed }) => ({ width: w, alignItems: 'center', paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <BadgeArt badge={b} size={w - 10} />
              <Text numberOfLines={2} style={{ fontSize: 10.5, fontWeight: '600', color: c.ink2, textAlign: 'center', marginTop: 5, lineHeight: 13, minHeight: 26 }}>{b.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

// One badge, full size, with previous / next to page through the rest.
// Read-only: no share row, that belongs to the owner.
const FriendBadge = ({ badges, index, owner, onIndex }: { badges: Badge[]; index: number | null; owner: string; onIndex: (i: number | null) => void }) => {
  const { c, mode } = useTheme();
  const b = index === null ? null : badges[index];
  if (!b || index === null) return null;
  const glow = tintOf(b).chrome ? '#C9CFD6' : tintOf(b).color;
  const close = () => onIndex(null);
  const step = (d: number) => onIndex((index + d + badges.length) % badges.length);
  const Arrow = ({ dir }: { dir: -1 | 1 }) => (
    <Pressable onPress={() => step(dir)} disabled={badges.length < 2} hitSlop={8} accessibilityRole="button" accessibilityLabel={dir < 0 ? 'Previous badge' : 'Next badge'}
      style={({ pressed }) => [{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: badges.length < 2 ? 0.35 : pressed ? 0.6 : 1 }, shadow.sm]}>
      <Icon name={dir < 0 ? 'chev-l' : 'chev-r'} size={22} stroke={2} color={c.ink2} />
    </Pressable>
  );
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <LinearGradient colors={[glow, glow + (mode === 'dark' ? '66' : 'AA'), c.paper]} locations={[0, 0.45, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '62%' }} />
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' }} />
        </View>
        <View style={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}><CloseBtn onPress={close} light /></View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingTop: 64, paddingHorizontal: 28, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <TiltBadge key={b.id} badge={b} size={250} locked={false} />
          <Text style={{ fontSize: 13, color: c.ink3, marginTop: 14, letterSpacing: 0.6, textTransform: 'uppercase' }}>{owner}'s badge</Text>
          <Text style={{ fontSize: 30, fontWeight: '700', color: c.ink, letterSpacing: -0.8, textAlign: 'center', marginTop: 2, lineHeight: 36 }}>{b.title}</Text>
          <Text style={{ fontSize: 18, color: c.ink3, textAlign: 'center', marginTop: 6, letterSpacing: -0.2, lineHeight: 23 }}>{b.desc}</Text>
          <View style={{ marginTop: 12 }}><RarityPill rarity={b.rarity} season={b.season} tint={b.tint} /></View>
          {!!b.flavor && <Text style={{ fontSize: 15, color: c.ink3, marginTop: 14, textAlign: 'center', fontStyle: 'italic' }}>{b.flavor}</Text>}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingHorizontal: 28 }}>
          <Arrow dir={-1} />
          <Text style={[{ fontSize: 14, fontWeight: '600', color: c.ink2 }, tnum]}>{index + 1} of {badges.length}</Text>
          <Arrow dir={1} />
        </View>
      </View>
    </Modal>
  );
};
