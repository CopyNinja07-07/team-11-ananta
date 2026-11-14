// Jammu climate, based on IMD climate normals for Jammu (1991-2020, rounded).
// [mean daily min, mean daily max] in deg C for Jan..Dec.
import { ist } from './clock.js';

export const JAMMU_NORMALS = [
  [7.5, 18.6], [10.1, 21.6], [14.3, 26.6], [19.3, 33.1], [23.8, 38.3], [26.3, 39.9],
  [25.6, 34.9], [25.1, 33.5], [23.2, 33.4], [17.8, 31.1], [11.8, 26.2], [8.2, 21.0],
];

// Interpolate monthly normals so there is no jump on the 1st of each month.
function normalsFor(t) {
  const mid = (t.day - 15) / 30;               // -0.5 .. +0.5 around mid-month
  const i = t.m - 1;
  const j = (i + (mid >= 0 ? 1 : 11)) % 12;
  const w = Math.abs(mid);
  const a = JAMMU_NORMALS[i], b = JAMMU_NORMALS[j];
  return [a[0] * (1 - w) + b[0] * w, a[1] * (1 - w) + b[1] * w];
}

// Weather keeps a slow random "anomaly" so some days are hotter than normal
// (heat waves) and some cooler (western disturbance rain), like real weather.
export class Weather {
  constructor(rng) {
    this.rng = rng;
    this.anomaly = 0;
    this.lastDay = null;
  }
  tempAt(ms) {
    const t = ist(ms);
    if (t.dateKey !== this.lastDay) {
      this.anomaly = 0.75 * this.anomaly + this.rng.normal(0, 1.6);
      this.lastDay = t.dateKey;
    }
    const [lo, hi] = normalsFor(t);
    // coolest near 6 am, warmest near 3 pm
    const phase = Math.cos(((t.hour - 15) / 24) * 2 * Math.PI);
    return (lo + hi) / 2 + ((hi - lo) / 2) * phase + this.anomaly;
  }
}

// Same curve without the random part. The forecaster uses this as a stand-in
// for a weather forecast (in a real deployment: IMD / Open-Meteo forecast).
export function normalTempAt(ms) {
  const t = ist(ms);
  const [lo, hi] = normalsFor(t);
  const phase = Math.cos(((t.hour - 15) / 24) * 2 * Math.PI);
  return (lo + hi) / 2 + ((hi - lo) / 2) * phase;
}
