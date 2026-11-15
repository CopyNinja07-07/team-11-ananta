import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Check, ClipboardList, Cpu, LineChart, PlugZap, ShieldCheck, Wrench } from 'lucide-react';
import DataSource from '../components/DataSource';
import { api } from '../lib/api';
import { num, rs } from '../lib/format';
import About from '../components/About';

// Who buys ECOGUARD, what it costs, how it reaches a new campus.
// Prices are launch prices for the pilot phase; the saving rate comes from the simulated year.

const KIT = [
  ['Room node', 'ESP32 with current sensor, motion, temperature and door switch', 1800, 'per room'],
  ['Water kit', 'Flow meter on the riser, sump and tank level, pump relay', 6500, 'per block'],
  ['Board meter', 'Main kW and earth-leakage reading at the distribution board', 4500, 'per block'],
];

const PLANS = [
  { name: 'Pilot', price: '₹0', per: 'for 60 days', who: 'One block, to see it work before paying for software.',
    items: ['Sensor kit at cost', 'Live view, alerts and Yes / No', 'Before vs after report at day 60'], cta: 'Start with one block' },
  { name: 'Campus', price: '₹1,499', per: 'per block, per month', who: 'For colleges and offices that keep it after the pilot.', featured: true,
    items: ['Everything in Pilot', 'Hindi voice advice for caretakers', 'Monthly savings and CO₂ report', 'Up to 20 rooms per block'] },
  { name: 'Network', price: 'Custom', per: 'many campuses', who: 'Universities, school chains and office parks.',
    items: ['All blocks in one view', 'MQTT and REST API for your systems', 'Runs on your own server if needed'] },
];

const STEPS = [
  [ClipboardList, 'Walk-through', 'One visit: count rooms, ACs, PCs, the pump and the tank. This becomes the building file.'],
  [Wrench, 'Fit the kit', 'A room node behind each switchboard, the water kit at the pump, one meter at the board. About two days for a block.'],
  [Cpu, 'Learn the block', 'Two weeks of readings teach the model what normal looks like for each room and timetable.'],
  [LineChart, 'Save and report', 'Alerts go live. Each month the report shows kWh, litres, rupees and CO₂ avoided.'],
];

export default function Plans() {
  const [exp, setExp] = useState(null);
  useEffect(() => { api.experiment().then(setExp).catch(() => setExp(null)); }, []);
  // share of the bill the simulated year saved (falls back to the published figure)
  const rate = exp ? exp.saved.rupees / exp.totals.before.rupees : 0.199;

  const [bill, setBill] = useState(19400);
  const [rooms, setRooms] = useState(8);
  const [blocks, setBlocks] = useState(1);
  const est = useMemo(() => {
    const kit = rooms * KIT[0][2] + blocks * (KIT[1][2] + KIT[2][2]);
    const monthSave = bill * rate;
    const fee = 1499 * blocks;
    const net = monthSave - fee;
    return { kit, monthSave, fee, net, payback: net > 0 ? kit / net : null, year2: net * 12 };
  }, [bill, rooms, blocks, rate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">For your campus</div>
          <h1 className="h-title mt-1">Find the waste in your own buildings</h1>
          <p className="h-sub max-w-2xl">ECOGUARD is sold per building block. A small sensor kit, a two-week learning period, then alerts that name the room, the cause, the cost and the fix.</p>
        </div>
        <About id="plans" points={[
          ["ECOGUARD is sold per building block: a sensor kit, two weeks of learning, then alerts with the room, cause, cost and fix.", "ECOGUARD हर बिल्डिंग ब्लॉक के हिसाब से बिकता है: सेंसर किट, दो हफ़्ते सीखना, फिर अलर्ट।"],
          ["Move the sliders to match your campus. The saving and payback are worked out from the simulated year's results.", "स्लाइडर अपने कैंपस के हिसाब से खिसकाएँ। बचत और पैसा वसूली सिम्युलेटेड साल के नतीजों से निकलते हैं।"],
        ]} />
        <Link to="/setup" className="btn-primary">Add your building <ArrowRight size={15} aria-hidden /></Link>
      </div>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Why campuses buy it">
        {[
          [PlugZap, 'One bill, no sub-meters', 'Most campus blocks pay one electricity bill and cannot see which room or which machine spends it.'],
          [Building2, 'Empty rooms, full power', 'Fixed timetables leave rooms empty for hours with lights, fans, ACs and PCs still on.'],
          [ShieldCheck, 'Hidden faults', 'A hot joint in a wall or a leak behind tiles shows up as a fire risk or a stain, months later.'],
        ].map(([Icon, t, d]) => (
          <div key={t} className="card card-pad">
            <Icon size={18} className="text-leaf-600" aria-hidden />
            <div className="mt-2 font-display text-[15px] font-semibold text-ink-900">{t}</div>
            <p className="mt-1 text-sm leading-relaxed text-ink-700">{d}</p>
          </div>
        ))}
      </section>

      <section className="card card-pad" aria-labelledby="calc-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="calc-h" className="font-display text-base font-semibold">What it could save you</h2>
          <DataSource kind="estimate" />
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <Field label="Monthly electricity bill for the block" suffix="₹" value={bill} set={setBill} min={2000} max={500000} step={500} />
            <Field label="Rooms in the block" value={rooms} set={setRooms} min={1} max={60} step={1} />
            <Field label="Blocks" value={blocks} set={setBlocks} min={1} max={50} step={1} />
            <p className="text-xs leading-relaxed text-ink-500">Uses the {num(rate * 100, 1)}% lower bill from the full simulated year of Academic Block A. Real results depend on the building, its timetable and how quickly alerts are acted on.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Out label="Saving per month" value={rs(est.monthSave)} tone="text-leaf-700" />
            <Out label="Software per month" value={rs(est.fee)} />
            <Out label="Sensor kit, one time" value={rs(est.kit)} />
            <Out label="Kit pays back in" value={est.payback ? `${num(est.payback, 1)} months` : 'not at this bill'} tone={est.payback && est.payback < 18 ? 'text-leaf-700' : 'text-ink-900'} />
            <div className="col-span-2 rounded-lg bg-night-900 p-4 text-white">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-leaf-300">From year two</div>
              <div className="readout mt-1 text-2xl">{rs(est.year2)} <span className="font-sans text-sm text-ink-300">kept every year, after the software fee</span></div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="plans-h">
        <h2 id="plans-h" className="font-display text-base font-semibold">Plans</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`card card-pad flex flex-col ${p.featured ? 'ring-2 ring-leaf-500' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-semibold">{p.name}</div>
                {p.featured && <span className="pill bg-leaf-50 text-leaf-700">Most chosen</span>}
              </div>
              <div className="mt-2"><span className="readout text-3xl">{p.price}</span> <span className="text-sm text-ink-500">{p.per}</span></div>
              <p className="mt-2 text-sm text-ink-700">{p.who}</p>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {p.items.map((i) => <li key={i} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-leaf-600" aria-hidden />{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-500">Launch prices for the pilot phase, before GST.</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="card card-pad" aria-labelledby="roll-h">
          <h2 id="roll-h" className="font-display text-base font-semibold">How a new block goes live</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map(([Icon, t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night-900 text-volt-300"><Icon size={16} aria-hidden /></span>
                <div>
                  <div className="font-display text-[15px] font-semibold"><span className="readout mr-2 text-xs text-leaf-600">0{i + 1}</span>{t}</div>
                  <p className="text-sm leading-relaxed text-ink-700">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="card card-pad" aria-labelledby="kit-h">
          <h2 id="kit-h" className="font-display text-base font-semibold">The sensor kit</h2>
          <ul className="mt-3 divide-y divide-ink-200">
            {KIT.map(([n, d, p, per]) => (
              <li key={n} className="flex items-start justify-between gap-3 py-2.5">
                <div><div className="text-sm font-medium text-ink-900">{n}</div><div className="text-xs text-ink-500">{d}</div></div>
                <div className="shrink-0 text-right"><div className="readout text-sm">{rs(p)}</div><div className="text-[11px] text-ink-500">{per}</div></div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">Off-the-shelf parts, no rewiring. Each block is one config file and one MQTT topic, so adding the next block adds no new code.</p>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, set, min, max, step, suffix }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-900">{label}</span>
      <div className="mt-1.5 flex items-center gap-3">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="flex-1 accent-leaf-600" />
        <div className="flex w-32 items-center rounded-lg border border-ink-300 bg-white px-2">
          {suffix && <span className="text-sm text-ink-500">{suffix}</span>}
          <input type="number" min={min} max={max} step={step} value={value} aria-label={label}
            onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="readout w-full bg-transparent py-1.5 pl-1 text-right text-sm outline-none" />
        </div>
      </div>
    </label>
  );
}

function Out({ label, value, tone = 'text-ink-900' }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
      <div className="label">{label}</div>
      <div className={`readout mt-1 text-xl ${tone}`}>{value}</div>
    </div>
  );
}
