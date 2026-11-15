import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplets, Leaf, PiggyBank, Zap } from 'lucide-react';
import Kpi from '../components/Kpi';
import DataSource from '../components/DataSource';
import { Empty, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { num, rs } from '../lib/format';
import About, { ChartNote } from '../components/About';

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title">Savings & Carbon</h1>
          <p className="h-sub">What ECOGUARD has avoided since it started, and a full-year before-vs-after test of the same block.</p>
        </div>
        <DataSource kind="sim" />
      </div>
      <About id="savings" points={[
        ["Waste caught: what the detector found being wasted. Avoided: what was saved because someone, or ECOGUARD, acted on it.", "पकड़ी गई बर्बादी: जो डिटेक्टर को मिली। बचाई गई: जो किसी के, या ECOGUARD के, कदम उठाने से बची।"],
        ["Money uses the block's tariff: ₹7 per kWh of electricity and ₹50 per 1,000 litres of water.", "पैसा ब्लॉक के टैरिफ़ से: बिजली ₹7 प्रति kWh, पानी ₹50 प्रति 1,000 लीटर।"],
        ["Carbon: every kWh not used avoids 0.716 kg of CO₂, the Central Electricity Authority's figure for India's grid.", "कार्बन: हर बची kWh से 0.716 kg CO₂ बचता है, यह भारत के ग्रिड के लिए केंद्रीय विद्युत प्राधिकरण (CEA) का आँकड़ा है।"],
        ["The before-vs-after test runs the same simulated year twice, once without ECOGUARD and once with it, so the saving is a fair comparison.", "पहले-बनाम-बाद टेस्ट एक ही सिम्युलेटेड साल दो बार चलाता है, एक बार ECOGUARD के बिना, एक बार उसके साथ।"],
      ]} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Money saved" value={rs(t.rupees_saved)} tone="brand" icon={PiggyBank} sub="estimated from actions taken" />
        <Kpi label="Energy avoided" value={num(t.kwh_avoided, 0)} unit="kWh" tone="energy" icon={Zap} />
        <Kpi label="Water avoided" value={num(t.litres_avoided / 1000, 1)} unit="kL" tone="water" icon={Droplets} />
        <Kpi label="CO₂ avoided" value={num(t.co2_avoided, 0)} unit="kg" tone="brand" icon={Leaf} sub="CEA grid factor 0.716 kg/kWh" />
      </div>

      {s.days.length > 0 && (
        <section className="card card-pad">
          <h2 className="font-semibold text-ink-900">Waste caught vs avoided, per day <span className="font-normal text-ink-500">(kWh)</span></h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer>
              <BarChart data={s.days}>
                <CartesianGrid stroke="#E4E1D8" vertical={false} />
                <XAxis dataKey="date" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                <YAxis fontSize={11} width={36} />
                <Tooltip formatter={(v) => `${num(v, 1)} kWh`} />
                <Legend />
                <Bar dataKey="kwh_wasted" name="Waste caught" fill="#F2C14E" isAnimationActive={false} />
                <Bar dataKey="kwh_avoided" name="Avoided by action" fill="#2F7549" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartNote en="Yellow bars: energy found being wasted that day. Green bars: energy saved because the waste was stopped. The closer green is to yellow, the more of the waste was fixed." hi="पीली पट्टी: उस दिन मिली बर्बादी। हरी पट्टी: रोकने से बची बिजली। हरी पीली के जितनी पास, उतनी ज़्यादा बर्बादी ठीक हुई।" />
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
    m[k] ||= { month: k, before: 0, after: 0, days: 0 };
    m[k].before += d.before_kwh; m[k].after += d.after_kwh; m[k].days++;
    return m;
  }, {})).filter((m) => m.days >= 20); // skip part months at the edges
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
        <h3 className="font-semibold text-ink-900">Monthly electricity <span className="font-normal text-ink-500">(kWh)</span></h3>
        <div className="mt-3 h-60">
          <ResponsiveContainer>
            <LineChart data={monthly}>
              <CartesianGrid stroke="#E4E1D8" vertical={false} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} width={50} />
              <Tooltip formatter={(v) => `${num(v, 0)} kWh`} />
              <Legend />
              <Line dataKey="before" name="Without ECOGUARD" stroke="#9AA59E" strokeWidth={2} isAnimationActive={false} />
              <Line dataKey="after" name="With ECOGUARD" stroke="#2F7549" strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ChartNote en="Grey line: the block's monthly electricity with nobody watching. Green line: the same months with ECOGUARD. The gap between them is the saving." hi="धूसर लाइन: बिना निगरानी के हर महीने की बिजली। हरी लाइन: ECOGUARD के साथ। दोनों के बीच का अंतर बचत है।" />
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
