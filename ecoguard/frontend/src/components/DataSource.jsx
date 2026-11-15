import { Cpu, Database, Radio } from 'lucide-react';

// Every page says where its numbers come from, so simulated and real data are never mixed up.
const KINDS = {
  sim: { icon: Cpu, text: 'Simulated · Academic Block A, Jammu', cls: 'border-leaf-200 bg-leaf-50 text-leaf-800' },
  real: { icon: Database, text: 'Real meters · BDG2 open data, 659 buildings', cls: 'border-river-200 bg-river-50 text-river-800' },
  live: { icon: Radio, text: 'Live feed · sensor gateway', cls: 'border-volt-200 bg-volt-50 text-volt-800' },
  estimate: { icon: Cpu, text: 'Estimate · based on the simulated year', cls: 'border-ink-200 bg-white text-ink-700' },
};

export default function DataSource({ kind = 'sim', note }) {
  const k = KINDS[kind] || KINDS.sim;
  const Icon = k.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] ${k.cls}`} title={note || k.text}>
      <Icon size={12} aria-hidden />{k.text}
    </span>
  );
}
