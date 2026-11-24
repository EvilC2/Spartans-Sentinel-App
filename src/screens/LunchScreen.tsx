// Spartans — Cafeteria Menu (from More or Quick links).
// Gemini Foods runs the caf. Top: a blue card with what the till takes
// (cash, change, debit, credit) and the floating gift card that opens the
// Loopz order page. Below: an Uber-Eats-style category row with 3D food art,
// tag filters, a two-column card grid (every item has its own art, see
// tools/food-art) and a "tray" tally so a student can add things up before the
// counter. Data + art map live in src/menu.ts. Not a bottom tab.
// App Club Admin menu posts change it live: today's specials (the "Today"
// strip), price changes, sold out, hidden items, new items.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Animated, Easing, Linking, ImageSourcePropType, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G155 } from '../theme';
import { Icon } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import {
  CATEGORIES, TAGS, FOOD_ART, BRAND, GIFT_CARD_URL,
  MenuItem, MenuCategory, Tag, priceLabel, inCategory, hasTag, applyMenuPosts,
} from '../menu';
import { usePosted, useContent } from '../content';
import { useFocus } from '../nav';
import { Spot, useReveal, useScrollSpot } from '../components/Spot';
import type { ScreenProps } from '../../App';

type Filter = Tag | 'cheap';

export default function LunchScreen({ topInset }: ScreenProps) {
  const { c, mode } = useTheme();
  const [cat, setCat] = useState<MenuCategory | 'all'>('all');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [tray, setTray] = useState<Record<string, number>>({});

  const toggleFilter = (f: Filter) => setFilters(fs => fs.includes(f) ? fs.filter(x => x !== f) : [...fs, f]);
  const posted = usePosted('menu', 'cafeteria');
  const { seen } = useContent();
  const menu = useMemo(() => applyMenuPosts(posted), [posted]);
  const today = menu.filter(m => m.featured);
  useEffect(() => { seen(posted.map(p => p.id)); }, [posted, seen]);

  // From a notification or The Buzz: that item, with any filter out of the way.
  const scroll = useScrollSpot();
  const [spot, setSpot] = useState<string | null>(null);
  useFocus('menu', f => {
    const m = menu.find(x => x.postId === f.id);
    if (!m) return false;
    setCat('all');
    setFilters([]);
    setSpot(m.id);
    return true;
  }, [menu]);
  useEffect(() => {
    if (!spot) return;
    const t = setTimeout(() => setSpot(null), 4000);
    return () => clearTimeout(t);
  }, [spot]);

  const items = useMemo(
    () => menu.filter(m => inCategory(m, cat) && filters.every(f => hasTag(m, f))),
    [menu, cat, filters],
  );
  const category = CATEGORIES.find(k => k.id === cat)!;

  const trayCount = Object.values(tray).reduce((a, b) => a + b, 0);
  const trayTotal = menu.reduce((sum, m) => sum + (tray[m.id] || 0) * (m.price || 0), 0);
  const trayUnpriced = menu.some(m => tray[m.id] && m.price === undefined);
  const add = (id: string) => setTray(t => ({ ...t, [id]: (t[id] || 0) + 1 }));
  const remove = (id: string) => setTray(t => { const n = (t[id] || 0) - 1; const { [id]: _, ...rest } = t; return n > 0 ? { ...rest, [id]: n } : rest; });

  return (
    <View ref={scroll.frame} collapsable={false} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView ref={scroll.ref} onScroll={scroll.onScroll} scrollEventThrottle={32} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: trayCount ? 190 : 120 }} showsVerticalScrollIndicator={false}>
        <AppHeader topInset={topInset} title="Cafeteria" back />

        {/* ── Gemini Foods + we take: cash, change, debit, credit, gift card ── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <View style={[{ borderRadius: 24, overflow: 'hidden' }, shadow.md]}>
            <LinearGradient colors={[c.sky, c.sky600, c.navy700]} {...G155} style={{ padding: 18, paddingTop: 14 }}>
              <Blob size={240} style={{ top: -120, right: -80, opacity: 0.16 }} />
              <Blob size={140} style={{ bottom: -70, left: 10, opacity: 0.12 }} />
              <Blob size={220} style={{ bottom: 20, alignSelf: 'center', opacity: 0.1 }} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.92)', letterSpacing: -0.2 }}>At the counter, we take</Text>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 10 }}>
                <PayPill art={FOOD_ART.cash} label="Cash" />
                <PayPill art={FOOD_ART.coin} label="Change" />
                <PayPill art={FOOD_ART.card} label="Debit" />
                <PayPill art={FOOD_ART.card} label="Credit" />
              </View>

              <Pressable
                onPress={() => Linking.openURL(GIFT_CARD_URL)}
                accessibilityRole="link"
                accessibilityLabel="Buy or reload a Gemini Foods gift card"
                style={({ pressed }) => ({ marginTop: 14, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <Floaty>
                  <Image source={BRAND.giftCard} style={{ width: 300, height: 209 }} resizeMode="contain" />
                </Floaty>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -6 }}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Image source={FOOD_ART.gift} style={{ width: 16, height: 16 }} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: c.navy700, letterSpacing: -0.2 }}>Gift card</Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>Tap the card to buy or reload</Text>
                </View>
              </Pressable>
            </LinearGradient>
          </View>
        </View>

        {/* ── Today: specials the App Club featured ──────────── */}
        {today.length > 0 && (
          <View style={{ paddingTop: 22 }}>
            <Text style={{ paddingHorizontal: 20, fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: c.ink, marginBottom: 10 }}>Today</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {today.map(m => (
                <Pressable key={m.id} onPress={() => !m.soldOut && add(m.id)} disabled={m.soldOut} accessibilityRole="button"
                  accessibilityLabel={`${m.name}${m.price !== undefined ? `, ${priceLabel(m.price)}` : ''}${m.soldOut ? ', sold out' : ''}`}
                  style={({ pressed }) => ({ width: 250, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: c.goldTint, opacity: m.soldOut ? 0.55 : pressed ? 0.85 : 1 })}>
                  <Image source={m.icon} style={{ width: 56, height: 56 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: c.gold }}>{m.soldOut ? 'Sold out' : 'Special'}</Text>
                    <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 1 }}>{m.name}</Text>
                    <Text numberOfLines={1} style={[{ fontSize: 12.5, color: c.ink3, marginTop: 2 }, tnum]}>{[m.price !== undefined ? priceLabel(m.price) : 'Ask at counter', m.blurb].filter(Boolean).join(' · ')}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Categories (Uber Eats style) ───────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, gap: 4 }}>
          {CATEGORIES.map(k => {
            const on = k.id === cat;
            return (
              <Pressable key={k.id} onPress={() => setCat(k.id)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({ alignItems: 'center', width: 76, opacity: pressed ? 0.7 : 1 })}>
                <View style={{
                  width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? c.skyTint : c.surface,
                }}>
                  <Image source={k.icon} style={{ width: 40, height: 40 }} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: on ? '700' : '500', color: on ? c.navy700 : c.ink2, marginTop: 6, letterSpacing: -0.2 }}>{k.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── Tag filters ────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, gap: 8 }}>
          {TAGS.map(t => (
            <Chip key={t.id} label={t.label} art={t.icon} icon={t.id === 'cheap' ? 'tag' : undefined} on={filters.includes(t.id)} onPress={() => toggleFilter(t.id)} />
          ))}
        </ScrollView>

        {/* ── Grid ───────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: category.note ? 4 : 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', letterSpacing: -0.3, color: c.ink }}>{cat === 'all' ? 'Everything' : category.label}</Text>
            <Text style={{ fontSize: 12, color: c.ink3, fontWeight: '500' }}>{items.length} {items.length === 1 ? 'item' : 'items'}</Text>
          </View>
          {!!category.note && <Text style={{ fontSize: 12.5, color: c.crimson, fontWeight: '600', marginBottom: 10 }}>{category.note}</Text>}
          {items.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Image source={FOOD_ART.cookie} style={{ width: 64, height: 64, opacity: 0.6 }} />
              <Text style={{ fontSize: 13, color: c.ink3, marginTop: 10 }}>Nothing matches. Loosen a filter.</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {items.map(m => (
              <FoodCard key={m.id} m={m} spot={spot === m.id} bring={scroll.bring} count={tray[m.id] || 0} onAdd={() => add(m.id)} onRemove={() => remove(m.id)} />
            ))}
          </View>
        </View>

        <Text style={{ paddingTop: 24, paddingHorizontal: 20, textAlign: 'center', fontSize: 12, color: c.ink4, letterSpacing: 0.2, lineHeight: 17 }}>
          Prices from the Gemini Foods menus, Sept 2026. Items without a price: ask at the counter.{'\n'}Food art: Fluent Emoji and Spartans originals.
        </Text>
      </ScrollView>

      {/* ── Tray bar ───────────────────────────────────────── */}
      {trayCount > 0 && (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 104 }}>
          <View style={[{ backgroundColor: mode === 'dark' ? c.surface : c.navy900, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, shadow.lg]}>
            <Image source={FOOD_ART.plate} style={{ width: 32, height: 32 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>Price checker</Text>
              <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600', marginTop: 1 }}>{trayCount} {trayCount === 1 ? 'item' : 'items'}{trayUnpriced ? ' · some unpriced' : ''}</Text>
            </View>
            <Text style={[{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }, tnum]}>{priceLabel(trayTotal)}{trayUnpriced ? '+' : ''}</Text>
            <Pressable onPress={() => setTray({})} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear price checker" style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', opacity: pressed ? 0.6 : 1 })}>
              <Icon name="close" size={14} stroke={2.2} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Food card ───────────────────────────────────────────────────
// Which tags get a pill on the card, in priority order (max two shown).
const PILL: Partial<Record<Tag, { label: string; tint: (c: any) => string; ink: (c: any) => string }>> = {
  popular: { label: 'Popular', tint: c => c.goldTint, ink: c => c.gold },
  gf: { label: 'GF', tint: c => c.skyTint, ink: c => c.sky600 },
  veg: { label: 'Veg', tint: () => '#E4F2DF', ink: c => c.moss },
  healthy: { label: 'Healthy', tint: () => '#E4F2DF', ink: c => c.moss },
};
const PILL_ORDER: Tag[] = ['popular', 'gf', 'veg', 'healthy'];

const FoodCard = ({ m, spot, bring, count, onAdd, onRemove }: { m: MenuItem; spot: boolean; bring: (n: View | null) => void; count: number; onAdd: () => void; onRemove: () => void }) => {
  const { c } = useTheme();
  const card = useRef<View>(null);
  useReveal(spot, card, bring);
  const scale = useRef(new Animated.Value(1)).current;
  const bump = () => {
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
    ]).start();
  };
  const pills = PILL_ORDER.filter(t => m.tags.includes(t)).slice(0, m.sometimes || m.soldOut ? 1 : 2);
  const priced = m.price !== undefined;
  return (
    <Pressable
      ref={card}
      onPress={() => { bump(); onAdd(); }}
      disabled={m.soldOut}
      accessibilityRole="button"
      accessibilityLabel={priced ? `${m.name}, ${priceLabel(m.price!)}` : `${m.name}, ask at counter`}
      style={({ pressed }) => [{
        width: '48.2%', marginBottom: 12, borderRadius: 20, padding: 14, paddingTop: 12,
        backgroundColor: c.surface,
        transform: [{ scale: pressed ? 0.97 : 1 }], opacity: m.soldOut ? 0.55 : 1,
      }, shadow.sm]}
    >
      <Spot on={spot} radius={20} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.Image source={m.icon} style={{ width: 50, height: 50, transform: [{ scale }] }} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {m.soldOut && (
            <View style={{ backgroundColor: c.crimsonTint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.crimson }}>Sold out</Text>
            </View>
          )}
          {m.sometimes && (
            <View style={{ backgroundColor: c.paper2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.ink3 }}>Some days</Text>
            </View>
          )}
          {pills.map(t => (
            <View key={t} style={{ backgroundColor: PILL[t]!.tint(c), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: PILL[t]!.ink(c) }}>{PILL[t]!.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3, marginTop: 12, lineHeight: 19, minHeight: 38 }}>{m.name}</Text>
      <Text numberOfLines={2} style={{ fontSize: 12, color: c.ink3, marginTop: 3, lineHeight: 16, minHeight: 32 }}>{m.blurb}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        {priced
          ? <Text style={[{ fontSize: 17, fontWeight: '800', color: c.navy700, letterSpacing: -0.4 }, tnum]}>{priceLabel(m.price!)}</Text>
          : <Text style={{ fontSize: 11.5, fontWeight: '600', color: c.ink4, letterSpacing: -0.1 }}>Ask at counter</Text>}
        {count > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.sky, borderRadius: 999, paddingHorizontal: 4, height: 28 }}>
            <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="minus" size={12} stroke={2.4} color="#fff" />
            </Pressable>
            <Text style={[{ fontSize: 13, fontWeight: '800', color: '#fff', minWidth: 14, textAlign: 'center' }, tnum]}>{count}</Text>
            <Pressable onPress={() => { bump(); onAdd(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Add ${m.name}`} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={12} stroke={2.4} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.skyTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={13} stroke={2.4} color={c.sky600} />
          </View>
        )}
      </View>
    </Pressable>
  );
};

// ── Bits ────────────────────────────────────────────────────────
const PayPill = ({ art, label }: { art: ImageSourcePropType; label: string }) => {
  const { c } = useTheme();
  return (
    // Filled white like the Gift card chip below: navy text on the bare gradient
    // got lost where it turns navy, and the ring alone read as a stray outline.
    <View style={{ flexGrow: 1, flexBasis: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(14,34,56,0.12)', borderRadius: 999, paddingHorizontal: 4, paddingVertical: 7, shadowColor: '#0E2238', shadowOpacity: 0.14, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
      <Image source={art} style={{ width: 14, height: 14 }} />
      <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '800', color: c.navy700, letterSpacing: -0.2 }}>{label}</Text>
    </View>
  );
};

const Blob = ({ size, style }: { size: number; style: any }) => (
  <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff' }, style]} />
);

const Chip = ({ label, icon, art, on, onPress }: { label: string; icon?: any; art?: ImageSourcePropType; on: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({
      flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 999,
      backgroundColor: on ? c.navy700 : c.surface, opacity: pressed ? 0.75 : 1,
    })}>
      {art ? <Image source={art} style={{ width: 18, height: 18 }} /> : icon ? <Icon name={icon} size={15} stroke={2} color={on ? '#fff' : c.ink2} /> : null}
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: on ? '#fff' : c.ink, letterSpacing: -0.2 }}>{label}</Text>
    </Pressable>
  );
};

// Gentle bob so the card feels like it is hovering.
const Floaty = ({ children }: { children: React.ReactNode }) => {
  const y = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -7, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.View style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
};
