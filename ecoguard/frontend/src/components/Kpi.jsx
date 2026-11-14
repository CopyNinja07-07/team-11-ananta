export default function Kpi({ label, value, unit, sub, tone = 'ink', icon: Icon }) {
  const tones = { ink: 'text-ink-900', energy: 'text-energy', water: 'text-water', hidden: 'text-hidden', brand: 'text-brand-700', danger: 'text-danger' };
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <div className="label">{label}</div>
        {Icon && <Icon size={16} className={tones[tone]} aria-hidden />}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>
        {value}{unit && <span className="ml-1 text-sm font-medium text-ink-500">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}
