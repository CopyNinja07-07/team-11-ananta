import { useState } from 'react';
import { Check, Droplets, Flame, PowerOff, Thermometer, Wrench, X, Zap } from 'lucide-react';
import { useApp } from '../App';
import { api } from '../lib/api';
import { KIND, num, rs, since, targetName, fmtTime } from '../lib/format';

const ICON = { energy: Zap, water: Droplets, hidden: Flame };

// What a manager can do for each kind of alert.
const ACTIONS = {
  empty_room: [{ command: 'switch_off', label: 'Switch room off', icon: PowerOff }],
  over_use: [{ command: 'work_order', label: 'Ask staff to check', icon: Wrench }],
  overcool: [{ command: 'ac_setpoint', label: 'Reset AC to 24 °C', icon: Thermometer }],
  door_open: [{ command: 'work_order', label: 'Ask staff to close it', icon: Wrench }],
  wall_heat: [{ command: 'work_order', label: 'Send electrician', icon: Wrench }],
  earth_leak: [{ command: 'work_order', label: 'Send electrician', icon: Wrench }],
  night_flow: [{ command: 'close_valve', label: 'Close floor valve', icon: PowerOff }, { command: 'work_order', label: 'Send plumber', icon: Wrench }],
  overflow: [{ command: 'pump_off', label: 'Stop pump', icon: PowerOff }, { command: 'work_order', label: 'Replace float', icon: Wrench }],
  dry_run: [{ command: 'pump_off', label: 'Stop pump', icon: PowerOff }],
};

export default function AlertCard({ alert, now, rooms, compact = false, onChange }) {
  const { lang } = useApp();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const k = KIND[alert.kind] || KIND.energy;
  const Icon = ICON[alert.kind] || Zap;
  const active = alert.end == null;

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); setDone(msg); onChange?.(); } catch (e) { setDone(`Failed: ${e.message}`); } finally { setBusy(false); }
  };

  return (
    <article className={`card card-pad ring-1 ${k.ring}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-2 ${k.bg}`}><Icon size={18} className={k.color} aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-900">{alert.title}</h3>
            <span className={`pill ${k.bg} ${k.color}`}>{k.label}</span>
            {alert.severity === 'high' && <span className="pill bg-danger text-white">High priority</span>}
            <StatusPill alert={alert} />
          </div>
          <div className="mt-0.5 text-sm text-ink-500">
            {targetName(alert.target, rooms)} · since {fmtTime(alert.start)}{active && now ? ` (${since(alert.start, now)})` : ''}
          </div>
          {!compact && <p className="mt-2 text-sm leading-relaxed text-ink-700">{lang === 'hi' ? alert.advice_hi : alert.advice_en}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            {alert.kwh > 0 && <span>{num(alert.kwh, 2)} kWh</span>}
            {alert.litres > 0 && <span>{num(alert.litres, 0)} L</span>}
            <span className="font-medium text-ink-700">{rs(alert.rupees)} so far</span>
            {alert.co2 > 0 && <span>{num(alert.co2, 1)} kg CO₂</span>}
          </div>
          {!compact && active && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(ACTIONS[alert.rule] || []).map((a) => (
                <button key={a.command} className="btn-primary" disabled={busy}
                  onClick={() => act(() => api.control(a.command, alert.target, alert.id), `${a.label}: sent`)}>
                  <a.icon size={14} />{a.label}
                </button>
              ))}
              {!alert.feedback && (
                <>
                  <button className="btn-ghost" disabled={busy} onClick={() => act(() => api.feedback(alert.id, 'confirm'), 'Marked as real waste')}><Check size={14} />Correct</button>
                  <button className="btn-ghost" disabled={busy} onClick={() => act(() => api.feedback(alert.id, 'dismiss'), 'Dismissed, no auto action will be taken')}><X size={14} />Not waste</button>
                </>
              )}
            </div>
          )}
          {done && <div className="mt-2 text-xs text-brand-700" role="status">{done}</div>}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ alert }) {
  if (alert.feedback === 'dismissed') return <span className="pill bg-ink-100 text-ink-500">Dismissed</span>;
  if (alert.status === 'actioned') return <span className="pill bg-brand-50 text-brand-700">Action taken</span>;
  if (alert.end) return <span className="pill bg-ink-100 text-ink-500">Resolved</span>;
  return <span className="pill bg-red-50 text-danger">Open</span>;
}
