// Spartans — App Club building blocks. The club's back office is quieter
// than the student app: grouped white lists, one page title style, 3D art
// small and only where it names something (a team, a role, a page). The big
// moments live elsewhere: the role card (RoleCard.tsx) and the join page.
// One button (Act, 48 tall), one list row (Row, 58 tall), one page title
// (PageTitle), one search box (Search; PeopleFinder when it looks people up),
// one fold-away section (Fold). Segmented controls scroll sideways instead of
// squashing.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Image, Animated, Easing, ScrollView, TextInput, Modal, Platform, ActivityIndicator,
  ImageSourcePropType, StyleProp, ViewStyle, TextInputProps,
} from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, Palette } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { glow, onGlow } from '../components/ProgramIcon';
import type { PageTone } from '../pages';
import { useKeyboardHeight } from '../useKeyboard';
import type { usePeopleSearch } from './search';

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
// Every page inside App Club starts with this: the page name in the app's
// serif, one line on what it's for, its art on the right. Where Back goes is
// in the header, so it isn't repeated here.
export const PageTitle = ({ title, sub, art }: { title: string; sub?: string; art?: ImageSourcePropType }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: c.ink, letterSpacing: -0.6 }}>{title}</Text>
        {!!sub && <Text style={{ fontSize: 14.5, color: c.ink3, marginTop: 2, lineHeight: 20 }}>{sub}</Text>}
      </View>
      {art && <Image source={art} style={{ width: 46, height: 46 }} resizeMode="contain" accessibilityIgnoresInvertColors />}
    </View>
  );
};

// ── Lists ───────────────────────────────────────────────────────
// A titled group of rows on one white surface (Settings-style).
export const Group = ({ title, note, trailing, onTrailing, children, footer }: {
  title?: string; note?: string; trailing?: string; onTrailing?: () => void; children: React.ReactNode; footer?: string;
}) => {
  const { c } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  // Dividers start where the row's text does.
  const inset = (r: React.ReactNode) => {
    const p: { art?: unknown; icon?: unknown; person?: unknown } = React.isValidElement(r) ? (r.props as object) : {};
    return p.person ? 68 : p.art || p.icon ? 60 : 16;
  };
  return (
    <View style={{ gap: 8 }}>
      {!!title && (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{title}</Text>
          {!!note && <Text style={[{ fontSize: 14, color: c.ink3 }, tnum]}>{note}</Text>}
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
            {i > 0 && <View style={{ height: 1, backgroundColor: c.line2, marginLeft: inset(r) }} />}
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
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, paddingLeft: art || icon ? 14 : 16, paddingRight: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      {(art || icon) && (
        <View style={{ width: 32, alignItems: 'center' }}>
          {art ? <Image source={art} style={{ width: 30, height: 30 }} resizeMode="contain" />
            : <Icon name={icon!} size={20} stroke={1.9} color={danger ? c.danger : c.ink2} />}
        </View>
      )}
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
      {trailing ? <View>{trailing}</View> : onPress ? <Icon name="chev-r" size={15} stroke={2.2} color={c.ink4} /> : null}
    </Pressable>
  );
};
// A person: initials, name, a line under it. Same height as Row.
export const initialsOf = (name: string) =>
  name.replace(/^(Mr|Ms|Mrs|Mx|Dr)\.?\s+/i, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
export const PersonRow = ({ person, sub, onPress, trailing, gold }: {
  person: string; sub?: string; onPress?: () => void; trailing?: React.ReactNode; gold?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[person, sub].filter(Boolean).join('. ')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: gold ? c.goldTint : c.navy50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.ink2 }}>{initialsOf(person)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{person}</Text>
        {!!sub && <Text numberOfLines={2} style={[{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 17 }, tnum]}>{sub}</Text>}
      </View>
      {trailing ? <View>{trailing}</View> : onPress ? <Icon name="chev-r" size={15} stroke={2.2} color={c.ink4} /> : null}
    </Pressable>
  );
};

// A row that opens what's under it, for use inside a Group. Keeps long lists
// (every role on every team) down to one line per team until you ask.
export const Fold = ({ art, icon, label, sub, open, onToggle, children }: {
  art?: ImageSourcePropType; icon?: IconName; label: string; sub?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <View>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={[label, sub].filter(Boolean).join('. ')}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, paddingLeft: art || icon ? 14 : 16, paddingRight: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
        {(art || icon) && (
          <View style={{ width: 32, alignItems: 'center' }}>
            {art ? <Image source={art} style={{ width: 30, height: 30 }} resizeMode="contain" /> : <Icon name={icon!} size={20} stroke={1.9} color={c.ink2} />}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{label}</Text>
          {!!sub && <Text numberOfLines={1} style={[{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 17 }, tnum]}>{sub}</Text>}
        </View>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chev-d" size={16} stroke={2.2} color={c.ink4} />
        </View>
      </Pressable>
      {open && (
        <View style={{ backgroundColor: c.paper }}>
          {React.Children.toArray(children).filter(Boolean).map((k, i) => (
            <View key={i} style={{ borderTopWidth: 1, borderTopColor: c.line2 }}>{k}</View>
          ))}
        </View>
      )}
    </View>
  );
};

// One choice in a list (radio): label, a line under it, a tick when picked.
export const Choice = ({ label, sub, on, onPress, inset = 60, trailing }: {
  label: string; sub?: string; on: boolean; onPress: () => void; inset?: number; trailing?: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on, checked: on }} accessibilityLabel={[label, sub].filter(Boolean).join('. ')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 8, paddingLeft: inset, paddingRight: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: on ? '700' : '500', color: c.ink }}>{label}</Text>
        {!!sub && <Text numberOfLines={2} style={{ fontSize: 13, color: c.ink3, marginTop: 1, lineHeight: 17 }}>{sub}</Text>}
      </View>
      {trailing}
      <View style={{ width: 20, alignItems: 'center' }}>{on && <Icon name="check" size={18} stroke={2.6} color={c.link} />}</View>
    </Pressable>
  );
};

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

export const Empty = ({ art, icon = 'check-circle', title, sub }: { art?: ImageSourcePropType; icon?: IconName; title: string; sub?: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 26, paddingHorizontal: 24 }}>
      {art ? <Image source={art} style={{ width: 44, height: 44, opacity: 0.85 }} /> : <Icon name={icon} size={24} stroke={1.8} color={icon === 'check-circle' ? c.moss : c.ink4} />}
      <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink2, textAlign: 'center' }}>{title}</Text>
      {!!sub && <Text style={{ fontSize: 13, color: c.ink3, textAlign: 'center', lineHeight: 18 }}>{sub}</Text>}
    </View>
  );
};

// ── Controls ────────────────────────────────────────────────────
// The one button. `fill` stretches it; otherwise it hugs its label. `busy`
// shows a spinner in place of the icon and stops a second tap.
export const Act = ({ label, icon, onPress, tone = 'primary', disabled, busy, fill, small }: {
  label: string; icon?: IconName; onPress: () => void; tone?: 'primary' | 'soft' | 'plain' | 'danger' | 'gold';
  disabled?: boolean; busy?: boolean; fill?: boolean; small?: boolean;
}) => {
  const { c, mode } = useTheme();
  const off = !!disabled && !busy;
  const dark = mode === 'dark';
  const look = off ? { bg: c.paper2, down: c.paper2, fg: c.ink3, edge: c.line2 } : {
    primary: { bg: c.action, down: dark ? '#255B99' : c.navy800, fg: '#fff', edge: 'transparent' },
    gold: { bg: '#DDB566', down: '#CDA24F', fg: '#14243A', edge: 'transparent' },
    soft: { bg: c.navy50, down: c.line, fg: c.link, edge: 'transparent' },
    plain: { bg: c.surface, down: c.paper2, fg: c.ink, edge: c.line },
    danger: { bg: c.crimsonTint, down: c.line, fg: c.danger, edge: 'transparent' },
  }[tone];
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} hitSlop={small ? 4 : 0}
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      style={({ pressed }) => ({
        minHeight: small ? 36 : 48, paddingHorizontal: small ? 14 : 20, borderRadius: small ? 11 : 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: small ? 6 : 8,
        alignSelf: fill ? 'stretch' : 'flex-start', flexGrow: fill ? 1 : 0, flexShrink: 1,
        backgroundColor: pressed ? look.down : look.bg, borderWidth: 1, borderColor: look.edge,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}>
      {busy ? <ActivityIndicator size="small" color={look.fg} />
        : icon ? <Icon name={icon} size={small ? 14 : 17} stroke={2.2} color={look.fg} /> : null}
      <Text numberOfLines={1} style={{ fontSize: small ? 14 : 16, fontWeight: '600', letterSpacing: -0.2, color: look.fg, flexShrink: 1 }}>{label}</Text>
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
            style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? c.action : c.surface, borderWidth: 1, borderColor: on ? c.action : c.line, opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{o.label}</Text>
            {o.count !== undefined && <Text style={[{ fontSize: 13, fontWeight: '600', color: on ? 'rgba(255,255,255,0.8)' : c.ink3 }, tnum]}>{o.count}</Text>}
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
            style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? c.action : c.paper2, opacity: pressed ? 0.8 : 1 })}>
            {o.icon && <Icon name={o.icon} size={14} stroke={2.2} color={on ? '#fff' : c.ink3} />}
            <Text style={{ fontSize: 14, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const FieldLabel = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink2 }}>{text}</Text>;
};

// A numbered step in a short sequence (pick a badge → who → why).
export const Step = ({ n, text }: { n: number; text: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[{ fontSize: 13, fontWeight: '700', color: c.link }, tnum]}>{n}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 16.5, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{text}</Text>
    </View>
  );
};

// Saved / failed, under the thing that did it.
export const Result = ({ msg }: { msg: { ok: boolean; text: string } | null }) => {
  const { c } = useTheme();
  if (!msg) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
      <Icon name={msg.ok ? 'check-circle' : 'flash'} size={16} stroke={2} color={msg.ok ? c.moss : c.danger} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: msg.ok ? c.ink2 : c.danger, lineHeight: 19 }}>{msg.text}</Text>
    </View>
  );
};

const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {};

export const Field = ({ label, style, onFocus, onBlur, ...rest }: TextInputProps & { label?: string }) => {
  const { c } = useTheme();
  const [on, setOn] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {!!label && <FieldLabel text={label} />}
      <TextInput placeholderTextColor={c.ink3} accessibilityLabel={label} {...rest}
        onFocus={e => { setOn(true); onFocus?.(e); }} onBlur={e => { setOn(false); onBlur?.(e); }}
        style={[{ minHeight: 48, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.ink, backgroundColor: c.surface, borderWidth: 1, borderColor: on ? c.link : c.line, ...noOutline },
          rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} />
    </View>
  );
};

// The one search box. Filters as you type; the cross clears it and keeps the
// keyboard up. `busy` swaps the glass for a spinner while it looks.
export const Search = ({ value, onChange, placeholder, busy }: { value: string; onChange: (v: string) => void; placeholder: string; busy?: boolean }) => {
  const { c } = useTheme();
  const [on, setOn] = useState(false);
  const input = useRef<TextInput>(null);
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6, minHeight: 48, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: on ? c.link : c.line }}>
      <View style={{ width: 20, alignItems: 'center' }}>
        {busy ? <ActivityIndicator size="small" color={c.ink3} /> : <Icon name="search" size={18} stroke={2} color={on ? c.link : c.ink3} />}
      </View>
      <TextInput ref={input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.ink3} accessibilityLabel={placeholder}
        autoCorrect={false} autoCapitalize="none" spellCheck={false} returnKeyType="search" blurOnSubmit
        onFocus={() => setOn(true)} onBlur={() => setOn(false)}
        style={{ flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 16, color: c.ink, ...noOutline }} />
      {!!value && (
        <Pressable onPress={() => { onChange(''); input.current?.focus(); }} accessibilityRole="button" accessibilityLabel="Clear search"
          style={({ pressed }) => ({ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={11} stroke={2.6} color={c.ink2} />
          </View>
        </Pressable>
      )}
    </Pressable>
  );
};

// Search for people by name, school email or student number, with the results
// right under the box. Pair with usePeopleSearch (search.ts).
type Findable = { id: string; name: string; email: string; grade?: number; teacher?: boolean };
export const PeopleFinder = <T extends Findable>({ s, placeholder = 'Name, email or student number', none = 'Nobody found. Check the spelling, or try their student number.', action, skip = [], bare }: {
  s: ReturnType<typeof usePeopleSearch<T>>; placeholder?: string; none?: string; action: (p: T) => React.ReactNode; skip?: string[];
  bare?: boolean;   // already on a card: no box of its own
}) => {
  const { c } = useTheme();
  const list = s.found.filter(p => !skip.includes(p.id));
  const row = (p: T) => (
    <PersonRow key={p.id} person={p.name || p.email} sub={[p.teacher ? 'Teacher' : p.grade ? `Grade ${p.grade}` : null, p.email].filter(Boolean).join('\n')} trailing={action(p)} />
  );
  const note = s.state === 'error' ? s.error
    : s.state === 'none' ? none
    : s.state === 'found' && !list.length ? 'Already added.'
    : s.state === 'short' ? 'Keep typing…' : null;
  return (
    <View style={{ gap: 10 }}>
      <Search value={s.q} onChange={s.setQ} placeholder={placeholder} busy={s.state === 'busy'} />
      {!!note && <Text accessibilityLiveRegion="polite" style={{ fontSize: 13.5, color: s.state === 'error' ? c.danger : c.ink3, lineHeight: 19, paddingHorizontal: 4 }}>{note}</Text>}
      {list.length > 0 && (s.state === 'found' || s.state === 'busy') && (
        bare ? <View style={{ marginHorizontal: -14 }}>{list.map(row)}</View> : <Group>{list.map(row)}</Group>
      )}
    </View>
  );
};

// How many a search found, with a way out.
export const FoundLine = ({ n, q, onClear }: { n: number; q: string; onClear: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 4 }}>
      <Text accessibilityLiveRegion="polite" numberOfLines={1} style={[{ flex: 1, fontSize: 14, color: c.ink3 }, tnum]}>{n === 0 ? 'No results' : n === 1 ? '1 result' : `${n} results`} for “{q.trim()}”</Text>
      <Pressable onPress={onClear} hitSlop={12} accessibilityRole="button"><Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>Clear</Text></Pressable>
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
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
