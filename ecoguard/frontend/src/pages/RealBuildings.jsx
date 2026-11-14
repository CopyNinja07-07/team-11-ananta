import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Building2, Droplets, Flame, Snowflake, Zap } from 'lucide-react';
import Kpi from '../components/Kpi';
import { ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { num } from '../lib/format';

const KINDS = [['all', 'All'], ['classroom', 'Classrooms'], ['lab', 'Labs'], ['office', 'Offices']];

export default function RealBuildings() {
  const [p, setP] = useState(null);
  const [m, setM] = useState(null);
  const [err, setErr] = useState(null);
  const [kind, setKind] = useState('all');
  useEffect(() => {
    api.realPortfolio().then(setP).catch((e) => setErr(e.message));
    api.realModels().then(setM).catch(() => setM({}));
  }, []);
  const list = useMemo(() => (p?.sandbox || []).filter((b) => kind === 'all' || b.kind === kind), [p, kind]);
  if (err) return <ErrorState message={err} />;
  if (!p) return <Loading what="real buildings" />;
  const e = m?.electricity || {};
  const c = m?.chilledwater || {};
  const f = m?.forecaster || {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Real Buildings</h1>
        <p className="h-sub max-w-3xl">
          ECOGUARD's models trained and tested on <b>{num(p.buildings, 0)} real classrooms, labs and offices</b> from the open
          Building Data Genome 2 data set: two years of hourly electricity, cooling (chilled water), heating and water meters
          with on-site weather. Trained on 2016, every number below is from 2017, a year the models never saw.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Avoidable electricity" value={`${num(p.avoidable_pct.median, 1)}%`} sub={`median building · 1 in 4 above ${num(p.avoidable_pct.p75, 0)}%`} tone="energy" icon={Zap} />
        <Kpi label="Cooling when closed" value={`${num(p.cooling_after_hours_share_pct.median, 0)}%`} sub={`of chilled water, median of ${p.cooling_buildings} buildings`} tone="water" icon={Snowflake} />
        <Kpi label="Heating + cooling together" value={p.simultaneous_heat_cool_buildings} sub="buildings fighting themselves for 100+ hours" tone="hidden" icon={Flame} />
        <Kpi label="Night-flow leak signs" value={`${p.buildings_with_leak_nights} / ${p.water_buildings}`} sub="water-metered buildings with 5+ leak nights" tone="water" icon={Droplets} />
      </div>

      <section className="card card-pad">
        <div className="flex items-center gap-2"><Brain size={18} className="text-brand-700" /><h2 className="font-semibold text-ink-900">Model report card (unseen year)</h2></div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ModelCard title="Electricity baseline" sub="LightGBM, one model for all buildings"
            lines={[[`${num(e.train_rows / 1e6, 1)} M`, 'hourly rows trained'], [`${num(e.median_cvrmse, 1)}%`, 'median CV(RMSE)'], [`${num(e.ashrae_g14_pass_pct, 0)}%`, 'buildings pass ASHRAE Guideline 14']]} />
          <ModelCard title="Cooling (HVAC) baseline" sub="LightGBM on chilled-water meters"
            lines={[[`${num(c.buildings, 0)}`, 'buildings with cooling meters'], [`${num(c.median_cvrmse, 1)}%`, 'median CV(RMSE)'], [`${num(c.median_nmbe, 1)}%`, 'median bias (NMBE)']]} />
          <ModelCard title="Day-ahead forecaster" sub="2-layer LSTM + MLP (PyTorch)"
            lines={f.median_cvrmse ? [[`${num(f.median_cvrmse.model, 1)}%`, 'error, our model'], [`${num(f.median_cvrmse.yesterday, 1)}%`, "error, 'same as yesterday'"], [`${num(f.model_beats_both_pct, 0)}%`, 'buildings where it beats both simple forecasts']] : [['–', 'not trained yet']]} />
        </div>
        <p className="mt-3 text-xs text-ink-500">CV(RMSE): typical hourly error as a share of average use. ASHRAE Guideline 14 accepts an hourly baseline below 30% CV(RMSE) and within ±10% bias. Real 2017 meters include real faults, which count as error here.</p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 font-semibold text-ink-900">Open a building in the sandbox</h2>
          {KINDS.map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
              className={`pill border ${kind === k ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-300 bg-white text-ink-700'}`}>{l}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((b) => (
            <Link key={b.id} to={`/real/${b.id}`} className="card card-pad block transition hover:border-brand-500 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-ink-900">{b.id.split('_').pop()}</div>
                  <div className="text-xs text-ink-500">{b.use} · {num(b.sqm, 0)} m² · site {b.id.split('_')[0]}</div>
                </div>
                <Building2 size={18} className="text-ink-300" />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="label">Avoidable</div>
                  <div className={`text-xl font-semibold ${b.avoidable_pct > 20 ? 'text-danger' : b.avoidable_pct > 10 ? 'text-energy' : 'text-brand-700'}`}>{num(b.avoidable_pct, 1)}%</div>
                </div>
                <div className="flex gap-1">
                  {b.cooling && <span className="pill bg-sky-50 text-water"><Snowflake size={11} className="mr-1" />HVAC</span>}
                  {b.water && <span className="pill bg-sky-50 text-water"><Droplets size={11} className="mr-1" />Water</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <p className="text-xs text-ink-500">Source: Miller et al., "The Building Data Genome Project 2", Scientific Data 7, 368 (2020), CC BY 4.0. Building names are the data set's anonymous codes.</p>
      </section>
    </div>
  );
}

function ModelCard({ title, sub, lines }) {
  return (
    <div className="rounded-xl border border-ink-300/60 p-4">
      <div className="font-medium text-ink-900">{title}</div>
      <div className="text-xs text-ink-500">{sub}</div>
      <dl className="mt-3 space-y-1.5">
        {lines.map(([v, l]) => (
          <div key={l} className="flex items-baseline gap-2"><dt className="w-16 text-lg font-semibold text-brand-700">{v}</dt><dd className="text-sm text-ink-700">{l}</dd></div>
        ))}
      </dl>
    </div>
  );
}
