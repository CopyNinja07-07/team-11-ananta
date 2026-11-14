import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../App';
import Kpi from '../components/Kpi';
import { ErrorState, Loading, NotStarted } from '../components/States';
import { api } from '../lib/api';
import { fmtTime, num } from '../lib/format';

export default function Water() {
  const { live } = useApp();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { api.water(48).then(setRows).catch((e) => setErr(e.message)); }, [live?.ts]);
  if (err) return <ErrorState message={err} />;
  if (!rows || !live) return <Loading what="water data" />;
  if (!live.ready) return <NotStarted />;
  const w = live.water;
  const night = rows.filter((r) => { const h = new Date(r.ts).getUTCHours(); return h >= 20 && h < 23; }); // 1:30-4:30 am IST
  const minNight = night.length ? Math.min(...night.map((r) => r.flow_lph)) : 0;
  const pumpKwh = rows.reduce((s, r) => s + r.pump_kwh, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Water & Pump</h1>
        <p className="h-sub">Water and energy meet at the pump: every litre lifted to the roof tank costs electricity, so an overflowing tank wastes both.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Overhead tank" value={num(w.tank_pct, 0)} unit="%" tone="water" sub="10,000 L capacity" />
        <Kpi label="Sump" value={num(w.sump_pct, 0)} unit="%" tone="water" sub={w.supply_on ? 'municipal supply coming in' : 'no supply right now'} />
        <Kpi label="Pump" value={w.pump_on ? 'Running' : 'Off'} tone={w.pump_on ? 'water' : 'ink'} sub={`${num(pumpKwh, 1)} kWh in last 48 h`} />
        <Kpi label="Lowest night flow" value={num(minNight, 0)} unit="L/h" tone={minNight > 6 ? 'danger' : 'brand'} sub="should be ~0 when building is empty" />
      </div>
      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Tank and sump level, pump running</h2>
        <div className="mt-3 h-64">
          <ResponsiveContainer>
            <ComposedChart data={rows}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={50} fontSize={11} />
              <YAxis domain={[0, 100]} unit="%" fontSize={11} width={45} />
              <Tooltip labelFormatter={fmtTime} formatter={(v, n) => [n === 'Pump on' ? (v ? 'yes' : 'no') : `${num(v, 0)}%`, n]} />
              <Legend />
              <Bar dataKey={(r) => (r.pump_on ? 100 : 0)} name="Pump on" fill="#e0f2fe" isAnimationActive={false} />
              <Line dataKey="tank_pct" name="Overhead tank" stroke="#0284c7" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="sump_pct" name="Sump" stroke="#64748b" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Water use by floor (L/h)</h2>
        <p className="text-xs text-ink-500">A leak or running cistern shows up as flow that never drops to zero at night.</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer>
            <AreaChart data={rows.map((r) => ({ ts: r.ts, f0: r.floors_lph[0], f1: r.floors_lph[1], f2: r.floors_lph[2] }))}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={50} fontSize={11} />
              <YAxis fontSize={11} width={45} />
              <Tooltip labelFormatter={fmtTime} formatter={(v) => `${num(v, 0)} L/h`} />
              <Legend />
              <Area dataKey="f0" name="Ground" stackId="1" stroke="#0369a1" fill="#7dd3fc" isAnimationActive={false} />
              <Area dataKey="f1" name="First" stackId="1" stroke="#0284c7" fill="#bae6fd" isAnimationActive={false} />
              <Area dataKey="f2" name="Second" stackId="1" stroke="#0ea5e9" fill="#e0f2fe" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
