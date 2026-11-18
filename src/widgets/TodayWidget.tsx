// Spartans — "Today's rotation" home screen widget.
// The Home hero card, tightened for a widget: the one square that matters
// (the class that is on, or the one coming up) sits beside "Day N", the
// in-progress panel moves up under it, and the "Next · …" line stays.
// Small, medium and large; large adds the rest of the day.
//
// Everything in the 'widget' function runs in the widget extension's own JS
// runtime: only @expo/ui/swift-ui components and modifiers, no hooks, and no
// references to anything outside the function (colours included).

import { HStack, VStack, Text, Spacer, Circle, ProgressView, Rectangle } from '@expo/ui/swift-ui';
import {
  font, foregroundStyle, padding, frame, background, shapes, lineLimit, kerning,
  monospacedDigit, containerBackground, multilineTextAlignment, tint, labelsHidden,
  clipped, widgetURL, minimumScaleFactor, opacity,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TodayProps } from './model';

const TodayWidget = (input: TodayProps, env: WidgetEnvironment) => {
  'widget';
  const NAVY = '#1A3A5C';
  const NAVY9 = '#0E2238';
  const GOLD = '#C99A50';
  const BAR_GOLD = '#E8D8AE';
  const MOSS = '#8DB57A';
  const W = '#FFFFFF';
  const W70 = '#FFFFFFB3';
  const W55 = '#FFFFFF8C';
  const W40 = '#FFFFFF66';
  const W14 = '#FFFFFF24';
  const W10 = '#FFFFFF1A';
  const INK3 = '#5C6470';

  // The gallery preview and the first launch have no props yet.
  const p = input && input.headline ? input : {
    date: 'Thursday · Sep 17', headline: 'Day 2', dayNum: 2, code: '2-23F14', mode: 'class',
    tile: { top: '2-3', name: 'Chem 11', time: '9:55', now: true },
    eyebrow: 'In progress', title: 'Chemistry 11', short: 'Chem 11', sub: 'Room 213 · Smith', room: 'Rm 213',
    start: 0, end: 0, until: '11:05', footer: 'Next · FIT at 11:05',
    later: [{ time: '11:05', name: 'FIT', sub: '' }, { time: '11:50', name: 'English 12', sub: 'Rm 204' }, { time: '1:00', name: 'Lunch', sub: '' }],
    tiles: [], together: '',
  };

  const fam = env.widgetFamily;
  const small = fam === 'systemSmall';
  const large = fam === 'systemLarge';
  const live = p.mode === 'class' || p.mode === 'gap' || p.mode === 'before';
  const accent = p.mode === 'class' ? MOSS : live ? GOLD : W40;
  const hasTimer = p.end > 0 && p.end > p.start;
  const bg = containerBackground({ type: 'linearGradient', colors: [NAVY, NAVY9], startPoint: { x: 0.25, y: 0 }, endPoint: { x: 0.75, y: 1 } }, 'widget');

  const tile = p.tile ? (
    <VStack
      spacing={1}
      modifiers={[
        padding({ vertical: small ? 6 : 8, horizontal: small ? 7 : 10 }),
        frame({ minWidth: small ? 56 : 70 }),
        background(p.tile.now ? W : W10, shapes.roundedRectangle({ cornerRadius: small ? 11 : 13, roundedCornerStyle: 'continuous' })),
      ]}
    >
      <Text modifiers={[font({ size: 9, weight: 'semibold' }), kerning(0.8), foregroundStyle(p.tile.now ? INK3 : (p.tile.top === 'FLEX' ? BAR_GOLD : W55))]}>{p.tile.top}</Text>
      <Text modifiers={[font({ size: small ? 13 : 15, weight: 'semibold' }), lineLimit(1), minimumScaleFactor(0.7), foregroundStyle(p.tile.now ? NAVY9 : W)]}>{p.tile.name}</Text>
      <Text modifiers={[font({ size: 10, weight: 'medium' }), monospacedDigit(), foregroundStyle(p.tile.now ? INK3 : W55)]}>{p.tile.time}</Text>
    </VStack>
  ) : null;

  // Day N with the rotation code above it, and the one square beside it.
  const header = (
    <HStack alignment="center" spacing={8}>
      <VStack alignment="leading" spacing={0}>
        <Text modifiers={[font({ size: small ? 9 : 10, weight: 'semibold' }), kerning(1.1), foregroundStyle(W55), lineLimit(1)]}>
          {p.code ? (small ? p.code : `TODAY · ${p.code}`) : p.date.toUpperCase()}
        </Text>
        <Text modifiers={[font({ design: 'serif', size: p.dayNum ? (small ? 34 : 42) : (small ? 20 : 26) }), foregroundStyle(W), lineLimit(1), minimumScaleFactor(0.6)]}>
          {p.headline}
        </Text>
      </VStack>
      <Spacer />
      {tile}
    </HStack>
  );

  const eyebrow = (
    <HStack spacing={5}>
      {live ? <Circle modifiers={[foregroundStyle(accent), frame({ width: 6, height: 6 })]} /> : null}
      <Text modifiers={[font({ size: 10, weight: 'bold' }), kerning(1), foregroundStyle(accent), lineLimit(1)]}>{p.eyebrow.toUpperCase()}</Text>
    </HStack>
  );

  const countdown = hasTimer ? (
    <VStack alignment="trailing" spacing={0}>
      <Text
        timerInterval={{ lower: new Date(p.start), upper: new Date(p.end) }}
        countsDown
        modifiers={[font({ size: small ? 20 : 24, weight: 'bold' }), monospacedDigit(), foregroundStyle(W), multilineTextAlignment('trailing'), frame({ maxWidth: small ? 90 : 110, alignment: 'trailing' })]}
      />
      <Text modifiers={[font({ size: 10.5 }), foregroundStyle(W55), monospacedDigit()]}>{`until ${p.until}`}</Text>
    </VStack>
  ) : null;

  // The bar fills as the period runs. Labels hidden and clipped to the bar so
  // the system's own timer text never shows under it.
  const bar = hasTimer && p.mode !== 'before' ? (
    <ProgressView
      timerInterval={{ lower: new Date(p.start), upper: new Date(p.end) }}
      countsDown={false}
      modifiers={[tint(p.mode === 'class' ? BAR_GOLD : accent), labelsHidden(), frame({ height: 4, alignment: 'top' }), clipped()]}
    />
  ) : (
    <Rectangle modifiers={[foregroundStyle(W14), frame({ height: 3 }), opacity(live ? 1 : 0.6)]} />
  );

  // What is next, and who you share this block with ("Spare with Alex" for a
  // spare you both have).
  const footer = p.footer || p.together ? (
    <HStack spacing={8}>
      <Text modifiers={[font({ size: 11.5 }), foregroundStyle(live ? W70 : W55), lineLimit(1), monospacedDigit()]}>{p.footer || ' '}</Text>
      <Spacer />
      {p.together ? <Text modifiers={[font({ size: 11.5, weight: 'semibold' }), foregroundStyle(MOSS), lineLimit(1)]}>{p.together}</Text> : null}
    </HStack>
  ) : null;

  if (small) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[bg, widgetURL('spartans://home')]}>
        {header}
        <Spacer />
        {eyebrow}
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(W), lineLimit(1), minimumScaleFactor(0.75)]}>{p.mode === 'class' || p.mode === 'gap' || p.mode === 'before' ? p.short : p.title}</Text>
        {hasTimer ? (
          <Text
            timerInterval={{ lower: new Date(p.start), upper: new Date(p.end) }}
            countsDown
            modifiers={[font({ size: 20, weight: 'bold' }), monospacedDigit(), foregroundStyle(W)]}
          />
        ) : (
          <Text modifiers={[font({ size: 11 }), foregroundStyle(W55), lineLimit(2)]}>{p.sub || ' '}</Text>
        )}
        {hasTimer && p.mode !== 'before' ? bar : null}
      </VStack>
    );
  }

  const nowPanel = (
    <HStack alignment="bottom" spacing={10}>
      <VStack alignment="leading" spacing={2}>
        {eyebrow}
        <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(W), lineLimit(1), minimumScaleFactor(0.8)]}>{p.title}</Text>
        {p.sub ? <Text modifiers={[font({ size: 11.5 }), foregroundStyle(W55), lineLimit(1)]}>{p.sub}</Text> : null}
      </VStack>
      <Spacer />
      {countdown}
    </HStack>
  );

  const rows = large ? p.later.slice(0, 6).map((r, i) => (
    <HStack key={`r${i}`} spacing={10}>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), monospacedDigit(), foregroundStyle(W55), frame({ width: 38, alignment: 'leading' })]}>{r.time}</Text>
      <Text modifiers={[font({ size: 13.5, weight: 'semibold' }), foregroundStyle(W), lineLimit(1)]}>{r.name}</Text>
      <Spacer />
      {r.sub ? <Text modifiers={[font({ size: 11.5 }), foregroundStyle(W55)]}>{r.sub}</Text> : null}
    </HStack>
  )) : [];

  return (
    <VStack alignment="leading" spacing={large ? 10 : 7} modifiers={[bg, widgetURL('spartans://home')]}>
      {header}
      {nowPanel}
      {bar}
      {footer}
      {large && rows.length ? (
        <VStack alignment="leading" spacing={9} modifiers={[padding({ top: 6 })]}>
          <Text modifiers={[font({ size: 10, weight: 'semibold' }), kerning(1.1), foregroundStyle(W40)]}>LATER TODAY</Text>
          {rows}
        </VStack>
      ) : null}
      {large ? <Spacer /> : null}
    </VStack>
  );
};

export default createWidget<TodayProps>('SpartansToday', TodayWidget);
