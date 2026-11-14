import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../App';
import Kpi from '../components/Kpi';
import { Empty, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { fmtTime, num, rs } from '../lib/format';

export default function Forecast() {
  const { live } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { api.forecast().then(setD).catch((e) => setErr(e.message)); }, [live?.ts && Math.floor(live.ts / 3600000)]);
  if (err) return <ErrorState message={err} />;
  if (!d) return <Loading what="forecast" />;
  if (!d.forecast.length) return <Empty title="Not enough history yet" hint="The forecast needs at least a day of readings to learn the weekly timetable." />;

  const rows = [
    ...d.actual.map((a) => ({ ts: a.ts, actual: a.kwh })),
    ...d.forecast.map((f) => ({ ts: f.ts, forecast: f.kwh })),
  ];
  const peak = d.forecast.reduce((m, f) => (f.kwh > m.kwh ? f : m), d.forecast[0]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Forecast</h1>
        <p className="h-sub">Next 24 hours, from the weekly class timetable (learned from occupancy), Jammu temperature normals and each room's trained model.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Next 24 h" value={num(d.next24_kwh, 0)} unit="kWh" tone="energy" />
        <Kpi label="Expected bill" value={rs(d.next24_rupees)} sub="at ₹7/kWh" />
        <Kpi label="Peak hour" value={fmtTime(peak.ts)} sub={`${num(peak.kwh, 1)} kWh`} />
        <Kpi label="Yesterday's error" value={d.yesterday_wape != null ? `${num(d.yesterday_wape * 100, 0)}%` : '–'} sub="forecast vs what happened (WAPE)" tone="brand" />
      </div>
      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Last 24 hours and next 24 hours (kWh per hour)</h2>
        <div className="mt-3 h-72">
          <ResponsiveContainer>
            <BarChart data={rows}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={40} fontSize={11} />
              <YAxis fontSize={11} width={40} />
              <Tooltip labelFormatter={fmtTime} formatter={(v) => `${num(v, 2)} kWh`} />
              <Legend />
              <Bar dataKey="actual" name="Actual" fill="#d97706" isAnimationActive={false} />
              <Bar dataKey="forecast" name="Forecast" fill="#fcd34d" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-ink-500">Use it to plan: pre-cool before the peak hour instead of during it, and schedule the pump outside the evening voltage dip.</p>
      </section>
    </div>
  );
}
