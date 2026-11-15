import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, PowerOff } from 'lucide-react';
import { useApp } from '../App';
import AlertCard from '../components/AlertCard';
import Kpi from '../components/Kpi';
import { Empty, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { floorName, fmtTime, num } from '../lib/format';
import About, { ChartNote } from '../components/About';

export default function RoomDetail() {
  const { id } = useParams();
  const { live, building } = useApp();
  const [series, setSeries] = useState(null);
  const [err, setErr] = useState(null);
  const [hours, setHours] = useState(24);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.roomSeries(id, hours).then(setSeries).catch((e) => setErr(e.message));
  }, [id, hours, live?.ts]);

  const room = live?.rooms?.find((r) => r.id === id);
  if (live?.rooms && !room) {
    return (
      <Empty title={`There is no room called “${id}” in this building`} hint="It may have been renamed in the building file. Pick a room from the list instead.">
        <Link to="/rooms" className="btn-primary"><ArrowLeft size={14} />All rooms</Link>
      </Empty>
    );
  }
  if (err) return <ErrorState message={err} />;
  if (!series || !live) return <Loading what="room history" />;
  const alerts = live.alerts.filter((a) => a.target === id);
  const rNow = series.filter((s) => s.r_ohm).slice(-12).map((s) => s.r_ohm);
  const rMed = rNow.length ? rNow.sort((a, b) => a - b)[Math.floor(rNow.length / 2)] : null;

  return (
    <div className="space-y-5">
      <Link to="/rooms" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft size={14} />All rooms</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title">{room.name}</h1>
          <p className="h-sub">{room.id} · {floorName(room.floor, building)} · seats {room.cap}</p>
        </div>
        <About id="room" points={[
          ["People: how many the camera or motion sensor counts in the room now.", "लोग: कैमरा या मोशन सेंसर अभी कमरे में कितने लोग गिन रहा है।"],
          ["Using vs should be: the room's power now, and what the trained model expects for those people and the weather.", "Using बनाम should be: अभी की बिजली, और उन लोगों व मौसम के लिए मॉडल का अनुमान।"],
          ["Wiring resistance: voltage at the board minus voltage in the room, divided by the current. It rises when a joint in the wall loosens and heats up.", "तार का रेज़िस्टेंस: बोर्ड और कमरे के वोल्टेज का अंतर ÷ करंट। दीवार में जोड़ ढीला होकर गर्म हो तो यह बढ़ता है।"],
          ["Earth leakage: current escaping to earth. Below 10 mA is normal; a steady rise means a damp wall or worn insulation.", "अर्थ लीकेज: अर्थ में जा रहा करंट। 10 mA से कम सामान्य; लगातार बढ़े तो दीवार में सीलन या ख़राब इंसुलेशन।"],
        ]} />
        <button className="btn-danger" onClick={() => api.control('switch_off', id).then(() => setMsg('Relay switch-off sent. Lights, fans and AC go off; sockets stay on.'))} disabled={room.people > 0}
          title={room.people > 0 ? 'Room is in use' : 'Switch off non-essential loads'}>
          <PowerOff size={14} />Switch off now
        </button>
        {room.people > 0 && <span className="ml-3 text-xs text-ink-500">Locked: {room.people} people are inside. ECOGUARD never switches off an occupied room.</span>}
      </div>
      {msg && <div className="text-sm text-brand-700" role="status">{msg}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="People" value={room.people} sub={`camera count, capacity ${room.cap}`} />
        <Kpi label="Using" value={num(room.kw, 2)} unit="kW" tone="energy" sub={`should be ${num(room.expected_kw, 2)} kW`} />
        <Kpi label="Wiring resistance" value={rMed ? num(rMed, 3) : '–'} unit="Ω" tone="hidden" sub={rMed ? '(board V − room V) ÷ current' : 'measured when the room draws over 1.5 A'} />
        <Kpi label="Earth leakage" value={num(room.leak_ma, 1)} unit="mA" tone={room.leak_ma > 15 ? 'danger' : 'ink'} sub="safe below 10 mA" />
      </div>

      <section className="card card-pad">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Actual vs expected power</h2>
          <div className="flex gap-1" role="group" aria-label="Time range">
            {[24, 72, 168].map((h) => <button key={h} onClick={() => setHours(h)} aria-pressed={hours === h} className={`btn ${hours === h ? 'bg-brand-700 text-white' : 'btn-ghost'}`}>{h === 168 ? '7 d' : `${h} h`}</button>)}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={series}>
              <CartesianGrid stroke="#E4E1D8" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={40} fontSize={11} />
              <YAxis yAxisId="kw" fontSize={11} width={50} domain={[0, (max) => Math.max(0.5, Math.ceil(max * 2) / 2)]} tickFormatter={(v) => `${num(v, 1)} kW`} />
              <YAxis yAxisId="p" orientation="right" fontSize={11} width={30} />
              <Tooltip labelFormatter={(v) => fmtTime(v)} formatter={(v, n) => [n === 'People' ? v : `${num(v, 2)} kW`, n]} />
              <Legend />
              <Area yAxisId="p" dataKey="people" name="People" fill="#D6E9D8" stroke="#3E8E5A" strokeWidth={0} isAnimationActive={false} />
              <Line yAxisId="kw" dataKey="expected_kw" name="Expected" stroke="#66756D" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line yAxisId="kw" dataKey="kw" name="Actual" stroke="#C98A00" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ChartNote en="Orange line: power the room really drew. Grey dashed line: what it should draw. Green shading: people in the room (right axis). Orange above grey while green is at zero means waste." hi="नारंगी लाइन: असली बिजली। धूसर डैश: जितनी लगनी चाहिए। हरा भाग: कमरे में लोग (दायाँ अक्ष)। हरा शून्य हो और नारंगी धूसर से ऊपर, तो बर्बादी।" />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink-900">Alerts for this room</h2>
        {alerts.length ? alerts.map((a) => <AlertCard key={a.id} alert={a} now={live.ts} rooms={live.rooms} />) : <Empty title="No open alerts for this room" />}
      </section>
    </div>
  );
}
