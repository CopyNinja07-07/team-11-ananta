const IST = 'Asia/Kolkata';

export const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: IST });
export const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: IST });
export const fmtDateTime = (ms) => `${fmtDay(ms)}, ${fmtTime(ms)}`;
export const rs = (n) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
export const num = (n, d = 1) => (n == null ? '–' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }));
export const since = (from, to) => {
  const m = Math.max(0, Math.round((to - from) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export const KIND = {
  energy: { label: 'Power', color: 'text-energy', bg: 'bg-volt-50', ring: 'ring-volt-200' },
  water: { label: 'Water', color: 'text-water', bg: 'bg-river-50', ring: 'ring-river-200' },
  hidden: { label: 'Inside walls', color: 'text-hidden', bg: 'bg-ember-50', ring: 'ring-ember-200' },
};

export const ORDINAL = ['Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth'];
// floor names come from the building config when it is loaded; this is only the fallback
export const floorName = (f, building) => building?.building?.floors?.find((x) => x.id === f)?.name || `${ORDINAL[f] ?? `Floor ${f}`} floor`;
export const floorShort = (f, building) => floorName(f, building).replace(/ floor$/i, '');
export const floorIds = (building, rooms) => {
  const ids = building?.building?.floors?.map((x) => x.id) ?? [...new Set((rooms || []).map((r) => r.floor))];
  return [...ids].sort((a, b) => b - a);   // top floor first, like looking at the building
};
export const FLOOR = ORDINAL.map((o) => `${o} floor`);
export const targetName = (t, rooms, building) => rooms?.find((r) => r.id === t)?.name
  || (/^F\d+$/.test(t) ? floorName(Number(t.slice(1)), building) : ({ TANK: 'Overhead tank', PUMP: 'Water pump' }[t] ?? t));
