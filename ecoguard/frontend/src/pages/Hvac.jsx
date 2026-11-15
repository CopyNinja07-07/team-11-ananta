import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AirVent, DoorOpen, Droplet, Snowflake, Sun, Thermometer } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../App';
import Kpi from '../components/Kpi';
import { ErrorState, Loading, NotStarted } from '../components/States';
import { api } from '../lib/api';
import { fmtTime, num } from '../lib/format';
import About, { ChartNote } from '../components/About';

const STATUS = {
  overcool: { label: 'Too cold', cls: 'bg-sky-100 text-sky-800', icon: Snowflake },
  door_open: { label: 'Door / window open', cls: 'bg-red-50 text-danger', icon: DoorOpen },
  cooling: { label: 'Cooling', cls: 'bg-brand-50 text-brand-700', icon: AirVent },
  hot: { label: 'Too hot', cls: 'bg-amber-50 text-energy', icon: Sun },
  comfortable: { label: 'Comfortable', cls: 'bg-brand-50 text-brand-700', icon: Thermometer },
  warm: { label: 'Warm', cls: 'bg-amber-50 text-energy', icon: Sun },
  cool: { label: 'Cool', cls: 'bg-sky-50 text-water', icon: Thermometer },
  off: { label: 'Empty, AC off', cls: 'bg-ink-100 text-ink-700', icon: Thermometer },
};
const LINE = ['#C98A00', '#147A9E', '#B4532A', '#2F7549', '#C0392B', '#10231C'];

export default function Hvac() {
  const { live } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});
  const load = () => api.hvac().then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [live?.ts]);
  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!d) return <Loading what="HVAC" />;
  if (!live?.ready) return <NotStarted />;

  const acRooms = d.rooms.filter((r) => r.ac_units > 0);
  const cooling = acRooms.filter((r) => r.ac_kw > 0.05).length;
  const tooCold = acRooms.filter((r) => r.status === 'overcool').length;
  const door = acRooms.filter((r) => r.status === 'door_open').length;
  const reset = async (id) => {
    setBusy(id);
    try { await api.control('ac_setpoint', id); setDone((d0) => ({ ...d0, [id]: true })); } catch (e) { setErr(e.message); } finally { setBusy(null); load(); }
  };

  // one row per timestamp with each AC room's indoor temperature
  const byTs = {};
  acRooms.forEach((r) => r.series.forEach((p) => { (byTs[p.ts] ||= { ts: p.ts })[r.id] = p.t_in; }));
  const rows = Object.values(byTs).sort((a, b) => a.ts - b.ts);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">Cooling & AC</h1>
        <p className="h-sub max-w-3xl">Every AC room has a wall sensor (temperature, humidity) and a current clamp on the AC circuit. ECOGUARD keeps rooms at the BEE default of 24 °C, catches ACs set far too cold, and spots an AC fighting an open door.</p>
      </div>
      <About id="hvac" points={[
        ["HVAC means heating, ventilation and air conditioning. In this block it is the split ACs in the offices, the lab and the seminar room.", "HVAC यानी हीटिंग, वेंटिलेशन और एयर कंडीशनिंग। इस ब्लॉक में ऑफिस, लैब और सेमिनार रूम के स्प्लिट एसी।"],
        ["Each AC room has a wall sensor for temperature and humidity, and a clamp that measures the AC's own power.", "हर एसी कमरे में तापमान-नमी का सेंसर और एसी की बिजली मापने वाला क्लैम्प है।"],
        ["The Bureau of Energy Efficiency (BEE) default is 24 °C. Each degree colder costs about 6% more AC power.", "BEE का डिफ़ॉल्ट 24 °C है। हर डिग्री ठंडा करने पर लगभग 6% ज़्यादा बिजली।"],
        ["Too cold: room below 21.5 °C with people inside. Door open: AC at full power but the room stays above 27 °C on a hot day.", "बहुत ठंडा: लोग हों और कमरा 21.5 °C से नीचे। दरवाज़ा खुला: एसी पूरी ताक़त पर, फिर भी गर्म दिन में कमरा 27 °C से ऊपर।"],
      ]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Outside" value={num(d.outside_c, 1)} unit="°C" icon={Sun} tone="energy" />
        <Kpi label="ACs running" value={`${cooling} / ${acRooms.length}`} sub="rooms with AC" icon={AirVent} tone="brand" />
        <Kpi label="AC share of power" value={`${num(d.ac_share * 100, 0)}%`} sub={`${num(d.ac_kwh, 0)} kWh in the last 24 h`} icon={Snowflake} tone="water" />
        <Kpi label="Needs attention" value={tooCold + door} sub={`${tooCold} too cold · ${door} door open`} tone={tooCold + door ? 'danger' : 'brand'} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {acRooms.map((r) => {
          const st = STATUS[r.status] || STATUS.off;
          const load = r.rated_kw ? Math.min(1, r.ac_kw / r.rated_kw) : 0;
          return (
            <div key={r.id} className="card card-pad">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/rooms/${r.id}`} className="font-semibold text-ink-900 hover:underline">{r.name}</Link>
                  <div className="text-xs text-ink-500">{r.people} people · {r.ac_units} AC unit{r.ac_units > 1 ? 's' : ''}</div>
                </div>
                <span className={`pill ${st.cls}`}><st.icon size={12} className="mr-1" />{st.label}</span>
              </div>
              <div className="mt-3 flex items-end gap-4">
                <div className="text-3xl font-semibold text-ink-900">{num(r.t_in, 1)}<span className="text-base text-ink-500">°C</span></div>
                <div className="pb-1 text-sm text-ink-500"><Droplet size={12} className="inline text-water" /> {num(r.rh, 0)}% RH</div>
              </div>
              <TempScale t={r.t_in} />
              <div className="mt-3">
                <div className="flex justify-between text-xs text-ink-500"><span>AC power</span><span>{num(r.ac_kw, 2)} / {r.rated_kw} kW</span></div>
                <div className="mt-1 h-2 rounded-full bg-ink-100" role="meter" aria-valuenow={Math.round(load * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="AC load">
                  <div className={`h-2 rounded-full ${load > 0.95 ? 'bg-danger' : 'bg-water'}`} style={{ width: `${load * 100}%` }} />
                </div>
              </div>
              {done[r.id] ? (
                <p className="mt-3 rounded-lg bg-leaf-50 px-3 py-2 text-xs font-medium text-leaf-700" role="status">AC set to 24 °C. The room drifts back to a comfortable temperature within the next reading or two.</p>
              ) : r.status === 'overcool' && (
                <button className="btn-primary mt-3 w-full justify-center" disabled={busy === r.id} onClick={() => reset(r.id)}>
                  <Thermometer size={14} />{busy === r.id ? 'Sending…' : 'Reset AC to 24 °C'}
                </button>
              )}
              {r.status === 'door_open' && <p className="mt-3 text-xs text-danger">The AC is at full power and the room is still above 27 °C. Ask the class to close the door.</p>}
            </div>
          );
        })}
      </div>

      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Indoor temperature, last 24 hours</h2>
        <div className="mt-3 h-72">
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid stroke="#E4E1D8" vertical={false} />
              <ReferenceArea y1={23} y2={27} fill="#D6E9D8" fillOpacity={0.5} />
              <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={40} fontSize={11} />
              <YAxis fontSize={11} width={36} unit="°" domain={[14, 'auto']} />
              <Tooltip labelFormatter={fmtTime} formatter={(v, n) => [`${num(v, 1)} °C`, acRooms.find((r) => r.id === n)?.name || n]} />
              <Legend formatter={(id) => acRooms.find((r) => r.id === id)?.name || id} />
              {acRooms.map((r, i) => <Line key={r.id} dataKey={r.id} stroke={LINE[i % LINE.length]} dot={false} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ChartNote en="One line per AC room. The green band (23 to 27 °C) is comfortable. A line far below the band while people are inside is an AC set too cold." hi="हर एसी कमरे की एक लाइन। हरी पट्टी (23 से 27 °C) आरामदायक है। लोग हों और लाइन पट्टी से बहुत नीचे हो, तो एसी ज़्यादा ठंडा है।" />
        <p className="mt-2 text-xs text-ink-500">Green band: 23 to 27 °C, comfortable for Indian classrooms (ISHRAE adaptive comfort). Rooms without people drift with the weather; that is fine and costs nothing.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ['24 °C, not 18', 'The Bureau of Energy Efficiency made 24 °C the default for room ACs. Every degree lower costs about 6% more power, and nobody is more comfortable at 18 °C.'],
          ['Close the door', 'A door left open in May lets in more heat than the AC can remove. It runs flat out, the room stays at 29 °C, and the bill goes up by a third.'],
          ['Cool before the peak', 'The forecast knows when the afternoon class starts. Starting the AC 20 minutes earlier at part load is cheaper than starting it at full load in the 3 pm peak.'],
        ].map(([t, b]) => (
          <div key={t} className="card card-pad"><div className="font-medium text-ink-900">{t}</div><p className="mt-1 text-sm text-ink-700">{b}</p></div>
        ))}
      </section>
    </div>
  );
}

function TempScale({ t }) {
  const at = (v) => `${((v - 14) / 26) * 100}%`;
  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#147A9E 0%,#8CC6D8 25%,#6DB283 35%,#6DB283 50%,#E8B030 62%,#C0392B 100%)' }}>
        {t != null && <div className="absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded bg-ink-900 ring-2 ring-white" style={{ left: at(Math.max(14, Math.min(40, t))) }} />}
      </div>
      <div className="relative mt-1 h-3 text-[10px] text-ink-500">
        <span className="absolute left-0">14°</span>
        <span className="absolute -translate-x-1/2 font-medium text-brand-700" style={{ left: at(24) }}>24°</span>
        <span className="absolute right-0">40°</span>
      </div>
    </div>
  );
}
