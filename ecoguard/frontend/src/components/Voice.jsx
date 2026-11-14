import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff } from 'lucide-react';
import { useApp } from '../App';
import { api } from '../lib/api';
import { num } from '../lib/format';

// Voice commands for staff (browser speech recognition, English or Hindi):
//   "switch off classroom 201" / "lab band karo"     -> relay off (only if the room is empty)
//   "set AC in seminar room to 24"                   -> AC setpoint reset
//   "status of the computer lab" / "lab ka status"   -> spoken summary
//   "open alerts" / "show water"                     -> navigate
const PAGES = [['alert', '/alerts'], ['water', '/water'], ['pump', '/water'], ['wall', '/wiring'], ['wiring', '/wiring'], ['hvac', '/hvac'],
  ['comfort', '/hvac'], ['forecast', '/forecast'], ['saving', '/savings'], ['camera', '/camera'], ['real', '/real'], ['setting', '/settings'], ['overview', '/'], ['home', '/']];

function findRoom(text, rooms) {
  const t = text.toLowerCase();
  const num3 = t.match(/\b(\d{3})\b/);
  if (num3) { const r = rooms.find((x) => x.id.endsWith(num3[1])); if (r) return r; }
  const keys = [['lab', 'LAB-1'], ['computer', 'LAB-1'], ['seminar', 'CR-103'], ['admin', 'OFF-ADM'], ['office', 'OFF-ADM'], ['faculty', 'OFF-FAC'], ['staff', 'OFF-FAC']];
  for (const [k, id] of keys) if (t.includes(k)) return rooms.find((x) => x.id === id);
  return null;
}

export default function Voice() {
  const { live, lang } = useApp();
  const nav = useNavigate();
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState('');
  const rec = useRef(null);
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
    if (/(\bac\b|a\.c\.|air condition)/.test(t) && /(24|reset|set)/.test(t)) {
      if (!room) return say('Which room\'s AC?');
      await api.control('ac_setpoint', room.id);
      return say(`Setting the AC in ${room.name} to 24 degrees.`);
    }
    if (/(status|how much|kitna|kya haal|स्थिति)/.test(t)) {
      if (room) return say(`${room.name}: ${room.people} people, ${num(room.kw, 1)} kilowatts${room.t_in ? `, ${num(room.t_in, 0)} degrees inside` : ''}.`);
      const open = live?.alerts?.length || 0;
      return say(`The block is using ${num(live?.kw, 1)} kilowatts with ${open} open alert${open === 1 ? '' : 's'}.`);
    }
    const page = PAGES.find(([k]) => t.includes(k));
    if (page) { nav(page[1]); return say(`Opening ${page[0]}.`); }
    say(`Sorry, I did not catch that: "${text}".`);
  }

  if (!Rec) return null;   // browser without speech recognition: no button at all
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const r = new Rec();
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = false;
    r.onresult = (e) => handle(e.results[0][0].transcript).catch((err) => say(`That did not work: ${err.message}`));
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
    setMsg('Listening…');
  };
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="hidden max-w-xs truncate text-xs text-ink-500 md:inline" role="status">{msg}</span>}
      <button onClick={toggle} aria-pressed={on} aria-label={on ? 'Stop listening' : 'Voice command'} title='Try: "switch off classroom 202" or "status of the lab"'
        className={`btn-ghost ${on ? 'border-danger text-danger' : ''}`}>{on ? <MicOff size={16} /> : <Mic size={16} />}</button>
    </div>
  );
}
