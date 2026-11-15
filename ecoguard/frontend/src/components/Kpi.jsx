// One number, what it means, and one line of context. The thin top bar carries the
// resource colour so the same colour means the same thing on every screen.
const TONES = {
  ink: { text: 'text-ink-900', bar: 'bg-ink-300' },
  energy: { text: 'text-energy', bar: 'bg-volt-400' },
  water: { text: 'text-water', bar: 'bg-river-500' },
  hidden: { text: 'text-hidden', bar: 'bg-ember-500' },
  brand: { text: 'text-leaf-700', bar: 'bg-leaf-500' },
  danger: { text: 'text-danger', bar: 'bg-alarm-500' },
};

export default function Kpi({ label, value, unit, sub, tone = 'ink', icon: Icon }) {
  const t = TONES[tone] || TONES.ink;
  return (
    <div className="card relative overflow-hidden card-pad">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${t.bar}`} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <div className="label">{label}</div>
        {Icon && <Icon size={16} className={t.text} aria-hidden />}
      </div>
      <div className={`readout mt-2 text-[28px] font-medium leading-none ${t.text}`}>
        {value}{unit && <span className="ml-1 font-sans text-sm font-normal text-ink-500">{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-xs leading-snug text-ink-500">{sub}</div>}
    </div>
  );
}
