// Everything in the simulator runs on Indian Standard Time (UTC+5:30).
// We keep time as epoch milliseconds and convert to IST fields when needed.
export const STEP_MIN = 15;
export const STEP_MS = STEP_MIN * 60 * 1000;
const IST_OFFSET = 330 * 60 * 1000;

export function ist(ms) {
  const d = new Date(ms + IST_OFFSET);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
  const h = d.getUTCHours(), min = d.getUTCMinutes();
  return {
    y, m, day, h, min,
    dow: d.getUTCDay(),               // 0 = Sunday
    hour: h + min / 60,               // fractional hour
    dateKey: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

export function istDate(y, m, d, h = 0, min = 0) {
  return Date.UTC(y, m - 1, d, h, min) - IST_OFFSET;
}

export function fmtIst(ms) {
  const t = ist(ms);
  return `${t.dateKey} ${String(t.h).padStart(2, '0')}:${String(t.min).padStart(2, '0')}`;
}

// Week number since a fixed Monday, used to vary the timetable week to week.
export function weekIndex(ms) {
  return Math.floor((ms - istDate(2024, 1, 1)) / (7 * 24 * 3600 * 1000));
}
