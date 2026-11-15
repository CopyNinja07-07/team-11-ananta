import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useApp } from '../App';
import { floorIds, floorShort, num } from '../lib/format';

// Schematic of the block, one row per floor. Colour = what's happening in the room.
export function roomState(room, alerts) {
  const a = alerts?.filter((x) => x.target === room.id && x.end == null) || [];
  if (a.some((x) => x.kind === 'hidden')) return 'hidden';
  if (a.length) return 'waste';
  if (room.people > 0) return 'busy';
  return 'idle';
}

const STYLE = {
  busy: 'bg-leaf-50 border-leaf-500 text-leaf-900',
  idle: 'bg-white border-ink-200 text-ink-700',
  waste: 'bg-volt-50 border-volt-400 text-volt-900',
  hidden: 'bg-ember-50 border-ember-500 text-ember-900',
};
const LABEL = { busy: 'In use', idle: 'Empty', waste: 'Wasting', hidden: 'Wiring risk' };

export default function FloorMap({ rooms, alerts, water }) {
  const { building } = useApp();
  const floors = floorIds(building, rooms);
  const floorAlert = (f) => alerts?.find((a) => a.target === `F${f}` && a.end == null);
  return (
    <div className="space-y-3">
      {floors.map((f) => (
        <div key={f} className="flex gap-3">
          <div className="w-16 shrink-0 pt-3 text-xs font-medium text-ink-500">{floorShort(f, building)}</div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {rooms.filter((r) => r.floor === f).map((r) => {
              const st = roomState(r, alerts);
              return (
                <Link key={r.id} to={`/rooms/${r.id}`} className={`rounded-lg border-[1.5px] p-2.5 transition hover:-translate-y-0.5 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${STYLE[st]}`}
                  aria-label={`${r.name}: ${LABEL[st]}, ${r.people} people, ${num(r.kw, 2)} kilowatts`}>
                  <div className="flex items-center justify-between font-mono text-[11px] font-medium">{r.id}<span className="font-medium opacity-80">{LABEL[st]}</span></div>
                  <div className="mt-1 flex justify-between gap-1 text-[11px] opacity-80"><span className="truncate">{r.name}</span>{r.t_in != null && <span className="shrink-0">{num(r.t_in, 0)}°C</span>}</div>
                  <div className="mt-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1"><Users size={13} aria-hidden />{r.people}</span>
                    <span className="readout font-medium">{num(r.kw, 2)} kW</span>
                  </div>
                </Link>
              );
            })}
            <div className={`rounded-lg border-2 border-dashed p-2.5 text-xs ${floorAlert(f) ? 'border-river-500 bg-river-50 text-river-900' : 'border-ink-300 text-ink-500'}`}>
              <div className="font-semibold">Washrooms F{f}</div>
              <div className="readout mt-1">{num((water?.floor_l?.[f] ?? 0) * 4, 0)} L/h</div>
              {floorAlert(f) && <div className="mt-1 font-medium">{floorAlert(f).rule === 'earth_leak' ? 'Damp wall?' : 'Flow when empty'}</div>}
            </div>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pl-[76px] text-xs text-ink-500">
        {Object.entries(LABEL).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded border-2 ${STYLE[k]}`} />{v}</span>)}
      </div>
    </div>
  );
}
