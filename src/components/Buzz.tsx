// Sentinel — "The Buzz": one big square window on the home screen that
// rotates through banner news, trivia, quick polls and "did you know" facts.
// Auto-advances every few seconds; swiping pauses it for a while.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, G165 } from '../theme';
import { Icon } from './Icon';
import { tagColor } from './Cards';

export type BuzzSlide =
  | { id: string; kind: 'news'; tag: string; title: string; body: string; author?: string }
  | { id: string; kind: 'trivia'; prompt: string; options: string[]; answer: number }
  | { id: string; kind: 'poll'; prompt: string; options: string[] }
  | { id: string; kind: 'fact'; eyebrow: string; title: string; body: string };

const AUTO_MS = 7000;
const PAUSE_MS = 20000;

// `aspect` = height ÷ width. Home uses a taller window than the old square.
export const Buzz = ({ slides, onNews, aspect = 1 }: { slides: BuzzSlide[]; onNews?: () => void; aspect?: number }) => {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const h = Math.round(w * aspect);
  const [i, setI] = useState(0);
  const list = useRef<FlatList<BuzzSlide>>(null);
  const pausedUntil = useRef(0);
  const idx = useRef(0);

  // Auto-rotate.
  useEffect(() => {
    if (!w || slides.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const next = (idx.current + 1) % slides.length;
      list.current?.scrollToOffset({ offset: next * w, animated: true });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [w, slides.length]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const n = Math.round(e.nativeEvent.contentOffset.x / w);
    idx.current = n;
    setI(n);
  };
  const pause = () => { pausedUntil.current = Date.now() + PAUSE_MS; };

  return (
    <View style={{ paddingHorizontal: 20 }} onLayout={e => setW(Math.floor(e.nativeEvent.layout.width - 40))}>
      {w > 0 && (
        <View style={[{ width: w, height: h, borderRadius: 24, overflow: 'hidden', backgroundColor: c.white, borderWidth: 1, borderColor: c.line }, shadow.md]}>
          <FlatList
            ref={list}
            data={slides}
            keyExtractor={s => s.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={pause}
            onMomentumScrollEnd={onScrollEnd}
            getItemLayout={(_, n) => ({ length: w, offset: w * n, index: n })}
            renderItem={({ item }) => (
              <View style={{ width: w, height: h }}>
                <Slide s={item} onNews={onNews} onTouch={pause} />
              </View>
            )}
          />
          {/* dots */}
          <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}>
            {slides.map((s, n) => (
              <View key={s.id} style={{
                width: n === i ? 18 : 6, height: 6, borderRadius: 3,
                backgroundColor: s.kind === 'news' ? (n === i ? '#fff' : 'rgba(255,255,255,0.4)') : (n === i ? c.sky : c.line),
              }} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const Slide = ({ s, onNews, onTouch }: { s: BuzzSlide; onNews?: () => void; onTouch: () => void }) => {
  switch (s.kind) {
    case 'news': return <NewsSlide s={s} onPress={onNews} />;
    case 'trivia': return <TriviaSlide s={s} onTouch={onTouch} />;
    case 'poll': return <PollSlide s={s} onTouch={onTouch} />;
    case 'fact': return <FactSlide s={s} />;
  }
};

const Eyebrow = ({ text, color }: { text: string; color: string }) => (
  <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color }}>{text}</Text>
);

// Banner news — sky-blue gradient (the Buzz's lighter, more playful blue),
// big serif headline.
const NewsSlide = ({ s, onPress }: { s: Extract<BuzzSlide, { kind: 'news' }>; onPress?: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient colors={[c.sky, c.sky600, c.navy700]} locations={[0, 0.55, 1]} start={G165.start} end={G165.end} style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="pin" size={14} stroke={1.8} color="#fff" />
          <Eyebrow text={s.tag} color="rgba(255,255,255,0.75)" />
        </View>
        <View style={{ paddingBottom: 18 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: '#fff' }} numberOfLines={4}>
            {s.title}
          </Text>
          <Text numberOfLines={3} style={{ fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.75)', marginTop: 10 }}>
            {s.body}
          </Text>
          {!!s.author && <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 10 }}>{s.author} · tap to read</Text>}
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const Option = ({ label, state, onPress }: { label: string; state: 'idle' | 'right' | 'wrong' | 'dim' | 'picked'; onPress: () => void }) => {
  const { c } = useTheme();
  const bg = state === 'right' ? c.moss : state === 'wrong' ? c.crimson : state === 'picked' ? c.sky : c.skyTint;
  const fg = state === 'idle' || state === 'dim' ? c.ink : '#fff';
  return (
    <Pressable onPress={onPress} disabled={state !== 'idle'} style={({ pressed }) => ({
      height: 42, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center',
      backgroundColor: bg, borderWidth: 1, borderColor: state === 'idle' || state === 'dim' ? c.line : bg,
      opacity: pressed ? 0.7 : state === 'dim' ? 0.45 : 1,
    })}>
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: fg, letterSpacing: -0.2 }}>{label}</Text>
    </Pressable>
  );
};

const TriviaSlide = ({ s, onTouch }: { s: Extract<BuzzSlide, { kind: 'trivia' }>; onTouch: () => void }) => {
  const { c } = useTheme();
  const [pick, setPick] = useState<number | null>(null);
  const done = pick !== null;
  return (
    <View style={{ flex: 1, padding: 22, justifyContent: 'space-between', backgroundColor: c.white }}>
      <View>
        <Eyebrow text="Trivia" color={c.sky600} />
        <Text style={{ fontSize: 21, lineHeight: 26, fontWeight: '600', letterSpacing: -0.4, color: c.ink, marginTop: 8 }} numberOfLines={3}>
          {s.prompt}
        </Text>
      </View>
      <View style={{ gap: 8, paddingBottom: 18 }}>
        {s.options.map((o, n) => (
          <Option
            key={o}
            label={o}
            state={!done ? 'idle' : n === s.answer ? 'right' : n === pick ? 'wrong' : 'dim'}
            onPress={() => { onTouch(); setPick(n); }}
          />
        ))}
        {done && (
          <Text style={{ fontSize: 12.5, color: pick === s.answer ? c.moss : c.ink3, fontWeight: '600', marginTop: 2 }}>
            {pick === s.answer ? 'Nice, got it.' : `Nope. It's ${s.options[s.answer]}.`}
          </Text>
        )}
      </View>
    </View>
  );
};

const PollSlide = ({ s, onTouch }: { s: Extract<BuzzSlide, { kind: 'poll' }>; onTouch: () => void }) => {
  const { c } = useTheme();
  const [pick, setPick] = useState<number | null>(null);
  return (
    <View style={{ flex: 1, padding: 22, justifyContent: 'space-between', backgroundColor: c.white }}>
      <View>
        <Eyebrow text="Quick poll" color={c.sky600} />
        <Text style={{ fontSize: 21, lineHeight: 26, fontWeight: '600', letterSpacing: -0.4, color: c.ink, marginTop: 8 }} numberOfLines={3}>
          {s.prompt}
        </Text>
      </View>
      <View style={{ gap: 8, paddingBottom: 18 }}>
        {s.options.map((o, n) => (
          <Option
            key={o}
            label={o}
            state={pick === null ? 'idle' : n === pick ? 'picked' : 'dim'}
            onPress={() => { onTouch(); setPick(n); }}
          />
        ))}
        {pick !== null && <Text style={{ fontSize: 12.5, color: c.ink3, fontWeight: '600', marginTop: 2 }}>Thanks, vote counted.</Text>}
      </View>
    </View>
  );
};

const FactSlide = ({ s }: { s: Extract<BuzzSlide, { kind: 'fact' }> }) => {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, padding: 22, justifyContent: 'space-between', backgroundColor: c.skyTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={15} stroke={1.8} color={c.sky600} />
        <Eyebrow text={s.eyebrow} color={c.sky600} />
      </View>
      <View style={{ paddingBottom: 18 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, color: c.ink }} numberOfLines={4}>
          {s.title}
        </Text>
        <Text numberOfLines={3} style={{ fontSize: 13.5, lineHeight: 19, color: c.ink3, marginTop: 10 }}>{s.body}</Text>
      </View>
    </View>
  );
};
