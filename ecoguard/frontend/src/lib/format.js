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
  energy: { label: 'Energy', color: 'text-energy', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  water: { label: 'Water', color: 'text-water', bg: 'bg-sky-50', ring: 'ring-sky-200' },
  hidden: { label: 'Hidden', color: 'text-hidden', bg: 'bg-violet-50', ring: 'ring-violet-200' },
};

export const FLOOR = ['Ground floor', 'First floor', 'Second floor'];
export const targetName = (t, rooms) => rooms?.find((r) => r.id === t)?.name || ({ F0: 'Ground floor', F1: 'First floor', F2: 'Second floor', TANK: 'Overhead tank', PUMP: 'Water pump' }[t] ?? t);
