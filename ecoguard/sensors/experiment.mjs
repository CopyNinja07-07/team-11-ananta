// Before vs after: the same block, same days, same people, same weather,
// same power cuts and the same faults, run twice.
//   BEFORE: nobody watching. Faults run until someone happens to notice.
//   AFTER:  readings go to the ECOGUARD backend, which detects, advises,
//           switches relays and raises maintenance tickets.
// Start a fresh backend first (empty database), then:
//   node experiment.mjs --api http://localhost:8000 --start 2026-01-05 --days 91
import fs from 'node:fs';
import { Campus } from './sim/engine.js';
import { istDate, ist } from './sim/clock.js';
import { FAULT_TYPES } from './sim/faults.js';
import { TARIFF, WATER } from './sim/campus.js';
import { toPayload, apply } from './gateway.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : null).filter(Boolean));
const API = args.api || 'http://localhost:8000';
const days = Number(args.days || 91);
const seed = Number(args.seed || 7);
const [y, m, d] = (args.start || '2026-01-05').split('-').map(Number);
const start = istDate(y, m, d);

const before = new Campus({ seed, start });
const after = new Campus({ seed, start });
const daily = {};
const day = (ts) => (daily[ist(ts).dateKey] ||= { before: blank(), after: blank() });
function blank() { return { kwh: 0, litres: 0, waste_kwh: 0, waste_l: 0, overflow_l: 0, pump_kwh: 0 }; }
function add(acc, r) {
  acc.kwh += r.totalKWh;
  acc.litres += r.water.demandL + r.water.overflowL;
  acc.overflow_l += r.water.overflowL;
  acc.pump_kwh += r.water.pumpKWh;
  acc.waste_kwh += r.wasteKWh;
  acc.waste_l += r.wasteL;
}

let comfortViolations = 0;   // times the system cut power to a room with people in it
const t0 = Date.now();
for (let i = 0; i < days * 96; i++) {
  const ra = before.step();
  const rb = after.step();
  add(day(ra.ts).before, ra);
  add(day(rb.ts).after, rb);
  const res = await fetch(`${API}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(toPayload(rb)) }).then((x) => x.json());
  for (const c of res.commands || []) {
    if (c.command === 'switch_off' && after.zones.find((z) => z.id === c.target)?.occ > 0) comfortViolations++;
    apply(after, c, () => {});
  }
  if (i % 960 === 0) console.log(`day ${i / 96} / ${days}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

const sum = (k, side) => Object.values(daily).reduce((s, x) => s + x[side][k], 0);
const faultTable = (sim) => {
  const out = {};
  for (const f of [...sim.closed, ...sim.faults]) {
    const o = (out[f.type] ||= { label: FAULT_TYPES[f.type].label, count: 0, waste_kwh: 0, waste_l: 0 });
    o.count++; o.waste_kwh += f.wasteKWh; o.waste_l += f.wasteL;
  }
  return out;
};
const fb = faultTable(before), fa = faultTable(after);
const rupees = (kwh, l) => kwh * TARIFF.rsPerKWh + (l / 1000) * TARIFF.rsPerKL;
const totals = {};
for (const side of ['before', 'after']) {
  totals[side] = {
    kwh: Math.round(sum('kwh', side)), litres: Math.round(sum('litres', side)),
    waste_kwh: Math.round(sum('waste_kwh', side)), waste_l: Math.round(sum('waste_l', side)),
    overflow_l: Math.round(sum('overflow_l', side)), pump_kwh: Math.round(sum('pump_kwh', side)),
  };
  totals[side].rupees = Math.round(rupees(totals[side].kwh, totals[side].litres));
  totals[side].co2_kg = Math.round(totals[side].kwh * TARIFF.kgCO2PerKWh);
}
const saved = {
  kwh: totals.before.kwh - totals.after.kwh,
  litres: totals.before.litres - totals.after.litres,
  rupees: totals.before.rupees - totals.after.rupees,
  co2_kg: totals.before.co2_kg - totals.after.co2_kg,
};
saved.kwh_pct = +((saved.kwh / totals.before.kwh) * 100).toFixed(1);
saved.litres_pct = +((saved.litres / totals.before.litres) * 100).toFixed(1);
saved.per_year_rupees = Math.round((saved.rupees / days) * 365);
const result = {
  seed, start: args.start || '2026-01-05', days, tariff: TARIFF, comfort_violations: comfortViolations,
  totals, saved,
  by_fault: Object.fromEntries(Object.keys({ ...fb, ...fa }).map((k) => [k, {
    label: (fb[k] || fa[k]).label, count: (fb[k] || fa[k]).count,
    before_kwh: +(fb[k]?.waste_kwh || 0).toFixed(1), after_kwh: +(fa[k]?.waste_kwh || 0).toFixed(1),
    before_l: Math.round(fb[k]?.waste_l || 0), after_l: Math.round(fa[k]?.waste_l || 0),
  }])),
  daily: Object.entries(daily).map(([date, v]) => ({ date, before_kwh: +v.before.kwh.toFixed(2), after_kwh: +v.after.kwh.toFixed(2), before_l: Math.round(v.before.litres), after_l: Math.round(v.after.litres) })),
};
const out = new URL('../models/before_after.json', import.meta.url);
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ totals, saved, comfortViolations }, null, 1));
