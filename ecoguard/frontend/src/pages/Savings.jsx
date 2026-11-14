import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets, Leaf, PiggyBank, Zap } from 'lucide-react';
import Kpi from '../components/Kpi';
import { Empty, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { num, rs } from '../lib/format';

export default function Savings() {
  const [s, setS] = useState(null);
  const [exp, setExp] = useState(undefined);
  const [err, setErr] = useState(null);
  useEffect(() => {
    api.savings(30).then(setS).catch((e) => setErr(e.message));
    api.experiment().then(setExp).catch(() => setExp(null));
  }, []);
  if (err) return <ErrorState message={err} />;
  if (!s || exp === undefined) return <Loading what="savings" />;
  const t = s.total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-title">Savings & Carbon</h1>
        <p className="h-sub">What ECOGUARD has avoided since it started, and a full-year before-vs-after test of the same block.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Money saved" value={rs(t.rupees_saved)} tone="brand" icon={PiggyBank} sub="estimated from actions taken" />
        <Kpi label="Energy avoided" value={num(t.kwh_avoided, 0)} unit="kWh" tone="energy" icon={Zap} />
        <Kpi label="Water avoided" value={num(t.litres_avoided / 1000, 1)} unit="kL" tone="water" icon={Droplets} />
        <Kpi label="CO₂ avoided" value={num(t.co2_avoided, 0)} unit="kg" tone="brand" icon={Leaf} sub="CEA grid factor 0.716 kg/kWh" />
      </div>

      {s.days.length > 0 && (
        <section className="card card-pad">
          <h2 className="font-semibold text-ink-900">Waste caught vs avoided, per day</h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer>
              <BarChart data={s.days}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                <YAxis fontSize={11} width={40} unit=" kWh" />
                <Tooltip formatter={(v) => `${num(v, 1)} kWh`} />
                <Legend />
                <Bar dataKey="kwh_wasted" name="Waste caught" fill="#fcd34d" isAnimationActive={false} />
                <Bar dataKey="kwh_avoided" name="Avoided by action" fill="#059669" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <BeforeAfter exp={exp} />
    </div>
  );
}

function BeforeAfter({ exp }) {
  if (!exp) return <Empty title="Before-vs-after test not run yet" hint="Run sensors/experiment.mjs against a fresh backend to produce it (see README)." />;
  const { before, after } = exp.totals;
  const monthly = Object.values(exp.daily.reduce((m, d) => {
    const k = d.date.slice(0, 7);
    m[k] ||= { month: k, before: 0, after: 0 };
    m[k].before += d.before_kwh; m[k].after += d.after_kwh;
    return m;
  }, {}));
  const faults = Object.entries(exp.by_fault).sort((a, b) => (b[1].before_kwh * 7 + b[1].before_l * 0.03) - (a[1].before_kwh * 7 + a[1].before_l * 0.03));
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Before vs after: one full year, same block</h2>
        <p className="h-sub">Same people, same weather, same power cuts and the same {Object.values(exp.by_fault).reduce((s, f) => s + f.count, 0)} faults. Once with nobody watching, once with ECOGUARD. {exp.comfort_violations === 0 ? 'No room was ever switched off with people inside.' : `${exp.comfort_violations} switch-offs hit an occupied room.`}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Compare label="Electricity" unit="kWh" b={before.kwh} a={after.kwh} pct={exp.saved.kwh_pct} tone="text-energy" />
        <Compare label="Water" unit="kL" b={before.litres / 1000} a={after.litres / 1000} pct={exp.saved.litres_pct} tone="text-water" />
        <Compare label="Bill (electricity + water)" unit="" money b={before.rupees} a={after.rupees} pct={+((exp.saved.rupees / before.rupees) * 100).toFixed(1)} tone="text-brand-700" />
      </div>
      <div className="card card-pad">
        <h3 className="font-semibold text-ink-900">Monthly electricity</h3>
        <div className="mt-3 h-60">
          <ResponsiveContainer>
            <LineChart data={monthly}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} width={50} />
              <Tooltip formatter={(v) => `${num(v, 0)} kWh`} />
              <Legend />
              <Line dataKey="before" name="Without ECOGUARD" stroke="#94a3b8" strokeWidth={2} isAnimationActive={false} />
              <Line dataKey="after" name="With ECOGUARD" stroke="#059669" strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-300/60 text-left"><tr className="label">
            <th className="p-3">Waste type</th><th className="p-3 text-right">Times</th><th className="p-3 text-right">Wasted before</th><th className="p-3 text-right">Wasted after</th><th className="p-3 text-right">Cut by</th>
          </tr></thead>
          <tbody>
            {faults.map(([k, f]) => {
              const isWater = f.before_l > 0;
              const b = isWater ? f.before_l / 1000 : f.before_kwh;
              const a = isWater ? f.after_l / 1000 : f.after_kwh;
              const u = isWater ? 'kL' : 'kWh';
              return (
                <tr key={k} className="border-b border-ink-100 last:border-0">
                  <td className="p-3">{f.label}</td>
                  <td className="p-3 text-right">{f.count}</td>
                  <td className="p-3 text-right">{num(b, 1)} {u}</td>
                  <td className="p-3 text-right">{num(a, 1)} {u}</td>
                  <td className="p-3 text-right font-medium text-brand-700">{b > 0 ? `${num((1 - a / b) * 100, 0)}%` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Compare({ label, unit, b, a, pct, tone, money }) {
  const f = (v) => (money ? rs(v) : `${num(v, 0)} ${unit}`);
  return (
    <div className="card card-pad">
      <div className="label">{label}</div>
      <div className="mt-2 flex items-baseline justify-between text-sm"><span className="text-ink-500">Without</span><span className="font-medium text-ink-700">{f(b)}</span></div>
      <div className="flex items-baseline justify-between text-sm"><span className="text-ink-500">With ECOGUARD</span><span className="font-medium text-ink-900">{f(a)}</span></div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>−{num(pct, 1)}%</div>
    </div>
  );
}
