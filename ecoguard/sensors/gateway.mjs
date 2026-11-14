// Sensor gateway: plays the part of the ESP32 nodes in the building.
// Every simulated 15 minutes it sends one reading per room node plus the
// water node to the backend, then carries out whatever commands come back
// (switch a room's relay off, stop the pump, close a valve, ...).
//
//   node gateway.mjs --api http://localhost:8000 --speed 2 --start 2026-04-14
//
// --speed: real seconds per 15-minute step (0 = as fast as possible)
import { Campus } from './sim/engine.js';
import { istDate, fmtIst } from './sim/clock.js';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith('--') ? [a.slice(2), all[i + 1]] : null).filter(Boolean));
const API = args.api || process.env.API_URL || 'http://localhost:8000';
let speed = Number(args.speed ?? 2);
const [y, m, d] = (args.start || '2026-04-13').split('-').map(Number);
const days = args.days ? Number(args.days) : Infinity;
const sim = new Campus({ seed: Number(args.seed || 7), start: istDate(y, m, d) });

export function toPayload(r) {
  return {
    ts: r.ts,
    temp_c: r.temp,
    grid_on: !r.cut,
    nodes: r.zones.map((z) => ({
      node: `esp32-${z.id}`, zone: z.id, people: z.occ, kwh: z.kwh, kw: z.kw,
      v_board: z.vdb, v_room: z.vroom, amps: z.amps, leak_ma: z.leakMa, source: 'sim',
    })),
    water: {
      floor_l: r.water.floorL, pump_on: r.water.pumpOn, pump_l: r.water.pumpL, pump_kwh: r.water.pumpKWh,
      tank_pct: r.water.tankPct, sump_pct: r.water.sumpPct, supply_on: r.water.supplyOn, overflow_l: r.water.overflowL,
    },
    // ground truth for the demo panel only; the detector never reads this
    sim: { active: r.active, waste_kwh: r.wasteKWh, waste_l: r.wasteL },
  };
}

export function apply(sim, cmd, log = console.log) {
  const p = cmd.params || {};
  switch (cmd.command) {
    case 'switch_off': sim.switchOff(cmd.target); break;
    case 'pump_off': sim.lockPump(cmd.target === 'TANK' ? 0.5 : 2); sim.enableInterlock(); break;
    case 'close_valve': sim.closeValve(Number(String(cmd.target).replace('F', ''))); break;
    case 'work_order': sim.workOrder(p.rule, cmd.target, p.due); break;
    case 'sim_inject': sim.inject(p.fault, p.target); break;
    case 'sim_cut': sim.forceCut(p.value || 60); break;
    case 'sim_fix': sim.fix(p.fault_id, 'fixed from dashboard'); break;
    case 'sim_speed': speed = Number(p.value); break;
    default: return;
  }
  log(`  -> ${cmd.command} ${cmd.target ?? ''}`);
}

async function post(body) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`${API}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return await res.json();
    } catch (e) {
      console.error(`ingest failed (${e.message}), retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('backend not reachable');
}

async function main() {
  console.log(`gateway -> ${API}, start ${args.start || '2026-04-13'}, ${speed}s per step`);
  const stop = sim.t + days * 86400000;
  while (sim.t < stop) {
    const r = sim.step();
    const res = await post(toPayload(r));
    if (res.commands?.length) {
      console.log(fmtIst(r.ts));
      for (const c of res.commands) apply(sim, c);
    }
    if (speed > 0) await new Promise((ok) => setTimeout(ok, speed * 1000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
