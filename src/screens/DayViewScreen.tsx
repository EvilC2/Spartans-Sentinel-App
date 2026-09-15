// Spartans — Day view (from More).
// A time-blocked vertical column for one school day: every bell period drawn
// to scale, the student's course in each block, a "now" line while the day
// is on. Step to other days with the arrows. Tap a block for the class card.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { NowDot } from '../components/Chrome';
import { useProfile, shortName, teacherShort, roomShort } from '../ProfileContext';
import { CALENDAR, toISO, MONTH_NAMES } from '../calendar';
import { buildDayPlan, fmt12, toMin, PlanPeriod } from '../bell';
import { useNow } from '../useToday';
import { useClassSheet } from '../components/ClassCard';
import type { ScreenProps } from '../../App';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const PX_PER_MIN = 2.1;

export default function DayViewScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const now = useNow();
  const [offset, setOffset] = useState(0);
  const sheet = useClassSheet();

  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const iso = toISO(date);
  const cal = CALENDAR[iso];
  const plan = buildDayPlan(cal, profile?.courses || []);
  const isToday = offset === 0;
  const label = `${DOW[date.getDay()]} · ${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <AppHeader topInset={topInset} title="Day view" back />

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 16, paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700', color: isToday ? c.moss : c.ink3 }}>
            {isToday ? 'Today' : offset === 1 ? 'Tomorrow' : offset === -1 ? 'Yesterday' : ' '}
          </Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: c.ink, marginTop: 2 }}>{label}</Text>
          <Text style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>
            {plan ? `Day ${plan.dayNum} · ${plan.bellName} · ${plan.code}${cal?.projected ? ' · projected' : ''}` : cal?.label || (cal?.kind === 'weekend' ? 'Weekend' : 'No classes')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <NavBtn icon="chev-l" onPress={() => setOffset(o => o - 1)} />
          <Pressable onPress={() => setOffset(0)} style={({ pressed }) => ({ backgroundColor: c.navy50, borderRadius: 16, paddingHorizontal: 12, height: 32, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: c.navy700, fontSize: 12.5, fontWeight: '600' }}>Today</Text>
          </Pressable>
          <NavBtn icon="chev-r" onPress={() => setOffset(o => o + 1)} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {plan ? (
          <DayColumn plan={plan} now={isToday ? now : null} onBlock={p => p.course && sheet.openCourse(p.course)} />
        ) : (
          <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 18, alignItems: 'center' }, shadow.sm]}>
            <Text style={{ fontSize: 14, color: c.ink3 }}>No bell schedule on this day.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const NavBtn = ({ icon, onPress }: { icon: 'chev-l' | 'chev-r'; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, shadow.sm]}>
      <Icon name={icon} size={16} stroke={1.8} color={c.ink2} />
    </Pressable>
  );
};

// One day drawn to scale. Shared with the calendar's week view.
export const DayColumn = ({ plan, now, onBlock, compact = false, pxPerMin = PX_PER_MIN }: {
  plan: NonNullable<ReturnType<typeof buildDayPlan>>; now: Date | null; onBlock?: (p: PlanPeriod) => void; compact?: boolean; pxPerMin?: number;
}) => {
  const { c } = useTheme();
  const PX_PER_MIN = pxPerMin;
  const ps = plan.periods;
  const start = toMin(ps[0].start);
  const end = toMin(ps[ps.length - 1].end);
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null;
  const showNow = nowMin !== null && nowMin >= start && nowMin <= end;
  const gutter = compact ? 0 : 52;

  return (
    <View style={{ height: (end - start) * PX_PER_MIN + 8, flexDirection: 'row' }}>
      {!compact && (
        <View style={{ width: gutter }}>
          {ps.map((p, i) => (
            <Text key={i} style={[{ position: 'absolute', top: (toMin(p.start) - start) * PX_PER_MIN - 1, fontSize: 10.5, color: c.ink4, fontWeight: '500' }, tnum]}>
              {fmt12(p.start)}
            </Text>
          ))}
          <Text style={[{ position: 'absolute', top: (end - start) * PX_PER_MIN - 1, fontSize: 10.5, color: c.ink4, fontWeight: '500' }, tnum]}>{fmt12(ps[ps.length - 1].end)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        {ps.map((p, i) => {
          const top = (toMin(p.start) - start) * PX_PER_MIN;
          const h = (toMin(p.end) - toMin(p.start)) * PX_PER_MIN;
          const isBlock = p.kind === 'block';
          const isFit = p.kind === 'fit';
          const spare = !!p.course?.spare;
          const col = isFit ? c.gold : isBlock && p.course && !spare ? p.course.color : c.ink4;
          const live = nowMin !== null && nowMin >= toMin(p.start) && nowMin < toMin(p.end);
          const inner = (
            <View style={{
              position: 'absolute', top, left: 0, right: 0, height: Math.max(h - 3, 14),
              borderRadius: compact ? 8 : 12,
              backgroundColor: isBlock || isFit ? (spare ? c.paper2 : c.surface) : c.paper2,
              borderWidth: 1, borderColor: live ? col : c.line,
              overflow: 'hidden', paddingLeft: compact ? 6 : 12, paddingRight: compact ? 4 : 10, justifyContent: 'center',
            }}>
              {(isBlock || isFit) && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: spare ? c.line : col }} />}
              {isBlock || isFit ? (
                <>
                  <Text numberOfLines={1} style={{ fontSize: compact ? 11 : 14, fontWeight: '600', color: spare ? c.ink3 : c.ink, letterSpacing: -0.2 }}>
                    {isFit ? 'FIT' : compact ? shortName(p.course?.name || '') : (p.course?.name || p.label)}
                  </Text>
                  {!compact && (
                    <Text numberOfLines={1} style={{ fontSize: 12, color: c.ink3, marginTop: 2 }}>
                      {isFit ? 'Flexible instructional time' : [`Block ${p.slot}`, p.course?.room ? roomShort(p.course.room) : null, p.course?.teacher ? teacherShort(p.course.teacher) : null].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {compact && <Text style={[{ fontSize: 9.5, color: c.ink4, marginTop: 1 }, tnum]}>{fmt12(p.start)}</Text>}
                </>
              ) : (
                <Text numberOfLines={1} style={{ fontSize: compact ? 9.5 : 11.5, color: c.ink4, fontWeight: '500' }}>{compact ? '' : p.label}</Text>
              )}
            </View>
          );
          return onBlock && isBlock && p.course && !spare
            ? <Pressable key={i} onPress={() => onBlock(p)} accessibilityRole="button" accessibilityLabel={`${p.course.name}, open class card`}>{inner}</Pressable>
            : <View key={i}>{inner}</View>;
        })}
        {showNow && (
          <View pointerEvents="none" style={{ position: 'absolute', left: -4, right: 0, top: (nowMin! - start) * PX_PER_MIN, flexDirection: 'row', alignItems: 'center' }}>
            <NowDot size={8} color={c.crimson} />
            <View style={{ flex: 1, height: 1.5, backgroundColor: c.crimson }} />
          </View>
        )}
      </View>
    </View>
  );
};
