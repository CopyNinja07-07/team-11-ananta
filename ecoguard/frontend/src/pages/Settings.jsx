import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';

export default function Settings() {
  const { lang, setLang } = useApp();
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);
  const [model, setModel] = useState(null);
  useEffect(() => {
    api.settings().then(setS).catch((e) => setErr(e.message));
    api.model().then(setModel).catch(() => {});
  }, []);
  if (err) return <ErrorState message={err} />;
  if (!s) return <Loading what="settings" />;
  const save = async (patch) => { const n = await api.saveSettings(patch); setS(n); setSaved(true); setTimeout(() => setSaved(false), 1500); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Settings</h1>
        <p className="h-sub">How much ECOGUARD is allowed to do on its own.</p>
      </div>
      <section className="card card-pad space-y-4">
        <Toggle label="Automatic mode" hint="Switch off empty rooms, stop the pump and close a leaking floor's valve on its own, after the grace period." value={s.auto_mode} onChange={(v) => save({ auto_mode: v })} />
        <Toggle label="Raise maintenance tickets automatically" hint="Wiring heat, earth leakage, leaks and pump faults go straight to the electrician or plumber." value={s.auto_work_orders} onChange={(v) => save({ auto_work_orders: v })} />
        <label className="block text-sm">
          <span className="font-medium text-ink-900">Grace period before auto action</span>
          <span className="block text-ink-500">Time a manager has to press "Not waste" before ECOGUARD acts.</span>
          <select className="mt-1 rounded-lg border border-ink-300 px-2 py-1.5" value={s.grace_min} onChange={(e) => save({ grace_min: Number(e.target.value) })}>
            {[15, 30, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-900">Typical repair time</span>
          <select className="mt-1 block rounded-lg border border-ink-300 px-2 py-1.5" value={s.maintenance_hours} onChange={(e) => save({ maintenance_hours: Number(e.target.value) })}>
            {[4, 12, 24, 48].map((h) => <option key={h} value={h}>{h} hours</option>)}
          </select>
        </label>
        <div className="text-sm">
          <span className="font-medium text-ink-900">Advice language</span>
          <div className="mt-1 flex gap-2">{[['en', 'English'], ['hi', 'हिन्दी']].map(([v, l]) => <button key={v} className={lang === v ? 'btn-primary' : 'btn-ghost'} onClick={() => setLang(v)}>{l}</button>)}</div>
        </div>
        {saved && <div className="text-sm text-brand-700" role="status">Saved</div>}
      </section>
      {model?.recall != null && (
        <section className="card card-pad text-sm">
          <h2 className="font-semibold text-ink-900">Detector report card</h2>
          <p className="text-ink-500">Tested on a full simulated year it never saw during training.</p>
          <div className="mt-2 flex flex-wrap gap-6">
            <div><div className="label">Faults caught</div><div className="text-xl font-semibold text-brand-700">{Math.round(model.recall * 100)}%</div></div>
            <div><div className="label">Alerts that were real</div><div className="text-xl font-semibold text-brand-700">{Math.round(model.precision * 100)}%</div></div>
            <div><div className="label">Faults in test year</div><div className="text-xl font-semibold text-ink-900">{model.faults_with_waste}</div></div>
          </div>
        </section>
      )}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-sm"><div className="font-medium text-ink-900">{label}</div><div className="text-ink-500">{hint}</div></div>
      <button role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-brand-700' : 'bg-ink-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
