// Spartans — class Live Activity: the Today card on the Lock Screen and in the
// Dynamic Island while school is on. Same props as the Today widget (see
// model.ts → todayProps). Started and stepped along by src/widgets/sync.ios.ts.
//
// Lock Screen banner laid out like the Home card: code over Day N with the
// day's block tiles beside it, then what is on with the countdown, the bar,
// and what is next with who you share the block with.
// Dynamic Island: compact is just an icon and the countdown, kept narrow;
// long-press (expanded) shows the whole card.

import { HStack, VStack, Text, Spacer, Circle, ProgressView, Image } from '@expo/ui/swift-ui';
import {
  font, foregroundStyle, padding, frame, background, shapes, lineLimit, kerning,
  monospacedDigit, multilineTextAlignment, tint, labelsHidden, clipped,
  minimumScaleFactor, activityBackgroundTint, progressViewStyle,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { TodayProps } from './model';

const ClassActivity = (p: TodayProps, env: LiveActivityEnvironment) => {
  'widget';
  const NAVY9 = '#0E2238';
  const GOLD = '#C99A50';
  const BAR_GOLD = '#E8D8AE';
  const MOSS = '#8DB57A';
  const W = '#FFFFFF';
  const W70 = '#FFFFFFB3';
  const W55 = '#FFFFFF8C';
  const W40 = '#FFFFFF66';
  const W30 = '#FFFFFF4D';
  const W10 = '#FFFFFF1A';
  const INK3 = '#5C6470';

  const dim = !!env.isLuminanceReduced;
  const live = p.mode === 'class' || p.mode === 'gap' || p.mode === 'before';
  const accent = dim ? W70 : p.mode === 'class' ? MOSS : live ? GOLD : W40;
  const hasTimer = p.end > 0 && p.end > p.start;
  const range = hasTimer ? { lower: new Date(p.start), upper: new Date(p.end) } : null;
  const dayTag = p.dayNum ? `Day ${p.dayNum}` : p.headline;

  const timer = (size: number, maxWidth: number) => range ? (
    <Text
      timerInterval={range}
      countsDown
      modifiers={[font({ size, weight: 'bold' }), monospacedDigit(), foregroundStyle(W), multilineTextAlignment('trailing'), frame({ maxWidth, alignment: 'trailing' })]}
    />
  ) : null;

  const bar = range && p.mode !== 'before' ? (
    <ProgressView
      timerInterval={range}
      countsDown={false}
      modifiers={[tint(p.mode === 'class' ? BAR_GOLD : accent), labelsHidden(), frame({ height: 4, alignment: 'top' }), clipped()]}
    />
  ) : null;

  const eyebrow = (
    <HStack spacing={5}>
      {live ? <Circle modifiers={[foregroundStyle(accent), frame({ width: 6, height: 6 })]} /> : null}
      <Text modifiers={[font({ size: 10.5, weight: 'bold' }), kerning(1), foregroundStyle(accent), lineLimit(1)]}>{p.eyebrow.toUpperCase()}</Text>
    </HStack>
  );

  // The Home card's row of block tiles, shrunk: done ones dimmed, the one on
  // now in white.
  const tiles = (p.tiles || []).map((b, i) => {
    const now = b.state === 'now' && !dim;
    const done = b.state === 'done';
    return (
      <VStack
        key={`t${i}`}
        spacing={0}
        modifiers={[
          padding({ vertical: 4, horizontal: 3 }),
          frame({ width: 40 }),
          background(now ? W : done ? '#0000002E' : W10, shapes.roundedRectangle({ cornerRadius: 9, roundedCornerStyle: 'continuous' })),
        ]}
      >
        <Text modifiers={[font({ size: 7.5, weight: 'semibold' }), kerning(0.6), lineLimit(1), foregroundStyle(now ? INK3 : b.top === 'FLEX' && !done ? BAR_GOLD : done ? W30 : W55)]}>{b.top}</Text>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), lineLimit(1), minimumScaleFactor(0.6), foregroundStyle(now ? NAVY9 : done ? W40 : W)]}>{b.name}</Text>
      </VStack>
    );
  });

  // "until 11:05", the time in gold like Home.
  const until = range ? (
    <HStack spacing={3}>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(W55)]}>until</Text>
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(BAR_GOLD), monospacedDigit()]}>{p.until}</Text>
    </HStack>
  ) : null;

  const footer = p.footer ? (
    <Text modifiers={[font({ size: 11.5 }), foregroundStyle(W70), lineLimit(1), monospacedDigit()]}>{p.footer}</Text>
  ) : null;

  // Friends in this block: "with Alex", or "Spare with Alex" for a shared spare.
  const together = p.together ? (
    <HStack spacing={4}>
      <Image systemName="person.2.fill" color={MOSS} size={10} />
      <Text modifiers={[font({ size: 11.5, weight: 'semibold' }), foregroundStyle(MOSS), lineLimit(1)]}>{p.together}</Text>
    </HStack>
  ) : null;

  // Eyebrow carries the room so the title gets the whole line.
  const eyebrowText = (p.room && live ? `${p.eyebrow} · ${p.room}` : p.eyebrow).toUpperCase();
  const nowLine = (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={5}>
        {live ? <Circle modifiers={[foregroundStyle(accent), frame({ width: 6, height: 6 })]} /> : null}
        <Text modifiers={[font({ size: 10, weight: 'bold' }), kerning(1), foregroundStyle(accent), lineLimit(1)]}>{eyebrowText}</Text>
      </HStack>
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(W), lineLimit(1), minimumScaleFactor(0.75)]}>
        {p.title}
      </Text>
      {!range && p.sub ? <Text modifiers={[font({ size: 11.5 }), foregroundStyle(W55), lineLimit(1)]}>{p.sub}</Text> : null}
    </VStack>
  );

  // Out of date: the period this update was for has ended and the app hasn't
  // been opened since (Apple won't let it update itself). Instead of a timer
  // stuck at 0:00, show the rest of the day. Every row has its own timer:
  // it shows the full length until that period starts, then counts down, so
  // whatever is on now is the one ticking.
  const rest = p.rest || [];
  const stale = !!env.isStale && rest.length > 0;
  const restRows = rest.map((r, i) => (
    <HStack key={`r${i}`} spacing={8}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(W55), monospacedDigit(), frame({ width: 38, alignment: 'leading' })]}>{r.time}</Text>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(W), lineLimit(1), minimumScaleFactor(0.75)]}>{r.name}</Text>
      <Spacer />
      <Text
        timerInterval={{ lower: new Date(r.start), upper: new Date(r.end) }}
        countsDown
        modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(BAR_GOLD), multilineTextAlignment('trailing'), frame({ width: 64, alignment: 'trailing' })]}
      />
    </HStack>
  ));
  const staleBody = (
    <VStack alignment="leading" spacing={5}>
      {restRows}
      <Text modifiers={[font({ size: 10.5 }), foregroundStyle(W40), lineLimit(1)]}>Open Spartans to refresh</Text>
    </VStack>
  );
  // The next period's range, for the Dynamic Island when out of date.
  const nextRange = stale ? { lower: new Date(rest[0].start), upper: new Date(rest[0].end) } : null;

  const icon = p.mode === 'class' ? 'graduationcap.fill' : p.mode === 'before' ? 'sunrise.fill' : live ? 'cup.and.saucer.fill' : 'checkmark.circle.fill';

  return {
    banner: (
      <VStack alignment="leading" spacing={7} modifiers={[padding({ horizontal: 16, vertical: 13 }), activityBackgroundTint(NAVY9)]}>
        {/* Rotation code over Day N, the day's tiles beside it — Home's top half. */}
        <HStack alignment="center" spacing={10}>
          <VStack alignment="leading" spacing={0}>
            <Text modifiers={[font({ size: 9, weight: 'semibold' }), kerning(1.1), foregroundStyle(W55), lineLimit(1)]}>
              {p.code ? `TODAY · ${p.code}` : p.date.toUpperCase()}
            </Text>
            <Text modifiers={[font({ design: 'serif', size: p.dayNum ? 30 : 22 }), foregroundStyle(W), lineLimit(1), minimumScaleFactor(0.6)]}>{dayTag}</Text>
          </VStack>
          <Spacer />
          {tiles.length ? <HStack spacing={4}>{tiles}</HStack> : null}
        </HStack>
        {stale ? staleBody : (
          <VStack alignment="leading" spacing={7}>
            {/* What is on, with the countdown on the right — Home's now panel. */}
            <HStack alignment="bottom" spacing={10}>
              {nowLine}
              <Spacer />
              <VStack alignment="trailing" spacing={0}>
                {timer(26, 110)}
                {until}
              </VStack>
            </HStack>
            {bar}
            {footer || together ? (
              <HStack spacing={8}>
                {footer}
                <Spacer />
                {together}
              </HStack>
            ) : null}
          </VStack>
        )}
      </VStack>
    ),
    // Compact Dynamic Island stays narrow — just the icon and the countdown.
    // The class name and everything else wait for the long-press (expanded).
    compactLeading: (
      <Image systemName={icon} color={accent} size={14} />
    ),
    compactTrailing: nextRange || range ? (
      <Text
        timerInterval={(nextRange || range)!}
        countsDown
        modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(accent), multilineTextAlignment('trailing'), frame({ width: 40, alignment: 'trailing' })]}
      />
    ) : (
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(W), lineLimit(1), frame({ maxWidth: 40, alignment: 'trailing' })]}>{p.dayNum ? `D${p.dayNum}` : '–'}</Text>
    ),
    minimal: nextRange || range ? (
      <ProgressView timerInterval={(nextRange || range)!} countsDown modifiers={[progressViewStyle('circular'), tint(accent), labelsHidden()]} />
    ) : (
      <Image systemName={icon} color={accent} />
    ),
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6, top: 4 })]}>
        <Text modifiers={[font({ design: 'serif', size: 26 }), foregroundStyle(W)]}>{dayTag}</Text>
        {eyebrow}
      </VStack>
    ),
    expandedTrailing: stale ? <Spacer /> : (
      <VStack alignment="trailing" spacing={0} modifiers={[padding({ trailing: 6, top: 4 })]}>
        {timer(24, 100)}
        {until}
      </VStack>
    ),
    expandedBottom: stale ? (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 6, bottom: 4 })]}>{staleBody}</VStack>
    ) : (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 6, bottom: 4 })]}>
        <HStack spacing={6}>
          <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(W), lineLimit(1)]}>{p.title}</Text>
          {p.room ? <Text modifiers={[font({ size: 13 }), foregroundStyle(W55)]}>{`· ${p.room}`}</Text> : null}
          <Spacer />
        </HStack>
        {bar}
        <HStack spacing={8}>
          {footer}
          <Spacer />
          {together}
        </HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity<TodayProps>('SpartansClassActivity', ClassActivity);
