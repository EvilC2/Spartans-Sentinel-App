// Spartans — "Up ahead" home screen widget.
// The countdown to the next day off (holiday, Pro-D, break) in big type, and on
// medium the next few dated school events beside it. From the school calendar,
// one entry per midnight for two weeks.

import { HStack, VStack, Text, Spacer, Rectangle } from '@expo/ui/swift-ui';
import {
  font, foregroundStyle, lineLimit, monospacedDigit, containerBackground, widgetURL,
  frame, kerning, minimumScaleFactor,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { UpAheadProps } from './model';

const UpAheadWidget = (input: UpAheadProps, env: WidgetEnvironment) => {
  'widget';
  const SKY = '#3B8BD9';
  const SKY6 = '#2E74BD';
  const NAVY9 = '#0E2238';
  const W = '#FFFFFF';
  const W70 = '#FFFFFFB3';
  const W55 = '#FFFFFF8C';
  const W20 = '#FFFFFF33';
  const BAR_GOLD = '#E8D8AE';

  const p = input && input.today ? input : {
    today: 'Day 1',
    off: { title: 'Remembrance Day', when: 'in 3 days', date: 'Wed Nov 11', days: 3 },
    events: [{ date: 'Fri Nov 13', title: 'Grad photos' }, { date: 'Tue Nov 17', title: 'Report cards' }],
  };
  const small = env.widgetFamily === 'systemSmall';
  const bg = containerBackground({ type: 'linearGradient', colors: [SKY, SKY6, NAVY9], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }, 'widget');

  const countdown = (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[font({ size: 10.5, weight: 'bold' }), kerning(1.1), foregroundStyle(W70)]}>NEXT DAY OFF</Text>
      {p.off ? (
        <HStack alignment="firstTextBaseline" spacing={4}>
          <Text modifiers={[font({ design: 'serif', size: small ? 46 : 50 }), foregroundStyle(W), monospacedDigit()]}>{String(p.off.days)}</Text>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(W70)]}>{p.off.days === 1 ? 'day' : 'days'}</Text>
        </HStack>
      ) : (
        <Text modifiers={[font({ design: 'serif', size: 26 }), foregroundStyle(W)]}>Summer</Text>
      )}
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(W), lineLimit(2), minimumScaleFactor(0.8)]}>{p.off ? p.off.title : 'No days off left'}</Text>
      <Text modifiers={[font({ size: 11 }), foregroundStyle(BAR_GOLD), monospacedDigit()]}>{p.off ? p.off.date : ''}</Text>
    </VStack>
  );

  if (small) {
    return (
      <VStack alignment="leading" spacing={0} modifiers={[bg, widgetURL('spartans://calendar')]}>
        <Text modifiers={[font({ size: 10.5, weight: 'semibold' }), foregroundStyle(W55)]}>{`Today · ${p.today}`}</Text>
        <Spacer />
        {countdown}
      </VStack>
    );
  }

  const rows = p.events.slice(0, 3).map((e, i) => (
    <VStack key={`e${i}`} alignment="leading" spacing={0}>
      <Text modifiers={[font({ size: 10.5, weight: 'semibold' }), foregroundStyle(BAR_GOLD), monospacedDigit()]}>{e.date}</Text>
      <Text modifiers={[font({ size: 12.5, weight: 'semibold' }), foregroundStyle(W), lineLimit(1)]}>{e.title}</Text>
    </VStack>
  ));

  return (
    <HStack alignment="top" spacing={14} modifiers={[bg, widgetURL('spartans://calendar')]}>
      <VStack alignment="leading" spacing={0}>
        <Text modifiers={[font({ size: 10.5, weight: 'semibold' }), foregroundStyle(W55)]}>{`Today · ${p.today}`}</Text>
        <Spacer />
        {countdown}
      </VStack>
      <Rectangle modifiers={[foregroundStyle(W20), frame({ width: 1 })]} />
      <VStack alignment="leading" spacing={8} modifiers={[frame({ maxWidth: 400, alignment: 'leading' })]}>
        <Text modifiers={[font({ size: 10.5, weight: 'bold' }), kerning(1.1), foregroundStyle(W70)]}>COMING UP</Text>
        {rows.length ? rows : <Text modifiers={[font({ size: 12 }), foregroundStyle(W70)]}>Nothing on the calendar.</Text>}
        <Spacer />
      </VStack>
    </HStack>
  );
};

export default createWidget<UpAheadProps>('SpartansUpAhead', UpAheadWidget);
