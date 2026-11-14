import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, PowerOff } from 'lucide-react';
import { useApp } from '../App';
import AlertCard from '../components/AlertCard';
import Kpi from '../components/Kpi';
import { Empty, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { fmtTime, num } from '../lib/format';

export default function RoomDetail() {
  const { id } = useParams();
  const { live } = useApp();
  const [series, setSeries] = useState(null);
  const [err, setErr] = useState(null);
  const [hours, setHours] = useState(24);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.roomSeries(id, hours).then(setSeries).catch((e) => setErr(e.message));
  }, [id, hours, live?.ts]);

  const room = live?.rooms?.find((r) => r.id === id);
  if (err) return <ErrorState message={err} />;
  if (!series || !live) return <Loading what="room history" />;
  if (!room) return <Empty title="Room not found" />;
  const alerts = live.alerts.filter((a) => a.target === id);
  const rNow = series.filter((s) => s.r_ohm).slice(-12).map((s) => s.r_ohm);
  const rMed = rNow.length ? rNow.sort((a, b) => a - b)[Math.floor(rNow.length / 2)] : null;

  return (
    <div className="space-y-5">
      <Link to="/rooms" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><ArrowLeft size={14} />All rooms</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title">{room.name}</h1>
          <p className="h-sub">{room.id} · {['Ground', 'First', 'Second'][room.floor]} floor · seats {room.cap}</p>
        </div>
        <button className="btn-danger" onClick={() => api.control('switch_off', id).then(() => setMsg('Relay switch-off sent. Lights, fans and AC go off; sockets stay on.'))} disabled={room.people > 0}
          title={room.people > 0 ? 'Room is in use' : 'Switch off non-essential loads'}>
          <PowerOff size={14} />Switch off now
        </button>
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
        <p className="mb-3 text-xs text-ink-500">The grey line is what the trained model says this room should draw for its headcount and the weather. Orange above grey with zero people is waste.</p>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={series}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={40} fontSize={11} />
              <YAxis yAxisId="kw" fontSize={11} width={50} domain={[0, (max) => Math.max(0.5, Math.ceil(max * 2) / 2)]} tickFormatter={(v) => `${num(v, 1)} kW`} />
              <YAxis yAxisId="p" orientation="right" fontSize={11} width={30} />
              <Tooltip labelFormatter={(v) => fmtTime(v)} formatter={(v, n) => [n === 'People' ? v : `${num(v, 2)} kW`, n]} />
              <Legend />
              <Area yAxisId="p" dataKey="people" name="People" fill="#d1fae5" stroke="#10b981" strokeWidth={0} isAnimationActive={false} />
              <Line yAxisId="kw" dataKey="expected_kw" name="Expected" stroke="#64748b" strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line yAxisId="kw" dataKey="kw" name="Actual" stroke="#d97706" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-ink-900">Alerts for this room</h2>
        {alerts.length ? alerts.map((a) => <AlertCard key={a.id} alert={a} now={live.ts} rooms={live.rooms} />) : <Empty title="No open alerts for this room" />}
      </section>
    </div>
  );
}
