// Fault catalogue. Each fault is a small object the engine consults every step.
// "switchable" faults end when the room's relay is switched off.
// "endWhenOccupied" faults end when people walk back in (they notice).
import { STEP_MS, ist, istDate } from './clock.js';

const H = 3600000, D = 24 * H;

export const FAULT_TYPES = {
  lights_left_on: { label: 'Lights and fans left on in empty room', kind: 'energy', scope: 'zone' },
  ac_left_on:     { label: 'AC left running after class', kind: 'energy', scope: 'zone' },
  pcs_left_on:    { label: 'Lab PCs left on overnight', kind: 'energy', scope: 'zone' },
  heater_left_on: { label: 'Room heater left on', kind: 'energy', scope: 'zone' },
  overcool:       { label: 'AC overcooling (door open / 16 deg setpoint)', kind: 'energy', scope: 'zone' },
  comeback:       { label: 'Loads restarted in empty room after power cut', kind: 'energy', scope: 'zone' },
  loose_joint:    { label: 'Heat in the wall: loose joint / failing wire', kind: 'hidden', scope: 'zone' },
  leak:           { label: 'Pipe leak (possibly inside wall)', kind: 'water', scope: 'floor' },
  cistern:        { label: 'Running toilet cistern', kind: 'water', scope: 'floor' },
  float_fail:     { label: 'Tank overflow: float switch stuck', kind: 'water', scope: 'tank' },
  dry_run:        { label: 'Pump running dry (sump empty)', kind: 'water', scope: 'pump' },
};

// next time the guard does a round (10 pm), or next morning 8 am
function guardRound(ms) {
  const t = ist(ms);
  const tonight = istDate(t.y, t.m, t.day, 22, 0);
  if (ms < tonight - 2 * H) return tonight;
  return istDate(t.y, t.m, t.day, 8, 0) + D;
}
function nextMorning(ms) {
  const t = ist(ms);
  let m = istDate(t.y, t.m, t.day, 9, 0) + D;
  // labs closed on weekend: PCs left Friday evening run till Monday
  const dow = ist(m).dow;
  if (dow === 6) m += 2 * D;
  if (dow === 0) m += D;
  return m;
}

export function makeFault(type, target, sim, rng) {
  const now = sim.t;
  const base = { type, target, start: now, wasteKWh: 0, wasteL: 0, label: FAULT_TYPES[type]?.label };
  switch (type) {
    case 'lights_left_on':
      return { ...base, switchable: true, endWhenOccupied: true, until: rng.chance(0.5) ? guardRound(now) : nextMorning(now), flags: () => ({ lights: true, fans: true }) };
    case 'ac_left_on':
      const lightsToo = rng.chance(0.5);
      return { ...base, switchable: true, endWhenOccupied: true, until: rng.chance(0.6) ? guardRound(now) : nextMorning(now), flags: () => ({ ac: true, lights: lightsToo }) };
    case 'pcs_left_on':
      return { ...base, switchable: true, endWhenOccupied: true, until: nextMorning(now), flags: () => ({ pcs: true }) };
    case 'heater_left_on':
      return { ...base, switchable: true, endWhenOccupied: true, until: nextMorning(now), flags: () => ({ heater: true }) };
    case 'overcool':
      return { ...base, switchable: false, until: now + rng.int(4, 10) * H, flags: (s, z) => (z.occ > 0 ? { overcool: true } : {}) };
    case 'comeback':
      return { ...base, switchable: true, endWhenOccupied: true, until: guardRound(now), flags: () => ({ lights: true, fans: true, ac: true }) };
    case 'loose_joint': {
      // contact resistance creeps up over 1-4 weeks, then stays until an electrician tightens it
      const ramp = rng.int(7, 28) * D;
      const rMax = rng.range(0.35, 0.9);
      return { ...base, until: now + ramp + rng.int(10, 30) * D, rMax, rNow: (ms) => rMax * Math.min(1, (ms - now) / ramp) ** 1.5 };
    }
    case 'leak': {
      const floor = Number(String(target).replace('F', ''));
      const inWall = rng.chance(0.6);
      // damp wall raises earth-leakage current slowly after ~1.5 days
      return { ...base, floor, inWall, lpm: rng.range(0.4, 2.5), until: now + rng.int(6, 20) * D,
        dampMa: (ms) => Math.max(0, Math.min(55, ((ms - now - 36 * H) / D) * 6)) };
    }
    case 'cistern': {
      const floor = Number(String(target).replace('F', ''));
      return { ...base, floor, lpm: rng.range(0.15, 0.45), until: now + rng.int(2, 6) * D };
    }
    case 'float_fail':
      return { ...base, until: now + rng.int(1, 4) * D };
    case 'dry_run':
      // sump inlet valve left closed after cleaning + low-level cut-off failed:
      // the sump drains and the pump keeps running with no water
      sim.water.sump = Math.min(sim.water.sump, 1500);
      return { ...base, until: now + rng.int(1, 3) * D };
    default:
      return null;
  }
}
