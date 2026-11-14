// Generate a year of simulated meter data as CSV files for training.
//   node tools/generate.mjs [days] [seed]
import fs from 'node:fs';
import path from 'node:path';
import { Campus } from './sim/engine.js';
import { istDate, fmtIst } from './sim/clock.js';
import { plannedOccupancy } from './sim/schedule.js';
import { normalTempAt } from './sim/climate.js';
import { ZONES } from './sim/campus.js';

const days = Number(process.argv[2] || 365);
const seed = Number(process.argv[3] || 11);
const outDir = path.resolve(process.env.DATA_DIR || '../data');
fs.mkdirSync(outDir, { recursive: true });

const sim = new Campus({ seed, start: istDate(2025, 7, 1) });
const zoneRows = ['ts,zone,occ,occ_plan,temp,temp_norm,kwh,vdb,vroom,amps,leak_ma,t_in,rh,ac_kw,cut'];
const waterRows = ['ts,temp,f0_l,f1_l,f2_l,pump_on,pump_l,pump_kwh,tank_pct,sump_pct,overflow_l,supply_on,cut'];
const truthRows = ['ts,fault_id,type,target'];
const steps = days * 96;
for (let i = 0; i < steps; i++) {
  const r = sim.step();
  const ts = fmtIst(r.ts);
  const tn = normalTempAt(r.ts).toFixed(2);
  for (const z of r.zones) zoneRows.push([ts, z.id, z.occ, plannedOccupancy(ZONES.find((q) => q.id === z.id), r.ts), r.temp, tn, z.kwh, z.vdb, z.vroom, z.amps, z.leakMa, z.tin, z.rh, z.acKw, r.cut ? 1 : 0].join(','));
  const w = r.water;
  waterRows.push([ts, r.temp, ...w.floorL, w.pumpOn ? 1 : 0, w.pumpL, w.pumpKWh, w.tankPct, w.sumpPct, w.overflowL, w.supplyOn ? 1 : 0, r.cut ? 1 : 0].join(','));
  for (const a of r.active) truthRows.push([ts, a.id, a.type, a.target].join(','));
}
const faults = ['fault_id,type,target,start,end,ended_by,waste_kwh,waste_l'];
for (const f of [...sim.closed, ...sim.faults]) {
  faults.push([f.id, f.type, f.target, fmtIst(f.start), f.end ? fmtIst(f.end) : '', f.endedBy || 'open', f.wasteKWh.toFixed(2), f.wasteL.toFixed(0)].join(','));
}
fs.writeFileSync(path.join(outDir, 'zones.csv'), zoneRows.join('\n'));
fs.writeFileSync(path.join(outDir, 'water.csv'), waterRows.join('\n'));
fs.writeFileSync(path.join(outDir, 'truth_steps.csv'), truthRows.join('\n'));
fs.writeFileSync(path.join(outDir, 'faults.csv'), faults.join('\n'));
console.log(`wrote ${steps} steps, ${faults.length - 1} faults to ${outDir}`);
