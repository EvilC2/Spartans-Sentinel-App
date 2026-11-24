// Spartans — "The Buzz": one big window on the home screen that rotates
// through whatever App Club Admin has put in it: banner news, trivia, quick
// polls, "did you know" facts, cafeteria specials and club events.
// Auto-advances every few seconds; swiping pauses it for a while.
// Answers and votes are saved through the content store, so a trivia answer
// sticks and a poll shows how everyone voted.
// Any slide may carry a photo (`image`): it fills the window behind a dark
// wash and the text goes white.

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, Image, StyleSheet, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G165 } from '../theme';
import { Icon } from './Icon';
import { useContent, Post } from '../content';
import { FOOD_ART, MENU } from '../menu';
import { fromISO, MONTH_NAMES } from '../calendar';
import { fmt12 } from '../bell';

type Pic = { image?: string | null };
export type BuzzSlide = Pic & (
  | { id: string; kind: 'news'; tag: string; title: string; body: string; author?: string }
  | { id: string; kind: 'trivia'; prompt: string; options: string[]; answer: number; explain?: string }
  | { id: string; kind: 'poll'; prompt: string; options: string[]; showResults?: boolean }
  | { id: string; kind: 'fact'; eyebrow: string; title: string; body: string }
  | { id: string; kind: 'menu'; name: string; price?: number | null; blurb: string; art?: string; itemId?: string; soldOut?: boolean }
  | { id: string; kind: 'event'; title: string; date: string; time?: string; place?: string; body?: string });

// A post as a slide. Pop-ups never sit in The Buzz, but just in case they
// show as a plain card.
export const postToSlide = (p: Post): BuzzSlide => {
  switch (p.kind) {
    case 'news': return { id: p.id, kind: 'news', tag: p.data.category, title: p.data.title, body: p.data.body, author: p.data.author, image: p.data.image };
    case 'trivia': return { id: p.id, kind: 'trivia', ...p.data };
    case 'poll': return { id: p.id, kind: 'poll', ...p.data };
    case 'fact': return { id: p.id, kind: 'fact', ...p.data };
    case 'menu': return { id: p.id, kind: 'menu', name: p.data.name, price: p.data.price, blurb: p.data.blurb, art: p.data.art, itemId: p.data.itemId, soldOut: p.data.soldOut, image: p.data.image };
    case 'event': return { id: p.id, kind: 'event', title: p.data.title, date: p.data.date, time: p.data.time, place: p.data.place, body: p.data.body, image: p.data.image };
    case 'popup': return { id: p.id, kind: 'fact', eyebrow: 'Heads up', title: p.data.title, body: p.data.body, image: p.data.image };
  }
};

// Admin previews: taps work, but nothing is saved or counted.
const PreviewCtx = createContext(false);

const AUTO_MS = 7000;
const PAUSE_MS = 20000;

// `aspect` = height ÷ width. Home uses a taller window than the old square.
// `focus` (admin preview): jump to that slide and hold it there a while.
export const Buzz = ({ slides, onOpen, aspect = 1, preview = false, focus }: { slides: BuzzSlide[]; onOpen?: (s: BuzzSlide) => void; aspect?: number; preview?: boolean; focus?: { id: string; at: number } | null }) => {
  const { c } = useTheme();
  const { seen } = useContent();
  const [w, setW] = useState(0);
  const h = Math.round(w * aspect);
  // The frame's 1pt border sits inside its width, so the list pages by 2pt less
  // than the frame. Slides must be exactly that wide: any wider and every swipe
  // leaves the next one a little further off to the side.
  const sw = Math.max(0, w - 2);
  const [i, setI] = useState(0);
  const list = useRef<FlatList<BuzzSlide>>(null);
  const pausedUntil = useRef(0);
  const idx = useRef(0);

  // Count a view for whichever slide is showing.
  useEffect(() => { const s = slides[Math.min(i, slides.length - 1)]; if (s && !preview) seen([s.id]); }, [i, slides, seen, preview]);

  // Auto-rotate.
  useEffect(() => {
    if (!w || slides.length < 2) return;
    const id = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const next = (idx.current + 1) % slides.length;
      list.current?.scrollToOffset({ offset: next * sw, animated: true });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [w, slides.length]);

  useEffect(() => {
    if (!focus || !w) return;
    const n = slides.findIndex(s => s.id === focus.id);
    if (n < 0) return;
    pausedUntil.current = Date.now() + PAUSE_MS;
    idx.current = n;
    setI(n);
    list.current?.scrollToOffset({ offset: n * sw, animated: true });
  }, [focus?.id, focus?.at, w]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const n = Math.round(e.nativeEvent.contentOffset.x / sw);
    idx.current = n;
    setI(n);
  };
  const pause = () => { pausedUntil.current = Date.now() + PAUSE_MS; };

  if (!slides.length) {
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ borderRadius: 24, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed', padding: 22, alignItems: 'center', gap: 6 }}>
          <Icon name="sparkle" size={22} stroke={1.8} color={c.ink4} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink2 }}>Nothing in The Buzz right now</Text>
          <Text style={{ fontSize: 12.5, color: c.ink3, textAlign: 'center' }}>Trivia, polls and news from the App Club show up here.</Text>
        </View>
      </View>
    );
  }

  return (
    <PreviewCtx.Provider value={preview}>
    <View style={{ paddingHorizontal: preview ? 0 : 20 }} onLayout={e => setW(Math.floor(e.nativeEvent.layout.width - (preview ? 0 : 40)))}>
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
            getItemLayout={(_, n) => ({ length: sw, offset: sw * n, index: n })}
            renderItem={({ item }) => (
              <View style={{ width: sw, height: h - 2 }}>
                <Slide s={item} onOpen={onOpen} onTouch={pause} />
              </View>
            )}
          />
          {/* dots */}
          <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}>
            {slides.map((s, n) => {
              const onDark = !!s.image || s.kind === 'news' || s.kind === 'event';
              return (
                <View key={s.id} style={{
                  width: n === i ? 18 : 6, height: 6, borderRadius: 3,
                  backgroundColor: onDark ? (n === i ? '#fff' : 'rgba(255,255,255,0.4)') : (n === i ? c.sky : c.line),
                }} />
              );
            })}
          </View>
        </View>
      )}
    </View>
    </PreviewCtx.Provider>
  );
};

// Answer state: saved through the store, or kept in the slide for previews.
const useAnswer = (id: string) => {
  const preview = useContext(PreviewCtx);
  const store = useContent();
  const [local, setLocal] = useState<number | null>(null);
  if (preview) return { pick: local, tally: { counts: [] as number[], total: 0 }, answer: (n: number) => setLocal(n) };
  return { pick: store.mine(id).choice ?? null, tally: store.tally(id), answer: (n: number) => store.answer(id, n) };
};

const Slide = ({ s, onOpen, onTouch }: { s: BuzzSlide; onOpen?: (s: BuzzSlide) => void; onTouch: () => void }) => {
  switch (s.kind) {
    case 'news': return <NewsSlide s={s} onPress={onOpen && (() => onOpen(s))} />;
    case 'trivia': return <TriviaSlide s={s} onTouch={onTouch} />;
    case 'poll': return <PollSlide s={s} onTouch={onTouch} />;
    case 'fact': return <FactSlide s={s} />;
    case 'menu': return <MenuSlide s={s} onPress={onOpen && (() => onOpen(s))} />;
    case 'event': return <EventSlide s={s} onPress={onOpen && (() => onOpen(s))} />;
  }
};

// The photo behind a slide: cover, then a wash that darkens towards the
// bottom so the text and answer rows read. Sits first in the slide; the
// slide's own content goes on top.
const Photo = ({ uri }: { uri: string }) => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    <LinearGradient colors={['rgba(8,16,28,0.30)', 'rgba(8,16,28,0.50)', 'rgba(8,16,28,0.86)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
  </View>
);
const W = { text: '#fff', soft: 'rgba(255,255,255,0.78)', faint: 'rgba(255,255,255,0.6)' };

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
        {!!s.image && <Photo uri={s.image} />}
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

type OptState = 'idle' | 'right' | 'wrong' | 'dim' | 'picked';

// One answer row. With `share` (0–1) it fills like a bar to show results.
const Option = ({ label, state, onPress, share, disabled, dark }: { label: string; state: OptState; onPress: () => void; share?: number; disabled?: boolean; dark?: boolean }) => {
  const { c } = useTheme();
  // On a photo the rows are frosted white glass instead of sky tint.
  const tint = dark ? 'rgba(255,255,255,0.18)' : c.skyTint;
  const line = dark ? 'rgba(255,255,255,0.28)' : c.line;
  const ink = dark ? '#fff' : c.ink;
  const bg = state === 'right' ? c.moss : state === 'wrong' ? c.crimson : state === 'picked' ? c.sky : tint;
  const fg = state === 'idle' || state === 'dim' ? ink : '#fff';
  const bar = share !== undefined;
  return (
    <Pressable onPress={onPress} disabled={disabled ?? state !== 'idle'} style={({ pressed }) => ({
      height: 42, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', overflow: 'hidden',
      backgroundColor: bar && state !== 'right' && state !== 'wrong' ? tint : bg,
      borderWidth: 1, borderColor: state === 'idle' || state === 'dim' ? line : bg,
      opacity: pressed ? 0.7 : state === 'dim' && !bar ? 0.45 : 1,
    })}>
      {bar && state !== 'right' && state !== 'wrong' && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(share! * 100)}%`, backgroundColor: state === 'picked' ? c.sky : dark ? 'rgba(255,255,255,0.22)' : 'rgba(59,139,217,0.22)' }} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: bar && state === 'dim' ? ink : fg, letterSpacing: -0.2 }}>{label}</Text>
        {bar && <Text style={[{ fontSize: 13, fontWeight: '700', color: bar && state === 'dim' ? (dark ? W.soft : c.ink2) : fg }, tnum]}>{Math.round(share! * 100)}%</Text>}
      </View>
    </Pressable>
  );
};

const TriviaSlide = ({ s, onTouch }: { s: Extract<BuzzSlide, { kind: 'trivia' }>; onTouch: () => void }) => {
  const { c } = useTheme();
  const { pick, tally: t, answer: choose } = useAnswer(s.id);
  const done = pick !== null;
  const right = t.total ? Math.round((t.counts[s.answer] / t.total) * 100) : null;
  const dark = !!s.image;
  return (
    <View style={{ flex: 1, padding: 22, justifyContent: 'space-between', backgroundColor: c.white }}>
      {dark && <Photo uri={s.image!} />}
      <View>
        <Eyebrow text="Trivia" color={dark ? W.soft : c.sky600} />
        <Text style={{ fontSize: 21, lineHeight: 26, fontWeight: '600', letterSpacing: -0.4, color: dark ? W.text : c.ink, marginTop: 8 }} numberOfLines={3}>
          {s.prompt}
        </Text>
      </View>
      <View style={{ gap: 8, paddingBottom: 18 }}>
        {s.options.map((o, n) => (
          <Option
            key={n}
            label={o}
            state={!done ? 'idle' : n === s.answer ? 'right' : n === pick ? 'wrong' : 'dim'}
            onPress={() => { onTouch(); choose(n); }}
            dark={dark}
          />
        ))}
        {done && (
          <Text numberOfLines={2} style={{ fontSize: 12.5, color: dark ? W.text : pick === s.answer ? c.moss : c.ink3, fontWeight: '600', marginTop: 2 }}>
            {pick === s.answer ? 'Nice, got it.' : `Nope. It's ${s.options[s.answer]}.`}
            {right !== null && t.total > 1 ? ` ${right}% of students got it.` : ''}
            {s.explain ? ` ${s.explain}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
};

const PollSlide = ({ s, onTouch }: { s: Extract<BuzzSlide, { kind: 'poll' }>; onTouch: () => void }) => {
  const { c } = useTheme();
  const { pick, tally: t, answer: choose } = useAnswer(s.id);
  const show = pick !== null && s.showResults !== false;
  const dark = !!s.image;
  return (
    <View style={{ flex: 1, padding: 22, justifyContent: 'space-between', backgroundColor: c.white }}>
      {dark && <Photo uri={s.image!} />}
      <View>
        <Eyebrow text="Quick poll" color={dark ? W.soft : c.sky600} />
        <Text style={{ fontSize: 21, lineHeight: 26, fontWeight: '600', letterSpacing: -0.4, color: dark ? W.text : c.ink, marginTop: 8 }} numberOfLines={3}>
          {s.prompt}
        </Text>
      </View>
      <View style={{ gap: 8, paddingBottom: 18 }}>
        {s.options.map((o, n) => (
          <Option
            key={n}
            label={o}
            state={pick === null ? 'idle' : n === pick ? 'picked' : 'dim'}
            share={show ? (t.total ? t.counts[n] / t.total : 0) : undefined}
            disabled={n === pick}
            onPress={() => { onTouch(); choose(n); }}
            dark={dark}
          />
        ))}
        {pick !== null && (
          <Text style={[{ fontSize: 12.5, color: dark ? W.soft : c.ink3, fontWeight: '600', marginTop: 2 }, tnum]}>
            {show ? `${t.total} ${t.total === 1 ? 'vote' : 'votes'} · tap another to change yours` : 'Thanks, vote counted.'}
          </Text>
        )}
      </View>
    </View>
  );
};

const FactSlide = ({ s }: { s: Extract<BuzzSlide, { kind: 'fact' }> }) => {
  const { c } = useTheme();
  const dark = !!s.image;
  return (
    <View style={{ flex: 1, padding: 22, justifyContent: 'space-between', backgroundColor: c.skyTint }}>
      {dark && <Photo uri={s.image!} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={15} stroke={1.8} color={dark ? W.text : c.sky600} />
        <Eyebrow text={s.eyebrow} color={dark ? W.soft : c.sky600} />
      </View>
      <View style={{ paddingBottom: 18 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, color: dark ? W.text : c.ink }} numberOfLines={4}>
          {s.title}
        </Text>
        <Text numberOfLines={3} style={{ fontSize: 13.5, lineHeight: 19, color: dark ? W.soft : c.ink3, marginTop: 10 }}>{s.body}</Text>
      </View>
    </View>
  );
};

// Cafeteria special: big food art, name and price. Tap for the menu.
const MenuSlide = ({ s, onPress }: { s: Extract<BuzzSlide, { kind: 'menu' }>; onPress?: () => void }) => {
  const { c } = useTheme();
  const art = (s.art && (FOOD_ART as Record<string, any>)[s.art]) || MENU.find(m => m.id === s.itemId)?.icon || FOOD_ART.plate;
  const dark = !!s.image;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.9 : 1, backgroundColor: c.goldTint, padding: 22, justifyContent: 'space-between' })}>
      {dark && <Photo uri={s.image!} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="fork" size={15} stroke={1.8} color={dark ? W.text : c.gold} />
        <Eyebrow text="Today at the caf" color={dark ? W.soft : c.gold} />
      </View>
      {!dark && <Image source={art} style={{ width: 120, height: 120, alignSelf: 'center' }} resizeMode="contain" />}
      <View style={{ paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: dark ? W.text : c.ink }}>{s.name}</Text>
          {s.price != null && <Text style={[{ fontSize: 20, fontWeight: '700', color: dark ? W.text : c.ink }, tnum]}>${s.price.toFixed(2)}</Text>}
        </View>
        <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, color: dark ? W.soft : c.ink3, marginTop: 6 }}>{s.soldOut ? 'Sold out for today.' : s.blurb}</Text>
      </View>
    </Pressable>
  );
};

// Club event: navy, date block on the left.
const EventSlide = ({ s, onPress }: { s: Extract<BuzzSlide, { kind: 'event' }>; onPress?: () => void }) => {
  const { c } = useTheme();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? fromISO(s.date) : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient colors={[c.navy700, c.navy900]} start={G165.start} end={G165.end} style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}>
        {!!s.image && <Photo uri={s.image} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="calendar" size={14} stroke={1.8} color="#fff" />
          <Eyebrow text="Coming up" color="rgba(255,255,255,0.75)" />
        </View>
        <View style={{ paddingBottom: 18, gap: 14 }}>
          {d && (
            <View style={{ alignSelf: 'flex-start', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>{MONTH_NAMES[d.getMonth()].slice(0, 3)}</Text>
              <Text style={[{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 32, color: '#fff' }, tnum]}>{d.getDate()}</Text>
            </View>
          )}
          <Text numberOfLines={3} style={{ fontFamily: fonts.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, color: '#fff' }}>{s.title}</Text>
          <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.75)' }}>
            {[s.time ? fmt12(s.time, true) : null, s.place].filter(Boolean).join(' · ') || s.body}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
};
