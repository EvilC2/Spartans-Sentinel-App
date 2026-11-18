// Spartans — "Class countdown" Lock Screen widget.
// Same timeline as Today's rotation (one entry per bell change), drawn for the
// Lock Screen's three accessory sizes:
//   circular     — Day N over a ring that empties as the period runs out
//   rectangular  — what is on, the live countdown, and the room
//   inline       — one line above the clock: "Day 2 · Chem 11 · 18:02"
// Lock Screen widgets are tinted by the system, so no brand colours here.

import { HStack, VStack, Text, ZStack, ProgressView, AccessoryWidgetBackground, Image } from '@expo/ui/swift-ui';
import {
  font, foregroundStyle, lineLimit, monospacedDigit, progressViewStyle, widgetURL,
  minimumScaleFactor, multilineTextAlignment, frame, labelsHidden, padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TodayProps } from './model';

const ClassWidget = (input: TodayProps, env: WidgetEnvironment) => {
  'widget';
  const p = input && input.headline ? input : {
    headline: 'Day 2', dayNum: 2, mode: 'class', eyebrow: 'In progress', title: 'Chemistry 11', short: 'Chem 11',
    sub: 'Room 213 · Smith', room: 'Rm 213', start: 0, end: 0, until: '11:05', footer: 'Next · FIT at 11:05', together: '',
  };
  const fam = env.widgetFamily;
  const live = p.mode === 'class' || p.mode === 'gap' || p.mode === 'before';
  const hasTimer = p.end > 0 && p.end > p.start;
  const dayTag = p.dayNum ? `Day ${p.dayNum}` : p.headline;

  if (fam === 'accessoryInline') {
    if (live && hasTimer) {
      return (
        <HStack modifiers={[widgetURL('spartans://home')]}>
          <Image systemName={p.mode === 'class' ? 'graduationcap.fill' : 'clock'} />
          <Text>{`${dayTag} · ${p.short} · `}</Text>
          <Text timerInterval={{ lower: new Date(p.start), upper: new Date(p.end) }} countsDown />
        </HStack>
      );
    }
    return (
      <HStack modifiers={[widgetURL('spartans://home')]}>
        <Image systemName="calendar" />
        <Text>{p.mode === 'after' || p.mode === 'off' ? `${dayTag} · ${p.title}` : dayTag}</Text>
      </HStack>
    );
  }

  if (fam === 'accessoryCircular') {
    const label = (
      <VStack spacing={-2}>
        <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>{p.dayNum ? 'DAY' : 'OFF'}</Text>
        <Text modifiers={[font({ size: p.dayNum ? 24 : 16, weight: 'bold', design: 'rounded' })]}>{p.dayNum ? String(p.dayNum) : '–'}</Text>
      </VStack>
    );
    return (
      <ZStack modifiers={[widgetURL('spartans://home')]}>
        <AccessoryWidgetBackground />
        {live && hasTimer ? (
          <ProgressView
            timerInterval={{ lower: new Date(p.start), upper: new Date(p.end) }}
            countsDown
            modifiers={[progressViewStyle('circular'), labelsHidden(), padding({ all: 2 })]}
          />
        ) : null}
        {label}
      </ZStack>
    );
  }

  // accessoryRectangular (and anything else)
  return (
    <VStack alignment="leading" spacing={0} modifiers={[widgetURL('spartans://home'), frame({ maxWidth: 400, alignment: 'leading' })]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>
        {`${dayTag} · ${p.eyebrow}`}
      </Text>
      <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.75)]}>
        {p.title}
      </Text>
      {live && hasTimer ? (
        <HStack spacing={4}>
          <Text
            timerInterval={{ lower: new Date(p.start), upper: new Date(p.end) }}
            countsDown
            modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), multilineTextAlignment('leading'), frame({ maxWidth: 52, alignment: 'leading' })]}
          />
          <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>
            {p.together ? `· ${p.together}` : p.room ? `· ${p.room}` : `· until ${p.until}`}
          </Text>
        </HStack>
      ) : (
        <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' }), lineLimit(1)]}>{p.sub || p.footer || ' '}</Text>
      )}
    </VStack>
  );
};

export default createWidget<TodayProps>('SpartansClass', ClassWidget);
