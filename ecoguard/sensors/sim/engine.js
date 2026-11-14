// The simulator. Each call to step() moves the building forward 15 minutes
// and returns what the meters would read, plus the "ground truth" of which
// faults were active (the detector never sees the truth, only the readings).
import { makeRng, hashSeed } from './rng.js';
import { STEP_MS, ist } from './clock.js';
import { Weather } from './climate.js';
import { ZONES, FLOORS, WATER } from './campus.js';
import { actualOccupancy, isTeachingDay, isOfficeDay } from './schedule.js';
import { FAULT_TYPES, makeFault } from './faults.js';

const HOURS = STEP_MS / 3600000; // 0.25 h

export class Campus {
  constructor({ seed = 11, start, autoFaults = true, faultRate = 1 } = {}) {
    // Every random draw comes from a stream keyed by (seed, time, purpose).
    // So two runs with the same seed see the same people, weather, power cuts
    // and faults, even if one of them switches things off. That is what makes
    // a fair before-vs-after comparison possible.
    this.seed = seed;
    this.rng = makeRng(seed);
    this.weather = new Weather(makeRng(seed + 1));
    this.t = start;
    this.autoFaults = autoFaults;
    this.faultRate = faultRate;
    this.zones = ZONES.map((z) => ({ ...z, occ: 0, prevOcc: 0, loadsOnAtCut: false, relayOffUntilOcc: false }));
    this.water = { tank: WATER.tankL * 0.7, sump: WATER.sumpL * 0.6, pumpOn: false, supplyOffToday: false, day: null };
    this.cut = null;             // { until } when grid power is off
    this.battery = {};           // inverter energy debt per zone (Wh) to be recharged after a cut
    this.faults = [];            // active faults
    this.natural = [];           // when each fault would have ended on its own (blocks re-spawning)
    this.closed = [];            // finished faults (ground truth log)
    this.nextFaultId = 1;
    this.cutsToday = 0;
  }

  // ---------- controls used by the dashboard ----------
  inject(type, target) {
    const f = makeFault(type, target, this, makeRng(hashSeed(this.seed, this.t, 'inject', type, target)));
    if (!f) return null;
    f.id = this.nextFaultId++;
    f.manual = true;
    this.natural.push({ type, target, until: f.until });
    this.faults.push(f);
    return f;
  }
  // Relay switch-off: cuts the room's non-essential loads until people come back.
  switchOff(zoneId) {
    const z = this.zones.find((x) => x.id === zoneId);
    if (!z) return 0;
    z.relayOffUntilOcc = true;
    let n = 0;
    for (const f of this.faults) if (f.target === zoneId && f.switchable) { this.endFault(f, 'switched off'); n++; }
    return n;
  }
  // Maintenance fix (plumber / electrician), or closing a floor isolation valve.
  fix(faultId, how = 'repaired') {
    const f = this.faults.find((x) => x.id === faultId);
    if (f) this.endFault(f, how);
    return !!f;
  }
  // Pump relay: keep the pump off for a while (overflow / dry-run response).
  lockPump(hours = 2) {
    this.water.lockUntil = this.t + hours * 3600000;
  }
  // Smart valve on a floor's branch line: stops a leak's water loss right away.
  closeValve(floor) {
    let n = 0;
    for (const f of this.faults) if ((f.type === 'leak' || f.type === 'cistern') && f.floor === floor) { f.isolated = true; n++; }
    return n;
  }
  // Maintenance ticket: at `due`, the electrician / plumber fixes whatever matches.
  workOrder(rule, target, due) {
    (this.tickets ||= []).push({ rule, target, due });
  }
  runTickets() {
    if (!this.tickets) return;
    const MATCH = { wall_heat: ['loose_joint'], earth_leak: ['leak'], night_flow: ['leak', 'cistern'], overflow: ['float_fail'], dry_run: ['dry_run'] };
    for (const tk of this.tickets.filter((x) => x.due <= this.t)) {
      for (const f of [...this.faults]) {
        const types = MATCH[tk.rule] || [];
        const sameTarget = f.target === tk.target || `F${f.floor}` === tk.target;
        if (types.includes(f.type) && sameTarget) this.endFault(f, 'fixed by maintenance');
      }
    }
    this.tickets = this.tickets.filter((x) => x.due > this.t);
  }
  forceCut(minutes = 90) {
    if (!this.cut) this.startCut(minutes);
  }

  endFault(f, how) {
    f.end = this.t;
    f.endedBy = how;
    this.faults = this.faults.filter((x) => x !== f);
    this.closed.push(f);
  }

  startCut(minutes) {
    this.cut = { from: this.t, until: this.t + minutes * 60000 };
    for (const z of this.zones) z.loadsOnAtCut = z.occ > 0;
  }

  // ---------- one 15-minute step ----------
  step() {
    const t = ist(this.t);
    const R = (tag) => makeRng(hashSeed(this.seed, this.t, tag));
    const rng = R('meter');
    const cutRng = R('cut');
    const occRng = R('occ');
    const temp = this.weather.tempAt(this.t);
    const out = { ts: this.t, temp: +temp.toFixed(2), zones: [], water: null, cut: false, restored: false };

    // --- grid power cuts (JPDCL style: more in summer and winter peaks, mostly evenings)
    if (t.h === 0 && t.min === 0) this.cutsToday = 0;
    if (!this.cut) {
      const season = [6, 7, 12, 1].includes(t.m) ? 1.8 : 1;
      const hourW = t.h >= 9 && t.h < 22 ? 1.2 : 0.4;
      if (this.cutsToday < 3 && cutRng.chance(0.012 * season * hourW)) {
        this.startCut(cutRng.pick([30, 45, 60, 60, 90, 120]));
        this.cutsToday++;
      }
    }
    let restoredNow = false;
    if (this.cut && this.t >= this.cut.until) {
      this.cut = null;
      restoredNow = true;
      out.restored = true;
    }
    out.cut = !!this.cut;

    // --- people
    for (const z of this.zones) {
      z.prevOcc = z.occ;
      z.occ = actualOccupancy(z, this.t, occRng);
      if (z.occ > 0) z.relayOffUntilOcc = false;
    }

    this.runTickets();

    // --- random faults (only when autoFaults is on)
    if (this.autoFaults) this.spawnFaults(t, temp, restoredNow);

    // --- grid voltage: sags in the evening peak, high at night
    const vBase = 232 - (t.h >= 18 && t.h < 23 ? 14 : 0) + (t.h >= 0 && t.h < 6 ? 8 : 0) - ([5, 6, 7].includes(t.m) ? 4 : 0);
    const vdb = vBase + rng.normal(0, 2.2);

    // --- electrical loads per room
    let wasteKWh = 0, wasteL = 0;
    for (const z of this.zones) {
      const flags = {};
      for (const f of this.faults) if (f.target === z.id && f.flags) Object.assign(flags, f.flags(this, z));
      const normal = roomLoad(z, temp, t, {}, false);
      let p = roomLoad(z, temp, t, flags, z.relayOffUntilOcc);
      // power cut: only inverter-backed rooms keep running, and the grid meter reads ~0
      let onInverter = 0;
      if (this.cut) {
        if (z.inverter) {
          const essential = p.light + p.fan + p.plug;
          onInverter = essential;
          this.battery[z.id] = (this.battery[z.id] || 0) + essential * 1.18 * HOURS; // inverter + battery losses
        }
        p = { light: 0, fan: 0, ac: 0, heat: 0, plug: 0, standby: 0, total: 0 };
      }
      // after the cut: the inverter recharges, which is energy the grid pays for later
      let recharge = 0;
      if (!this.cut && (this.battery[z.id] || 0) > 0) {
        recharge = Math.min(600, this.battery[z.id] / HOURS);
        this.battery[z.id] -= recharge * HOURS;
      }
      const loadW = p.total + recharge;

      // wiring: current, voltage drop, I^2R heat inside walls
      let rJoint = 0, leakMa = 2 + rng.next() * 3;
      for (const f of this.faults) {
        if (f.type === 'loose_joint' && f.target === z.id) rJoint += f.rNow(this.t);
        if (f.type === 'leak' && f.inWall && f.floor === z.floor) leakMa += f.dampMa(this.t);
      }
      const rTot = z.rWire + rJoint;
      const amps = loadW / (vdb * 0.92);
      const vroom = vdb - amps * rTot;
      const lossW = amps * amps * rTot;
      const kwh = ((loadW + lossW) * HOURS) / 1000;

      // ground truth waste in this room this step
      const extraW = Math.max(0, p.total - (this.cut ? 0 : normal.total));
      const jointW = amps * amps * rJoint;
      for (const f of this.faults) {
        if (f.target !== z.id) continue;
        if (f.type === 'loose_joint') f.wasteKWh += (jointW * HOURS) / 1000;
        else if (f.flags) f.wasteKWh += (extraW * HOURS) / 1000 / Math.max(1, this.faults.filter((g) => g.target === z.id && g.flags).length);
      }
      wasteKWh += ((extraW + jointW) * HOURS) / 1000;

      out.zones.push({
        id: z.id, occ: this.cut && !z.inverter ? z.occ : z.occ, kw: +((loadW + lossW) / 1000).toFixed(3),
        kwh: +kwh.toFixed(4), vdb: +vdb.toFixed(2), vroom: +(vroom + rng.normal(0, 0.15)).toFixed(2),
        amps: +amps.toFixed(3), leakMa: +leakMa.toFixed(1), lossW: +lossW.toFixed(1), inverterW: Math.round(onInverter),
        parts: { light: p.light, fan: p.fan, ac: Math.round(p.ac), heat: p.heat, plug: Math.round(p.plug), standby: p.standby, recharge: Math.round(recharge) },
        relayOff: z.relayOffUntilOcc,
      });
    }

    // --- water
    const w = this.waterStep(t, R('water'));
    wasteKWh += w.wasteKWh;
    wasteL += w.wasteL;
    out.water = w.reading;

    // close faults that have run their course
    for (const f of [...this.faults]) {
      if (f.until && this.t >= f.until) this.endFault(f, 'ended');
      else if (f.endWhenOccupied) {
        const z = this.zones.find((x) => x.id === f.target);
        if (z && z.occ > 0) this.endFault(f, 'people returned');
      }
    }

    out.active = this.faults.map((f) => ({ id: f.id, type: f.type, target: f.target, start: f.start, manual: !!f.manual }));
    out.wasteKWh = +wasteKWh.toFixed(4);
    out.wasteL = +wasteL.toFixed(1);
    out.totalKWh = +(out.zones.reduce((s, z) => s + z.kwh, 0) + w.reading.pumpKWh).toFixed(4);
    this.t += STEP_MS;
    return out;
  }

  waterStep(t, rng) {
    const W = this.water;
    let wasteKWh = 0, wasteL = 0;
    if (W.day !== t.dateKey) {
      W.day = t.dateKey;
      W.supplyOffToday = rng.chance([5, 6].includes(t.m) ? 0.22 : 0.12);
    }
    // municipal supply into the sump
    // a blocked sump inlet (dry_run fault) means the supply never reaches the sump
    const inletBlocked = this.faults.some((f) => f.type === 'dry_run');
    const supplyOn = !W.supplyOffToday && !inletBlocked && WATER.supplyWindows.some(([a, b]) => t.hour >= a && t.hour < b);
    const inflow = supplyOn ? Math.min(WATER.supplyLpm * 15, WATER.sumpL - W.sump) : 0;
    W.sump += inflow;

    // washroom use per floor
    const floorL = FLOORS.map((fl) => {
      const people = this.zones.filter((z) => z.floor === fl.id).reduce((s, z) => s + z.occ, 0);
      let l = people * WATER.litresPerPersonHour * HOURS * (0.8 + 0.4 * rng.next());
      if (t.h === 8 && t.min === 0 && (isTeachingDay(t) || isOfficeDay(t))) l += WATER.cleaningL;
      return l;
    });
    for (const f of this.faults) {
      if ((f.type === 'leak' || f.type === 'cistern') && !f.isolated) {
        const l = f.lpm * 15;
        floorL[f.floor] += l;
        f.wasteL += l;
        wasteL += l;
      }
    }
    const demand = floorL.reduce((a, b) => a + b, 0);
    W.tank = Math.max(0, W.tank - demand);

    // pump with float switch; faults can break the float or the sump cut-off
    const floatFail = this.faults.find((f) => f.type === 'float_fail');
    const sumpFail = this.faults.find((f) => f.type === 'dry_run');
    const tankPct = (W.tank / WATER.tankL) * 100;
    const sumpPct = (W.sump / WATER.sumpL) * 100;
    if (!W.pumpOn && tankPct < WATER.pumpOnPct) W.pumpOn = true;
    if (W.pumpOn && tankPct >= WATER.pumpOffPct && !floatFail) W.pumpOn = false;
    if (W.pumpOn && sumpPct < 3 && !sumpFail) W.pumpOn = false;
    if (floatFail && W.pumpOn && tankPct >= 99) {
      floatFail.overrunMin = (floatFail.overrunMin || 0) + 15;
      if (floatFail.overrunMin > 90) { W.pumpOn = false; floatFail.overrunMin = 0; } // someone notices water pouring off the roof
    }
    const running = W.pumpOn && !this.cut && !(W.lockUntil > this.t);
    let pumped = 0, pumpKWh = 0, overflow = 0;
    if (running) {
      // a working float switch stops the pump as soon as the tank reaches the cut-off level
      const room = floatFail ? Infinity : Math.max(0, (WATER.tankL * WATER.pumpOffPct) / 100 - W.tank);
      pumped = Math.min(WATER.pumpLpm * 15, W.sump, room);
      W.sump -= pumped;
      W.tank += pumped;
      // a pump with no water still draws ~75% power (and wears out)
      pumpKWh = WATER.pumpKW * HOURS * (pumped > 0 ? Math.min(1, 0.15 + pumped / (WATER.pumpLpm * 15)) : 0.75) * (0.97 + 0.06 * rng.next());
      if (pumped < 1 && sumpFail) { sumpFail.wasteKWh += pumpKWh; wasteKWh += pumpKWh; }
      if (W.tank > WATER.tankL) {
        overflow = W.tank - WATER.tankL;
        W.tank = WATER.tankL;
        if (floatFail) {
          floatFail.wasteL += overflow;
          floatFail.wasteKWh += pumpKWh * (overflow / Math.max(pumped, 1));
          wasteL += overflow;
          wasteKWh += pumpKWh * (overflow / Math.max(pumped, 1));
        }
      }
    }
    return {
      wasteKWh, wasteL,
      reading: {
        floorL: floorL.map((x) => +x.toFixed(1)), demandL: +demand.toFixed(1),
        supplyOn, inflowL: +inflow.toFixed(0), pumpOn: running, pumpL: +pumped.toFixed(0),
        pumpKWh: +pumpKWh.toFixed(4), overflowL: +overflow.toFixed(0),
        tankPct: +((W.tank / WATER.tankL) * 100).toFixed(1), sumpPct: +((W.sump / WATER.sumpL) * 100).toFixed(1),
      },
    };
  }

  spawnFaults(t, temp, restoredNow) {
    const rng = makeRng(hashSeed(this.seed, this.t, 'fault'));
    const k = this.faultRate;
    this.natural = this.natural.filter((n) => n.until > this.t);
    const add = (type, target) => {
      // don't start a fault that, left alone, would still be running from before
      if (this.natural.some((n) => n.type === type && n.target === target)) return;
      if (this.faults.some((f) => f.type === type && f.target === target)) return;
      const f = makeFault(type, target, this, makeRng(hashSeed(this.seed, this.t, type, target)));
      if (f) {
        f.id = this.nextFaultId++;
        this.faults.push(f);
        this.natural.push({ type, target, until: f.until });
      }
    };
    for (const z of this.zones) {
      const leftRoom = z.prevOcc > 0 && z.occ === 0;
      if (leftRoom && !this.cut) {
        const evening = t.hour >= 16;
        if (z.kind !== 'lab' && rng.chance((evening ? 0.12 : 0.04) * k)) add('lights_left_on', z.id);
        if (z.acUnits && temp > 28 && rng.chance((evening ? 0.08 : 0.03) * k)) add('ac_left_on', z.id);
        if (z.kind === 'lab' && evening && rng.chance(0.22 * k)) add('pcs_left_on', z.id);
        if (z.heaterW && temp < 13 && evening && rng.chance(0.1 * k)) add('heater_left_on', z.id);
      }
      if (z.acUnits && z.occ > 0 && temp > 31 && rng.chance(0.0025 * k)) add('overcool', z.id);
      // comeback waste: power returns, room was in use when the cut started, now empty
      if (restoredNow && z.loadsOnAtCut && z.occ === 0 && !z.inverter && rng.chance(0.6)) add('comeback', z.id);
    }
    // slow, rarer faults (per 15 min step)
    const perDay = (n) => (n / 96) * k;
    if (rng.chance(perDay(1 / 50))) add('loose_joint', rng.pick(this.zones).id);
    if (rng.chance(perDay(1 / 35))) add('leak', `F${rng.int(0, 2)}`);
    if (rng.chance(perDay(1 / 18))) add('cistern', `F${rng.int(0, 2)}`);
    if (rng.chance(perDay(1 / 40))) add('float_fail', 'TANK');
    if (rng.chance(perDay(1 / 45))) add('dry_run', 'PUMP');
  }
}

// Power drawn by one room (W), split by end use.
// flags (from faults) can force things on; relayOff forces everything off.
export function roomLoad(z, temp, t, flags, relayOff) {
  const occ = z.occ;
  const on = occ > 0;
  const p = { light: 0, fan: 0, ac: 0, heat: 0, plug: 0, standby: z.standbyW, total: 0 };
  if (relayOff && !on) { p.total = p.standby; return p; }
  const daylit = z.kind === 'class' && t.hour >= 10 && t.hour < 15;
  if (on || flags.lights) p.light = Math.round(z.lightW * (daylit ? 0.7 : 1));
  if ((on && temp >= 25) || flags.fans) p.fan = Math.round(z.fans * 60 * Math.min(1, Math.max(0.5, (temp - 22) / 6)));
  const acNeed = Math.min(1, Math.max(0.4, (temp - 24) / 14));
  if (z.acUnits && ((on && temp >= 30) || flags.ac)) p.ac = z.acUnits * z.acKW * 1000 * (flags.overcool ? 1.0 : acNeed) * (flags.overcool ? 1.25 : 1);
  if (z.heaterW && ((on && temp < 13) || flags.heater)) p.heat = z.heaterW;
  if (z.kind === 'lab') p.plug = on ? Math.min(occ, z.pcs) * 95 : (flags.pcs ? z.pcs * 62 : 0);
  else if (z.kind === 'office') p.plug = on ? occ * 70 + 60 : (flags.pcs ? z.pcs * 45 : 0);
  else p.plug = on ? 220 : 0; // projector
  p.total = p.light + p.fan + p.ac + p.heat + p.plug + p.standby;
  return p;
}
