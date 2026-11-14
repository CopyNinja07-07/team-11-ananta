// Who is in which room, and when.
// Classrooms follow a weekly timetable (7 one-hour slots, lunch 1-2 pm).
// Offices follow office hours. Breaks and holidays empty the classrooms.
import { ist, weekIndex } from './clock.js';
import { makeRng, hashSeed } from './rng.js';
import { HOLIDAYS, isBreak } from './campus.js';

export const SLOT_STARTS = [9, 10, 11, 12, 14, 15, 16];
const BOOKING_PROB = { class: 0.68, lab: 0.5 };

export function isTeachingDay(t) {
  return t.dow >= 1 && t.dow <= 5 && !HOLIDAYS.has(t.dateKey) && !isBreak(t.dateKey);
}
export function isOfficeDay(t) {
  return t.dow >= 1 && t.dow <= 6 && !HOLIDAYS.has(t.dateKey);
}

// Is this room booked in this slot? Same answer every time for a given week,
// like a real timetable. Seminar room (cap 90) is booked less often.
export function slotBooked(zone, ms, slotIdx) {
  const t = ist(ms);
  if (!isTeachingDay(t)) return false;
  const p = zone.cap >= 90 ? 0.35 : BOOKING_PROB[zone.kind] ?? 0;
  const r = makeRng(hashSeed(zone.id, weekIndex(ms), t.dow, slotIdx)).next();
  return r < p;
}

function slotAt(hour) {
  for (let i = 0; i < SLOT_STARTS.length; i++) {
    if (hour >= SLOT_STARTS[i] && hour < SLOT_STARTS[i] + 1) return i;
  }
  return -1;
}

// Expected headcount (no randomness). The forecaster is allowed to use this,
// because a timetable is known in advance.
export function plannedOccupancy(zone, ms) {
  const t = ist(ms);
  if (zone.kind === 'office') {
    if (!isOfficeDay(t)) return 0;
    const close = t.dow === 6 ? 13.5 : 17.5;
    if (t.hour < 9.5 || t.hour >= close) return 0;
    if (t.hour >= 13 && t.hour < 14) return Math.round(zone.cap * 0.45);
    return Math.round(zone.cap * 0.85);
  }
  const s = slotAt(t.hour);
  if (s < 0 || !slotBooked(zone, ms, s)) return 0;
  const r = makeRng(hashSeed(zone.id, 'att', weekIndex(ms), t.dow, s)).next();
  return Math.round(zone.cap * (0.55 + 0.4 * r));
}

// Actual headcount = planned + day-to-day noise (bunks, extra classes, staff on leave).
export function actualOccupancy(zone, ms, rng) {
  const plan = plannedOccupancy(zone, ms);
  if (plan === 0) {
    // occasional extra class / staff staying late
    const t = ist(ms);
    if (zone.kind === 'office' && isOfficeDay(t) && t.hour >= 17.5 && t.hour < 19 && rng.chance(0.08)) return 1;
    return 0;
  }
  const jitter = zone.kind === 'office' ? rng.normal(0, 0.8) : rng.normal(0, plan * 0.05);
  return Math.max(1, Math.round(plan + jitter));
}
