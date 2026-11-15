import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../App';
import AlertCard from '../components/AlertCard';
import { Empty, ErrorState, Loading } from '../components/States';
import { api, DEMO } from '../lib/api';
import About from '../components/About';

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
          <p className="h-sub">Answer “Right call? Yes / No” on each alert. Every answer is saved as a label, so the model learns this building over time.</p>
        </div>
        <About id="alerts" points={[
          ["An alert means ECOGUARD found power or water being wasted, or a fault hidden in the wall.", "अलर्ट का मतलब: ECOGUARD को बिजली या पानी की बर्बादी, या दीवार में छिपी ख़राबी मिली।"],
          ["Each card says where, since when, what it has cost so far, and the readings that made ECOGUARD raise it.", "हर कार्ड बताता है कहाँ, कब से, अब तक कितना नुकसान, और किन रीडिंग से अलर्ट बना।"],
          ["The green button fixes it from here: switch a room off, reset an AC, stop the pump, or send a technician.", "हरा बटन यहीं से ठीक करता है: कमरा बंद, एसी रीसेट, पंप बंद, या टेक्नीशियन भेजें।"],
          ["Right call? Yes / No teaches the detector. Open shows what is happening now; History shows everything already closed.", "\"सही पकड़ा? हाँ / ना\" से डिटेक्टर सीखता है। Open में अभी के, History में पुराने अलर्ट हैं।"],
        ]} />
        {!DEMO && <a className="btn-ghost" href={`${import.meta.env.VITE_API_URL || ''}/api/labels.csv`}><Download size={14} />Labelled alerts (CSV)</a>}
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
      {rows && shown.length === 0 && (
        <Empty title={tab === 'open' ? 'No open alerts' : 'No alerts here yet'}
          hint={tab === 'open' ? 'When something is wasted, it shows up here within 30 minutes. If auto mode is on, ECOGUARD fixes it first and the alert moves to History, where you can still say if it was the right call.' : 'When something is wasted, it shows up here within 30 minutes with what it costs and what to do.'}>
          {tab === 'open' && <button className="btn-ghost" onClick={() => setTab('closed')}>See history</button>}
        </Empty>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((a) => <AlertCard key={a.id} alert={a} now={live?.ts} rooms={live?.rooms} onChange={load} />)}
      </div>
    </div>
  );
}
