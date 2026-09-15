// Sentinel — 2026–2027 school calendar.
// GENERATED — do not hand-edit day entries; regenerate if the school posts a revision.
//
// Sources:
//   • West Vancouver Schools "School Year 2026 - 2027" district calendar (Jun 2026)
//     — holidays, Pro-D days, breaks, first/last day of classes.
//   • Sentinel "Block Rotation Schedule September 7th – October 30th, 2026"
//     — rotation codes verified day-by-day through Oct 30.
//     Codes after Oct 30 are PROJECTED from the weekly A/B pattern that sheet
//     follows (week of Sep 7 = Week B; weeks alternate regardless of holidays):
//       Week A: Mon 1-12F34 · Tue 2-1234 · Wed 1-2314 · Thu 2-23F14 · Fri 1-3124
//       Week B: Mon 2-31F24 · Tue 1-1234 · Wed 2-1234 · Thu 1-23F14 · Fri 2-2314
//     Projected days carry `projected: true`. Sync days and Collaboration Days
//     beyond October are not yet published and are not included.
//
// code: "<day>-<slots>"  e.g. "2-23F14" = Day 2, slot order Block 2, Block 3,
//       FIT, Block 1, Block 4. Codes are omitted on days with no classes.
// kind: school | fit | collab | holiday | prod | break | noclass | weekend
// early: early-dismissal time. sync: Day 1 / Day 2 sync day. exam: AP exams.

export type DayKind = 'school' | 'fit' | 'collab' | 'holiday' | 'prod' | 'break' | 'noclass' | 'weekend';

export type CalDay = {
  kind: DayKind;
  code?: string;
  label?: string;
  events?: string[];
  exam?: boolean;
  early?: string;
  sync?: boolean;
  projected?: boolean; // rotation code inferred, not yet confirmed by the school
};

export const SCHOOL_YEAR = { start: '2026-09-01', end: '2027-06-30', label: '2026–2027' };
export const ROTATION_VERIFIED_THROUGH = '2026-10-30';

export const CALENDAR: Record<string, CalDay> = {
  // ── September 2026 ──
  '2026-09-01': { kind: "noclass" },
  '2026-09-02': { kind: "noclass" },
  '2026-09-03': { kind: "prod", label: "Pro-D Day", events: ["Professional Development Day · no classes"] },
  '2026-09-04': { kind: "noclass" },
  '2026-09-05': { kind: "weekend" },
  '2026-09-06': { kind: "weekend" },
  '2026-09-07': { kind: "holiday", label: "Labour Day", events: ["Labour Day · no school"] },
  '2026-09-08': { kind: "noclass", label: "First day", events: ["School opens · staggered start", "Check in to Home Room 1-1", "Gr 8 8:30 · Gr 9 9:00 · Gr 10 10:00 · Gr 11 11:00 · Gr 12 12:00"] },
  '2026-09-09': { kind: "school", code: "2-1234" },
  '2026-09-10': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"] },
  '2026-09-11': { kind: "school", code: "2-2314" },
  '2026-09-12': { kind: "weekend" },
  '2026-09-13': { kind: "weekend" },
  '2026-09-14': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"] },
  '2026-09-15': { kind: "school", code: "2-1234" },
  '2026-09-16': { kind: "school", code: "1-2314" },
  '2026-09-17': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"] },
  '2026-09-18': { kind: "school", code: "1-3124" },
  '2026-09-19': { kind: "weekend" },
  '2026-09-20': { kind: "weekend" },
  '2026-09-21': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"] },
  '2026-09-22': { kind: "school", code: "1-1234" },
  '2026-09-23': { kind: "school", code: "2-1234" },
  '2026-09-24': { kind: "collab", code: "1-2314", events: ["Collaboration Day · students start 9:25"] },
  '2026-09-25': { kind: "prod", label: "Pro-D Day", events: ["Professional Development Day · no classes"] },
  '2026-09-26': { kind: "weekend" },
  '2026-09-27': { kind: "weekend" },
  '2026-09-28': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"] },
  '2026-09-29': { kind: "school", code: "2-1234" },
  '2026-09-30': { kind: "holiday", label: "National Day for Truth and Reconciliation", events: ["National Day for Truth and Reconciliation · no school"] },
  // ── October 2026 ──
  '2026-10-01': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"] },
  '2026-10-02': { kind: "school", code: "1-3124" },
  '2026-10-03': { kind: "weekend" },
  '2026-10-04': { kind: "weekend" },
  '2026-10-05': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"] },
  '2026-10-06': { kind: "school", code: "1-1234" },
  '2026-10-07': { kind: "school", code: "2-1234" },
  '2026-10-08': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"] },
  '2026-10-09': { kind: "school", code: "2-2314" },
  '2026-10-10': { kind: "weekend" },
  '2026-10-11': { kind: "weekend" },
  '2026-10-12': { kind: "holiday", label: "Thanksgiving", events: ["Thanksgiving · no school"] },
  '2026-10-13': { kind: "school", code: "2-1234" },
  '2026-10-14': { kind: "school", code: "1-2314" },
  '2026-10-15': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"] },
  '2026-10-16': { kind: "school", code: "1-3124" },
  '2026-10-17': { kind: "weekend" },
  '2026-10-18': { kind: "weekend" },
  '2026-10-19': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"] },
  '2026-10-20': { kind: "school", code: "1-1234" },
  '2026-10-21': { kind: "school", code: "2-1234" },
  '2026-10-22': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"] },
  '2026-10-23': { kind: "prod", label: "Pro-D Day", events: ["Professional Development Day · no classes"] },
  '2026-10-24': { kind: "weekend" },
  '2026-10-25': { kind: "weekend" },
  '2026-10-26': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"] },
  '2026-10-27': { kind: "school", code: "2-1234" },
  '2026-10-28': { kind: "school", code: "1-2314" },
  '2026-10-29': { kind: "collab", code: "2-2314", events: ["Collaboration Day · students start 9:25"] },
  '2026-10-30': { kind: "school", code: "1-3124" },
  '2026-10-31': { kind: "weekend" },
  // ── November 2026 ──
  '2026-11-01': { kind: "weekend" },
  '2026-11-02': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-03': { kind: "school", code: "1-1234", projected: true },
  '2026-11-04': { kind: "school", code: "2-1234", projected: true },
  '2026-11-05': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-06': { kind: "school", code: "2-2314", projected: true },
  '2026-11-07': { kind: "weekend" },
  '2026-11-08': { kind: "weekend" },
  '2026-11-09': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-10': { kind: "school", code: "2-1234", projected: true },
  '2026-11-11': { kind: "holiday", label: "Remembrance Day", events: ["Remembrance Day · no school"] },
  '2026-11-12': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-13': { kind: "school", code: "1-3124", projected: true },
  '2026-11-14': { kind: "weekend" },
  '2026-11-15': { kind: "weekend" },
  '2026-11-16': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-17': { kind: "school", code: "1-1234", projected: true },
  '2026-11-18': { kind: "school", code: "2-1234", projected: true },
  '2026-11-19': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-20': { kind: "school", code: "2-2314", projected: true },
  '2026-11-21': { kind: "weekend" },
  '2026-11-22': { kind: "weekend" },
  '2026-11-23': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-24': { kind: "school", code: "2-1234", projected: true },
  '2026-11-25': { kind: "school", code: "1-2314", projected: true },
  '2026-11-26': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2026-11-27': { kind: "prod", label: "Pro-D Day", events: ["Professional Development Day · no classes"] },
  '2026-11-28': { kind: "weekend" },
  '2026-11-29': { kind: "weekend" },
  '2026-11-30': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  // ── December 2026 ──
  '2026-12-01': { kind: "school", code: "1-1234", projected: true },
  '2026-12-02': { kind: "school", code: "2-1234", projected: true },
  '2026-12-03': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2026-12-04': { kind: "school", code: "2-2314", projected: true },
  '2026-12-05': { kind: "weekend" },
  '2026-12-06': { kind: "weekend" },
  '2026-12-07': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2026-12-08': { kind: "school", code: "2-1234", projected: true },
  '2026-12-09': { kind: "school", code: "1-2314", projected: true },
  '2026-12-10': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2026-12-11': { kind: "school", code: "1-3124", projected: true },
  '2026-12-12': { kind: "weekend" },
  '2026-12-13': { kind: "weekend" },
  '2026-12-14': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2026-12-15': { kind: "school", code: "1-1234", projected: true },
  '2026-12-16': { kind: "school", code: "2-1234", projected: true },
  '2026-12-17': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2026-12-18': { kind: "school", code: "2-2314", projected: true },
  '2026-12-19': { kind: "weekend" },
  '2026-12-20': { kind: "weekend" },
  '2026-12-21': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  '2026-12-22': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  '2026-12-23': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  '2026-12-24': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  '2026-12-25': { kind: "holiday", label: "Christmas Day", events: ["Christmas Day · no school"] },
  '2026-12-26': { kind: "weekend" },
  '2026-12-27': { kind: "weekend" },
  '2026-12-28': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  '2026-12-29': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  '2026-12-30': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  '2026-12-31': { kind: "break", label: "Winter Break", events: ["Winter Break"] },
  // ── January 2027 ──
  '2027-01-01': { kind: "holiday", label: "New Year's Day", events: ["New Year's Day · no school"] },
  '2027-01-02': { kind: "weekend" },
  '2027-01-03': { kind: "weekend" },
  '2027-01-04': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-05': { kind: "school", code: "2-1234", projected: true },
  '2027-01-06': { kind: "school", code: "1-2314", projected: true },
  '2027-01-07': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-08': { kind: "school", code: "1-3124", projected: true },
  '2027-01-09': { kind: "weekend" },
  '2027-01-10': { kind: "weekend" },
  '2027-01-11': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-12': { kind: "school", code: "1-1234", projected: true },
  '2027-01-13': { kind: "school", code: "2-1234", projected: true },
  '2027-01-14': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-15': { kind: "school", code: "2-2314", projected: true },
  '2027-01-16': { kind: "weekend" },
  '2027-01-17': { kind: "weekend" },
  '2027-01-18': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-19': { kind: "school", code: "2-1234", projected: true },
  '2027-01-20': { kind: "school", code: "1-2314", projected: true },
  '2027-01-21': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-22': { kind: "school", code: "1-3124", projected: true },
  '2027-01-23': { kind: "weekend" },
  '2027-01-24': { kind: "weekend" },
  '2027-01-25': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-26': { kind: "school", code: "1-1234", projected: true },
  '2027-01-27': { kind: "school", code: "2-1234", projected: true },
  '2027-01-28': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-01-29': { kind: "prod", label: "Pro-D Day", events: ["Professional Development Day · no classes"] },
  '2027-01-30': { kind: "weekend" },
  '2027-01-31': { kind: "weekend" },
  // ── February 2027 ──
  '2027-02-01': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-02-02': { kind: "school", code: "2-1234", projected: true },
  '2027-02-03': { kind: "school", code: "1-2314", projected: true },
  '2027-02-04': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-02-05': { kind: "school", code: "1-3124", projected: true },
  '2027-02-06': { kind: "weekend" },
  '2027-02-07': { kind: "weekend" },
  '2027-02-08': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-02-09': { kind: "school", code: "1-1234", projected: true },
  '2027-02-10': { kind: "school", code: "2-1234", projected: true },
  '2027-02-11': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-02-12': { kind: "noclass", label: "Reading Break", events: ["Reading Break · non-instructional day"] },
  '2027-02-13': { kind: "weekend" },
  '2027-02-14': { kind: "weekend" },
  '2027-02-15': { kind: "holiday", label: "Family Day", events: ["Family Day · no school"] },
  '2027-02-16': { kind: "school", code: "2-1234", projected: true },
  '2027-02-17': { kind: "school", code: "1-2314", projected: true },
  '2027-02-18': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-02-19': { kind: "school", code: "1-3124", projected: true },
  '2027-02-20': { kind: "weekend" },
  '2027-02-21': { kind: "weekend" },
  '2027-02-22': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-02-23': { kind: "school", code: "1-1234", projected: true },
  '2027-02-24': { kind: "school", code: "2-1234", projected: true },
  '2027-02-25': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-02-26': { kind: "school", code: "2-2314", projected: true },
  '2027-02-27': { kind: "weekend" },
  '2027-02-28': { kind: "weekend" },
  // ── March 2027 ──
  '2027-03-01': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-03-02': { kind: "school", code: "2-1234", projected: true },
  '2027-03-03': { kind: "school", code: "1-2314", projected: true },
  '2027-03-04': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-03-05': { kind: "school", code: "1-3124", projected: true },
  '2027-03-06': { kind: "weekend" },
  '2027-03-07': { kind: "weekend" },
  '2027-03-08': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-03-09': { kind: "school", code: "1-1234", projected: true },
  '2027-03-10': { kind: "school", code: "2-1234", projected: true },
  '2027-03-11': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-03-12': { kind: "school", code: "2-2314", projected: true },
  '2027-03-13': { kind: "weekend" },
  '2027-03-14': { kind: "weekend" },
  '2027-03-15': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-16': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-17': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-18': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-19': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-20': { kind: "weekend" },
  '2027-03-21': { kind: "weekend" },
  '2027-03-22': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-23': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-24': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-25': { kind: "break", label: "Spring Break", events: ["Spring Break"] },
  '2027-03-26': { kind: "holiday", label: "Good Friday", events: ["Good Friday · no school"] },
  '2027-03-27': { kind: "weekend" },
  '2027-03-28': { kind: "weekend" },
  '2027-03-29': { kind: "holiday", label: "Easter Monday", events: ["Easter Monday · no school"] },
  '2027-03-30': { kind: "school", code: "2-1234", projected: true },
  '2027-03-31': { kind: "school", code: "1-2314", projected: true },
  // ── April 2027 ──
  '2027-04-01': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-02': { kind: "school", code: "1-3124", projected: true },
  '2027-04-03': { kind: "weekend" },
  '2027-04-04': { kind: "weekend" },
  '2027-04-05': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-06': { kind: "school", code: "1-1234", projected: true },
  '2027-04-07': { kind: "school", code: "2-1234", projected: true },
  '2027-04-08': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-09': { kind: "school", code: "2-2314", projected: true },
  '2027-04-10': { kind: "weekend" },
  '2027-04-11': { kind: "weekend" },
  '2027-04-12': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-13': { kind: "school", code: "2-1234", projected: true },
  '2027-04-14': { kind: "school", code: "1-2314", projected: true },
  '2027-04-15': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-16': { kind: "noclass", label: "Reading Break", events: ["Reading Break · non-instructional day"] },
  '2027-04-17': { kind: "weekend" },
  '2027-04-18': { kind: "weekend" },
  '2027-04-19': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-20': { kind: "school", code: "1-1234", projected: true },
  '2027-04-21': { kind: "school", code: "2-1234", projected: true },
  '2027-04-22': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-23': { kind: "school", code: "2-2314", projected: true },
  '2027-04-24': { kind: "weekend" },
  '2027-04-25': { kind: "weekend" },
  '2027-04-26': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-27': { kind: "school", code: "2-1234", projected: true },
  '2027-04-28': { kind: "school", code: "1-2314", projected: true },
  '2027-04-29': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-04-30': { kind: "school", code: "1-3124", projected: true },
  // ── May 2027 ──
  '2027-05-01': { kind: "weekend" },
  '2027-05-02': { kind: "weekend" },
  '2027-05-03': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-05-04': { kind: "school", code: "1-1234", projected: true },
  '2027-05-05': { kind: "school", code: "2-1234", projected: true },
  '2027-05-06': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-05-07': { kind: "school", code: "2-2314", projected: true },
  '2027-05-08': { kind: "weekend" },
  '2027-05-09': { kind: "weekend" },
  '2027-05-10': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-05-11': { kind: "school", code: "2-1234", projected: true },
  '2027-05-12': { kind: "school", code: "1-2314", projected: true },
  '2027-05-13': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-05-14': { kind: "school", code: "1-3124", projected: true },
  '2027-05-15': { kind: "weekend" },
  '2027-05-16': { kind: "weekend" },
  '2027-05-17': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-05-18': { kind: "school", code: "1-1234", projected: true },
  '2027-05-19': { kind: "school", code: "2-1234", projected: true },
  '2027-05-20': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-05-21': { kind: "prod", label: "Pro-D Day", events: ["Professional Development Day · no classes"] },
  '2027-05-22': { kind: "weekend" },
  '2027-05-23': { kind: "weekend" },
  '2027-05-24': { kind: "holiday", label: "Victoria Day", events: ["Victoria Day · no school"] },
  '2027-05-25': { kind: "school", code: "2-1234", projected: true },
  '2027-05-26': { kind: "school", code: "1-2314", projected: true },
  '2027-05-27': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-05-28': { kind: "school", code: "1-3124", projected: true },
  '2027-05-29': { kind: "weekend" },
  '2027-05-30': { kind: "weekend" },
  '2027-05-31': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  // ── June 2027 ──
  '2027-06-01': { kind: "school", code: "1-1234", projected: true },
  '2027-06-02': { kind: "school", code: "2-1234", projected: true },
  '2027-06-03': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-04': { kind: "school", code: "2-2314", projected: true },
  '2027-06-05': { kind: "weekend" },
  '2027-06-06': { kind: "weekend" },
  '2027-06-07': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-08': { kind: "school", code: "2-1234", projected: true },
  '2027-06-09': { kind: "school", code: "1-2314", projected: true },
  '2027-06-10': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-11': { kind: "school", code: "1-3124", projected: true },
  '2027-06-12': { kind: "weekend" },
  '2027-06-13': { kind: "weekend" },
  '2027-06-14': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-15': { kind: "school", code: "1-1234", projected: true },
  '2027-06-16': { kind: "school", code: "2-1234", projected: true },
  '2027-06-17': { kind: "fit", code: "1-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-18': { kind: "school", code: "2-2314", projected: true },
  '2027-06-19': { kind: "weekend" },
  '2027-06-20': { kind: "weekend" },
  '2027-06-21': { kind: "fit", code: "1-12F34", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-22': { kind: "school", code: "2-1234", projected: true },
  '2027-06-23': { kind: "school", code: "1-2314", projected: true },
  '2027-06-24': { kind: "fit", code: "2-23F14", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-25': { kind: "school", code: "1-3124", projected: true },
  '2027-06-26': { kind: "weekend" },
  '2027-06-27': { kind: "weekend" },
  '2027-06-28': { kind: "fit", code: "2-31F24", events: ["FIT 11:05–11:50"], projected: true },
  '2027-06-29': { kind: "school", code: "1-1234", events: ["Last day of classes"], projected: true },
  '2027-06-30': { kind: "noclass", label: "Year end", events: ["No classes · school year ends"] },
};

// ── Helpers ──────────────────────────────────────────────────────

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Months covered by the school year, in order: [year, month0]
export const YEAR_MONTHS: [number, number][] = [
  [2026, 8], [2026, 9], [2026, 10], [2026, 11],
  [2027, 0], [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5],
];

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const getDay = (iso: string): CalDay | undefined => CALENDAR[iso];

export const inSchoolYear = (iso: string) => iso >= SCHOOL_YEAR.start && iso <= SCHOOL_YEAR.end;

// Split a rotation code into its parts. "2-23F14" → { dayNum: 2, slots: ['2','3','F','1','4'] }
export const parseCode = (code: string) => {
  const [n, s] = code.split('-');
  return { dayNum: Number(n) as 1 | 2, slots: [...s] };
};

export type GridCell = {
  iso: string;
  day: number;
  month: number;
  year: number;
  padding: boolean;
  cal?: CalDay;
};

// Month grid, Monday-first, padded with the neighbouring months' days so every
// row has 7 cells.
export const monthGrid = (year: number, month: number): GridCell[] => {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Mon = 0
  const cells: GridCell[] = [];
  const startDate = new Date(year, month, 1 - lead);
  const total = Math.ceil((lead + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    const iso = toISO(d);
    cells.push({
      iso, day: d.getDate(), month: d.getMonth(), year: d.getFullYear(),
      padding: d.getMonth() !== month,
      cal: CALENDAR[iso],
    });
  }
  return cells;
};

// Next `limit` dated events on or after `fromIso`, flattened for the home strip.
// Skips the boilerplate that repeats every day (grad assessments, AP exams,
// break days) so the strip shows things a student would actually plan around.
const SKIP = /^(Grad Assessments|AP Exams|Winter Break|Spring Break|Rotation inferred|Truth and Reconciliation Week$|Sentinel Stage Production$|Grad photo sessions$)/;
export const upcomingEvents = (fromIso: string, limit = 5, windowDays = 21) => {
  const out: { id: string; date: string; iso: string; title: string; time: string; loc: string }[] = [];
  const start = fromISO(fromIso);
  for (let i = 0; i < windowDays && out.length < limit; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    const cal = CALENDAR[iso];
    if (!cal) continue;
    const label = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    const items = [...(cal.events || [])];
    if (!items.length && cal.label && cal.kind !== 'weekend') items.push(cal.label);
    for (const ev of items) {
      if (SKIP.test(ev)) continue;
      const [title, ...rest] = ev.split(' · ');
      out.push({ id: iso + ':' + title, iso, date: label, title, time: rest.join(' · '), loc: '' });
      if (out.length >= limit) break;
    }
  }
  return out;
};
