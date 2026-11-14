import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../App';
import AlertCard from '../components/AlertCard';
import { Empty, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';

const TABS = [['open', 'Open'], ['closed', 'History'], ['', 'All']];
const KINDS = [['', 'All types'], ['energy', 'Energy'], ['water', 'Water'], ['hidden', 'Hidden (wiring)']];

export default function Alerts() {
  const { live } = useApp();
  const [tab, setTab] = useState('open');
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => api.alerts(tab).then((d) => { setRows(d); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [tab, live?.ts]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = rows?.filter((a) => !kind || a.kind === kind) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title">Alerts</h1>
          <p className="h-sub">Mark each alert correct or not waste. Every answer is saved as a label, so the model learns this building over time.</p>
        </div>
        <a className="btn-ghost" href={`${import.meta.env.VITE_API_URL || ''}/api/labels.csv`}><Download size={14} />Labelled alerts (CSV)</a>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ink-300 bg-white p-0.5" role="tablist">
          {TABS.map(([v, l]) => <button key={l} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded-md px-3 py-1 text-sm font-medium ${tab === v ? 'bg-brand-700 text-white' : 'text-ink-700'}`}>{l}</button>)}
        </div>
        <label className="text-sm text-ink-500">
          <span className="sr-only">Filter by type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-sm text-ink-700">
            {KINDS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
          </select>
        </label>
        {rows && <span className="text-sm text-ink-500">{shown.length} alert(s)</span>}
      </div>
      {err && <ErrorState message={err} onRetry={load} />}
      {!rows && !err && <Loading what="alerts" />}
      {rows && shown.length === 0 && <Empty title={tab === 'open' ? 'No open alerts' : 'No alerts here yet'} hint="When something is wasted, it shows up here within 30 minutes with what it costs and what to do." />}
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((a) => <AlertCard key={a.id} alert={a} now={live?.ts} rooms={live?.rooms} onChange={load} />)}
      </div>
    </div>
  );
}
