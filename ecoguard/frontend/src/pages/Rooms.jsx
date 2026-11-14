import { Link } from 'react-router-dom';
import { useApp } from '../App';
import { roomState } from '../components/FloorMap';
import { ErrorState, Loading, NotStarted } from '../components/States';
import { num } from '../lib/format';

const BADGE = { busy: ['In use', 'bg-brand-50 text-brand-700'], idle: ['Empty', 'bg-ink-100 text-ink-500'], waste: ['Wasting', 'bg-amber-50 text-energy'], hidden: ['Wiring risk', 'bg-violet-50 text-hidden'] };

export default function Rooms() {
  const { live, error } = useApp();
  if (error && !live) return <ErrorState message={error} />;
  if (!live) return <Loading what="rooms" />;
  if (!live.ready) return <NotStarted />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h-title">Rooms</h1>
        <p className="h-sub">Every room compared with what it should be using for the people in it and today's weather.</p>
      </div>
      <div className="card overflow-x-auto">
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
                  <td className="p-3">{['Ground', 'First', 'Second'][r.floor]}</td>
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
