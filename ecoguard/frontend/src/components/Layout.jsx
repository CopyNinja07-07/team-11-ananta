import { DEMO } from '../lib/api';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AirVent, Bell, Brain, Building2, Cctv, Clock, Database, Droplets, Flame, FlaskConical, Gauge, LineChart, Menu, Plus, Tags, PiggyBank, Settings, Thermometer, X, Zap, ZapOff } from 'lucide-react';
import { useT } from '../lib/i18n';
import Popover from './Popover';
import { useApp } from '../App';
import { fmtDateTime, num } from '../lib/format';
import Voice from './Voice';

// Grouped by the question a facility manager is asking, not by data type.
// Each label is [English, Hindi].
const NAV = [
  { group: ['Right now', 'अभी'], items: [
    { to: '/', label: ['Live building', 'लाइव बिल्डिंग'], icon: Gauge },
    { to: '/alerts', label: ['Alerts', 'अलर्ट'], icon: Bell, badge: true },
    { to: '/rooms', label: ['Rooms', 'कमरे'], icon: Building2 },
  ] },
  { group: ['Where waste hides', 'बर्बादी कहाँ छिपी है'], items: [
    { to: '/hvac', label: ['Cooling & AC', 'कूलिंग और एसी'], icon: AirVent },
    { to: '/water', label: ['Water tank & pump', 'पानी की टंकी और पंप'], icon: Droplets },
    { to: '/wiring', label: ['Inside the walls', 'दीवारों के अंदर'], icon: Flame },
    { to: '/camera', label: ['People count', 'कमरे में कितने लोग'], icon: Cctv },
  ] },
  { group: ['Results', 'नतीजे'], items: [
    { to: '/savings', label: ['Savings & carbon', 'बचत और कार्बन'], icon: PiggyBank },
    { to: '/forecast', label: ['Next 24 hours', 'अगले 24 घंटे'], icon: LineChart },
    { to: '/models', label: ['How it decides', 'यह कैसे तय करता है'], icon: Brain },
    { to: '/real', label: ['Tested on 659 buildings', '659 इमारतों पर परखा'], icon: Database },
  ] },
  { group: ['For your campus', 'आपके कैंपस के लिए'], items: [
    { to: '/plans', label: ['Plans & pricing', 'प्लान और कीमत'], icon: Tags },
    { to: '/setup', label: ['Add a building', 'नई बिल्डिंग जोड़ें'], icon: Plus },
  ] },
  { group: ['Control room', 'कंट्रोल रूम'], items: [
    { to: '/simulator', label: ['Test mode', 'टेस्ट मोड'], icon: FlaskConical },
    { to: '/settings', label: ['Settings', 'सेटिंग्स'], icon: Settings },
  ] },
];

export default function Layout({ children }) {
  const { live, error, lang, setLang, building } = useApp();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const openAlerts = live?.alerts?.length ?? 0;
  const b = building?.building;
  const t = useT();

  const nav = (
    <nav className="flex flex-col gap-3 px-3 pb-4 lg:gap-5 lg:pb-6" aria-label="Main">
      {NAV.map(({ group, items }) => (
        <div key={group[0]}>
          <div className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-leaf-300/70">{t(...group)}</div>
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => `group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13.5px] transition lg:py-2 ${isActive ? 'bg-night-700/80 text-white' : 'text-ink-300 hover:bg-night-800 hover:text-white'}`}>
              {({ isActive }) => (<>
                {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-volt-300" aria-hidden />}
                <Icon size={17} aria-hidden className={isActive ? 'text-volt-300' : 'text-leaf-300/80 group-hover:text-leaf-200'} />
                <span className="flex-1">{t(...label)}</span>
                {badge && openAlerts > 0 && <span className="readout rounded-md bg-alarm-500 px-1.5 text-[11px] font-medium text-white">{openAlerts}</span>}
              </>)}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="blueprint flex h-full flex-col bg-night-900">
      <Brand />
      <div className="flex-1 overflow-y-auto">{nav}</div>
      <SystemStrip live={live} error={error} />
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <aside className="hidden bg-night-900 lg:block"><div className="sticky top-0 h-screen">{sidebar}</div></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-night-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 shadow-xl">
            <button className="absolute right-3 top-4 z-10 rounded-md p-1.5 text-ink-300 hover:bg-night-800" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-ink-50/90 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
            <button className="btn-ghost lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={16} /></button>
            <div className="min-w-0">
              <div className="truncate font-display text-[15px] font-semibold text-ink-900">{b?.name || 'Building'}<span className="font-sans font-normal text-ink-500"> · {b?.city || ''}</span></div>
            </div>
            {live?.ready && (
              <div className="order-last flex w-full flex-wrap items-center gap-1.5 text-xs md:order-none md:w-auto">
                <Popover label={<><Clock size={12} aria-hidden />{fmtDateTime(live.ts)}</>} className="readout border-ink-200 bg-white text-ink-700">
                  <b>{t('Time of the latest reading', 'आख़िरी रीडिंग का समय')}</b>
                  <p className="mt-1">{t('Every room sends one reading every 15 minutes. This is the time of the newest one, in India time (IST).', 'हर कमरा हर 15 मिनट में एक रीडिंग भेजता है। यह सबसे नई रीडिंग का समय है (भारतीय समय)।')}</p>
                </Popover>
                <Popover label={<><Thermometer size={12} aria-hidden />{num(live.temp_c)}°C {t('out', 'बाहर')}</>} className="readout border-ink-200 bg-white text-ink-700">
                  <b>{t('Temperature outside', 'बाहर का तापमान')}</b>
                  <p className="mt-1">{t('From the weather sensor on the roof. Hot days need more AC, so the "should use" number for every room goes up with it.', 'छत के मौसम सेंसर से। गर्म दिन में एसी ज़्यादा चलता है, इसलिए हर कमरे का "इतनी बिजली लगनी चाहिए" अनुमान भी बढ़ता है।')}</p>
                </Popover>
                {live.grid_on ? (
                  <Popover label={<><Zap size={12} aria-hidden />{t('Grid on', 'बिजली चालू')}</>} className="border-leaf-200 bg-leaf-50 text-leaf-700">
                    <b>{t('Mains power is on', 'मेन बिजली चालू है')}</b>
                    <p className="mt-1">{t('Power is coming from the grid, so every energy check is running.', 'बिजली ग्रिड से आ रही है, इसलिए बिजली की सारी जाँच चल रही है।')}</p>
                    <p className="mt-1">{t('If the power goes, this turns red. During a cut the meter reads zero, so energy checks pause and the inverter rooms run on battery. When power returns, ECOGUARD looks for rooms that switched back on by themselves.', 'बिजली जाने पर यह लाल हो जाएगा। कट के दौरान मीटर शून्य पढ़ता है, इसलिए जाँच रुकती है। बिजली लौटने पर ECOGUARD देखता है कि कौन से कमरे अपने आप चालू हो गए।')}</p>
                  </Popover>
                ) : (
                  <Popover label={<><ZapOff size={12} aria-hidden />{t('Power cut', 'बिजली कटी')}</>} className="border-alarm-200 bg-alarm-50 text-danger">
                    <b>{t('Power cut right now', 'अभी बिजली कटी है')}</b>
                    <p className="mt-1">{t('The meter reads zero, so energy checks are paused. Water checks keep running on the battery-backed water box.', 'मीटर शून्य पढ़ रहा है, इसलिए बिजली की जाँच रुकी है। पानी की जाँच बैटरी पर चलती रहती है।')}</p>
                  </Popover>
                )}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              {error && <span className="pill bg-alarm-50 text-danger" role="status">Server offline</span>}
              <Voice />
              <div className="flex rounded-lg border border-ink-300 bg-white p-0.5 text-xs" role="group" aria-label="Language" title={t('Language for menus, page notes and advice', 'मेन्यू, नोट्स और सलाह की भाषा')}>
                {['en', 'hi'].map((l) => (
                  <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                    className={`rounded-md px-2 py-1 font-medium ${lang === l ? 'bg-night-900 text-white' : 'text-ink-700'}`}>{l === 'en' ? 'EN' : 'हिं'}</button>
                ))}
              </div>
            </div>
          </div>
        </header>
        {DEMO && (
          <div className="border-b border-volt-200 bg-volt-50 px-4 py-2 text-xs text-volt-700 sm:px-6">
            {t('Online demo: a frozen moment of the simulated Academic Block A. Buttons respond but change nothing. The full system runs live from the GitHub repo with one command.', 'ऑनलाइन डेमो: सिम्युलेटेड एकेडमिक ब्लॉक A का एक रुका हुआ पल। बटन जवाब देते हैं पर कुछ बदलते नहीं।')}
          </div>
        )}
        <main id="main" key={pathname} className="mx-auto max-w-[1360px] animate-rise p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 pb-5 pt-5">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9" />
      <div>
        <div className="font-display text-[17px] font-semibold tracking-tight text-white">ECOGUARD</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-leaf-300/80">power · water · walls</div>
      </div>
    </div>
  );
}

// the "robot" heartbeat: is the system alive, when did it last hear from the building
function SystemStrip({ live, error }) {
  const ok = !error && live?.ready;
  return (
    <div className="border-t border-night-700 px-5 py-3 font-mono text-[10.5px] leading-5 text-ink-300">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'animate-pulseDot bg-leaf-400' : 'bg-alarm-400'}`} aria-hidden />
        {DEMO ? 'Online demo · frozen snapshot' : ok ? 'Sensors online' : error ? 'No link to server' : 'Waiting for sensors'}
      </div>
      {live?.ready && <div className="text-ink-400">{live.rooms?.length ?? 0} rooms · 15-min readings</div>}
    </div>
  );
}
