import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Droplets, Leaf, PiggyBank, Zap } from 'lucide-react';
import { useApp } from '../App';
import AlertCard from '../components/AlertCard';
import FloorMap from '../components/FloorMap';
import Building3D from '../components/Building3D';
import DataSource from '../components/DataSource';
import Kpi from '../components/Kpi';
import { Empty, ErrorState, Loading, NotStarted } from '../components/States';
import { api } from '../lib/api';
import { num, rs } from '../lib/format';
import About from '../components/About';

export default function Overview() {
  const { live, error, building } = useApp();
  const [view, setView] = useState('3d');
  const [fixed, setFixed] = useState([]);
  // what ECOGUARD already fixed on its own in the last 12 hours, so the panel never looks idle
  useEffect(() => {
    if (!live?.ts) return;
    api.alerts('closed').then((rows) => setFixed(rows.filter((a) => a.status === 'actioned' && a.end > live.ts - 12 * 3600e3))).catch(() => {});
  }, [live?.ts]);
  if (error && !live) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!live) return <Loading what="the building" />;
  if (!live.ready) return <NotStarted />;

  const t = live.today || {};
  const people = live.rooms.reduce((s, r) => s + r.people, 0);
  const wasting = live.rooms.filter((r) => r.people === 0 && r.kw - r.expected_kw > 0.2).length;
  const alerts = live.alerts.filter((a) => a.feedback !== 'dismissed');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Live · every 15 minutes</div>
          <h1 className="h-title mt-1">What the building is doing right now</h1>
          <p className="h-sub max-w-2xl">Power, water and the hidden heat in the walls, room by room. Anything wasted shows up here with a name, a cost and a fix.</p>
        </div>
        <DataSource kind="sim" />
      </div>
      <About id="live" points={[
        ["The five numbers at the top are for today: power now, energy and water used, money saved and CO₂ avoided.", "ऊपर के पाँच नंबर आज के हैं: अभी की बिजली, आज की बिजली और पानी, बचत और बचा CO₂।"],
        ["The 3D building is live. Green rooms are in use, grey rooms are empty, yellow rooms are wasting power. Amber sparks are electricity, blue drops are water.", "3D बिल्डिंग लाइव है। हरा = कमरा इस्तेमाल में, धूसर = ख़ाली, पीला = बिजली बर्बाद। पीली चिंगारी बिजली है, नीली बूँद पानी।"],
        ["Click any room in the 3D view to open its own page with its graph.", "3D में किसी भी कमरे पर क्लिक करें, उसका पेज और ग्राफ़ खुलेगा।"],
        ["Needs attention lists what is being wasted right now, with the cost and a one-tap fix.", "\"ध्यान दें\" में अभी की बर्बादी, उसका ख़र्च और एक टैप वाला उपाय है।"],
      ]} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Power now" value={num(live.kw, 1)} unit="kW" sub={`${people} people inside`} icon={Activity} />
        <Kpi label="Energy today" value={num(t.kwh_used, 0)} unit="kWh" sub={`${num(t.kwh_wasted, 1)} kWh caught as waste`} tone="energy" icon={Zap} />
        <Kpi label="Water today" value={num((t.litres_used || 0) / 1000, 1)} unit="kL" sub={`${num(t.litres_wasted, 0)} L caught as waste`} tone="water" icon={Droplets} />
        <Kpi label="Saved today" value={rs(t.rupees_saved)} sub={`${num(t.kwh_avoided, 1)} kWh · ${num(t.litres_avoided, 0)} L avoided`} tone="brand" icon={PiggyBank} />
        <div className="col-span-2 lg:col-span-1"><Kpi label="CO₂ avoided" value={num(t.co2_avoided, 1)} unit="kg" sub="0.716 kg per kWh (CEA grid factor)" tone="brand" icon={Leaf} /></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <section className="card-dark overflow-hidden p-3 sm:p-4" aria-labelledby="map-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 id="map-h" className="font-display text-base font-semibold text-white">The building, live</h2>
              <p className="text-xs text-ink-300">{wasting ? `${wasting} empty room${wasting > 1 ? 's are' : ' is'} drawing power` : 'No empty room is drawing extra power'}</p>
            </div>
            <div className="flex rounded-lg border border-night-700 p-0.5 text-xs" role="tablist" aria-label="Building view">
              {[['3d', '3D'], ['plan', 'Floor plan']].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                  className={`rounded-md px-2.5 py-1 font-medium ${view === k ? 'bg-night-700 text-white' : 'text-ink-300 hover:text-white'}`}>{l}</button>
              ))}
            </div>
          </div>
          {view === '3d'
            ? <Building3D live={live} building={building} fallback={<div className="rounded-xl bg-white p-3"><FloorMap rooms={live.rooms} alerts={live.alerts} water={live.water} /></div>} />
            : <div className="rounded-xl bg-white p-3 sm:p-4"><FloorMap rooms={live.rooms} alerts={live.alerts} water={live.water} /></div>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <MiniGauge label="Roof tank" pct={live.water.tank_pct} />
            <MiniGauge label="Sump" pct={live.water.sump_pct} />
            <div className="rounded-lg border border-night-700 bg-night-800 p-2.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-400">Pump</div>
              <div className={`readout mt-0.5 text-sm ${live.water.pump_on ? 'text-river-300' : 'text-ink-100'}`}>{live.water.pump_on ? 'Running' : 'Off'}</div>
            </div>
          </div>
        </section>

        <section aria-labelledby="alerts-h" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="alerts-h" className="font-display text-base font-semibold text-ink-900">Needs attention <span className="readout ml-1 text-sm font-normal text-ink-500">{alerts.length}</span></h2>
            <Link to="/alerts" className="text-sm font-medium text-leaf-700 hover:underline">All alerts</Link>
          </div>
          {alerts.length === 0 && fixed.length > 0
            ? <div className="card card-pad text-sm text-ink-700">Nothing is being wasted right now. Every room, the tank and the pump are checked every 15 minutes.</div>
            : alerts.length === 0
            ? <Empty title="Nothing is being wasted right now" hint="Every room, the tank and the pump are checked every 15 minutes." />
            : alerts.slice(0, 4).map((a) => <AlertCard key={a.id} alert={a} now={live.ts} rooms={live.rooms} />)}
          {alerts.length < 3 && fixed.length > 0 && (
            <>
              <h3 className="pt-2 font-display text-sm font-semibold text-ink-700">Fixed automatically <span className="readout ml-1 font-normal text-ink-500">{fixed.length} in 12 h</span></h3>
              {fixed.slice(0, 3 - alerts.length).map((a) => <AlertCard key={a.id} alert={a} now={live.ts} rooms={live.rooms} compact />)}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniGauge({ label, pct }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const tone = p > 98 ? 'bg-alarm-400' : p < 15 ? 'bg-volt-400' : 'bg-river-400';
  return (
    <div className="rounded-lg border border-night-700 bg-night-800 p-2.5">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-ink-400"><span>{label}</span><span className="text-ink-100">{num(p, 0)}%</span></div>
      <div className="mt-2 h-1.5 rounded bg-night-700" role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-1.5 rounded ${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
