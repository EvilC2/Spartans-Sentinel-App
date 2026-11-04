// Spartans — one school day drawn to scale. Used by the Calendar's Week strip
// (compact, three days across) and its Day tab (full width). Every bell
// period sits at its real time; classes wear their colour bar, a red "now"
// line runs while the day is on, and a notepad icon sits on any class that
// has homework due that day (count on it, faded once it's all ticked).
// Tap a class for its card. (This used to live in the Day view screen, which
// is now the Day tab inside Calendar.)

import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useTheme } from '../ThemeContext';
import { shadow, tnum } from '../theme';
import { NowDot } from './Chrome';
import { glow, onGlow } from './ProgramIcon';
import { shortName, teacherShort, roomShort } from '../ProfileContext';
import { buildDayPlan, fmt12, toMin, PlanPeriod } from '../bell';
import { classKey } from '../stores';
import type { HomeworkItem } from '../programs';

export const PX_PER_MIN = 2.1;
const NOTEPAD = require('../../assets/homework/notepad.png');

// Homework due on `iso` for the class in this period (by block, or by the
// program name for items a student added themselves).
export const blockHomework = (items: HomeworkItem[], iso: string, p: PlanPeriod) =>
  p.kind !== 'block' || !p.course || p.course.spare || !p.course.name.trim() ? []
  : items.filter(h => h.due === iso && ((h.slot && h.slot === p.slot) || (!!h.program && classKey(h.program) === classKey(p.course!.name))));

export const DayColumn = ({ plan, iso, homework = [], now, onBlock, compact = false, pxPerMin = PX_PER_MIN }: {
  plan: NonNullable<ReturnType<typeof buildDayPlan>>; iso: string; homework?: HomeworkItem[]; now: Date | null;
  onBlock?: (p: PlanPeriod) => void; compact?: boolean; pxPerMin?: number;
}) => {
  const { c, mode } = useTheme();
  const PX = pxPerMin;
  const ps = plan.periods;
  const start = toMin(ps[0].start);
  const end = toMin(ps[ps.length - 1].end);
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null;
  const showNow = nowMin !== null && nowMin >= start && nowMin <= end;
  const gutter = compact ? 0 : 50;
  const now_ = glow(c.crimson, mode);

  return (
    <View style={{ height: (end - start) * PX + 8, flexDirection: 'row' }}>
      {/* Time axis: when each class starts, and when the day ends. */}
      {!compact && (
        <View style={{ width: gutter }}>
          {ps.filter(p => p.kind === 'block' || p.kind === 'fit').map((p, i) => (
            <Text key={i} style={[{ position: 'absolute', top: (toMin(p.start) - start) * PX + 2, fontSize: 13, color: c.ink2, fontWeight: '700' }, tnum]}>
              {fmt12(p.start)}
            </Text>
          ))}
          <Text style={[{ position: 'absolute', top: (end - start) * PX - 14, fontSize: 12.5, color: c.ink3, fontWeight: '500' }, tnum]}>{fmt12(ps[ps.length - 1].end)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        {ps.map((p, i) => {
          const top = (toMin(p.start) - start) * PX;
          const h = (toMin(p.end) - toMin(p.start)) * PX;
          const isBlock = p.kind === 'block';
          const isFit = p.kind === 'fit';
          const spare = !!p.course?.spare;
          const col = glow(isFit ? c.gold : isBlock && p.course && !spare ? p.course.color : c.ink4, mode);
          const live = nowMin !== null && nowMin >= toMin(p.start) && nowMin < toMin(p.end);
          const hw = blockHomework(homework, iso, p);
          const open = hw.filter(x => !x.done).length;
          const inner = (
            <View style={[{
              position: 'absolute', top, left: 0, right: 0, height: Math.max(h - 3, 14),
              borderRadius: compact ? 9 : 14,
              backgroundColor: isBlock || isFit ? (spare ? c.paper2 : mode === 'dark' ? (compact ? '#1C2531' : '#283446') : c.surface) : 'transparent',
              // No outlines: colour bar and fill. Only the class on right now gets a ring.
              borderWidth: live ? 2 : 0, borderColor: col,
              overflow: 'hidden', paddingLeft: compact ? 9 : 14, paddingRight: compact ? 4 : 12, justifyContent: 'center',
            }, (isBlock || isFit) && !spare && !compact ? shadow.sm : shadow.none]}>
              {(isBlock || isFit) && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: compact ? 4 : 5, backgroundColor: spare ? c.line : col }} />}
              {isBlock || isFit ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: compact ? 12.5 : 16, fontWeight: '700', color: isFit ? col : spare ? c.ink3 : c.ink, letterSpacing: -0.3 }}>
                      {isFit ? 'FIT' : compact ? shortName(p.course?.name || '') : (p.course?.name || p.label)}
                    </Text>
                    {compact ? (
                      <Text style={[{ fontSize: 11, fontWeight: '600', color: c.ink3, marginTop: 1 }, tnum]}>{fmt12(p.start)}</Text>
                    ) : (
                      <Text numberOfLines={1} style={{ fontSize: 13, color: c.ink3, marginTop: 2 }}>
                        {isFit ? 'Flexible instructional time' : [p.course?.room ? roomShort(p.course.room) : null, p.course?.teacher ? teacherShort(p.course.teacher) : null, `Block ${p.slot}`].filter(Boolean).join('  ·  ')}
                      </Text>
                    )}
                  </View>
                  {hw.length > 0 && <HomeworkMark open={open} total={hw.length} color={col} compact={compact} />}
                </View>
              ) : (
                !compact && <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink4, fontStyle: 'italic', paddingLeft: 2 }}>{p.label}</Text>
              )}
            </View>
          );
          return onBlock && isBlock && p.course && !spare
            ? <Pressable key={i} onPress={() => onBlock(p)} accessibilityRole="button" accessibilityLabel={`${p.course.name}${hw.length ? `, ${open} homework due` : ''}, open class card`}>{inner}</Pressable>
            : <View key={i}>{inner}</View>;
        })}
        {showNow && (
          <View pointerEvents="none" style={{ position: 'absolute', left: -4, right: 0, top: (nowMin! - start) * PX, flexDirection: 'row', alignItems: 'center' }}>
            <NowDot size={8} color={now_} />
            <View style={{ flex: 1, height: 2, backgroundColor: now_ }} />
          </View>
        )}
      </View>
    </View>
  );
};

// Notepad with a count bubble: homework due for this class on this day.
export const HomeworkMark = ({ open, total, color, compact }: { open: number; total: number; color: string; compact: boolean }) => {
  const { mode } = useTheme();
  const size = compact ? 18 : 26;
  return (
    <View style={{ width: size + 6, height: size + 4, opacity: open ? 1 : 0.4 }} accessibilityLabel={`${open} of ${total} homework due`}>
      <Image source={NOTEPAD} style={{ width: size, height: size, marginTop: 4 }} resizeMode="contain" />
      {open > 0 && (
        <View style={{ position: 'absolute', top: 0, right: 0, minWidth: compact ? 14 : 17, height: compact ? 14 : 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[{ fontSize: compact ? 9 : 10.5, fontWeight: '800', color: onGlow(mode) }, tnum]}>{open}</Text>
        </View>
      )}
    </View>
  );
};
