// Sentinel — Badges.
// Opened from the badge button beside the student's name on Me. A page sheet
// listing every badge, grouped by rarity or by category (segmented toggle).
// Tapping a badge opens the detail sheet, laid out like the reference
// screenshot: rarity-coloured glow fading to paper, big art, "Badge Unlocked",
// title, description, unlock date, flavour line, then a share row.

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Share, Platform, useWindowDimensions, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '../ThemeContext';
import { shadow, fonts } from '../theme';
import { Icon, IconName, MessagesGlyph } from '../components/Icon';
import { BadgeArt, RarityPill, TiltBadge } from '../components/BadgeArt';
import {
  BADGES, Badge, Rarity, Category, RARITY, RARITY_ORDER, CATEGORY, CATEGORY_ORDER,
  isUnlocked, unlockedOn, formatUnlockDate, sortByRarity,
} from '../badges';

type SortMode = 'rarity' | 'category';

export const unlockedCount = () => BADGES.filter(isUnlocked).length;

// ────────────────────────────────────────────────────────────────
// List sheet
// ────────────────────────────────────────────────────────────────
export const BadgesSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const [sort, setSort] = useState<SortMode>('rarity');
  const [open, setOpen] = useState<Badge | null>(null);
  const unlocked = unlockedCount();

  const groups = useMemo(() => {
    if (sort === 'rarity') {
      return RARITY_ORDER.map(r => ({
        key: r, title: RARITY[r].label, color: RARITY[r].color,
        items: BADGES.filter(b => b.rarity === r).sort((a, b) => Number(isUnlocked(b)) - Number(isUnlocked(a)) || a.title.localeCompare(b.title)),
      })).filter(g => g.items.length);
    }
    return CATEGORY_ORDER.map(k => ({
      key: k, title: CATEGORY[k], color: c.navy700,
      items: sortByRarity(BADGES.filter(b => b.category === k)).sort((a, b) => Number(isUnlocked(b)) - Number(isUnlocked(a))),
    })).filter(g => g.items.length);
  }, [sort, c.navy700]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <Grabber />
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: c.ink }}>Badges</Text>
            <Text style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>{unlocked} of {BADGES.length} unlocked</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({
            width: 32, height: 32, borderRadius: 16, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line,
            alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
          })}>
            <Icon name="close" size={16} stroke={2} color={c.ink2} />
          </Pressable>
        </View>

        {/* Sort toggle */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 3, gap: 2, maxWidth: 240 }}>
            {(['rarity', 'category'] as SortMode[]).map(k => {
              const on = sort === k;
              return (
                <Pressable key={k} onPress={() => setSort(k)} style={[{ flex: 1, borderRadius: 9, paddingVertical: 7, alignItems: 'center', backgroundColor: on ? c.surface : 'transparent' }, on ? shadow.sm : shadow.none]}>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? c.ink : c.ink3 }}>{k === 'rarity' ? 'By rarity' : 'By category'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {groups.map(g => (
            <View key={g.key}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 22, paddingHorizontal: 20, paddingBottom: 6 }}>
                {sort === 'rarity'
                  ? <RarityPill rarity={g.key as Rarity} />
                  : (
                    <View style={{ borderRadius: 999, backgroundColor: c.navy700, paddingVertical: 5, paddingHorizontal: 13 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#FFFFFF' }}>{g.title}</Text>
                    </View>
                  )}
                <Text style={{ fontSize: 12.5, color: c.ink4, marginLeft: 'auto' }}>
                  {g.items.filter(isUnlocked).length}/{g.items.length}
                </Text>
              </View>
              <BadgeGrid items={g.items} onPress={setOpen} />
            </View>
          ))}
        </ScrollView>

        <BadgeDetail badge={open} onClose={() => setOpen(null)} />
      </View>
    </Modal>
  );
};

const BadgeGrid = ({ items, onPress }: { items: Badge[]; onPress: (b: Badge) => void }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const cols = 3;
  const gap = 10;
  const w = (Math.min(width, 430) - 40 - gap * (cols - 1)) / cols;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, paddingHorizontal: 20 }}>
      {items.map(b => {
        const on = isUnlocked(b);
        const secret = b.rarity === 'secret' && !on;
        return (
          <Pressable key={b.id} onPress={() => onPress(b)} style={({ pressed }) => ({
            width: w, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4,
            opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
          })}>
            <BadgeArt badge={b} size={w - 16} locked={!on} />
            <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '600', color: on ? c.ink : c.ink3, textAlign: 'center', marginTop: 6, lineHeight: 15, letterSpacing: -0.1, minHeight: 30 }}>
              {secret ? '???' : b.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Detail sheet — mirrors the reference screenshot
// ────────────────────────────────────────────────────────────────
export const BadgeDetail = ({ badge, onClose }: { badge: Badge | null; onClose: () => void }) => {
  const { c, mode } = useTheme();
  const cardRef = useRef<View>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!badge) return null;
  const b = badge;
  const on = isUnlocked(b);
  const r = RARITY[b.rarity];
  const date = unlockedOn(b);
  const secret = b.rarity === 'secret' && !on;
  const glow = r.chrome ? '#C9CFD6' : r.color;

  const shareText = on
    ? `I unlocked "${b.title}" in Spartans: ${b.desc}`
    : `"${b.title}" in Spartans: ${b.desc}`;

  // The share card is rendered off-screen and captured as a PNG for copy,
  // save and the share sheet. Falls back to text where capture is unavailable
  // (web preview).
  const snapshot = async (result: 'tmpfile' | 'base64'): Promise<string> => {
    if (!cardRef.current || Platform.OS === 'web') throw new Error('no capture');
    // Lazy: needs the native module, which older builds / web lack.
    const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
    return captureRef(cardRef, { format: 'png', quality: 1, result });
  };

  const share = async () => {
    try {
      const uri = await snapshot('tmpfile');
      await Share.share(Platform.OS === 'ios' ? { url: uri, message: shareText } : { message: shareText, url: uri });
    } catch {
      Share.share({ message: shareText }).catch(() => {});
    }
  };
  const copy = async () => {
    try {
      const b64 = await snapshot('base64');
      await Clipboard.setImageAsync(b64);
    } catch {
      await Clipboard.setStringAsync(shareText).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const message = () => {
    // sms: cannot carry an image, so Messages gets the text; the share sheet
    // (More) is the route for sending the picture.
    const url = Platform.OS === 'ios' ? `sms:&body=${encodeURIComponent(shareText)}` : `sms:?body=${encodeURIComponent(shareText)}`;
    Linking.openURL(url).catch(share);
  };
  const save = async () => {
    try {
      if (Platform.OS === 'web') throw new Error('web');
      // Lazy: the native module is absent on web and throws at import time.
      const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) { Alert.alert('Photos access needed', 'Allow Spartans to add to your photos to save badges.'); return; }
      const uri = await snapshot('tmpfile');
      await MediaLibrary.saveToLibraryAsync(uri);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      Alert.alert('Could not save', 'Saving badges needs the phone app, not the web preview.');
    }
  };

  const tiles: { label: string; icon?: IconName; glyph?: React.ReactNode; onPress: () => void }[] = [
    { label: 'Messages', glyph: <MessagesGlyph size={62} />, onPress: message },
    { label: copied ? 'Copied' : 'Copy', icon: copied ? 'check' : 'copy', onPress: copy },
    { label: saved ? 'Saved' : 'Save', icon: saved ? 'check' : 'download', onPress: save },
    { label: 'More', icon: 'more', onPress: share },
  ];

  return (
    <Modal visible={!!badge} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <LinearGradient
          colors={[glow, glow + (mode === 'dark' ? '66' : 'AA'), c.paper]}
          locations={[0, 0.45, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '62%' }}
        />
        <Grabber light />
        <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({
          position: 'absolute', top: 16, right: 16, zIndex: 2,
          width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.35)',
          alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
        })}>
          <Icon name="close" size={16} stroke={2} color="#FFFFFF" />
        </Pressable>

        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingTop: 72, paddingHorizontal: 28, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <TiltBadge badge={b} size={270} locked={!on} />

          <Text style={{ fontSize: 13, fontWeight: '400', color: c.ink3, marginTop: 14, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {on ? 'Badge Unlocked' : 'Badge Locked'}
          </Text>
          <Text style={{ fontSize: 30, fontWeight: '700', color: c.ink, letterSpacing: -0.8, textAlign: 'center', marginTop: 2, lineHeight: 36 }}>
            {secret ? '???' : b.title}
          </Text>
          <Text style={{ fontSize: 19, color: c.ink3, textAlign: 'center', marginTop: 6, letterSpacing: -0.2, lineHeight: 24 }}>
            {secret ? 'Description stays hidden until unlocked' : b.desc}
          </Text>
          <View style={{ marginTop: 12 }}><RarityPill rarity={b.rarity} /></View>

          <View style={{ flex: 1, minHeight: 28 }} />

          {on && date ? (
            <>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.ink4, letterSpacing: 1, textTransform: 'uppercase' }}>Unlocked</Text>
              <Text style={{ fontSize: 22, color: c.ink2, marginTop: 2, fontFamily: fonts.serif, letterSpacing: -0.2 }}>{formatUnlockDate(date)}</Text>
              {!!b.flavor && <Text style={{ fontSize: 16, color: c.ink3, marginTop: 10, textAlign: 'center', letterSpacing: -0.2, fontStyle: 'italic' }}>{b.flavor}</Text>}
            </>
          ) : (
            <Text style={{ fontSize: 18, color: c.ink3, textAlign: 'center', letterSpacing: -0.2 }}>Not unlocked yet</Text>
          )}
        </ScrollView>

        {/* Share row: Messages · Copy · Save · More */}
        <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}>
            {tiles.map((t, i) => (
              <Pressable key={i} onPress={t.onPress} style={({ pressed }) => ({ alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
                {t.glyph ?? (
                  <View style={{ width: 62, height: 62, borderRadius: 16, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={t.icon!} size={26} stroke={1.7} color={t.icon === 'check' ? '#3FA35B' : c.ink2} />
                  </View>
                )}
                <Text style={{ fontSize: 12.5, color: c.ink3 }}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Off-screen share card, captured as the image for copy/save/share */}
        <View pointerEvents="none" style={{ position: 'absolute', left: -2000, top: 0 }}>
          <View ref={cardRef} collapsable={false} style={{ width: 360, height: 480, overflow: 'hidden' }}>
            <LinearGradient colors={[glow, glow + 'AA', '#FFFFFF']} locations={[0, 0.45, 1]} style={{ flex: 1, alignItems: 'center', paddingTop: 48, paddingHorizontal: 28 }}>
              <BadgeArt badge={b} size={230} locked={!on} />
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 18, letterSpacing: 0.6, textTransform: 'uppercase' }}>{on ? 'Badge Unlocked' : 'Badge Locked'}</Text>
              <Text style={{ fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.6, textAlign: 'center', marginTop: 2 }}>{secret ? '???' : b.title}</Text>
              <Text style={{ fontSize: 15, color: '#4B5563', textAlign: 'center', marginTop: 4 }}>{secret ? 'Hidden until unlocked' : b.desc}</Text>
              <View style={{ marginTop: 10 }}><RarityPill rarity={b.rarity} small /></View>
              <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 'auto', marginBottom: 16, letterSpacing: 0.4 }}>SPARTANS · SENTINEL SECONDARY</Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const Grabber = ({ light = false }: { light?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 6 }}>
      <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: light ? 'rgba(255,255,255,0.6)' : c.line }} />
    </View>
  );
};
