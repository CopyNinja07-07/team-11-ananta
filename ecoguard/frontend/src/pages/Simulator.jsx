import { useState } from 'react';
import { Bug, CloudLightning, FlaskConical, Gauge } from 'lucide-react';
import { useApp } from '../App';
import { api } from '../lib/api';
import { fmtTime, targetName, floorIds } from '../lib/format';
import About from '../components/About';

// Demo controls. In the real building these faults happen on their own;
// here we can trigger them on stage and watch ECOGUARD respond.
const FAULTS = [
  { type: 'lights_left_on', label: 'Lights + fans left on', scope: 'room' },
  { type: 'ac_left_on', label: 'AC left on after class', scope: 'ac' },
  { type: 'pcs_left_on', label: 'Lab PCs left on', scope: 'lab' },
  { type: 'overcool', label: 'AC overcooling', scope: 'ac' },
  { type: 'loose_joint', label: 'Loose joint in wall', scope: 'room' },
  { type: 'leak', label: 'Pipe leak', scope: 'floor' },
  { type: 'cistern', label: 'Running cistern', scope: 'floor' },
  { type: 'float_fail', label: 'Tank float stuck', scope: 'tank' },
  { type: 'dry_run', label: 'Sump empty, pump dry', scope: 'pump' },
];

export default function Simulator() {
  const { live, building } = useApp();
  const [fault, setFault] = useState(FAULTS[0]);
  const [target, setTarget] = useState('CR-101');
  const [note, setNote] = useState(null); // { where, text }: shown next to the button that was pressed
  const rooms = live?.rooms ?? [];
  // targets come from the building config, so a new floor or AC room appears here by itself
  const zones = building?.zones ?? [];
  const AC_ROOMS = zones.filter((z) => z.equipment?.acUnits > 0).map((z) => z.id);
  const LABS = zones.filter((z) => z.kind === 'lab').map((z) => z.id);
  const targets = fault.scope === 'floor' ? floorIds(building, rooms).map((f) => `F${f}`) : fault.scope === 'tank' ? ['TANK'] : fault.scope === 'pump' ? ['PUMP']
    : fault.scope === 'lab' ? LABS : fault.scope === 'ac' ? AC_ROOMS : rooms.map((r) => r.id);
  const send = async (body, text, where) => {
    try { await api.sim(body); setNote({ where, text, ok: true }); }
    catch (e) { setNote({ where, text: `Failed: ${e.message}`, ok: false }); }
  };
  const Note = ({ where }) => (note?.where === where ? (
    <p role="status" className={`rounded-lg px-3 py-2 text-sm ${note.ok ? 'bg-brand-50 text-brand-800' : 'bg-alarm-50 text-alarm-700'}`}>{note.text}</p>
  ) : null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Test mode</h1>
        <p className="h-sub">A safe place to test ECOGUARD. Break something in the simulated block, then watch the Alerts page catch it from the readings alone.</p>
      </div>
      <About id="test" points={[
        ["Test mode drives the simulated Academic Block A that stands in for real sensor boxes until they are fitted.", "टेस्ट मोड सिम्युलेटेड एकेडमिक ब्लॉक A चलाता है, जो असली सेंसर लगने तक उनकी जगह काम करता है।"],
        ["Inject a fault (an AC left on, a leak, a loose joint) and watch ECOGUARD find it from the readings alone. The detector is never told what you injected.", "कोई ख़राबी डालें (एसी चालू छूटा, लीक, ढीला जोड़) और देखें ECOGUARD सिर्फ़ रीडिंग से उसे कैसे पकड़ता है। डिटेक्टर को नहीं बताया जाता।"],
        ["The power-cut button tests what happens when the grid fails: rooms that switch back on by themselves afterwards are caught too.", "बिजली कट बटन परखता है कि ग्रिड जाने पर क्या होता है: बाद में अपने आप चालू हुए कमरे भी पकड़े जाते हैं।"],
        ["Ground truth at the bottom lists what is really broken, with Detected or Not yet, so you can check ECOGUARD yourself.", "नीचे \"असली स्थिति\" बताती है क्या सच में ख़राब है, साथ में \"पकड़ा\" या \"अभी नहीं\", ताकि आप ख़ुद जाँच सकें।"],
        ["When real ESP32 boxes are installed they send the same readings, and this page is no longer needed.", "असली ESP32 बॉक्स लगने पर वे यही रीडिंग भेजेंगे, तब इस पेज की ज़रूरत नहीं रहेगी।"],
      ]} />
      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {[['1', 'Pick a fault and a room below, then press Create fault.'], ['2', 'Wait one or two readings (set the speed to Fast to hurry it).'], ['3', 'Open Alerts: the fault appears there with its cost and a fix. Ground truth below turns to Detected.']].map(([n, x]) => (
          <li key={n} className="flex gap-3 rounded-xl border border-ink-200 bg-white p-3"><span className="readout flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-600 text-xs text-white">{n}</span><span className="text-ink-700">{x}</span></li>
        ))}
      </ol>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink-900"><Bug size={16} />Create a fault</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="label">Fault</span>
              <select className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1.5" value={fault.type}
                onChange={(e) => { const f = FAULTS.find((x) => x.type === e.target.value); setFault(f); setTarget({ floor: 'F1', tank: 'TANK', pump: 'PUMP', lab: 'LAB-1', ac: 'CR-201' }[f.scope] || 'CR-101'); }}>
                {FAULTS.map((f) => <option key={f.type} value={f.type}>{f.label}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="label">Where</span>
              <select className="mt-1 w-full rounded-lg border border-ink-300 px-2 py-1.5" value={target} onChange={(e) => setTarget(e.target.value)}>
                {targets.map((t) => <option key={t} value={t}>{targetName(t, rooms)}</option>)}
              </select>
            </label>
          </div>
          <button className="btn-primary" onClick={() => send({ action: 'inject', fault: fault.type, target }, `Fault created: ${fault.label} in ${targetName(target, rooms)}. It starts at the next reading; open Alerts in a minute to see ECOGUARD catch it.`, 'fault')}><FlaskConical size={14} />Create fault</button>
          <p className="text-xs text-ink-500">Tip: "lights left on" needs an empty room. A loose joint takes simulated days to heat up, so speed up time to see it.</p>
          <Note where="fault" />
        </section>
        <section className="card card-pad space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink-900"><CloudLightning size={16} />Grid and time</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => send({ action: 'cut', value: 60 }, 'Power cut started: the grid is off for 60 simulated minutes. The Grid chip at the top turns to Grid off, and any room that switches back on by itself afterwards shows up in Alerts.', 'grid')}>Power cut (60 min)</button>
          </div>
          <div>
            <div className="label flex items-center gap-1"><Gauge size={12} />Speed: real seconds per 15 simulated minutes</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {[[5, 'Slow'], [2, 'Normal'], [0.5, 'Fast'], [0.05, 'Very fast']].map(([v, l]) => <button key={v} className="btn-ghost" onClick={() => send({ action: 'speed', value: v }, `Speed set to ${l}: one 15-minute reading every ${v} s.`, 'grid')}>{l}</button>)}
            </div>
          </div>
          <Note where="grid" />
        </section>
      </div>
      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">What is really broken (hidden from the detector)</h2>
        <p className="text-xs text-ink-500">What is really broken in the simulated block right now, so you can check ECOGUARD against it.</p>
        <div className="mt-2"><Note where="truth" /></div>
        <ul className="mt-2 divide-y divide-ink-100 text-sm">
          {(live?.sim?.active ?? []).length === 0 && <li className="py-2 text-ink-500">Nothing is broken right now.</li>}
          {(live?.sim?.active ?? []).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{f.type.replaceAll('_', ' ')}</b> · {targetName(f.target, rooms)} · since {fmtTime(f.start)}</span>
              <span className="flex items-center gap-2">
                {live.alerts.some((a) => a.target === f.target || a.target === `F${f.target?.slice?.(1)}`) ? <span className="pill bg-brand-50 text-brand-700">Detected</span> : <span className="pill bg-ink-100 text-ink-500">Not yet</span>}
                <button className="btn-ghost" onClick={() => send({ action: 'fix', fault_id: f.id }, `Fixed: ${f.type.replaceAll('_', ' ')} in ${targetName(f.target, rooms)}. Its alert closes after the next reading.`, 'truth')}>Fix</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
