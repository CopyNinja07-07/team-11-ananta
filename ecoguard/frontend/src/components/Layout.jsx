import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AirVent, Bell, Cctv, Building2, Database, Droplets, Flame, Gauge, LineChart, Menu, PiggyBank, Settings, SlidersHorizontal, X, Zap, ZapOff } from 'lucide-react';
import { useApp } from '../App';
import { fmtDateTime, num } from '../lib/format';
import Voice from './Voice';

const NAV = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/rooms', label: 'Rooms', icon: Building2 },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/camera', label: 'Camera Occupancy', icon: Cctv },
  { to: '/hvac', label: 'HVAC & Comfort', icon: AirVent },
  { to: '/water', label: 'Water & Pump', icon: Droplets },
  { to: '/wiring', label: 'Heat & Damp Walls', icon: Flame },
  { to: '/forecast', label: 'Forecast', icon: LineChart },
  { to: '/savings', label: 'Savings & Carbon', icon: PiggyBank },
  { to: '/real', label: 'Real Buildings', icon: Database },
  { to: '/simulator', label: 'Simulator', icon: SlidersHorizontal },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout({ children }) {
  const { live, error, lang, setLang } = useApp();
  const [open, setOpen] = useState(false);
  const openAlerts = live?.alerts?.length ?? 0;

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100'}`}>
          <Icon size={18} aria-hidden />
          <span className="flex-1">{label}</span>
          {to === '/alerts' && openAlerts > 0 && <span className="pill bg-danger text-white">{openAlerts}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:block border-r border-ink-300/60 bg-white">
        <Brand />
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <div className="flex items-center justify-between pr-3"><Brand /><button className="btn-ghost" onClick={() => setOpen(false)} aria-label="Close menu"><X size={16} /></button></div>
            {nav}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-ink-300/60 bg-white/90 px-4 py-2.5 backdrop-blur">
          <button className="btn-ghost lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={16} /></button>
          <div className="text-sm text-ink-700">
            <span className="font-semibold text-ink-900">Academic Block A</span> · Jammu
          </div>
          {live?.ready && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="pill bg-ink-100 text-ink-700">{fmtDateTime(live.ts)}</span>
              <span className="pill bg-ink-100 text-ink-700">{num(live.temp_c)} °C outside</span>
              {live.grid_on
                ? <span className="pill bg-brand-50 text-brand-700"><Zap size={12} className="mr-1" />Grid on</span>
                : <span className="pill bg-red-50 text-danger"><ZapOff size={12} className="mr-1" />Power cut</span>}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {error && <span className="pill bg-red-50 text-danger" role="status">Backend offline</span>}
            <Voice />
            <div className="flex rounded-lg border border-ink-300 p-0.5 text-xs" role="group" aria-label="Advice language">
              {['en', 'hi'].map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`rounded-md px-2 py-1 font-medium ${lang === l ? 'bg-brand-700 text-white' : 'text-ink-700'}`}>{l === 'en' ? 'English' : 'हिन्दी'}</button>
              ))}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-5 py-4">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <div>
        <div className="text-sm font-bold tracking-wide text-ink-900">ECOGUARD AI</div>
        <div className="text-[11px] text-ink-500">Energy & water waste detector</div>
      </div>
    </div>
  );
}
