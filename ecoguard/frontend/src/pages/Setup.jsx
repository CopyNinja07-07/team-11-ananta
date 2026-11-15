import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../App';
import { api } from '../lib/api';
import { ORDINAL } from '../lib/format';
import About from '../components/About';

// Add a building in four steps. The result is the same building file the server and the
// sensor gateway read (config/campus.json), so a new block needs no new code.

const KIND_DEFAULTS = {
  class: { cap: 60, lightW: 480, fans: 6, acKW: 1.7, acUnits: 1, pcs: 1, heaterW: 0, standbyW: 40, inverter: false, rWire: 0.15 },
  lab: { cap: 40, lightW: 720, fans: 6, acKW: 1.7, acUnits: 3, pcs: 40, heaterW: 0, standbyW: 140, inverter: false, rWire: 0.14 },
  office: { cap: 8, lightW: 360, fans: 4, acKW: 1.6, acUnits: 1, pcs: 8, heaterW: 2000, standbyW: 90, inverter: true, rWire: 0.16 },
};
const KIND_LABEL = { class: 'Classroom', lab: 'Lab', office: 'Office' };
const STEPS = ['Building', 'Rooms', 'Water and tariff', 'Review'];

export default function Setup() {
  const { building } = useApp();
  const [step, setStep] = useState(0);
  const [b, setB] = useState({ id: 'BLK-B', name: 'Academic Block B', city: 'Jammu', floors: 2 });
  const [rooms, setRooms] = useState([]);
  const [water, setWater] = useState({ tankL: 10000, sumpL: 20000, pumpKW: 1.5 });
  const [tariff, setTariff] = useState({ rsPerKWh: 7, rsPerKL: 30, kgCO2PerKWh: 0.716 });
  const [copied, setCopied] = useState(false);

  // start from a copy of the current block so the form is never empty
  useEffect(() => {
    if (!building || rooms.length) return;
    api.building().then((d) => {
      const zones = d.zones || d.rooms || [];
      if (zones.length) setRooms(zones.map((z) => ({ ...KIND_DEFAULTS[z.kind] || KIND_DEFAULTS.class, ...z })));
      if (d.water) setWater((w) => ({ ...w, ...d.water }));
      if (d.tariff) setTariff(d.tariff);
    }).catch(() => {});
  }, [building, rooms.length]);

  const floors = Array.from({ length: b.floors }, (_, i) => ({ id: i, name: i === 0 ? 'Ground floor' : `${ORDINAL[i] || `Floor ${i}`} floor` }));
  const config = useMemo(() => ({
    building: { id: b.id, name: b.name, city: b.city, floors: floors.map((f) => ({ id: f.id, name: f.name })) },
    zones: rooms.map((r) => ({ ...r, floor: Math.min(r.floor, b.floors - 1) })),
    water, tariff,
  }), [b, rooms, water, tariff]); // eslint-disable-line react-hooks/exhaustive-deps

  const json = JSON.stringify(config, null, 1);
  const problems = [
    !b.name.trim() && 'Give the building a name.',
    rooms.length === 0 && 'Add at least one room.',
    new Set(rooms.map((r) => r.id)).size !== rooms.length && 'Two rooms share the same ID.',
  ].filter(Boolean);

  const setRoom = (i, patch) => setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRoom = () => setRooms((rs) => [...rs, { id: `R-${rs.length + 1}`, name: `Room ${rs.length + 1}`, floor: 0, kind: 'class', ...KIND_DEFAULTS.class }]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'campus.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ } };

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow">For your campus</div>
        <h1 className="h-title mt-1">Add a building</h1>
        <p className="h-sub max-w-2xl">Four steps. The answer is one building file that the server and the sensor nodes both read, so the next block needs no new code.</p>
      </div>
      <About id="setup" points={[
        ["Four steps describe a new building: floors, rooms, their equipment and the water tank.", "चार कदमों में नई बिल्डिंग: मंज़िलें, कमरे, उनके उपकरण और पानी की टंकी।"],
        ["The result is one building file. The server and every sensor box read the same file, so a new block needs no new code.", "नतीजा एक बिल्डिंग फ़ाइल है। सर्वर और हर सेंसर बॉक्स यही फ़ाइल पढ़ते हैं, इसलिए नए ब्लॉक के लिए नया कोड नहीं चाहिए।"],
      ]} />

      <ol className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${step === i ? 'border-night-900 bg-night-900 text-white' : i < step ? 'border-leaf-200 bg-leaf-50 text-leaf-800' : 'border-ink-300 bg-white text-ink-700'}`}>
              <span className="readout text-xs">{i < step ? <Check size={13} aria-hidden /> : i + 1}</span>{s}
            </button>
          </li>
        ))}
      </ol>

      <section className="card card-pad">
        {step === 0 && (
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Input label="Building name" value={b.name} onChange={(v) => setB({ ...b, name: v })} />
            <Input label="Short ID" value={b.id} onChange={(v) => setB({ ...b, id: v.toUpperCase().replace(/\s+/g, '-') })} hint="Used in the MQTT topic" />
            <Input label="City" value={b.city} onChange={(v) => setB({ ...b, city: v })} />
            <Input label="Floors" type="number" value={b.floors} min={1} max={12} onChange={(v) => setB({ ...b, floors: Math.max(1, Math.min(12, Number(v) || 1)) })} />
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="hidden grid-cols-[90px_1fr_120px_110px_80px_70px_70px_36px] gap-2 px-1 pb-2 font-mono text-[10.5px] uppercase tracking-wider text-ink-500 lg:grid">
              <span>ID</span><span>Name</span><span>Type</span><span>Floor</span><span>Seats</span><span>ACs</span><span>PCs</span><span />
            </div>
            <ul className="space-y-2">
              {rooms.map((r, i) => (
                <li key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-ink-200 p-2 lg:grid-cols-[90px_1fr_120px_110px_80px_70px_70px_36px] lg:border-0 lg:p-0">
                  <input aria-label="Room ID" className="field readout" value={r.id} onChange={(e) => setRoom(i, { id: e.target.value.toUpperCase() })} />
                  <input aria-label="Room name" className="field" value={r.name} onChange={(e) => setRoom(i, { name: e.target.value })} />
                  <select aria-label="Room type" className="field" value={r.kind} onChange={(e) => setRoom(i, { kind: e.target.value, ...KIND_DEFAULTS[e.target.value] })}>
                    {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <select aria-label="Floor" className="field" value={Math.min(r.floor, b.floors - 1)} onChange={(e) => setRoom(i, { floor: Number(e.target.value) })}>
                    {floors.map((f) => <option key={f.id} value={f.id}>{f.id === 0 ? 'Ground' : `Floor ${f.id}`}</option>)}
                  </select>
                  <input aria-label="Seats" type="number" className="field readout" value={r.cap} onChange={(e) => setRoom(i, { cap: Number(e.target.value) || 0 })} />
                  <input aria-label="AC units" type="number" className="field readout" value={r.acUnits} onChange={(e) => setRoom(i, { acUnits: Number(e.target.value) || 0 })} />
                  <input aria-label="PCs" type="number" className="field readout" value={r.pcs} onChange={(e) => setRoom(i, { pcs: Number(e.target.value) || 0 })} />
                  <button className="btn-ghost justify-center px-2" onClick={() => setRooms((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove ${r.name}`}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
            <button className="btn-ghost mt-3" onClick={addRoom}><Plus size={15} aria-hidden />Add a room</button>
          </div>
        )}

        {step === 2 && (
          <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
            <Input label="Roof tank (litres)" type="number" value={water.tankL} onChange={(v) => setWater({ ...water, tankL: Number(v) || 0 })} />
            <Input label="Sump (litres)" type="number" value={water.sumpL} onChange={(v) => setWater({ ...water, sumpL: Number(v) || 0 })} />
            <Input label="Pump (kW)" type="number" step="0.1" value={water.pumpKW} onChange={(v) => setWater({ ...water, pumpKW: Number(v) || 0 })} />
            <Input label="Electricity (₹ per kWh)" type="number" step="0.5" value={tariff.rsPerKWh} onChange={(v) => setTariff({ ...tariff, rsPerKWh: Number(v) || 0 })} />
            <Input label="Water (₹ per kL)" type="number" value={tariff.rsPerKL} onChange={(v) => setTariff({ ...tariff, rsPerKL: Number(v) || 0 })} />
            <Input label="Grid CO₂ (kg per kWh)" type="number" step="0.001" value={tariff.kgCO2PerKWh} onChange={(v) => setTariff({ ...tariff, kgCO2PerKWh: Number(v) || 0 })} hint="CEA factor for India: 0.716" />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3 text-sm">
              <div className="readout text-2xl">{b.name}</div>
              <div className="text-ink-700">{b.city} · {b.floors} floor{b.floors > 1 ? 's' : ''} · {rooms.length} rooms · {rooms.reduce((s, r) => s + (r.acUnits || 0), 0)} ACs · {rooms.reduce((s, r) => s + (r.pcs || 0), 0)} PCs</div>
              {problems.length
                ? <ul className="rounded-lg border border-alarm-200 bg-alarm-50 p-3 text-danger" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
                : <div className="rounded-lg border border-leaf-200 bg-leaf-50 p-3 text-leaf-800">Ready. Save this file as <span className="readout">config/campus.json</span> on the ECOGUARD server and restart it. The rooms appear on the live view as soon as their sensor nodes send the first reading.</div>}
              <div className="flex gap-2">
                <button className="btn-primary" onClick={download} disabled={problems.length > 0}><Download size={15} aria-hidden />Download building file</button>
                <button className="btn-ghost" onClick={copy}><Copy size={15} aria-hidden />{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-night-900 p-4 font-mono text-[11.5px] leading-5 text-leaf-100">{json}</pre>
          </div>
        )}
      </section>

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
        {step < 3 && <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Next: {STEPS[step + 1]}</button>}
      </div>
    </div>
  );
}

function Input({ label, hint, onChange, ...p }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-900">{label}</span>
      <input {...p} onChange={(e) => onChange(e.target.value)} className="field mt-1 w-full" />
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
