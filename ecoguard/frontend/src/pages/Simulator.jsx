import { useState } from 'react';
import { Bug, CloudLightning, FlaskConical, Gauge } from 'lucide-react';
import { useApp } from '../App';
import { api } from '../lib/api';
import { fmtTime, targetName } from '../lib/format';

// Demo controls. In the real building these faults happen on their own;
// here we can trigger them on stage and watch ECOGUARD respond.
const FAULTS = [
  { type: 'lights_left_on', label: 'Lights + fans left on', scope: 'room' },
  { type: 'ac_left_on', label: 'AC left on after class', scope: 'ac' },
  { type: 'pcs_left_on', label: 'Lab PCs left on', scope: 'lab' },
  { type: 'overcool', label: 'AC overcooling', scope: 'ac' },
  { type: 'loose_joint', label: 'Loose joint in wall', scope: 'room' },
  { type: 'leak', label: 'Pipe leak', scope: 'floor' },
  { type: 'cistern', label: 'Running cistern', scope: 'floor' },
  { type: 'float_fail', label: 'Tank float stuck', scope: 'tank' },
  { type: 'dry_run', label: 'Sump empty, pump dry', scope: 'pump' },
];
const AC_ROOMS = ['OFF-ADM', 'LAB-1', 'CR-103', 'CR-201', 'OFF-FAC'];

export default function Simulator() {
  const { live } = useApp();
  const [fault, setFault] = useState(FAULTS[0]);
  const [target, setTarget] = useState('CR-101');
  const [log, setLog] = useState([]);
  const rooms = live?.rooms ?? [];
  const targets = fault.scope === 'floor' ? ['F0', 'F1', 'F2'] : fault.scope === 'tank' ? ['TANK'] : fault.scope === 'pump' ? ['PUMP']
    : fault.scope === 'lab' ? ['LAB-1'] : fault.scope === 'ac' ? AC_ROOMS : rooms.map((r) => r.id);
  const send = async (body, text) => {
    try { await api.sim(body); setLog((l) => [`${text} (applied at the next reading)`, ...l].slice(0, 6)); }
    catch (e) { setLog((l) => [`Failed: ${e.message}`, ...l]); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Simulator</h1>
        <p className="h-sub">The virtual block that stands in for real ESP32 meters during the demo. Faults you create here are invisible to the detector; it has to find them from the readings alone.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink-900"><Bug size={16} />Create a fault</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="label">Fault</span>
              <select className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1.5" value={fault.type}
                onChange={(e) => { const f = FAULTS.find((x) => x.type === e.target.value); setFault(f); setTarget({ floor: 'F1', tank: 'TANK', pump: 'PUMP', lab: 'LAB-1', ac: 'CR-201' }[f.scope] || 'CR-101'); }}>
                {FAULTS.map((f) => <option key={f.type} value={f.type}>{f.label}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="label">Where</span>
              <select className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1.5" value={target} onChange={(e) => setTarget(e.target.value)}>
                {targets.map((t) => <option key={t} value={t}>{targetName(t, rooms)}</option>)}
              </select>
            </label>
          </div>
          <button className="btn-primary" onClick={() => send({ action: 'inject', fault: fault.type, target }, `${fault.label} in ${targetName(target, rooms)}`)}><FlaskConical size={14} />Create fault</button>
          <p className="text-xs text-ink-500">Tip: "lights left on" needs an empty room. A loose joint takes simulated days to heat up, so speed up time to see it.</p>
        </section>
        <section className="card card-pad space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink-900"><CloudLightning size={16} />Grid and time</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => send({ action: 'cut', value: 60 }, 'Power cut for 60 min')}>Power cut (60 min)</button>
          </div>
          <div>
            <div className="label flex items-center gap-1"><Gauge size={12} />Speed: real seconds per 15 simulated minutes</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {[[5, 'Slow'], [2, 'Normal'], [0.5, 'Fast'], [0.05, 'Very fast']].map(([v, l]) => <button key={v} className="btn-ghost" onClick={() => send({ action: 'speed', value: v }, `Speed set to ${l}`)}>{l}</button>)}
            </div>
          </div>
        </section>
      </div>
      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Ground truth (hidden from the detector)</h2>
        <p className="text-xs text-ink-500">What is really broken in the simulated block right now, so you can check ECOGUARD against it.</p>
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {(live?.sim?.active ?? []).length === 0 && <li className="py-2 text-ink-500">Nothing is broken right now.</li>}
          {(live?.sim?.active ?? []).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{f.type.replaceAll('_', ' ')}</b> · {targetName(f.target, rooms)} · since {fmtTime(f.start)}</span>
              <span className="flex items-center gap-2">
                {live.alerts.some((a) => a.target === f.target || a.target === `F${f.target?.slice?.(1)}`) ? <span className="pill bg-brand-50 text-brand-700">Detected</span> : <span className="pill bg-ink-100 text-ink-500">Not yet</span>}
                <button className="btn-ghost" onClick={() => send({ action: 'fix', fault_id: f.id }, `Fixed ${f.type}`)}>Fix</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {log.length > 0 && <ul className="space-y-1 text-sm text-brand-700" role="status">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}
