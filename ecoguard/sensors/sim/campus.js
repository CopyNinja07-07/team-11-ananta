// The building we simulate: one academic block, three floors, with
// classrooms, a computer lab and offices. The numbers live in
// config/campus.json so the backend and the sensors share one asset register.
//
// Zone fields:
// kind: 'class' | 'lab' | 'office'
// lightW: total lighting load (LED tube lights)
// fans: ceiling fans (~60 W each)
// acKW / acUnits: split ACs, rated electrical input per unit
// pcs: desktop PCs (lab) or staff PCs (office)
// heaterW: room heater used in Jammu winter (offices only)
// standbyW: things that never switch off (router, CCTV, chargers, projector standby)
// inverter: true if the room's lights/fans/PCs stay on during power cuts
// rWire: round-trip resistance of the room's supply circuit (ohm), measured at commissioning
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../../config/campus.json', import.meta.url), 'utf8'));

export const BUILDING = cfg.building;
export const ZONES = cfg.zones;
export const FLOORS = cfg.building.floors;
export const WATER = cfg.water;
export const TARIFF = cfg.tariff;
export const BREAKS = cfg.breaks;
export const HOLIDAYS = new Set(cfg.holidays);

export function isBreak(dateKey) {
  return BREAKS.some(([a, b]) => dateKey >= a && dateKey <= b);
}
