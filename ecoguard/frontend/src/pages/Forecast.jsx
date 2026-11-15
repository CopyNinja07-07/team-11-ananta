import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../App';
import Kpi from '../components/Kpi';
import DataSource from '../components/DataSource';
import { Empty, ErrorState, Loading } from '../components/States';
import { api } from '../lib/api';
import { fmtTime, num, rs } from '../lib/format';
import About, { ChartNote } from '../components/About';

export default function Forecast() {
  const { live } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { api.forecast().then(setD).catch((e) => setErr(e.message)); }, [live?.ts && Math.floor(live.ts / 3600000)]);
  if (err) return <ErrorState message={err} />;
  if (!d) return <Loading what="forecast" />;
  if (!d.forecast.length) return <Empty title="Not enough history yet" hint="The forecast needs at least a day of readings to learn the weekly timetable." />;

  const rows = [
    ...d.actual.map((a) => ({ ts: a.ts, actual: a.kwh })),
    ...d.forecast.map((f) => ({ ts: f.ts, forecast: f.kwh })),
  ];
  const peak = d.forecast.reduce((m, f) => (f.kwh > m.kwh ? f : m), d.forecast[0]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h-title">Next 24 hours</h1>
          <p className="h-sub">Next 24 hours, from the weekly class timetable (learned from occupancy), Jammu temperature normals and each room's trained model.</p>
        </div>
        <DataSource kind="sim" />
      </div>
      <About id="forecast" points={[
        ["This page predicts how much power the block will use in each of the next 24 hours.", "यह पेज बताता है कि अगले 24 घंटों में हर घंटे ब्लॉक कितनी बिजली लेगा।"],
        ["It adds up each room's trained model, using who is usually in the room at that hour (learned from the weekly timetable) and the usual Jammu temperature.", "हर कमरे के मॉडल को जोड़कर: उस घंटे कमरे में आमतौर पर कितने लोग होते हैं (हफ़्ते के टाइमटेबल से सीखा) और जम्मू का सामान्य तापमान।"],
        ["Yesterday's error shows how far the same method was from what really happened yesterday.", "\"कल की गलती\" बताती है कि यही तरीका कल असल से कितना दूर था।"],
        ["Use it to plan: cool rooms before the peak hour and run the pump when demand is low.", "योजना के लिए: पीक से पहले कमरे ठंडे करें, कम माँग के समय पंप चलाएँ।"],
      ]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Next 24 h" value={num(d.next24_kwh, 0)} unit="kWh" tone="energy" />
        <Kpi label="Expected bill" value={rs(d.next24_rupees)} sub="at ₹7/kWh" />
        <Kpi label="Peak hour" value={fmtTime(peak.ts)} sub={`${num(peak.kwh, 1)} kWh`} />
        <Kpi label="Yesterday's error" value={d.yesterday_wape != null ? `${num(d.yesterday_wape * 100, 0)}%` : '–'} sub="forecast vs what happened (WAPE)" tone="brand" />
      </div>
      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">Last 24 hours and next 24 hours (kWh per hour)</h2>
        <div className="mt-3 h-72">
          <ResponsiveContainer>
            <BarChart data={rows}>
              <CartesianGrid stroke="#E4E1D8" vertical={false} />
              <XAxis dataKey="ts" tickFormatter={fmtTime} minTickGap={40} fontSize={11} />
              <YAxis fontSize={11} width={40} />
              <Tooltip labelFormatter={fmtTime} formatter={(v) => `${num(v, 2)} kWh`} />
              <Legend />
              <Bar dataKey="actual" name="Actual" fill="#C98A00" isAnimationActive={false} />
              <Bar dataKey="forecast" name="Forecast" fill="#F2C14E" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartNote en="Dark bars on the left: what the block really used in the last 24 hours. Light bars on the right: the forecast for the next 24. Tall bars are class hours; the tallest is the peak hour." hi="बाईं गहरी पट्टियाँ: पिछले 24 घंटे की असली खपत। दाईं हल्की पट्टियाँ: अगले 24 घंटे का अनुमान। ऊँची पट्टियाँ क्लास के घंटे हैं।" />
        <p className="mt-2 text-xs text-ink-500">Use it to plan: pre-cool before the peak hour instead of during it, and schedule the pump outside the evening voltage dip.</p>
      </section>
    </div>
  );
}
