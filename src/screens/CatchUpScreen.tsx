// Spartans — Catch Up flow: intro, the questions, then the reveal. Answers and
// badge rules live in src/catchUp.ts; App.tsx decides when this shows.
// Covers the tabs rather than sitting in a Modal, so a banner can still appear
// over it without iOS refusing a second modal.
// `practice` (owner only, Developer screen): any grade, starts empty, saves
// nothing and gives nothing; the reveal shows what the answers would earn.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, tnum, G165 } from '../theme';
import { Icon, Check } from '../components/Icon';
import { BadgeArt } from '../components/BadgeArt';
import { CatchUpReveal } from '../components/CatchUpReveal';
import { useProfile } from '../ProfileContext';
import { Badge, BADGES, UNLOCKED } from '../badges';
import { isCatchUpBadge } from '../earned';
import { gradeXp } from '../xp';
import { Answers, CATCH_UP_NAME, Question, badgesFrom, firstUnanswered, optionsOf, questionsFor, revealOrder, scoreFor } from '../catchUp';

const TEASE = ['welcome-to-sentinel', 'friday-night-lights', 'top-dog', 'honor-roll', 'on-stage'];

export default function CatchUpScreen({ topInset, bottomInset, onClose, practice }: {
  topInset: number; bottomInset: number; onClose: () => void; practice?: { grade: number } | null;
}) {
  const { profile, saveCatchUpProgress: saveReal, finishCatchUp } = useProfile();
  const [practiceGrade, setPracticeGrade] = useState(practice?.grade ?? 8);
  const grade = practice ? practiceGrade : profile?.grade ?? 8;
  const saveCatchUpProgress = practice ? () => {} : saveReal;
  const [answers, setAnswers] = useState<Answers>(() => (practice ? {} : profile?.catchUp?.answers || {}));
  const [step, setStep] = useState<'intro' | number>('intro');
  const [reveal, setReveal] = useState<Badge[] | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => questionsFor(grade, answers), [grade, answers]);

  // Finished on another phone: the server copy landed while the intro was up.
  const doneElsewhere = !practice && !!profile?.catchUp?.doneAt && step === 'intro' && !reveal;
  useEffect(() => { if (doneElsewhere) onClose(); }, [doneElsewhere]);   // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    const owned = Object.keys(UNLOCKED).filter(id => !isCatchUpBadge(id));
    const ids = badgesFrom(grade, answers, owned);
    if (practice) { setReveal(revealOrder(BADGES.filter(b => ids.includes(b.id)))); return; }
    setReveal(await finishCatchUp(answers, ids));
  };

  if (reveal) return <CatchUpReveal badges={reveal} grade={grade} topInset={topInset} bottomInset={bottomInset} onDone={onClose} />;

  if (step === 'intro') {
    const score = practice ? 0 : profile?.catchUp?.score || 0;
    return (
      <Intro
        grade={grade} score={score} topInset={topInset} bottomInset={bottomInset}
        practice={practice ? { grade: practiceGrade, setGrade: g => { setPracticeGrade(g); setAnswers({}); } } : undefined}
        onStart={() => setStep(score ? firstUnanswered(grade, answers) : 0)}
        onLater={onClose}
      />
    );
  }

  const i = Math.min(step, list.length - 1);
  const last = i === list.length - 1;
  const next = (a: Answers) => {
    saveCatchUpProgress(a, scoreFor(grade, a));
    if (last) claim(); else setStep(i + 1);
  };

  return (
    <Ask
      key={list[i].id}
      q={list[i]} grade={grade} answers={answers} index={i} total={list.length} last={last} busy={busy}
      topInset={topInset} bottomInset={bottomInset}
      onAnswer={setAnswers}
      onNext={next}
      onBack={() => setStep(i === 0 ? 'intro' : i - 1)}
      onLater={() => { saveCatchUpProgress(answers, scoreFor(grade, answers)); onClose(); }}
    />
  );
}

// ── Intro ─────────────────────────────────────────────────────────
const Intro = ({ grade, score, topInset, bottomInset, onStart, onLater, practice }: {
  grade: number; score: number; topInset: number; bottomInset: number; onStart: () => void; onLater: () => void;
  practice?: { grade: number; setGrade: (g: number) => void };
}) => {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [rise]);
  const tease = TEASE.map(id => BADGES.find(b => b.id === id)).filter((b): b is Badge => !!b);
  const xp = gradeXp(grade);

  return (
    <LinearGradient colors={['#14304E', '#0E2238', '#071423']} start={G165.start} end={G165.end} style={{ flex: 1, paddingTop: topInset + 24, paddingBottom: bottomInset + 20, paddingHorizontal: 24 }}>
      <Animated.View style={{ flex: 1, justifyContent: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 32 }}>
          {tease.map((b, n) => {
            const size = n === 2 ? 104 : n === 1 || n === 3 ? 76 : 56;
            return <View key={b.id} style={{ marginHorizontal: -4 }}><BadgeArt badge={b} size={size} locked /></View>;
          })}
        </View>
        <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#E8D8AE', textTransform: 'uppercase' }}>{CATCH_UP_NAME}</Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 36, lineHeight: 41, letterSpacing: -0.8, color: '#fff', marginTop: 8 }}>
          Get what you would have earned.
        </Text>
        <Text style={{ fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.82)', marginTop: 14 }}>
          You didn't have this app on your first day at Sentinel. Tell us what you've done since, and you'll get the badges and XP you would already have.
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)', marginTop: 14 }}>
          It takes about 2 minutes and runs on the honour system, so answer truthfully.
          {xp > 0 ? ` Grade ${grade} already counts for ${xp.toLocaleString()} XP.` : ''}
        </Text>
        {practice && (
          <View style={{ marginTop: 22, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1.2, color: '#E8D8AE', textTransform: 'uppercase' }}>Practice run · nothing is saved</Text>
            <Text style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Answer as a student in</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              {[8, 9, 10, 11, 12].map(g => {
                const on = g === practice.grade;
                return (
                  <Pressable
                    key={g}
                    onPress={() => practice.setGrade(g)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Grade ${g}`}
                    style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#E8D8AE' : 'rgba(255,255,255,0.1)', opacity: pressed ? 0.8 : 1 })}
                  >
                    <Text style={[{ fontSize: 15, fontWeight: '700', color: on ? '#0E2238' : '#fff' }, tnum]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </Animated.View>

      <Pressable
        onPress={onStart}
        accessibilityRole="button"
        style={({ pressed }) => ({ height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8D8AE', opacity: pressed ? 0.85 : 1 })}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#0E2238' }}>{score ? `Keep going (${score}% done)` : 'Start'}</Text>
      </Pressable>
      <Pressable onPress={onLater} accessibilityRole="button" style={{ height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>{practice ? 'Close practice' : 'Not now'}</Text>
      </Pressable>
    </LinearGradient>
  );
};

// ── One question ──────────────────────────────────────────────────
const Ask = ({ q, grade, answers, index, total, last, busy, topInset, bottomInset, onAnswer, onNext, onBack, onLater }: {
  q: Question; grade: number; answers: Answers; index: number; total: number; last: boolean; busy: boolean;
  topInset: number; bottomInset: number;
  onAnswer: (a: Answers) => void; onNext: (a: Answers) => void; onBack: () => void; onLater: () => void;
}) => {
  const { c } = useTheme();
  const options = optionsOf(q, grade, answers);
  const value = answers[q.id];
  const picked: string[] = Array.isArray(value) ? value : value ? [value] : [];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const tap = (id: string) => {
    if (q.multi) {
      onAnswer({ ...answers, [q.id]: picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id] });
      return;
    }
    const a = { ...answers, [q.id]: id };
    onAnswer(a);
    // Single choice moves on by itself, after a beat to see the tick. The last
    // question waits for the button, since that one gives out the badges.
    if (!last) timer.current = setTimeout(() => onNext(a), 180);
  };

  const proceed = () => onNext(q.multi && !Array.isArray(value) ? { ...answers, [q.id]: [] } : answers);
  const ready = q.multi || picked.length > 0;
  const label = last ? 'Get my badges' : q.multi && picked.length === 0 ? 'None of these' : 'Next';

  return (
    <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: topInset }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 52 }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chev-l" size={18} stroke={2.2} color={c.ink2} />
        </Pressable>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Question ${index + 1} of ${total}`}
          style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden', marginHorizontal: 6 }}
        >
          <View style={{ width: `${((index + 1) / total) * 100}%`, height: '100%', backgroundColor: c.gold, borderRadius: 3 }} />
        </View>
        <Pressable onPress={onLater} accessibilityRole="button" accessibilityLabel="Finish later" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={18} stroke={2.2} color={c.ink2} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={q.art} style={{ width: 44, height: 44 }} resizeMode="contain" />
          <Text style={[{ fontSize: 13, fontWeight: '700', color: c.ink3, letterSpacing: 0.2 }, tnum]}>{q.section}</Text>
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 35, letterSpacing: -0.6, color: c.ink, marginTop: 14 }}>{q.prompt}</Text>
        {!!q.sub && <Text style={{ fontSize: 15, lineHeight: 21, color: c.ink3, marginTop: 6 }}>{q.sub}</Text>}
        {q.multi && <Text style={{ fontSize: 14, color: c.ink3, marginTop: 6 }}>Pick all that are true.</Text>}

        <View style={{ gap: 8, marginTop: 20 }}>
          {options.map(o => {
            const on = picked.includes(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => tap(o.id)}
                accessibilityRole={q.multi ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: on }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
                  backgroundColor: on ? c.goldTint : c.surface, borderWidth: 1.5, borderColor: on ? c.gold : c.line,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, lineHeight: 21, fontWeight: '600', color: c.ink }}>{o.label}</Text>
                  {!!o.sub && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>{o.sub}</Text>}
                </View>
                <View style={{
                  width: 24, height: 24, borderRadius: q.multi ? 7 : 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? c.gold : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: c.ink4,
                }}>
                  {on && <Check size={12} color="#fff" />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: bottomInset + 14, borderTopWidth: 1, borderTopColor: c.line2 }}>
        <Pressable
          onPress={proceed}
          disabled={!ready || busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || busy }}
          style={({ pressed }) => ({ height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.action, opacity: !ready || busy ? 0.4 : pressed ? 0.85 : 1 })}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>{label}</Text>
        </Pressable>
      </View>
    </View>
  );
};
