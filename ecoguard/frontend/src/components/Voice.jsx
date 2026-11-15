import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, X } from 'lucide-react';
import { useT } from '../lib/i18n';
import { useApp } from '../App';
import { api } from '../lib/api';
import { num } from '../lib/format';

// Voice commands for staff (browser speech recognition, English or Hindi):
//   "switch off classroom 201" / "lab band karo"     -> relay off (only if the room is empty)
//   "set AC in seminar room to 24"                   -> AC setpoint reset
//   "status of the computer lab" / "lab ka status"   -> spoken summary
//   "open alerts" / "show water"                     -> navigate
const PAGES = [['alert', '/alerts'], ['water', '/water'], ['pump', '/water'], ['wall', '/wiring'], ['wiring', '/wiring'], ['hvac', '/hvac'],
  ['comfort', '/hvac'], ['forecast', '/forecast'], ['saving', '/savings'], ['camera', '/camera'], ['real', '/real'], ['setting', '/settings'], ['पानी', '/water'], ['अलर्ट', '/alerts'], ['कमरे', '/rooms'], ['room', '/rooms'], ['बचत', '/savings'], ['test', '/simulator'], ['overview', '/'], ['home', '/']];

const EXAMPLES = [
  ['switch off classroom 202', 'क्लासरूम 202 बंद करो'],
  ['set AC in seminar room to 24', 'सेमिनार रूम का एसी 24 करो'],
  ['status of the computer lab', 'लैब का स्टेटस'],
  ['open water', 'पानी दिखाओ'],
];

function findRoom(text, rooms) {
  const t = text.toLowerCase();
  const num3 = t.match(/\b(\d{3})\b/);
  if (num3) { const r = rooms.find((x) => x.id.endsWith(num3[1])); if (r) return r; }
  const keys = [['lab', 'LAB-1'], ['computer', 'LAB-1'], ['seminar', 'CR-103'], ['admin', 'OFF-ADM'], ['office', 'OFF-ADM'], ['faculty', 'OFF-FAC'], ['staff', 'OFF-FAC'], ['लैब', 'LAB-1'], ['सेमिनार', 'CR-103'], ['ऑफिस', 'OFF-ADM']];
  for (const [k, id] of keys) if (t.includes(k)) return rooms.find((x) => x.id === id);
  return null;
}

export default function Voice() {
  const { live, lang } = useApp();
  const nav = useNavigate();
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  const [panel, setPanel] = useState(false);
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState('');
  const rec = useRef(null);
  const box = useRef(null);
  const t = useT();
  useEffect(() => {
    if (!panel) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) setPanel(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [panel]);
  const Rec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const say = (text) => {
    setMsg(text);
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.speak(u);
    } catch { /* no speech output available */ }
  };

  async function handle(text) {
    const t = text.toLowerCase();
    const rooms = live?.rooms || [];
    const room = findRoom(t, rooms);
    if (/(switch off|turn off|band kar|bund kar|बंद)/.test(t)) {
      if (!room) return say('Which room should I switch off?');
      if (room.people > 0) return say(`${room.name} has ${room.people} people inside, so I will not switch it off.`);
      await api.control('switch_off', room.id);
      return say(`Switching off ${room.name}.`);
    }
    if (/(\bac\b|a\.c\.|air condition|एसी)/.test(t) && /(24|reset|set)/.test(t)) {
      if (!room) return say('Which room\'s AC?');
      await api.control('ac_setpoint', room.id);
      return say(`Setting the AC in ${room.name} to 24 degrees.`);
    }
    if (/(status|how much|kitna|kya haal|स्थिति|स्टेटस)/.test(t)) {
      if (room) return say(`${room.name}: ${room.people} people, ${num(room.kw, 1)} kilowatts${room.t_in ? `, ${num(room.t_in, 0)} degrees inside` : ''}.`);
      const open = live?.alerts?.length || 0;
      return say(`The block is using ${num(live?.kw, 1)} kilowatts with ${open} open alert${open === 1 ? '' : 's'}.`);
    }
    const page = PAGES.find(([k]) => t.includes(k));
    if (page) { nav(page[1]); return say(`Opening ${page[0]}.`); }
    say(`Sorry, I did not catch that: "${text}".`);
  }

  const toggle = () => {
    setPanel(true);
    if (!Rec) return;                     // no speech in this browser: the panel still takes typed commands
    if (on) { rec.current?.stop(); return; }
    const r = new Rec();
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = false;
    r.onresult = (e) => run(e.results[0][0].transcript);
    r.onend = () => setOn(false);
    r.onerror = () => { setOn(false); setMsg(t('Could not hear you. Allow the microphone, or type the command below.', 'आवाज़ नहीं सुनाई दी। माइक की अनुमति दें, या नीचे लिखें।')); };
    rec.current = r;
    r.start();
    setOn(true);
    setMsg(t('Listening… speak now', 'सुन रहा हूँ… बोलिए'));
  };
  const run = (text) => { setHeard(text); handle(text).catch((err) => say(`That did not work: ${err.message}`)); };
  const submit = (e) => { e.preventDefault(); if (typed.trim()) { run(typed.trim()); setTyped(''); } };
  return (
    <div className="relative" ref={box}>
      <button onClick={toggle} aria-pressed={on} aria-expanded={panel} aria-label={on ? 'Stop listening' : 'Voice command'}
        className={`btn-ghost ${on ? 'animate-pulse border-danger text-danger' : ''}`}>{on ? <MicOff size={16} /> : <Mic size={16} />}</button>
      {panel && (
        <div role="dialog" aria-label="Voice commands" className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-ink-200 bg-white p-4 text-[12.5px] text-ink-700 shadow-xl">
          <div className="flex items-center justify-between">
            <b className="text-ink-900">{t('Voice commands', 'आवाज़ से कमांड')}</b>
            <button className="rounded p-1 text-ink-500 hover:bg-ink-100" onClick={() => { rec.current?.stop(); setPanel(false); }} aria-label="Close"><X size={14} /></button>
          </div>
          <p className="mt-1 text-ink-500">{Rec ? t('Tap the mic and speak in English or Hindi. Or type below.', 'माइक दबाकर अंग्रेज़ी या हिंदी में बोलें, या नीचे लिखें।') : t('This browser cannot listen (Chrome and Edge can). Type the command instead.', 'यह ब्राउज़र आवाज़ नहीं सुन सकता (Chrome और Edge सुन सकते हैं)। कमांड लिखें।')}</p>
          <ul className="mt-2 space-y-1">
            {EXAMPLES.map(([en, hi]) => (
              <li key={en}><button className="w-full rounded-md bg-ink-50 px-2 py-1 text-left hover:bg-leaf-50" onClick={() => run(en)}>“{t(en, hi)}”</button></li>
            ))}
          </ul>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('Type a command', 'कमांड लिखें')}
              className="min-w-0 flex-1 rounded-md border border-ink-300 px-2 py-1.5" aria-label="Command" />
            <button className="btn-primary px-3 py-1.5 text-xs">{t('Run', 'चलाएँ')}</button>
          </form>
          {heard && <div className="mt-3 text-ink-500">{t('You said', 'आपने कहा')}: “{heard}”</div>}
          {msg && <div className="mt-1 rounded-md bg-leaf-50 px-2 py-1.5 text-leaf-800" role="status">{msg}</div>}
        </div>
      )}
    </div>
  );
}
