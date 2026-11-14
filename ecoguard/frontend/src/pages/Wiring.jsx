import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { ErrorState, Loading, NotStarted } from '../components/States';
import { api } from '../lib/api';
import { num } from '../lib/format';

const ST = { ok: ['Healthy', 'bg-brand-50 text-brand-700', 'bg-brand-500'], watch: ['Watch', 'bg-amber-50 text-energy', 'bg-energy'], danger: ['Hot joint', 'bg-red-50 text-danger', 'bg-danger'] };

export default function Wiring() {
  const { live } = useApp();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { api.wiring().then(setData).catch((e) => setErr(e.message)); }, [live?.ts]);
  if (err) return <ErrorState message={err} />;
  if (!data || !live) return <Loading what="wiring health" />;
  if (!live.ready) return <NotStarted />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Heat in the Walls</h1>
        <p className="h-sub">Waste no ordinary meter can see: energy lost as heat in loose joints and old wiring inside the walls, and current leaking into damp walls.</p>
      </div>

      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">How we measure it</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <svg viewBox="0 0 520 150" className="w-full" role="img" aria-label="Voltage is measured at the distribution board and at the room. The drop divided by the current gives the wiring resistance.">
            <rect x="10" y="40" width="110" height="70" rx="8" fill="#f1f5f9" stroke="#94a3b8" />
            <text x="65" y="70" textAnchor="middle" fontSize="13" fill="#0f172a">Distribution</text>
            <text x="65" y="88" textAnchor="middle" fontSize="13" fill="#0f172a">board</text>
            <text x="65" y="130" textAnchor="middle" fontSize="12" fill="#047857">V₁ measured</text>
            <line x1="120" y1="75" x2="400" y2="75" stroke="#64748b" strokeWidth="4" />
            <circle cx="260" cy="75" r="13" fill="#fee2e2" stroke="#dc2626" strokeWidth="2" />
            <text x="260" y="45" textAnchor="middle" fontSize="12" fill="#dc2626">loose joint = hot spot</text>
            <text x="260" y="112" textAnchor="middle" fontSize="12" fill="#334155">wire inside the wall, current I</text>
            <rect x="400" y="40" width="110" height="70" rx="8" fill="#ecfdf5" stroke="#10b981" />
            <text x="455" y="80" textAnchor="middle" fontSize="13" fill="#0f172a">Room</text>
            <text x="455" y="130" textAnchor="middle" fontSize="12" fill="#047857">V₂ measured</text>
          </svg>
          <ul className="space-y-2 text-sm text-ink-700">
            <li><b>Resistance</b> R = (V₁ − V₂) ÷ I. We learn each circuit's normal R in its first week.</li>
            <li><b>Heat</b> in the wall = I² × (R − R₀). It grows with the square of the current, so a joint that is fine with lights on can glow when the ACs start.</li>
            <li><b>Earth leakage</b> = phase current − neutral current. A wall soaked by a hidden pipe leak lets current leak to earth, so a rise here plus water flowing at night on the same floor points to a leak <i>inside</i> the wall.</li>
          </ul>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-300/60 text-left"><tr className="label">
            <th className="p-3">Circuit</th><th className="p-3 text-right">Normal R₀</th><th className="p-3 text-right">Now</th><th className="p-3">Change</th><th className="p-3 text-right">Heat at full load</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {data.circuits.map((c) => (
              <tr key={c.id} className="border-b border-ink-100 last:border-0">
                <td className="p-3"><div className="font-medium text-ink-900">{c.name}</div><div className="text-xs text-ink-500">{c.id} · up to {num(c.peak_amps, 0)} A</div></td>
                <td className="p-3 text-right">{num(c.r0, 3)} Ω</td>
                <td className="p-3 text-right font-medium">{c.r_now ? `${num(c.r_now, 3)} Ω` : '–'}</td>
                <td className="p-3">
                  <div className="h-2 w-32 rounded bg-ink-100" role="meter" aria-valuenow={c.ratio} aria-valuemin={0} aria-valuemax={4} aria-label={`${c.name} resistance ratio`}>
                    <div className={`h-2 rounded ${ST[c.status][2]}`} style={{ width: `${Math.min(100, (c.ratio / 4) * 100)}%` }} />
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">× {num(c.ratio, 2)}</div>
                </td>
                <td className="p-3 text-right">{c.peak_heat_w > 0 ? `${num(c.peak_heat_w, 0)} W` : '–'}</td>
                <td className="p-3"><span className={`pill ${ST[c.status][1]}`}>{ST[c.status][0]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Earth leakage by floor</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((f) => {
            const ma = data.earth_leak_ma[f] ?? 0;
            return (
              <div key={f} className={`rounded-lg p-3 ${ma > 15 ? 'bg-red-50' : 'bg-ink-100'}`}>
                <div className="text-xs text-ink-500">{['Ground', 'First', 'Second'][f]} floor</div>
                <div className={`text-xl font-semibold ${ma > 15 ? 'text-danger' : 'text-ink-900'}`}>{num(ma, 1)} mA</div>
                <div className="text-xs text-ink-500">{ma > 15 ? 'Check for damp walls' : 'Normal (under 10 mA)'}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
