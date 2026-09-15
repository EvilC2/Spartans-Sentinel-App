// Spartans — The Buzz tab.
// The rotating Buzz window (trivia, polls, did-you-know, banner news) on top,
// then the announcements feed: Athletics, Academic, General, Events. A
// featured pinned post sits first in a heavier card; the rest scroll below as
// a grouped list. Admin posts carry a small verified mark. Tapping a card
// expands it inline (state-managed locally — expanded id).

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import S from '../data';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, Palette } from '../theme';
import { Icon, Check } from '../components/Icon';
import { TabId } from '../components/Chrome';
import { AppHeader } from '../components/AppHeader';
import { Buzz, BuzzSlide } from '../components/Buzz';

type Props = { onNavigate: (t: TabId) => void; topInset: number };

const FILTERS = ['All', 'Athletics', 'Academic', 'General', 'Events'];

export default function BuzzScreen({ onNavigate, topInset }: Props) {
  const { c } = useTheme();
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const fun = S.buzz as BuzzSlide[];

  // Split pinned out; filter list
  const pinned = S.news.find(n => n.pinned);
  const rest = S.news.filter(n => !n.pinned);
  const list = filter === 'All' ? rest : rest.filter(n => n.category === filter);
  const showPinned = filter === 'All' || (!!pinned && pinned.category === filter);

  // Group filtered list by relative date label
  const groups = groupByTime(list);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} />

      {/* ── Title ───────────────────────────────────────────── */}
      <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 14 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.7, color: c.ink }}>
          The Buzz
        </Text>
        <Text style={{ fontSize: 13, color: c.ink3, marginTop: 4, letterSpacing: -0.1 }}>
          Trivia, polls, news and what's for lunch. Run by the School App Club.
        </Text>
      </View>

      {/* ── The rotating window ─────────────────────────────── */}
      <Buzz slides={fun} aspect={0.9} />

      {/* ── Announcements title + counter ───────────────────── */}
      <View style={{ paddingTop: 26, paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
        }}>
          <Text style={{ fontSize: 20, fontWeight: '600', letterSpacing: -0.4, color: c.ink }}>
            Announcements
          </Text>
          <Text style={{ fontSize: 12, color: c.ink3, fontWeight: '500', letterSpacing: -0.1 }}>
            {S.news.length} this week
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: c.ink3, marginTop: 4, letterSpacing: -0.1 }}>
          Updated 7:48 AM · Tue May 19
        </Text>
      </View>

      {/* ── Category filter chips ───────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
        }}
      >
        {FILTERS.map(f => (
          <FilterChip key={f} label={f} active={f === filter} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {/* ── Pinned / featured card ──────────────────────────── */}
      {showPinned && !!pinned && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
          <PinnedCard
            n={pinned}
            expanded={expanded === pinned.id}
            onToggle={() => setExpanded(expanded === pinned.id ? null : pinned.id)}
          />
        </View>
      )}

      {/* ── Grouped list ────────────────────────────────────── */}
      {groups.map(g => (
        <View key={g.label}>
          <Text style={{
            paddingTop: 6, paddingHorizontal: 20, paddingBottom: 8,
            fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
            textTransform: 'uppercase', color: c.ink3,
          }}>
            {g.label}
          </Text>
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            {g.items.map(n => (
              <NewsCard
                key={n.id}
                n={n}
                expanded={expanded === n.id}
                onToggle={() => setExpanded(expanded === n.id ? null : n.id)}
              />
            ))}
          </View>
        </View>
      ))}

      {/* ── End-of-feed footer ──────────────────────────────── */}
      <Text style={{
        paddingTop: 32, paddingHorizontal: 20, paddingBottom: 8,
        textAlign: 'center', fontSize: 12, color: c.ink4, letterSpacing: 0.2,
      }}>
        — End of feed —
      </Text>
    </ScrollView>
  );
}

// Group news items by their `time` field into "Today" / "Yesterday" / earlier.
function groupByTime(items: any[]) {
  const isToday = (t: string) => /AM|PM/.test(t) && !/Yesterday/.test(t);
  const isYday = (t: string) => t === 'Yesterday';
  const groups: Record<string, any[]> = { Today: [], Yesterday: [], Earlier: [] };
  items.forEach(n => {
    if (isToday(n.time)) groups.Today.push(n);
    else if (isYday(n.time)) groups.Yesterday.push(n);
    else groups.Earlier.push(n);
  });
  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([label, v]) => ({ label, items: v }));
}

// ────────────────────────────────────────────────────────────────
// Filter chip
// ────────────────────────────────────────────────────────────────
const FilterChip = ({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[{
        paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999,
        backgroundColor: active ? c.navy700 : c.surface,
        borderWidth: 1, borderColor: active ? c.navy700 : c.line,
      }, active ? shadow.sm : shadow.none]}
    >
      <Text style={{
        fontSize: 12.5, fontWeight: '600', letterSpacing: -0.1,
        color: active ? '#fff' : c.ink2,
      }}>
        {label}
      </Text>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Category tag colours
// ────────────────────────────────────────────────────────────────
const catColor = (k: string, c: Palette) =>
  ({ Athletics: c.crimson, Academic: c.navy700, General: c.ink3, Events: c.moss } as Record<string, string>)[k] || c.ink3;

const catTint = (k: string, c: Palette) =>
  ({
    Athletics: c.crimsonTint,
    Academic: c.navy50,
    General: c.paper2,
    Events: 'rgba(91,122,78,0.10)',
  } as Record<string, string>)[k] || c.paper2;

// ────────────────────────────────────────────────────────────────
// Pinned / featured card — heavier composition, navy accent rail
// ────────────────────────────────────────────────────────────────
const PinnedCard = ({
  n, expanded, onToggle,
}: { n: any; expanded: boolean; onToggle: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={[{
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.line,
      borderRadius: 20, overflow: 'hidden',
    }, shadow.md]}>
      {/* Category colour rail */}
      <View style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        backgroundColor: catColor(n.category, c),
      }} />

      <View style={{ paddingTop: 14, paddingRight: 16, paddingBottom: 14, paddingLeft: 18 }}>
        {/* Pin row */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 10,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="pin" size={12} stroke={2} color={c.gold} />
              <Text style={{
                color: c.gold, fontSize: 10.5, fontWeight: '700',
                letterSpacing: 1.4, textTransform: 'uppercase',
              }}>
                Pinned
              </Text>
            </View>
            <Text style={{ color: c.ink4, fontSize: 11, fontWeight: '500' }}>·</Text>
            <CategoryTag category={n.category} />
          </View>
          <Text style={{ fontSize: 12, color: c.ink4 }}>{n.time}</Text>
        </View>

        {/* Title */}
        <Text style={{
          fontFamily: fonts.serif, fontSize: 22, lineHeight: 26.4,
          letterSpacing: -0.4, color: c.ink,
        }}>
          {n.title}
        </Text>

        {/* Body */}
        <Text
          numberOfLines={expanded ? undefined : 3}
          style={{
            fontSize: 14, color: c.ink2, marginTop: 8,
            lineHeight: 21, letterSpacing: -0.1,
          }}
        >
          {expanded ? n.body : n.preview}
        </Text>

        {/* Author + admin badge */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
          paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line,
        }}>
          <AuthorMark name={n.author} role={n.role} admin={n.admin} />
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{
              color: c.navy700, fontSize: 13, fontWeight: '600', letterSpacing: -0.1,
            }}>
              {expanded ? 'Show less' : 'Read more'}
            </Text>
            <Icon name={expanded ? 'chev-d' : 'chev-r'} size={14} stroke={2} color={c.navy700} />
          </Pressable>
        </View>

        {/* Reactions row, only when expanded */}
        {expanded && (
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 12.5, color: c.ink3 }}>♥ {n.reactions}</Text>
            <Text style={{ fontSize: 12.5, color: c.ink3 }}>{n.comments} comments</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 12.5, color: c.ink4 }}>{n.timeFull}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Standard news card
// ────────────────────────────────────────────────────────────────
const NewsCard = ({
  n, expanded, onToggle,
}: { n: any; expanded: boolean; onToggle: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [{
        backgroundColor: c.surface,
        borderWidth: 1, borderColor: c.line,
        borderRadius: 18,
        paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12,
        opacity: pressed ? 0.85 : 1,
      }, shadow.sm]}
    >
      {/* Tag row */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 8,
      }}>
        <CategoryTag category={n.category} />
        <Text style={{ fontSize: 12, color: c.ink4 }}>{n.time}</Text>
      </View>

      {/* Title */}
      <Text style={{
        fontSize: 15.5, fontWeight: '600', color: c.ink,
        letterSpacing: -0.2, lineHeight: 20,
      }}>
        {n.title}
      </Text>

      {/* Preview */}
      <Text
        numberOfLines={expanded ? undefined : 2}
        style={{ fontSize: 13.5, color: c.ink3, marginTop: 6, lineHeight: 19.6 }}
      >
        {n.preview}
      </Text>

      {/* Author row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <AuthorMark name={n.author} role={n.role} admin={n.admin} compact />
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 12, color: c.ink4 }}>
          {n.reactions > 0 ? `♥ ${n.reactions} · ` : ''}{n.comments} comments
        </Text>
      </View>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Category tag — coloured uppercase label
// ────────────────────────────────────────────────────────────────
export const CategoryTag = ({ category }: { category: string }) => {
  const { c } = useTheme();
  return (
    <View style={{
      backgroundColor: catTint(category, c),
      paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4,
    }}>
      <Text style={{
        fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase',
        fontWeight: '700', color: catColor(category, c), lineHeight: 14.7,
      }}>
        {category}
      </Text>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Author mark — initials puck + name + admin check
// ────────────────────────────────────────────────────────────────
export const AuthorMark = ({
  name, role, admin, compact,
}: { name: string; role?: string; admin?: boolean; compact?: boolean }) => {
  const { c } = useTheme();
  const initials = (name || '').split(/\s+/).map(w => w[0]).slice(0, 2).join('');
  const d = compact ? 22 : 28;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
      <View style={{
        width: d, height: d, borderRadius: d / 2,
        backgroundColor: c.paper2,
        borderWidth: 1, borderColor: c.line,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{
          fontSize: compact ? 9.5 : 10.5, fontWeight: '700',
          color: c.ink2, letterSpacing: 0.3,
        }}>
          {initials}
        </Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: compact ? 12.5 : 13, fontWeight: '600',
              color: c.ink2, letterSpacing: -0.1, maxWidth: 140,
            }}
          >
            {name}
          </Text>
          {admin && <AdminBadge />}
        </View>
        {!compact && !!role && (
          <Text style={{ fontSize: 11.5, color: c.ink4, marginTop: 1 }}>{role}</Text>
        )}
      </View>
    </View>
  );
};

export const AdminBadge = () => {
  const { c } = useTheme();
  return (
    <View style={{
      width: 13, height: 13, borderRadius: 6.5,
      backgroundColor: c.navy700,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Check size={8} color="#fff" width={3.5} />
    </View>
  );
};
