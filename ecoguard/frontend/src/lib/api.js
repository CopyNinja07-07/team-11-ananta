// Small API client. VITE_API_URL lets the dashboard talk to a backend on
// another host; by default it uses the same origin (FastAPI serves the build).
const BASE = import.meta.env.VITE_API_URL || '';

async function req(path, opts = {}) {
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
};

export function wsUrl() {
  const base = BASE || window.location.origin;
  return base.replace(/^http/, 'ws') + '/ws';
}
