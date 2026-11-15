// Small API client. VITE_API_URL lets the dashboard talk to a backend on
// another host; by default it uses the same origin (FastAPI serves the build).
const BASE = import.meta.env.VITE_API_URL || '';
// Demo build (VITE_DEMO=1): no server. Every GET reads a saved JSON snapshot from /demo,
// and buttons answer "ok" without changing anything. Used for the public website.
export const DEMO = !!import.meta.env.VITE_DEMO;
const demoFile = (path) => `${import.meta.env.BASE_URL}demo/${path.replace(/^\/api\//, '').replace(/[^a-zA-Z0-9]+/g, '_')}.json`;

async function req(path, opts = {}) {
  if (DEMO) {
    if (opts.method && opts.method !== 'GET') return { ok: true, demo: true };
    const res = await fetch(demoFile(path));
    if (!res.ok) throw new Error('404 {"detail":"not in the demo snapshot"}');
    return res.json();
  }
  const res = await fetch(`${BASE}${path}`, { headers: { 'content-type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const type = res.headers.get('content-type') || '';
  return type.includes('json') ? res.json() : res.text();
}

export const api = {
  live: () => req('/api/live'),
  building: () => req('/api/building'),
  alerts: (status) => req(`/api/alerts${status ? `?status=${status}` : ''}`),
  feedback: (id, f) => req(`/api/alerts/${id}/${f}`, { method: 'POST' }),
  control: (command, target, alert_id) => req('/api/control', { method: 'POST', body: JSON.stringify({ command, target, alert_id }) }),
  actions: () => req('/api/actions'),
  roomSeries: (id, hours = 24) => req(`/api/rooms/${id}/series?hours=${hours}`),
  water: (hours = 48) => req(`/api/water/series?hours=${hours}`),
  wiring: () => req('/api/wiring'),
  forecast: () => req('/api/forecast'),
  savings: (days = 30) => req(`/api/savings?days=${days}`),
  experiment: () => req('/api/experiment'),
  model: () => req('/api/model'),
  settings: () => req('/api/settings'),
  saveSettings: (body) => req('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  sim: (body) => req('/api/sim', { method: 'POST', body: JSON.stringify(body) }),
  hvac: () => req('/api/hvac'),
  cvStatus: () => req('/api/cv/status'),
  cvCount: async (blob, zone) => {
    if (DEMO) throw new Error('400 {"detail":"Camera counting needs the ECOGUARD server; this is the online demo"}');
    const fd = new FormData();
    fd.append('image', blob, 'frame.jpg');
    if (zone) fd.append('zone', zone);
    const res = await fetch(`${BASE}/api/cv/count`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  },
  realPortfolio: () => req('/api/real/portfolio'),
  realModels: () => req('/api/real/models'),
  realBuilding: (id) => req(`/api/real/buildings/${encodeURIComponent(id)}`),
  realForecast: (id, day) => req(`/api/real/buildings/${encodeURIComponent(id)}/forecast?day=${day}`),
};

export function wsUrl() {
  const base = BASE || window.location.origin;
  return base.replace(/^http/, 'ws') + '/ws';
}
