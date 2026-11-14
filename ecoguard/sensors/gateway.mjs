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
      v_board: z.vdb, v_room: z.vroom, amps: z.amps, leak_ma: z.leakMa, t_in: z.tin, rh: z.rh, ac_kw: z.acKw, source: 'sim',
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
    case 'ac_setpoint': sim.setAcSetpoint(cmd.target); break;
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

// Fail-safe: what each ESP32 node does on its own when the server or the network is down.
// Simple, predictable rules that cannot hurt anyone: a room empty for an hour has its
// non-essential loads cut; the pump obeys the tank and sump level sensors.
const emptyFor = {};
export function localSafeRules(sim, r, log = console.log) {
  for (const z of r.zones) {
    emptyFor[z.id] = z.occ === 0 ? (emptyFor[z.id] || 0) + 1 : 0;
    const standby = sim.zones.find((q) => q.id === z.id).standbyW / 1000;
    if (emptyFor[z.id] >= 4 && z.kw > standby + 0.1 && !z.relayOff) {
      sim.switchOff(z.id);
      log(`  [local rule] ${z.id} empty for 1 h -> relay off`);
    }
  }
  if (r.water.tankPct >= 98 || r.water.sumpPct < 3) {
    sim.lockPump(1);
    sim.enableInterlock();
  }
}

async function post(body) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${API}/api/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      return await res.json();
    } catch (e) {
      console.error(`ingest failed (${e.message}), retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;   // server down: the caller falls back to local rules
}

// MQTT transport (as on the real ESP32 nodes): --mqtt mqtt://broker:1883
async function mqttTransport(url) {
  const { connectAsync } = await import('mqtt');
  const client = await connectAsync(url, { clientId: `ecoguard-gateway-${process.pid}` });
  const waiting = new Map();
  await client.subscribeAsync('ecoguard/block-a/commands', { qos: 1 });
  client.on('message', (_t, buf) => {
    const msg = JSON.parse(buf.toString());
    waiting.get(msg.ts)?.(msg);
    waiting.delete(msg.ts);
  });
  return async (body) => {
    const reply = new Promise((ok) => { waiting.set(body.ts, ok); setTimeout(() => { waiting.delete(body.ts); ok({ commands: [] }); }, 3000); });
    try { await client.publishAsync('ecoguard/block-a/readings', JSON.stringify(body), { qos: 1 }); } catch { return null; }
    return reply;   // the backend answers every reading; no answer in 3 s counts as none
  };
}

async function main() {
  const send = args.mqtt ? await mqttTransport(args.mqtt) : post;
  console.log(`gateway -> ${args.mqtt || API}, start ${args.start || '2026-04-13'}, ${speed}s per step`);
  const stop = sim.t + days * 86400000;
  while (sim.t < stop) {
    const r = sim.step();
    const res = await send(toPayload(r));
    if (!res) {
      console.log(`${fmtIst(r.ts)} server unreachable, running local safe rules`);
      localSafeRules(sim, r);
    } else if (res.commands?.length) {
      console.log(fmtIst(r.ts));
      for (const c of res.commands) apply(sim, c);
    }
    if (speed > 0) await new Promise((ok) => setTimeout(ok, speed * 1000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
