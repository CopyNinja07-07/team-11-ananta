import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { ErrorState, Loading, NotStarted } from '../components/States';
import { api } from '../lib/api';
import { floorIds, floorName, floorShort, num } from '../lib/format';
import About from '../components/About';

const ST = { ok: ['Healthy', 'bg-brand-50 text-brand-700', 'bg-brand-500'], watch: ['Watch', 'bg-amber-50 text-energy', 'bg-energy'], danger: ['Hot joint', 'bg-red-50 text-danger', 'bg-danger'] };

export default function Wiring() {
  const { live, building } = useApp();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { api.wiring().then(setData).catch((e) => setErr(e.message)); }, [live?.ts]);
  if (err) return <ErrorState message={err} />;
  if (!data || !live) return <Loading what="wiring health" />;
  if (!live.ready) return <NotStarted />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Inside the walls: hot wiring and damp</h1>
        <p className="h-sub">Waste no ordinary meter can see: energy lost as heat in loose joints and old wiring inside the walls, and current leaking into damp walls.</p>
      </div>
      <About id="walls" points={[
        ["This page finds waste that no ordinary meter shows, because it happens inside the walls.", "यह पेज वह बर्बादी ढूँढता है जो दीवार के अंदर होती है और साधारण मीटर नहीं दिखाता।"],
        ["Hot wiring: each room box measures the voltage at the board and in the room. The drop divided by the current is the wiring resistance. When a joint loosens it rises, and the lost power becomes heat in the wall.", "गर्म तार: बोर्ड और कमरे का वोल्टेज मापा जाता है। वोल्टेज की गिरावट ÷ करंट = रेज़िस्टेंस। जोड़ ढीला हो तो यह बढ़ता है और बिजली दीवार में गर्मी बनती है।"],
        ["Damp wall: an earth-leakage sensor measures current escaping to earth. Water in the wall lets more current escape.", "सीलन: अर्थ-लीकेज सेंसर अर्थ में जा रहा करंट मापता है। दीवार में पानी हो तो ज़्यादा करंट जाता है।"],
        ["A leak inside the wall shows up twice: water flowing at night and leakage rising on the same floor. ECOGUARD only says 'pipe leak inside the wall' when both happen.", "दीवार के अंदर लीक दो जगह दिखता है: रात में पानी का बहाव और उसी मंज़िल पर लीकेज बढ़ना। दोनों हों तभी ECOGUARD इसे दीवार के अंदर लीक कहता है।"],
      ]} />

      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">How we measure it</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <svg viewBox="0 0 520 150" className="w-full" role="img" aria-label="Voltage is measured at the distribution board and at the room. The drop divided by the current gives the wiring resistance.">
            <rect x="10" y="40" width="110" height="70" rx="8" fill="#ECEEE8" stroke="#9AA59E" />
            <text x="65" y="70" textAnchor="middle" fontSize="13" fill="#10231C">Distribution</text>
            <text x="65" y="88" textAnchor="middle" fontSize="13" fill="#10231C">board</text>
            <text x="65" y="130" textAnchor="middle" fontSize="12" fill="#2F7549">V₁ measured</text>
            <line x1="120" y1="75" x2="400" y2="75" stroke="#66756D" strokeWidth="4" />
            <circle cx="260" cy="75" r="13" fill="#F6DEDA" stroke="#C0392B" strokeWidth="2" />
            <text x="260" y="45" textAnchor="middle" fontSize="12" fill="#C0392B">loose joint = hot spot</text>
            <text x="260" y="112" textAnchor="middle" fontSize="12" fill="#34463E">wire inside the wall, current I</text>
            <rect x="400" y="40" width="110" height="70" rx="8" fill="#EEF5EE" stroke="#3E8E5A" />
            <text x="455" y="80" textAnchor="middle" fontSize="13" fill="#10231C">Room</text>
            <text x="455" y="130" textAnchor="middle" fontSize="12" fill="#2F7549">V₂ measured</text>
          </svg>
          <ul className="space-y-2 text-sm text-ink-700">
            <li><b>Resistance</b> R = (V₁ − V₂) ÷ I. We learn each circuit's normal R in its first week.</li>
            <li><b>Heat</b> in the wall = I² × (R − R₀). It grows with the square of the current, so a joint that is fine with lights on can glow when the ACs start.</li>
            <li><b>Earth leakage</b> = phase current − neutral current. A wall soaked by a hidden pipe leak lets current leak to earth, so a rise here plus water flowing at night on the same floor points to a leak <i>inside</i> the wall.</li>
          </ul>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-300/60 text-left"><tr className="label">
            <th className="p-3">Circuit</th><th className="p-3 text-right">Normal R₀</th><th className="p-3 text-right">Now</th><th className="p-3">Change</th><th className="p-3 text-right">Heat at full load</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {data.circuits.map((c) => (
              <tr key={c.id} className="border-b border-ink-100 last:border-0">
                <td className="p-3"><div className="font-medium text-ink-900">{c.name}</div><div className="text-xs text-ink-500">{c.id} · up to {num(c.peak_amps, 0)} A</div></td>
                <td className="p-3 text-right">{num(c.r0, 3)} Ω</td>
                <td className="p-3 text-right font-medium">{c.r_now ? `${num(c.r_now, 3)} Ω` : '–'}</td>
                <td className="p-3">
                  <div className="h-2 w-32 rounded bg-ink-100" role="meter" aria-valuenow={c.ratio} aria-valuemin={0} aria-valuemax={4} aria-label={`${c.name} resistance ratio`}>
                    <div className={`h-2 rounded ${ST[c.status][2]}`} style={{ width: `${Math.min(100, (c.ratio / 4) * 100)}%` }} />
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">× {num(c.ratio, 2)}</div>
                </td>
                <td className="p-3 text-right">{c.peak_heat_w > 0 ? `${num(c.peak_heat_w, 0)} W` : '–'}</td>
                <td className="p-3"><span className={`pill ${ST[c.status][1]}`}>{ST[c.status][0]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Damp walls: earth leakage and night water, floor by floor</h2>
        <p className="h-sub">A hidden pipe leak shows up twice: water that never stops flowing at night, and current leaking into the wet wall. ECOGUARD only calls it a leak inside the wall when both happen on the same floor.</p>
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_1.1fr]">
          <BuildingSection building={building} floors={data.floors || []} />
          <div className="space-y-2">
            {[...(data.floors || [])].reverse().map((f) => {
              const damp = f.leak_ma > 15;
              const verdict = f.inside_wall ? ['Leak inside the wall', 'bg-red-50 text-danger'] : damp ? ['Damp wall or worn insulation', 'bg-amber-50 text-energy']
                : f.night_flow_lph ? ['Water flowing at night', 'bg-sky-50 text-water'] : ['Dry and healthy', 'bg-brand-50 text-brand-700'];
              return (
                <div key={f.floor} className="flex items-center justify-between rounded-xl border border-ink-300/60 p-3">
                  <div>
                    <div className="font-medium text-ink-900">{floorName(f.floor, building)}</div>
                    <div className="text-xs text-ink-500">Earth leakage {num(f.leak_ma, 1)} mA (safe under 10) · night flow {f.night_flow_lph ? `${num(f.night_flow_lph, 0)} L/h` : 'none'}</div>
                  </div>
                  <span className={`pill ${verdict[1]}`}>{verdict[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function BuildingSection({ floors, building }) {
  const ids = floorIds(building, floors); const H = 40 + ids.length * 66 + 24;
  const col = (f) => (f.inside_wall ? '#C0392B' : f.leak_ma > 15 ? '#C98A00' : f.leak_ma > 8 ? '#E8B030' : '#B5D8BF');
  return (
    <svg viewBox={`0 0 300 ${H}`} className="w-full max-w-sm" role="img" aria-label="Cross-section of the block, walls coloured by earth leakage">
      <polygon points="20,40 150,8 280,40" fill="#E4E1D8" />
      <rect x="250" y="16" width="26" height="22" rx="3" fill="#BFE0EA" stroke="#147A9E" />
      {ids.map((fl, i) => {
        const f = floors.find((x) => x.floor === fl) || { leak_ma: 0 };
        const y = 40 + i * 66;
        return (
          <g key={fl}>
            <rect x="20" y={y} width="260" height="66" fill="#fff" stroke="#9AA59E" />
            <rect x="20" y={y} width="12" height="66" fill={col(f)} />
            <rect x="268" y={y} width="12" height="66" fill={col(f)} />
            <line x1="262" y1={y} x2="262" y2={y + 66} stroke="#147A9E" strokeWidth="3" strokeDasharray={f.night_flow_lph ? '0' : '6 4'} />
            {f.inside_wall && <circle cx="262" cy={y + 40} r="7" fill="#147A9E" opacity="0.8"><animate attributeName="r" values="5;9;5" dur="1.6s" repeatCount="indefinite" /></circle>}
            <text x="150" y={y + 30} textAnchor="middle" fontSize="13" fill="#10231C">{floorName(fl, building)}</text>
            <text x="150" y={y + 48} textAnchor="middle" fontSize="11" fill="#66756D">{num(f.leak_ma, 1)} mA</text>
          </g>
        );
      })}
      <text x="150" y={H - 4} textAnchor="middle" fontSize="10" fill="#66756D">walls coloured by earth leakage · blue line: water riser</text>
    </svg>
  );
}
