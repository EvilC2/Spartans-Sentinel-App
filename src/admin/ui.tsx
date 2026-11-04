// Spartans — App Club building blocks. The club's back office is quieter
// than the student app: grouped white lists, one page title style, 3D art
// small and only where it names something (a team, a role, a page). The big
// moments live elsewhere: the role card (RoleCard.tsx) and the join page.
// One button shape (Act, 46 tall), one list row (Row, 58 tall), one page
// title (PageTitle). Segmented controls scroll sideways instead of squashing.

import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Image, Animated, Easing, ScrollView, TextInput, Modal, Platform,
  ImageSourcePropType, StyleProp, ViewStyle, TextInputProps,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, Palette } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { glow, onGlow } from '../components/ProgramIcon';
import type { PageTone } from '../pages';
import { useKeyboardHeight } from '../useKeyboard';

// ── Tones ───────────────────────────────────────────────────────
// Team colours, used for state and small accents, never as page washes.
export const toneOf = (c: Palette, mode: 'light' | 'dark', tone: PageTone) => {
  const t = {
    sky: { bg: c.skyTint, ink: c.sky600 },
    gold: { bg: c.goldTint, ink: c.gold },
    moss: { bg: c.mossTint, ink: c.moss },
    crimson: { bg: c.crimsonTint, ink: c.crimson },
    navy: { bg: c.navy50, ink: c.navy600 },
  }[tone];
  return { bg: t.bg, ink: glow(t.ink, mode), on: onGlow(mode) };
};

// ── Motion ──────────────────────────────────────────────────────
// A gentle bob, for art on the join page only.
export const Floaty = ({ children, amount = 5 }: { children: React.ReactNode; amount?: number }) => {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -amount, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y, amount]);
  return <Animated.View pointerEvents="none" style={{ transform: [{ translateY: y }] }}>{children}</Animated.View>;
};

// ── Page title ──────────────────────────────────────────────────
// Every page inside App Club starts with this: which team, the page name in
// the app's serif, one line on what it's for, the page's art on the right.
export const PageTitle = ({ kicker, title, sub, art }: { kicker?: string; title: string; sub?: string; art?: ImageSourcePropType }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {!!kicker && <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.ink3 }}>{kicker}</Text>}
        <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, color: c.ink, letterSpacing: -0.6 }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 14, color: c.ink3, marginTop: 2, lineHeight: 19 }}>{sub}</Text>}
      </View>
      {art && <Image source={art} style={{ width: 52, height: 52 }} resizeMode="contain" accessibilityIgnoresInvertColors />}
    </View>
  );
};

// ── Lists ───────────────────────────────────────────────────────
// A titled group of rows on one white surface (Settings-style).
export const Group = ({ title, trailing, onTrailing, children, footer }: {
  title?: string; trailing?: string; onTrailing?: () => void; children: React.ReactNode; footer?: string;
}) => {
  const { c } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 8 }}>
      {!!title && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{title}</Text>
          {!!trailing && (
            <Pressable onPress={onTrailing} disabled={!onTrailing} hitSlop={10}>
              <Text style={{ fontSize: 14, color: c.link, fontWeight: '600' }}>{trailing}</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.line2 }}>
        {rows.map((r, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: 1, backgroundColor: c.line2, marginLeft: 60 }} />}
            {r}
          </View>
        ))}
      </View>
      {!!footer && <Text style={{ fontSize: 12.5, color: c.ink3, lineHeight: 17, paddingHorizontal: 4 }}>{footer}</Text>}
    </View>
  );
};

// One row: art (or an icon) · label and a line under it · a detail on the
// right · chevron when it opens something. Always the same height.
export const Row = ({ art, icon, label, sub, detail, onPress, trailing, count, danger }: {
  art?: ImageSourcePropType; icon?: IconName; label: string; sub?: string; detail?: string;
  onPress?: () => void; trailing?: React.ReactNode; count?: number; danger?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[label, sub, detail, count ? `${count} waiting` : null].filter(Boolean).join('. ')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 58, paddingVertical: 9, paddingLeft: 14, paddingRight: 12, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      <View style={{ width: 32, alignItems: 'center' }}>
        {art ? <Image source={art} style={{ width: 30, height: 30 }} resizeMode="contain" />
          : icon ? <Icon name={icon} size={20} stroke={1.9} color={danger ? c.danger : c.ink2} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: danger ? c.danger : c.ink, letterSpacing: -0.2 }}>{label}</Text>
        {!!sub && <Text numberOfLines={2} style={[{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 17 }, tnum]}>{sub}</Text>}
      </View>
      {!!count && (
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, backgroundColor: c.crimson, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[{ fontSize: 12, fontWeight: '800', color: '#fff' }, tnum]}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
      {!!detail && <Text numberOfLines={1} style={[{ fontSize: 14, color: c.ink3, maxWidth: 120 }, tnum]}>{detail}</Text>}
      {trailing ?? (onPress ? <Icon name="chev-r" size={15} stroke={2.2} color={c.ink4} /> : null)}
    </Pressable>
  );
};
// Older name used by a few pages.
export const ItemRow = ({ art, icon, label, sub, onPress, trailing }: {
  art?: ImageSourcePropType; icon?: IconName; label: string; sub?: string; onPress?: () => void;
  trailing?: React.ReactNode; last?: boolean; tone?: PageTone;
}) => <Row art={art} icon={icon} label={label} sub={sub} onPress={onPress} trailing={trailing} />;

// ── Surfaces ────────────────────────────────────────────────────
export const Card = ({ children, style, pad = 16 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) => {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: 18, padding: pad, gap: 12, borderWidth: 1, borderColor: c.line2 }, style]}>{children}</View>;
};

// A card's own title: small art or icon, title, optional line under it.
export const CardHead = ({ icon, art, title, sub, trailing }: {
  icon?: IconName; art?: ImageSourcePropType; title: string; sub?: string; tone?: PageTone; trailing?: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {art ? <Image source={art} style={{ width: 30, height: 30 }} resizeMode="contain" />
        : icon ? <Icon name={icon} size={20} stroke={1.9} color={c.ink2} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16.5, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 18 }}>{sub}</Text>}
      </View>
      {trailing}
    </View>
  );
};

export const SectionTitle = ({ title, trailing, onTrailing }: { title: string; trailing?: string; onTrailing?: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: c.ink }}>{title}</Text>
      {!!trailing && (
        <Pressable onPress={onTrailing} disabled={!onTrailing} hitSlop={10}>
          <Text style={{ fontSize: 14, color: c.link, fontWeight: '600' }}>{trailing}</Text>
        </Pressable>
      )}
    </View>
  );
};

// State label (Live, Behind, Teacher…). Small, tinted, for status only.
export const Pill = ({ text, tone = 'navy', solid, icon }: { text: string; tone?: PageTone | 'ink'; solid?: boolean; icon?: IconName }) => {
  const { c, mode } = useTheme();
  const t = tone === 'ink' ? { bg: c.paper2, ink: c.ink3, on: '#fff' } : toneOf(c, mode, tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: solid ? t.ink : t.bg }}>
      {icon && <Icon name={icon} size={11} stroke={2.4} color={solid ? t.on : t.ink} />}
      <Text numberOfLines={1} style={[{ fontSize: 12, fontWeight: '700', color: solid ? t.on : t.ink }, tnum]}>{text}</Text>
    </View>
  );
};

// A quiet line of explanation. No box, so it never competes with content.
export const Hint = ({ text, warn, icon }: { text: string; warn?: boolean; icon?: IconName }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
      <Icon name={icon || (warn ? 'flash' : 'sparkle')} size={14} stroke={2} color={warn ? c.danger : c.ink4} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize: 13, color: warn ? c.danger : c.ink3, lineHeight: 18 }}>{text}</Text>
    </View>
  );
};

export const Empty = ({ art, title, sub }: { art?: ImageSourcePropType; title: string; sub?: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 26, paddingHorizontal: 24 }}>
      {art ? <Image source={art} style={{ width: 44, height: 44, opacity: 0.85 }} /> : <Icon name="check-circle" size={24} stroke={1.8} color={c.moss} />}
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink2, textAlign: 'center' }}>{title}</Text>
      {!!sub && <Text style={{ fontSize: 13, color: c.ink3, textAlign: 'center', lineHeight: 18 }}>{sub}</Text>}
    </View>
  );
};

// ── Controls ────────────────────────────────────────────────────
// The one button. `fill` stretches it; otherwise it hugs its label.
export const Act = ({ label, icon, onPress, tone = 'primary', disabled, fill, small }: {
  label: string; icon?: IconName; onPress: () => void; tone?: 'primary' | 'soft' | 'plain' | 'danger' | 'gold';
  disabled?: boolean; fill?: boolean; small?: boolean;
}) => {
  const { c } = useTheme();
  const look = {
    primary: { bg: c.action, fg: '#fff' },
    gold: { bg: c.gold, fg: '#fff' },
    soft: { bg: c.navy50, fg: c.link },
    plain: { bg: c.surface, fg: c.ink },
    danger: { bg: c.crimsonTint, fg: c.danger },
  }[tone];
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: small ? 36 : 46, paddingHorizontal: small ? 14 : 18, borderRadius: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        alignSelf: fill ? 'stretch' : 'flex-start', flexGrow: fill ? 1 : 0, flexShrink: 1,
        backgroundColor: look.bg, borderWidth: tone === 'plain' ? 1 : 0, borderColor: c.line,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}>
      {icon && <Icon name={icon} size={small ? 14 : 16} stroke={2.2} color={look.fg} />}
      <Text numberOfLines={1} style={{ fontSize: small ? 14 : 15.5, fontWeight: '700', color: look.fg, flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
};

// Pick one. Scrolls sideways when the options don't fit, never squashes.
export const Seg = <T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void;
}) => {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 4 }} style={{ flexGrow: 0 }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 13, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? c.ink : c.surface, borderWidth: 1, borderColor: on ? c.ink : c.line2, opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: on ? c.paper : c.ink2 }}>{o.label}</Text>
            {o.count !== undefined && <Text style={[{ fontSize: 12.5, fontWeight: '700', color: on ? c.paper : c.ink4 }, tnum]}>{o.count}</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

// Pick any (wrapping chips).
export const ChipPick = <T extends string>({ value, options, onToggle, multi = true }: {
  value: T[]; options: { id: T; label: string; icon?: IconName }[]; onToggle: (v: T) => void; multi?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const on = value.includes(o.id);
        return (
          <Pressable key={o.id} onPress={() => onToggle(o.id)} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={multi ? { checked: on } : { selected: on }}
            style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? c.ink : c.paper2, opacity: pressed ? 0.8 : 1 })}>
            {o.icon && <Icon name={o.icon} size={13} stroke={2.2} color={on ? c.paper : c.ink3} />}
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: on ? c.paper : c.ink2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const Field = ({ label, style, ...rest }: TextInputProps & { label?: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {!!label && <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.ink2 }}>{label}</Text>}
      <TextInput placeholderTextColor={c.ink4} {...rest}
        style={[{ minHeight: 46, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.ink, backgroundColor: c.paper2,
          ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}) }, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} />
    </View>
  );
};

export const Search = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2 }}>
      <Icon name="search" size={16} stroke={2} color={c.ink4} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.ink4} autoCorrect={false} autoCapitalize="none"
        style={{ flex: 1, paddingVertical: 10, fontSize: 15.5, color: c.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}) }} />
      {!!value && <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Clear search"><Icon name="close" size={15} stroke={2} color={c.ink4} /></Pressable>}
    </View>
  );
};

// ── Sheet ───────────────────────────────────────────────────────
export const ClubSheet = ({ visible, onClose, title, sub, art, children, footer }: {
  visible: boolean; onClose: () => void; title: string; sub?: string; art?: ImageSourcePropType; tone?: PageTone;
  children: React.ReactNode; footer?: React.ReactNode;
}) => {
  const { c } = useTheme();
  const kb = useKeyboardHeight();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <View style={{ paddingTop: 10, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.line2 }}>
          <View style={{ alignItems: 'center', paddingBottom: 12 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {art && <Image source={art} style={{ width: 38, height: 38 }} resizeMode="contain" />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: c.ink, letterSpacing: -0.4 }}>{title}</Text>
              {!!sub && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1 }}>{sub}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
              style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Icon name="close" size={16} stroke={2.2} color={c.ink2} />
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 + kb }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
        {footer && <View style={[{ padding: 16, paddingBottom: 28 + kb, borderTopWidth: 1, borderTopColor: c.line2, backgroundColor: c.paper, gap: 10 }, shadow.none]}>{footer}</View>}
      </View>
    </Modal>
  );
};

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 10080 ? `${Math.round(m / 1440)}d ago` : new Date(iso).toLocaleDateString();
};
