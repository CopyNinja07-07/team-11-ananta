import { Link } from 'react-router-dom';
import { Activity, Droplets, Leaf, PiggyBank, Zap } from 'lucide-react';
import { useApp } from '../App';
import AlertCard from '../components/AlertCard';
import FloorMap from '../components/FloorMap';
import Kpi from '../components/Kpi';
import { Empty, ErrorState, Loading, NotStarted } from '../components/States';
import { num, rs } from '../lib/format';

export default function Overview() {
  const { live, error } = useApp();
  if (error && !live) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!live) return <Loading what="the building" />;
  if (!live.ready) return <NotStarted />;

  const t = live.today || {};
  const people = live.rooms.reduce((s, r) => s + r.people, 0);
  const wasting = live.rooms.filter((r) => r.people === 0 && r.kw - r.expected_kw > 0.2).length;
  const alerts = live.alerts.filter((a) => a.feedback !== 'dismissed');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Overview</h1>
        <p className="h-sub">What the block is using right now, what is being wasted, and what ECOGUARD has already done about it.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Power now" value={num(live.kw, 1)} unit="kW" sub={`${people} people inside`} icon={Activity} />
        <Kpi label="Energy today" value={num(t.kwh_used, 0)} unit="kWh" sub={`${num(t.kwh_wasted, 1)} kWh caught as waste`} tone="energy" icon={Zap} />
        <Kpi label="Water today" value={num((t.litres_used || 0) / 1000, 1)} unit="kL" sub={`${num(t.litres_wasted, 0)} L caught as waste`} tone="water" icon={Droplets} />
        <Kpi label="Saved today" value={rs(t.rupees_saved)} sub={`${num(t.kwh_avoided, 1)} kWh · ${num(t.litres_avoided, 0)} L avoided`} tone="brand" icon={PiggyBank} />
        <Kpi label="CO₂ avoided" value={num(t.co2_avoided, 1)} unit="kg" sub="grid factor 0.716 kg/kWh (CEA)" tone="brand" icon={Leaf} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="card card-pad" aria-labelledby="map-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="map-h" className="font-semibold text-ink-900">Building map</h2>
            <span className="text-xs text-ink-500">{wasting ? `${wasting} empty room(s) drawing power` : 'No empty room is drawing extra power'}</span>
          </div>
          <FloorMap rooms={live.rooms} alerts={live.alerts} water={live.water} />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <MiniGauge label="Overhead tank" pct={live.water.tank_pct} />
            <MiniGauge label="Sump" pct={live.water.sump_pct} />
            <div className="rounded-lg bg-ink-100 p-2">
              <div className="text-ink-500">Pump</div>
              <div className={`text-sm font-semibold ${live.water.pump_on ? 'text-water' : 'text-ink-700'}`}>{live.water.pump_on ? 'Running' : 'Off'}</div>
            </div>
          </div>
        </section>

        <section aria-labelledby="alerts-h" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="alerts-h" className="font-semibold text-ink-900">Open alerts</h2>
            <Link to="/alerts" className="text-sm font-medium text-brand-700 hover:underline">See all</Link>
          </div>
          {alerts.length === 0
            ? <Empty title="Nothing is being wasted right now" hint="ECOGUARD checks every room, the tank and the pump every 15 minutes." />
            : alerts.slice(0, 4).map((a) => <AlertCard key={a.id} alert={a} now={live.ts} rooms={live.rooms} />)}
        </section>
      </div>
    </div>
  );
}

function MiniGauge({ label, pct }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const tone = p > 98 ? 'bg-danger' : p < 15 ? 'bg-energy' : 'bg-water';
  return (
    <div className="rounded-lg bg-ink-100 p-2">
      <div className="text-ink-500">{label}</div>
      <div className="text-sm font-semibold text-ink-900">{num(p, 0)}%</div>
      <div className="mt-1 h-1.5 rounded bg-white" role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-1.5 rounded ${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
