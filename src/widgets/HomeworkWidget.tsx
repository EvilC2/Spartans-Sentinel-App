// Spartans — "Homework" home screen widget.
// What is still to do, soonest first. Small: the count and the next item.
// Medium: the next few with their class and when they're due. Taps open the
// Homework page. Rebuilt by the app whenever homework changes, with one entry
// per midnight so "Tomorrow" becomes "Today" on time.

import { HStack, VStack, Text, Spacer, Circle } from '@expo/ui/swift-ui';
import {
  font, foregroundStyle, lineLimit, monospacedDigit, containerBackground, widgetURL,
  frame, kerning, padding, background, shapes, minimumScaleFactor,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { HomeworkProps } from './model';

const HomeworkWidget = (input: HomeworkProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const PAPER = dark ? '#161D26' : '#FAF9F5';
  const INK = dark ? '#F4F2EC' : '#0F1419';
  const INK3 = dark ? '#9A9588' : '#5C6470';
  const NAVY = dark ? '#8FBDF0' : '#1A3A5C';
  const CRIMSON = dark ? '#EF8A8A' : '#A23E3E';
  const GOLD = '#B68842';
  const MOSS = dark ? '#8DB57A' : '#5B7A4E';

  const p = input && input.items ? input : {
    open: 3, urgent: 1,
    items: [
      { title: 'Lab report: titration', cls: 'Chem 11', due: 'Today', tone: 'today' },
      { title: 'Read ch. 4–5', cls: 'Eng 12', due: 'Tomorrow', tone: 'soon' },
      { title: 'Problem set 7', cls: 'PreCa 12', due: 'Thu', tone: 'later' },
    ],
  };
  const small = env.widgetFamily === 'systemSmall';
  const toneColor = (tone: string) => tone === 'late' ? CRIMSON : tone === 'today' ? GOLD : tone === 'soon' ? NAVY : INK3;
  const bg = containerBackground(PAPER, 'widget');

  const head = (
    <HStack spacing={6}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), kerning(1.1), foregroundStyle(NAVY)]}>HOMEWORK</Text>
      <Spacer />
      {p.urgent ? (
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle('#FFFFFF'), padding({ horizontal: 6, vertical: 2 }), background(p.items[0] && p.items[0].tone === 'late' ? CRIMSON : GOLD, shapes.capsule())]}>
          {`${p.urgent} due`}
        </Text>
      ) : null}
    </HStack>
  );

  if (!p.open) {
    return (
      <VStack alignment="leading" spacing={4} modifiers={[containerBackground(PAPER, 'widget'), widgetURL('spartans://homework')]}>
        {head}
        <Spacer />
        <Text modifiers={[font({ design: 'serif', size: small ? 26 : 30 }), foregroundStyle(INK)]}>All done.</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(INK3), lineLimit(2)]}>Nothing left to hand in. Add homework from a class page.</Text>
      </VStack>
    );
  }

  if (small) {
    const first = p.items[0];
    return (
      <VStack alignment="leading" spacing={3} modifiers={[bg, widgetURL('spartans://homework')]}>
        {head}
        <Spacer />
        <Text modifiers={[font({ design: 'serif', size: 34 }), foregroundStyle(INK), monospacedDigit(), lineLimit(1)]}>{String(p.open)}</Text>
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(INK3)]}>{p.open === 1 ? 'thing to do' : 'things to do'}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(INK), lineLimit(1), minimumScaleFactor(0.8)]}>{first.title}</Text>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(toneColor(first.tone)), lineLimit(1), minimumScaleFactor(0.8)]}>{`${first.due} · ${first.cls}`}</Text>
      </VStack>
    );
  }

  // A medium widget has about 120pt inside its margins. Three two-line rows
  // fit, or two rows and the "+ more" line; three rows and "+ more" ran off
  // the bottom.
  const shown = p.open > 3 ? 2 : 3;
  const rows = p.items.slice(0, shown).map((h, i) => (
    <HStack key={`h${i}`} spacing={8}>
      <Circle modifiers={[foregroundStyle(toneColor(h.tone)), frame({ width: 7, height: 7 })]} />
      <VStack alignment="leading" spacing={0}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(INK), lineLimit(1), minimumScaleFactor(0.8)]}>{h.title}</Text>
        <Text modifiers={[font({ size: 10.5 }), foregroundStyle(INK3), lineLimit(1)]}>{h.cls}</Text>
      </VStack>
      <Spacer />
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(toneColor(h.tone)), lineLimit(1)]}>{h.due}</Text>
    </HStack>
  ));

  return (
    <VStack alignment="leading" spacing={6} modifiers={[bg, widgetURL('spartans://homework')]}>
      {head}
      {rows}
      <Spacer />
      {p.open > shown ? (
        <Text modifiers={[font({ size: 11 }), foregroundStyle(MOSS), lineLimit(1)]}>{`+ ${p.open - shown} more`}</Text>
      ) : null}
    </VStack>
  );
};

export default createWidget<HomeworkProps>('SpartansHomework', HomeworkWidget);
