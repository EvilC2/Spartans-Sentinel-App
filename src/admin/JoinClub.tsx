// Spartans — the App Club join page: what everyone outside the club sees
// behind the gold bubble. It's the club's pitch, so it doesn't look like the
// rest of the app: one dark, unbroken scroll over real Sentinel photos
// (westvancouverschools.ca, graded into navy in assets/join), with big
// serif lines between them. No cards, no sections.
//   the school from above · "Build the app Sentinel opens every day." · code box
//   the mural · your work goes live
//   the microscope · skills
//   five teams, as type
//   the gym · made for everyone
//   three steps
//   the grad parade (duotone) · the big code box
//   Google Classroom and Instagram
// The invite code box shows twice (top and bottom); both redeem the same
// way. Redeeming flips AdminScreen over to the club's pages.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Image, Animated, TextInput, Linking, Platform, AccessibilityInfo,
  ImageSourcePropType, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { useTheme } from '../ThemeContext';
import { fonts, tnum } from '../theme';
import { Icon } from '../components/Icon';
import { useNav } from '../nav';
import { useProfile } from '../ProfileContext';
import { useContent } from '../content';
import { TEAMS, TEAM_ORDER, roleLabel } from '../ranks';
import { Act, Card, Field, Result } from './ui';

const PHOTO = {
  aerial: require('../../assets/join/aerial.jpg'),
  mural: require('../../assets/join/mural.jpg'),
  microscope: require('../../assets/join/microscope.jpg'),
  lunch: require('../../assets/join/lunch.jpg'),
  grad: require('../../assets/join/grad-duo.jpg'),
};

// The page's own palette: night navy, warm white, gold.
const BG = '#07111D';
const INK = '#F4F1EA';
const SOFT = 'rgba(244,241,234,0.68)';
const FAINT = 'rgba(244,241,234,0.42)';
const GOLD = '#E4C27E';

const CLASSROOM_CODE = 'brfxwyka';
const INSTAGRAM = 'spartansappclub';

// ── Redeeming a code (shared by both boxes) ─────────────────────
const useRedeem = () => {
  const { redeemInvite, online } = useProfile();
  const { mode } = useContent();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const redeem = async () => {
    if (busy || !code.trim()) return;
    if (mode === 'demo') { setMsg({ ok: false, text: 'Codes need the server. In demo mode, use the eye at the top to try any role.' }); return; }
    if (!online) { setMsg({ ok: false, text: 'Offline. Codes need a connection.' }); return; }
    setBusy(true); setMsg(null);
    try { const role = await redeemInvite(code); setMsg({ ok: true, text: `You're in: ${roleLabel(role)}.` }); setCode(''); }
    catch (e: any) { setMsg({ ok: false, text: String(e?.message || 'That code didn\'t work.') }); }
    finally { setBusy(false); }
  };
  return { code, setCode: (t: string) => { setCode(t.toUpperCase()); setMsg(null); }, busy, msg, redeem };
};
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {};

// ════════════════════════════════════════════════════════════════
export const JoinClub = ({ topInset, club }: { topInset: number; club?: React.ReactNode }) => {
  const nav = useNav();
  const { width, height } = useWindowDimensions();
  const w = Math.min(width, 430);
  const heroH = Math.max(560, Math.min(height * 0.82, 760));
  const scrollY = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {}); }, []);
  const top = useRedeem();
  const bottom = useRedeem();

  // The aerial drifts slower than the page (Reduce Motion: it doesn't).
  const drift = still ? 0 : scrollY.interpolate({ inputRange: [-200, 0, heroH], outputRange: [-60, 0, heroH * 0.35], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: Platform.OS !== 'web' })}
      >
        {/* ── The school from above ── */}
        <View style={{ height: heroH, overflow: 'hidden' }}>
          <Animated.Image source={PHOTO.aerial} resizeMode="cover" accessibilityIgnoresInvertColors
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: heroH + 80, width: '100%', transform: [{ translateY: drift as any }] }} />
          <LinearGradient colors={['rgba(7,17,29,0.55)', 'rgba(7,17,29,0)', 'rgba(7,17,29,0.55)', BG]} locations={[0, 0.22, 0.55, 0.92]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: GOLD }}>Sentinel's School App Club</Text>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 46, lineHeight: 48, color: INK, letterSpacing: -1.4, marginTop: 10 }}>
              Build the app Sentinel opens every day.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 18 }}>
          <Text style={{ fontSize: 16.5, color: SOFT, lineHeight: 24 }}>
            Spartans is made by students. Join a team and the next thing the whole school sees could be yours.
          </Text>
          <View style={{ marginTop: 26 }}>
            <CodeLine r={top} />
          </View>
        </View>

        {/* ── Beats ── */}
        <Beat photo={PHOTO.mural} width={w} title="Your work, on every phone."
          body="The trivia, polls, news and badges you make go live for the whole school the moment you post them." />
        <Beat photo={PHOTO.microscope} width={w} title="Learn what class doesn't teach."
          body="Design, code, writing, marketing, and running a team. Real skills on a real app, and something to show for it." />

        {/* ── Five teams, as type ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 72 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: GOLD }}>Five teams</Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: INK, letterSpacing: -0.8, marginTop: 8 }}>Find where you fit.</Text>
          <View style={{ marginTop: 26, gap: 26 }}>
            {TEAM_ORDER.map(t => {
              const team = TEAMS[t];
              const roles = [...(team.lead ? ['Manager'] : []), ...team.jobs.map(j => j.label)];
              return (
                <View key={t} style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
                  <Image source={team.art} style={{ width: 40, height: 40, marginTop: 2 }} resizeMode="contain" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, color: INK, letterSpacing: -0.5 }}>{team.label}</Text>
                    <Text style={{ fontSize: 15, color: SOFT, marginTop: 4, lineHeight: 21 }}>{PITCH[t]}</Text>
                    <Text style={{ fontSize: 13.5, color: FAINT, marginTop: 6, lineHeight: 19 }}>{roles.map(r => r.replace(/-/g, '\u2011').replace(/ /g, '\u00A0')).join('  ·  ')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <Beat photo={PHOTO.lunch} width={w} title="Made for all of Sentinel."
          body="Grade 8 to grad. Every student opens Spartans for their day, their friends and their school. You decide what they find there." />

        {/* ── Three steps ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 72, gap: 22 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: INK, letterSpacing: -0.8 }}>Getting in is easy.</Text>
          {[
            ['Come to a meeting', 'Or talk to anyone in the club. We\'re easy to find.'],
            ['Pick your team', 'A manager sets you up with an invite code for your role.'],
            ['Enter your code', 'Your role card and your pages show up right away.'],
          ].map(([t, s], i) => (
            <View key={t} style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
              <Text style={[{ fontFamily: fonts.serif, fontSize: 40, lineHeight: 42, color: GOLD, width: 26 }, tnum]}>{i + 1}</Text>
              <View style={{ flex: 1, paddingTop: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: INK, letterSpacing: -0.2 }}>{t}</Text>
                <Text style={{ fontSize: 15, color: SOFT, marginTop: 3, lineHeight: 21 }}>{s}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── The big code box, over the grad parade ── */}
        <View style={{ marginTop: 72 }}>
          <Image source={PHOTO.grad} resizeMode="cover" accessibilityIgnoresInvertColors style={{ width: '100%', height: w * 0.8 }} />
          <LinearGradient colors={[BG, 'rgba(7,17,29,0.15)', 'rgba(7,17,29,0.35)', BG]} locations={[0, 0.3, 0.65, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: w * 0.8 }} />
          <View style={{ paddingHorizontal: 24, marginTop: -(w * 0.26) }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, color: INK, letterSpacing: -1 }}>Got your code?</Text>
            <Text style={{ fontSize: 15.5, color: SOFT, marginTop: 6, lineHeight: 22 }}>Enter it once. Your role sticks to this account.</Text>
            <View style={{ marginTop: 22 }}>
              <CodeBig r={bottom} />
            </View>
          </View>
        </View>

        {/* ── Find us ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 64, gap: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: GOLD }}>Find the club</Text>
          <Social
            icon={<ClassroomGlyph />}
            title="Google Classroom"
            sub={`Class code ${CLASSROOM_CODE}`}
            action="Copy code"
            onPress={async () => {
              await Clipboard.setStringAsync(CLASSROOM_CODE).catch(() => {});
              Linking.openURL('https://classroom.google.com/').catch(() => {});
            }}
          />
          <Social
            icon={<InstagramGlyph />}
            title="Instagram"
            sub={`@${INSTAGRAM}`}
            action="Follow"
            onPress={() => Linking.openURL(`https://instagram.com/${INSTAGRAM}`).catch(() => {})}
          />
          <Text style={{ fontSize: 13, color: FAINT, lineHeight: 18 }}>Google Classroom opens with the class code copied. Tap the + and paste it.</Text>
        </View>
      </Animated.ScrollView>

      {/* Floating top bar, on a soft scrim so it reads over text as you scroll */}
      <LinearGradient pointerEvents="none" colors={['rgba(7,17,29,0.92)', 'rgba(7,17,29,0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(topInset, 20) + 84 }} />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, paddingTop: Math.max(topInset, 20) + 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(7,17,29,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Icon name="chev-l" size={18} stroke={2.2} color="#fff" />
        </Pressable>
        {club}
      </View>
    </View>
  );
};

const PITCH: Record<string, string> = {
  developer: 'Write the code and ship the features everyone taps.',
  maintenance: 'Run what students see: trivia, polls, news, the caf menu.',
  badges: 'Design the badges people chase, then hand them out.',
  feedback: 'Hear what students think, and get it fixed.',
  executive: 'Lead the club. Talk to the principal. Make the calls.',
};

// A photo that fades in from the page and back out, then its line.
const Beat = ({ photo, width, title, body }: { photo: ImageSourcePropType; width: number; title: string; body: string }) => {
  const h = width * 0.78;
  return (
    <View style={{ marginTop: 64 }}>
      <View style={{ height: h }}>
        <Image source={photo} resizeMode="cover" accessibilityIgnoresInvertColors style={{ width: '100%', height: h }} />
        <LinearGradient colors={[BG, 'rgba(7,17,29,0)', 'rgba(7,17,29,0)', BG]} locations={[0, 0.22, 0.55, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </View>
      <View style={{ paddingHorizontal: 24, marginTop: -44 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, color: INK, letterSpacing: -0.8 }}>{title}</Text>
        <Text style={{ fontSize: 16, color: SOFT, marginTop: 10, lineHeight: 23 }}>{body}</Text>
      </View>
    </View>
  );
};

// Top: one line, glass field + gold arrow.
const CodeLine = ({ r }: { r: ReturnType<typeof useRedeem> }) => (
  <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 6, minHeight: 56, borderRadius: 28, backgroundColor: 'rgba(244,241,234,0.08)', borderWidth: 1, borderColor: 'rgba(244,241,234,0.16)' }}>
      <TextInput value={r.code} onChangeText={r.setCode} onSubmitEditing={r.redeem} placeholder="Have an invite code?" placeholderTextColor={FAINT}
        autoCapitalize="characters" autoCorrect={false} returnKeyType="go" accessibilityLabel="Invite code"
        style={[{ flex: 1, fontSize: 16, color: INK, paddingVertical: 14, letterSpacing: r.code ? 2 : 0 }, webNoOutline]} />
      <Pressable onPress={r.redeem} disabled={!r.code.trim() || r.busy} accessibilityRole="button" accessibilityLabel="Join with this code"
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', opacity: !r.code.trim() ? 0.35 : pressed ? 0.8 : 1 })}>
        <Icon name="chev-r" size={18} stroke={2.6} color="#14243A" />
      </Pressable>
    </View>
    {r.msg && <Text style={{ fontSize: 14, fontWeight: '600', color: r.msg.ok ? '#9CCB8A' : '#F0A39B', paddingHorizontal: 6 }}>{r.msg.text}</Text>}
  </View>
);

// Bottom: the big one. Wide-spaced code, full gold button.
const CodeBig = ({ r }: { r: ReturnType<typeof useRedeem> }) => (
  <View style={{ gap: 12 }}>
    <TextInput value={r.code} onChangeText={r.setCode} onSubmitEditing={r.redeem} placeholder="Your code" placeholderTextColor="rgba(244,241,234,0.3)"
      autoCapitalize="characters" autoCorrect={false} returnKeyType="go" accessibilityLabel="Invite code" maxLength={16}
      style={[{ minHeight: 72, borderRadius: 20, paddingHorizontal: 20, fontSize: 28, letterSpacing: 6, textAlign: 'center', color: INK, fontFamily: fonts.mono, backgroundColor: 'rgba(7,17,29,0.6)', borderWidth: 1.5, borderColor: r.code ? GOLD : 'rgba(244,241,234,0.2)' }, webNoOutline]} />
    <Pressable onPress={r.redeem} disabled={!r.code.trim() || r.busy} accessibilityRole="button"
      style={({ pressed }) => ({ minHeight: 56, borderRadius: 18, overflow: 'hidden', opacity: !r.code.trim() ? 0.45 : pressed ? 0.85 : 1 })}>
      <LinearGradient colors={['#F1D9A4', '#E4C27E', '#C9A15B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: '#14243A' }}>{r.busy ? 'Checking…' : 'Join the club'}</Text>
        {!r.busy && <Icon name="chev-r" size={17} stroke={2.6} color="#14243A" />}
      </LinearGradient>
    </Pressable>
    {r.msg && <Text style={{ fontSize: 14, fontWeight: '600', color: r.msg.ok ? '#9CCB8A' : '#F0A39B', textAlign: 'center' }}>{r.msg.text}</Text>}
  </View>
);

const Social = ({ icon, title, sub, action, onPress }: { icon: React.ReactNode; title: string; sub: string; action: string; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${title}, ${sub}. ${action}`}
    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: pressed ? 'rgba(244,241,234,0.1)' : 'rgba(244,241,234,0.05)', borderWidth: 1, borderColor: 'rgba(244,241,234,0.1)' })}>
    {icon}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>{title}</Text>
      <Text selectable style={[{ fontSize: 14, color: SOFT, marginTop: 2 }, tnum]}>{sub}</Text>
    </View>
    <View style={{ paddingHorizontal: 14, minHeight: 34, borderRadius: 17, backgroundColor: INK, justifyContent: 'center' }}>
      <Text style={{ fontSize: 13.5, fontWeight: '800', color: BG }}>{action}</Text>
    </View>
  </Pressable>
);

// Simple drawn marks so they read at a glance (not the official logo files).
const InstagramGlyph = () => (
  <View style={{ width: 48, height: 48, borderRadius: 14, overflow: 'hidden' }}>
    <LinearGradient colors={['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <Rect x={3} y={3} width={18} height={18} rx={5.5} stroke="#fff" strokeWidth={2} fill="none" />
        <Circle cx={12} cy={12} r={4.2} stroke="#fff" strokeWidth={2} fill="none" />
        <Circle cx={17.3} cy={6.7} r={1.2} fill="#fff" />
      </Svg>
    </LinearGradient>
  </View>
);

const ClassroomGlyph = () => (
  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#1E8E3E', alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Rect x={2.5} y={4} width={19} height={14} rx={1.5} fill="#F6C026" />
      <Rect x={4} y={5.5} width={16} height={11} rx={0.8} fill="#2E7D32" />
      <Circle cx={12} cy={9.4} r={1.7} fill="#fff" />
      <Path d="M8.6 15c.4-1.9 1.8-3 3.4-3s3 1.1 3.4 3z" fill="#fff" />
      <Circle cx={7.4} cy={10.4} r={1.2} fill="#A5D6A7" />
      <Circle cx={16.6} cy={10.4} r={1.2} fill="#A5D6A7" />
      <Rect x={13.5} y={18} width={5} height={1.6} rx={0.6} fill="#fff" />
    </Svg>
  </View>
);

// Invite codes for people already in the club: a quiet link at the bottom
// of App Club that opens into a small box.
export const Redeem = () => {
  const { c } = useTheme();
  const r = useRedeem();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button"
        style={({ pressed }) => ({ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: c.link }}>Have an invite code?</Text>
      </Pressable>
    );
  }
  return (
    <Card>
      <Field label="Invite code" value={r.code} onChangeText={r.setCode} placeholder="From your manager" autoFocus autoCapitalize="characters" autoCorrect={false} returnKeyType="go" onSubmitEditing={r.redeem} />
      <Act label="Add this role" fill onPress={r.redeem} busy={r.busy} disabled={!r.code.trim()} />
      <Result msg={r.msg} />
    </Card>
  );
};
