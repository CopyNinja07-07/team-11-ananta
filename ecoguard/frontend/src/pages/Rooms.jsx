import { Link } from 'react-router-dom';
import { useApp } from '../App';
import { roomState } from '../components/FloorMap';
import { ErrorState, Loading, NotStarted } from '../components/States';
import { floorShort, num } from '../lib/format';
import About from '../components/About';

const BADGE = { busy: ['In use', 'bg-brand-50 text-brand-700'], idle: ['Empty', 'bg-ink-100 text-ink-500'], waste: ['Wasting', 'bg-amber-50 text-energy'], hidden: ['Wiring risk', 'bg-violet-50 text-hidden'] };

export default function Rooms() {
  const { live, error, building } = useApp();
  if (error && !live) return <ErrorState message={error} />;
  if (!live) return <Loading what="rooms" />;
  if (!live.ready) return <NotStarted />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h-title">Rooms</h1>
        <p className="h-sub">Every room compared with what it should be using for the people in it and today's weather.</p>
      </div>
      <About id="rooms" points={[
        ["One row per room. Using is the power the room draws right now.", "हर कमरे की एक लाइन। \"Using\" = कमरा अभी कितनी बिजली ले रहा है।"],
        ["Should use is what the trained room model expects for the people inside and today's heat.", "\"Should use\" = अंदर के लोगों और आज की गर्मी के हिसाब से मॉडल का अनुमान।"],
        ["If a room is empty and uses more than 0.2 kW above that, it is marked as wasting.", "कमरा ख़ाली हो और अनुमान से 0.2 kW ज़्यादा ले, तो उसे बर्बादी माना जाता है।"],
        ["Click a room to see its graph, its wiring health and its alerts.", "कमरे पर क्लिक करें: उसका ग्राफ़, तारों की सेहत और अलर्ट दिखेंगे।"],
      ]} />
      <ul className="space-y-2 sm:hidden">
        {live.rooms.map((r) => {
          const st = roomState(r, live.alerts);
          const diff = r.kw - r.expected_kw;
          return (
            <li key={r.id}>
              <Link to={`/rooms/${r.id}`} className="card flex items-center gap-3 p-3 hover:bg-ink-100/60">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-brand-700">{r.name}</div>
                  <div className="text-xs text-ink-500">{floorShort(r.floor, building)} floor · {r.people} / {r.cap} people</div>
                </div>
                <div className="text-right">
                  <div className="readout text-sm font-medium text-ink-900">{num(r.kw, 2)} kW</div>
                  <div className={`text-xs ${diff > 0.2 ? 'text-energy' : 'text-ink-500'}`}>should be {num(r.expected_kw, 2)}</div>
                </div>
                <span className={`pill ${BADGE[st][1]}`}>{BADGE[st][0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="card hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-ink-300/60 text-left">
            <tr className="label">
              <th className="p-3">Room</th><th className="p-3">Floor</th><th className="p-3">People</th>
              <th className="p-3 text-right">Using</th><th className="p-3 text-right">Should use</th><th className="p-3 text-right">Difference</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {live.rooms.map((r) => {
              const st = roomState(r, live.alerts);
              const diff = r.kw - r.expected_kw;
              return (
                <tr key={r.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60">
                  <td className="p-3"><Link className="font-medium text-brand-700 hover:underline" to={`/rooms/${r.id}`}>{r.name}</Link><div className="text-xs text-ink-500">{r.id}</div></td>
                  <td className="p-3">{floorShort(r.floor, building)}</td>
                  <td className="p-3">{r.people} / {r.cap}</td>
                  <td className="p-3 text-right font-medium">{num(r.kw, 2)} kW</td>
                  <td className="p-3 text-right text-ink-500">{num(r.expected_kw, 2)} kW</td>
                  <td className={`p-3 text-right font-medium ${diff > 0.2 ? 'text-energy' : 'text-ink-500'}`}>{diff > 0 ? '+' : ''}{num(diff, 2)} kW</td>
                  <td className="p-3"><span className={`pill ${BADGE[st][1]}`}>{BADGE[st][0]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
