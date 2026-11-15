import { useState } from 'react';
import { Check, Droplets, Flame, PowerOff, Thermometer, Wrench, X, Zap } from 'lucide-react';
import { useApp } from '../App';
import { useT } from '../lib/i18n';
import { api } from '../lib/api';
import { KIND, num, rs, since, targetName, fmtTime } from '../lib/format';

const ICON = { energy: Zap, water: Droplets, hidden: Flame };
const BAR = { energy: 'bg-volt-400', water: 'bg-river-500', hidden: 'bg-ember-500' };

// What a manager can do for each kind of alert.
const ACTIONS = {
  empty_room: [{ command: 'switch_off', label: 'Switch room off', icon: PowerOff }],
  over_use: [{ command: 'work_order', label: 'Ask staff to check', icon: Wrench }],
  overcool: [{ command: 'ac_setpoint', label: 'Reset AC to 24 °C', icon: Thermometer }],
  door_open: [{ command: 'work_order', label: 'Ask staff to close it', icon: Wrench }],
  wall_heat: [{ command: 'work_order', label: 'Send electrician', icon: Wrench }],
  earth_leak: [{ command: 'work_order', label: 'Send electrician', icon: Wrench }],
  night_flow: [{ command: 'close_valve', label: 'Close floor valve', icon: PowerOff }, { command: 'work_order', label: 'Send plumber', icon: Wrench }],
  overflow: [{ command: 'pump_off', label: 'Stop pump', icon: PowerOff }, { command: 'work_order', label: 'Replace float', icon: Wrench }],
  dry_run: [{ command: 'pump_off', label: 'Stop pump', icon: PowerOff }],
};

// One plain sentence per check: what this alert means.
const MEANS = {
  empty_room: ['Nobody is in this room, but lights, fans, AC or PCs are still running.', 'कमरे में कोई नहीं है, फिर भी लाइट, पंखे, एसी या पीसी चल रहे हैं।'],
  over_use: ['People are in the room, but it uses far more than a room like this normally does with that many people.', 'कमरे में लोग हैं, पर इतने लोगों के लिए जितनी बिजली लगनी चाहिए उससे बहुत ज़्यादा लग रही है।'],
  overcool: ['The AC is set colder than needed. Every degree below 24 °C costs about 6% more power.', 'एसी ज़रूरत से ज़्यादा ठंडा है। 24 °C से हर डिग्री नीचे लगभग 6% ज़्यादा बिजली।'],
  door_open: ['The AC runs at full power but the room stays hot: a door or window is probably open.', 'एसी पूरी ताक़त से चल रहा है पर कमरा गर्म है: शायद दरवाज़ा या खिड़की खुली है।'],
  wall_heat: ['A wiring joint inside the wall has loosened. It turns power into heat inside the wall, which wastes money and can start a fire.', 'दीवार के अंदर तार का जोड़ ढीला हो गया है। बिजली दीवार में गर्मी बनकर बर्बाद होती है, आग का ख़तरा भी।'],
  earth_leak: ['A little current is escaping to earth. That usually means a damp wall or worn insulation.', 'थोड़ा करंट अर्थ में जा रहा है। आमतौर पर इसका मतलब सीलन वाली दीवार या घिसा इंसुलेशन।'],
  night_flow: ['Water keeps flowing while the building is empty, so something is leaking or a cistern is running.', 'बिल्डिंग ख़ाली है फिर भी पानी बह रहा है: कहीं लीक है या टंकी का फ़्लश चल रहा है।'],
  overflow: ['The roof tank is full but the pump is still filling it, so water spills out of the overflow pipe.', 'छत की टंकी भरी है पर पंप चल रहा है, पानी ओवरफ़्लो पाइप से बह रहा है।'],
  dry_run: ['The pump is running but no water comes out. A dry pump wastes power and burns out.', 'पंप चल रहा है पर पानी नहीं आ रहा। सूखा पंप बिजली खाता है और जल सकता है।'],
};

// The readings behind the alert, so the person can check the reason themselves.
function evidence(alert, room, t) {
  const i = alert.info || {};
  const kw = (v) => `${num(v, 2)} kW`;
  switch (alert.rule) {
    case 'empty_room': return [
      [t('People seen', 'लोग दिखे'), '0'],
      [t('Normal when empty', 'ख़ाली होने पर सामान्य'), room ? kw(room.expected_kw) : '–'],
      [t('Extra power found', 'फ़ालतू बिजली मिली'), i.extra_kw != null ? kw(i.extra_kw) : '–'],
      [t('Probably', 'शायद'), i.cause || '–'],
    ];
    case 'over_use': return [
      [t('People seen', 'लोग दिखे'), room ? `${room.people}` : '–'],
      [t('Drawing now', 'अभी खपत'), room ? kw(room.kw) : '–'],
      [t('Expected for them', 'उनके लिए अनुमान'), i.expected_kw != null ? kw(i.expected_kw) : '–'],
    ];
    case 'overcool': return [
      [t('Room temperature', 'कमरे का तापमान'), `${num(i.t_in, 1)} °C`], [t('AC drawing', 'एसी की खपत'), kw(i.ac_kw)],
      [t('Recommended', 'सुझाया'), '24 °C (BEE)'], [t('Extra power', 'फ़ालतू बिजली'), kw(i.extra_kw)],
    ];
    case 'door_open': return [
      [t('Room temperature', 'कमरे का तापमान'), `${num(i.t_in, 1)} °C`], [t('AC drawing', 'एसी की खपत'), `${kw(i.ac_kw)} (${t('full power', 'पूरी ताक़त')})`],
      [t('Lost to the door', 'दरवाज़े से नुकसान'), kw(i.extra_kw)],
    ];
    case 'wall_heat': return [
      [t('Wiring resistance', 'तार का रेज़िस्टेंस'), `${num(i.r_now, 3)} Ω`], [t('When installed', 'लगाते समय'), `${num(i.r0, 3)} Ω`],
      [t('Heat in the wall now', 'अभी दीवार में गर्मी'), `${num(i.heat_w, 0)} W`], [t('At full load', 'पूरे लोड पर'), `${num(i.peak_heat_w, 0)} W`],
    ];
    case 'earth_leak': return [
      [t('Leak current', 'लीक करंट'), `${num(i.leak_ma, 0)} mA`], [t('Normal', 'सामान्य'), t('below 10 mA', '10 mA से कम')], [t('Safety trip', 'सेफ़्टी ट्रिप'), '30 mA'],
    ];
    case 'night_flow': return [
      [t('Flow while empty', 'ख़ाली में बहाव'), `${num(i.lph, 0)} L/h`], [t('Normal', 'सामान्य'), '0 L/h'], [t('Probably', 'शायद'), i.cause || '–'],
    ];
    case 'overflow': return [[t('Roof tank', 'छत की टंकी'), '100%'], [t('Pump', 'पंप'), t('still running', 'अभी चल रहा')]];
    case 'dry_run': return [[t('Pump', 'पंप'), t('running', 'चल रहा')], [t('Water out', 'पानी निकला'), '0 L']];
    default: return [];
  }
}

export default function AlertCard({ alert, now, rooms, compact = false, onChange }) {
  const { lang } = useApp();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [acted, setActed] = useState(false);
  const [answered, setAnswered] = useState(null);
  const room = rooms?.find((r) => r.id === alert.target);
  const facts = evidence(alert, room, t);
  const k = KIND[alert.kind] || KIND.energy;
  const Icon = ICON[alert.kind] || Zap;
  const active = alert.end == null;

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); setDone(msg); onChange?.(); return true; } catch (e) { setDone(`Failed: ${e.message}`); return false; } finally { setBusy(false); }
  };

  return (
    <article className="card relative overflow-hidden card-pad pl-5">
      <span className={`absolute inset-y-0 left-0 w-1 ${BAR[alert.kind] || BAR.energy}`} aria-hidden />
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-lg p-2 ${k.bg}`}><Icon size={18} className={k.color} aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[15px] font-semibold leading-snug text-ink-900">{alert.title}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`pill ${k.bg} ${k.color}`}>{k.label}</span>
            {alert.severity === 'high' && <span className="pill bg-danger text-white">High priority</span>}
            <StatusPill alert={alert} />
          </div>
          <div className="mt-1.5 text-sm text-ink-500">
            {targetName(alert.target, rooms)} · since {fmtTime(alert.start)}{active && now ? ` (${since(alert.start, now)})` : ''}
          </div>
          {!compact && MEANS[alert.rule] && <p className="mt-2 text-[13px] text-ink-500"><b className="font-medium text-ink-700">{t('What this means: ', 'इसका मतलब: ')}</b>{t(...MEANS[alert.rule])}</p>}
          {!compact && facts.length > 0 && (
            <div className="mt-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{t('Why ECOGUARD thinks so', 'ECOGUARD ऐसा क्यों मानता है')}</div>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-4">
                {facts.map(([l, v]) => <div key={l}><dt className="text-ink-500">{l}</dt><dd className={`font-medium text-ink-900 ${/^[\d–]/.test(v) ? 'readout' : ''}`}>{v}</dd></div>)}
              </dl>
            </div>
          )}
          {!compact && <p className="mt-2 text-sm leading-relaxed text-ink-700"><b className="font-medium text-ink-900">{t('What to do: ', 'क्या करें: ')}</b>{lang === 'hi' ? alert.advice_hi : alert.advice_en}</p>}
          <div className="readout mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-500">
            {alert.kwh > 0 && <span>{num(alert.kwh, 2)} kWh</span>}
            {alert.litres > 0 && <span>{num(alert.litres, 0)} L</span>}
            <span className="font-medium text-ink-700">{rs(alert.rupees)} so far</span>
            {alert.co2 > 0 && <span>{num(alert.co2, 1)} kg CO₂</span>}
          </div>
          {!compact && active && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {acted || alert.status === 'actioned' ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-leaf-50 px-3 py-2 text-sm font-medium text-leaf-700" role="status"><Check size={14} />{acted ? `${t('Done', 'हो गया')}: ${acted}` : t('ECOGUARD already acted. It will close when the readings are normal.', 'ECOGUARD ने कार्रवाई कर दी। रीडिंग सामान्य होते ही बंद होगा।')}</span>
              ) : (ACTIONS[alert.rule] || []).map((a) => (
                <button key={a.command} className="btn-primary" disabled={busy}
                  onClick={async () => { if (await act(() => api.control(a.command, alert.target, alert.id), null)) setActed(a.label); }}>
                  <a.icon size={14} />{a.label}
                </button>
              ))}
              {!alert.feedback && (answered ? (
                <span className="ml-auto text-xs text-ink-500" role="status">{answered === 'yes' ? t('Thanks: saved as real waste. The model learns from it.', 'धन्यवाद: असली बर्बादी के रूप में सहेजा।') : t('Thanks: saved as not waste. No automatic action for it.', 'धन्यवाद: बर्बादी नहीं के रूप में सहेजा।')}</span>
              ) : (
                <div className="ml-auto flex items-center gap-1 text-xs text-ink-500">
                  <span className="hidden sm:inline">{t('Right call?', 'सही पकड़ा?')}</span>
                  <button className="btn px-2 text-leaf-700 hover:bg-leaf-50" disabled={busy} aria-label="Yes, this is real waste" onClick={async () => { if (await act(() => api.feedback(alert.id, 'confirm'), null)) setAnswered('yes'); }}><Check size={14} />{t('Yes', 'हाँ')}</button>
                  <button className="btn px-2 text-ink-500 hover:bg-ink-100" disabled={busy} aria-label="No, this is not waste" onClick={async () => { if (await act(() => api.feedback(alert.id, 'dismiss'), null)) setAnswered('no'); }}><X size={14} />{t('No', 'नहीं')}</button>
                </div>
              ))}
            </div>
          )}
          {done && done.startsWith('Failed') && <div className="mt-2 text-xs text-danger" role="status">{done}</div>}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ alert }) {
  if (alert.feedback === 'dismissed') return <span className="pill bg-ink-100 text-ink-500">Dismissed</span>;
  if (alert.status === 'actioned') return <span className="pill bg-brand-50 text-brand-700">Action taken</span>;
  if (alert.end) return <span className="pill bg-ink-100 text-ink-500">Resolved</span>;
  return <span className="pill bg-red-50 text-danger">Open</span>;
}
