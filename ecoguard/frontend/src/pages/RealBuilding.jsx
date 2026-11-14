import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Droplets, Leaf, PiggyBank, Snowflake, Zap } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Kpi from '../components/Kpi';
import { ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { num, rs } from '../lib/format';

const RS_KWH = 7;
const CO2 = 0.716;
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RealBuilding() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [week, setWeek] = useState(10);
  const [setback, setSetback] = useState(70);   // % of after-hours excess removed by switching off
  const [fixEvents, setFixEvents] = useState(true);
  const [hvacCut, setHvacCut] = useState(60);   // % of after-hours cooling removed by HVAC scheduling
  useEffect(() => { setD(null); api.realBuilding(id).then(setD).catch((e) => setErr(e.message)); }, [id]);

  const t0 = d ? new Date(d.start).getTime() : 0;
  const weeks = d ? Math.floor(d.hours / 168) : 52;

  // what-if: recompute the whole year from the sliders
  const sim = useMemo(() => {
    if (!d) return null;
    const floor = d.summary.closed_floor_kw;
    let base = 0, after = 0, ahSaved = 0, evSaved = 0, chwSaved = 0;
    const evHours = new Set();
    if (fixEvents) d.events.filter((e) => !e.closed).forEach((e) => { for (let k = 0; k < e.hours; k++) evHours.add(e.i + k); });
    const chwFloor = d.chw ? pct(d.chw.filter((x, i) => x != null && d.closed[i]), 10) : 0;
    for (let i = 0; i < d.hours; i++) {
      const e = d.elec[i];
      if (e == null) continue;
      base += e;
      let cut = 0;
      if (d.closed[i] && e > floor) cut = (e - floor) * setback / 100;
      else if (evHours.has(i) && d.exp[i] != null && e > d.exp[i]) { cut = e - d.exp[i]; evSaved += cut; }
      if (d.closed[i]) ahSaved += cut;
      if (d.chw && d.closed[i] && d.chw[i] != null && d.chw[i] > chwFloor) chwSaved += (d.chw[i] - chwFloor) * hvacCut / 100;
      after += e - cut;
    }
    const saved = base - after;
    return { base, after, saved, ahSaved, evSaved, chwSaved, pct: saved / base * 100 };
  }, [d, setback, fixEvents, hvacCut]);

  const rows = useMemo(() => {
    if (!d) return [];
    const out = [];
    for (let k = 0; k < 168; k++) {
      const i = week * 168 + k;
      if (i >= d.hours) break;
      out.push({ i, ts: t0 + i * 3600000, actual: d.elec[i], expected: d.exp[i], closed: d.closed[i],
        chw: d.chw?.[i], chw_exp: d.chw_exp?.[i], water: d.water?.[i], temp: d.temp[i] });
    }
    return out;
  }, [d, week, t0]);

  if (err) return <ErrorState message={err} />;
  if (!d) return <Loading what="building" />;
  const s = d.summary;
  const tick = (ts) => { const x = new Date(ts); return `${DAY[x.getUTCDay()]} ${x.getUTCDate()}/${x.getUTCMonth() + 1}`; };
  const closedRuns = runs(rows.map((r) => r.closed));
  const weekEvents = d.events.filter((e) => e.i >= week * 168 && e.i < (week + 1) * 168);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/real" className="btn-ghost"><ArrowLeft size={14} />All buildings</Link>
        <div>
          <h1 className="h-title">{d.name} <span className="text-ink-500 font-normal">· {d.use}</span></h1>
          <p className="h-sub">Real building, site {d.site} · {num(d.sqm, 0)} m²{d.yearbuilt ? ` · built ${d.yearbuilt}` : ''} · hourly meters for 2017</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Electricity in 2017" value={num(s.total_kwh / 1000, 0)} unit="MWh" icon={Zap} tone="energy" />
        <Kpi label="Avoidable (found)" value={`${num(s.avoidable_pct, 1)}%`} sub={`${num(s.avoidable_kwh / 1000, 0)} MWh`} tone={s.avoidable_pct > 15 ? 'danger' : 'energy'} />
        <Kpi label="Used while closed" value={`${num(s.after_hours_share * 100, 0)}%`} sub={`best nights reach ${num(s.closed_floor_kw, 0)} kW`} />
        <Kpi label="Waste events" value={s.events} sub={`${num(s.event_kwh / 1000, 1)} MWh above the model`} tone="hidden" />
      </div>

      <section className="card card-pad">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-ink-900">Week {week + 1}: actual vs what the model expected</h2>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-ghost" onClick={() => setWeek(Math.max(0, week - 1))} aria-label="Previous week"><ChevronLeft size={14} /></button>
            <input type="range" min={0} max={weeks - 1} value={week} onChange={(e) => setWeek(+e.target.value)} className="w-40 accent-emerald-700" aria-label="Week of the year" />
            <button className="btn-ghost" onClick={() => setWeek(Math.min(weeks - 1, week + 1))} aria-label="Next week"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="mt-3 h-72">
          <ResponsiveContainer>
            <ComposedChart data={rows}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              {closedRuns.map(([a, b]) => <ReferenceArea key={a} x1={rows[a].ts} x2={rows[Math.min(b, rows.length - 1)].ts} fill="#f1f5f9" fillOpacity={0.9} ifOverflow="hidden" />)}
              {weekEvents.map((e) => <ReferenceArea key={e.i} x1={t0 + e.i * 3600000} x2={t0 + (e.i + e.hours) * 3600000} fill="#fee2e2" fillOpacity={0.8} ifOverflow="hidden" />)}
              <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tick} ticks={rows.filter((r) => r.i % 24 === 0).map((r) => r.ts)} fontSize={11} />
              <YAxis fontSize={11} width={56} tickFormatter={(v) => `${num(v, 0)} kW`} />
              <Tooltip labelFormatter={(v) => new Date(v).toUTCString().slice(0, 22)} formatter={(v, n) => [`${num(v, 1)} kW`, n]} />
              <Legend />
              <Area dataKey="actual" name="Actual" stroke="#d97706" fill="#fde68a" fillOpacity={0.5} isAnimationActive={false} />
              <Line dataKey="expected" name="Expected (model)" stroke="#047857" dot={false} strokeDasharray="5 3" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-ink-500">Grey: building closed (nights, weekends, holidays). Red: a waste event, at least 3 hours far above what the model expects for that hour and weather.</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="card card-pad">
          <h2 className="font-semibold text-ink-900">The year at a glance</h2>
          <p className="h-sub">Each column is a day, each row an hour. Darker means more use above the model's expectation.</p>
          <YearHeatmap d={d} />
        </section>

        <section className="card card-pad space-y-4">
          <div>
            <h2 className="font-semibold text-ink-900">Sandbox: what if ECOGUARD ran this building?</h2>
            <p className="h-sub">Move the controls; the whole year is recomputed from the real meter readings.</p>
          </div>
          <Slider label="Switch off when closed" value={setback} onChange={setSetback}
            hint={`Removes ${setback}% of the use above this building's own best nights.`} />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={fixEvents} onChange={(e) => setFixEvents(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
            Act on waste events during open hours ({d.events.filter((e) => !e.closed).length} found)
          </label>
          {d.chw && <Slider label="Schedule HVAC cooling to opening hours" value={hvacCut} onChange={setHvacCut}
            hint="Share of after-hours chilled-water cooling removed." />}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-brand-50 p-3 text-center">
            <Stat icon={Zap} v={`${num(sim.pct, 1)}%`} l={`${num(sim.saved / 1000, 0)} MWh/yr`} />
            <Stat icon={PiggyBank} v={rs(sim.saved * RS_KWH)} l="a year at Jammu tariff" />
            <Stat icon={Leaf} v={`${num(sim.saved * CO2 / 1000, 0)} t`} l="CO₂ a year (CEA)" />
          </div>
          {d.chw && <p className="text-sm text-ink-700"><Snowflake size={14} className="mr-1 inline text-water" />Plus <b>{num(sim.chwSaved / 1000, 0)} MWh</b> a year of chilled-water cooling (thermal, separate meter) from HVAC scheduling.</p>}
        </section>
      </div>

      {(d.chw || d.water) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {d.chw && (
            <section className="card card-pad">
              <h2 className="font-semibold text-ink-900"><Snowflake size={16} className="mr-1 inline text-water" />HVAC: cooling this week</h2>
              <HvacFacts h={s.hvac} />
              <div className="mt-3 h-56">
                <ResponsiveContainer>
                  <ComposedChart data={rows}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    {closedRuns.map(([a, b]) => <ReferenceArea key={a} x1={rows[a].ts} x2={rows[Math.min(b, rows.length - 1)].ts} fill="#f1f5f9" ifOverflow="hidden" />)}
                    <XAxis dataKey="ts" type="number" domain={['dataMin', 'dataMax']} tickFormatter={tick} ticks={rows.filter((r) => r.i % 24 === 0).map((r) => r.ts)} fontSize={11} />
                    <YAxis yAxisId="c" fontSize={11} width={56} tickFormatter={(v) => `${num(v, 0)} kW`} />
                    <YAxis yAxisId="t" orientation="right" fontSize={11} width={36} unit="°" />
                    <Tooltip labelFormatter={(v) => new Date(v).toUTCString().slice(0, 22)} />
                    <Legend />
                    <Area yAxisId="c" dataKey="chw" name="Cooling (chilled water)" stroke="#0284c7" fill="#bae6fd" isAnimationActive={false} />
                    <Line yAxisId="c" dataKey="chw_exp" name="Expected" stroke="#047857" dot={false} strokeDasharray="5 3" isAnimationActive={false} />
                    <Line yAxisId="t" dataKey="temp" name="Outside °C" stroke="#94a3b8" dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          {d.water && (
            <section className="card card-pad">
              <h2 className="font-semibold text-ink-900"><Droplets size={16} className="mr-1 inline text-water" />Water: minimum night flow, every night of 2017</h2>
              <p className="h-sub">A healthy building's lowest flow between 1 and 5 am is near its floor. Nights well above it point to a leak or a running cistern.</p>
              <MnfChart w={d.water_audit} />
              <p className="mt-2 text-sm text-ink-700"><b>{d.water_audit.leak_nights}</b> leak-like nights, about <b>{num(d.water_audit.leak_share * 100, 1)}%</b> of the year's water.</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function HvacFacts({ h }) {
  if (!h || !h.cooling_total) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      <span className="pill bg-sky-50 text-water">{num(h.cooling_after_hours / h.cooling_total * 100, 0)}% of cooling while closed</span>
      <span className="pill bg-sky-50 text-water">{h.cooling_in_cold_hours} h cooling below 10 °C outside</span>
      {h.simultaneous_hours != null && <span className="pill bg-violet-50 text-hidden">{h.simultaneous_hours} h heating and cooling together</span>}
    </div>
  );
}

function Slider({ label, value, onChange, hint }) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm"><span className="font-medium text-ink-900">{label}</span><span className="text-brand-700 font-semibold">{value}%</span></div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1 w-full accent-emerald-700" />
      <div className="text-xs text-ink-500">{hint}</div>
    </label>
  );
}

function Stat({ icon: Icon, v, l }) {
  return (
    <div>
      <Icon size={14} className="mx-auto text-brand-700" />
      <div className="text-lg font-semibold text-brand-700">{v}</div>
      <div className="text-[11px] leading-tight text-ink-500">{l}</div>
    </div>
  );
}

function YearHeatmap({ d }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const days = Math.floor(d.hours / 24);
    const cw = 2, ch = 6;
    c.width = days * cw; c.height = 24 * ch;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, c.width, c.height);
    const ex = d.elec.map((e, i) => (e != null && d.exp[i] != null ? Math.max(0, e - d.exp[i]) : 0));
    const top = pct(ex.filter((x) => x > 0), 98) || 1;
    for (let i = 0; i < days * 24; i++) {
      const v = Math.min(1, ex[i] / top);
      if (d.elec[i] == null) { ctx.fillStyle = '#e2e8f0'; } else if (v < 0.03) { ctx.fillStyle = d.closed[i] ? '#f1f5f9' : '#ecfdf5'; } else {
        ctx.fillStyle = `rgba(220, 38, 38, ${0.15 + 0.85 * v})`;
      }
      ctx.fillRect(Math.floor(i / 24) * cw, (i % 24) * ch, cw, ch);
    }
  }, [d]);
  return (
    <div className="mt-3 overflow-x-auto">
      <canvas ref={ref} className="h-36 w-full min-w-[520px] rounded-md" style={{ imageRendering: 'pixelated' }} role="img" aria-label="Heatmap of use above expected, by day and hour, for 2017" />
      <div className="mt-1 flex justify-between text-[11px] text-ink-500"><span>January</span><span>midnight at top, 11 pm at bottom</span><span>December</span></div>
    </div>
  );
}

function MnfChart({ w }) {
  const data = w.mnf_series.map((v, i) => ({ i, v, base: w.mnf_base }));
  return (
    <div className="mt-3 h-48">
      <ResponsiveContainer>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="i" fontSize={11} tickFormatter={(i) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Math.min(11, Math.floor(i / 30.5))]} interval={30} />
          <YAxis fontSize={11} width={40} />
          <Tooltip formatter={(v) => num(v, 2)} labelFormatter={(i) => `Night ${i + 1}`} />
          <Area dataKey="v" name="Minimum night flow" stroke="#0284c7" fill="#bae6fd" isAnimationActive={false} />
          <Line dataKey="base" name="Normal night floor" stroke="#047857" dot={false} strokeDasharray="5 3" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function runs(flags) {
  const out = [];
  let a = null;
  flags.forEach((f, i) => {
    if (f && a == null) a = i;
    if (!f && a != null) { out.push([a, i - 1]); a = null; }
  });
  if (a != null) out.push([a, flags.length - 1]);
  return out;
}
