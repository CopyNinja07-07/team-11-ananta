import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, Camera, CheckCircle2, Gauge, LineChart, ListChecks, Snowflake, ThumbsUp } from 'lucide-react';
import About from '../components/About';
import DataSource from '../components/DataSource';
import { Loading } from '../components/States';
import { api } from '../lib/api';
import { num } from '../lib/format';
import { useT } from '../lib/i18n';
import { useApp } from '../App';

// Every trained model in ECOGUARD: what it learned from, how good it is on data it never saw,
// and where in the app it is working.
const FAULT_NAMES = {
  lights_left_on: 'Lights and fans left on', ac_left_on: 'AC left on', pcs_left_on: 'Lab PCs left on',
  comeback: 'Came back on after a power cut', overcool: 'AC set too cold', door_open: 'AC with door open',
  loose_joint: 'Loose joint heating the wall', leak: 'Pipe leak', cistern: 'Running cistern',
  float_fail: 'Tank float switch failed', dry_run: 'Pump running dry',
};

export default function Models() {
  const t = useT();
  const { live } = useApp();
  const [ev, setEv] = useState(null);
  const [real, setReal] = useState(null);
  const [cv, setCv] = useState(null);
  useEffect(() => {
    api.model().then(setEv).catch(() => setEv({}));
    api.realModels().then(setReal).catch(() => setReal({}));
    api.cvStatus().then(setCv).catch(() => setCv({ ready: false }));
  }, []);
  if (!ev || !real) return <Loading what="models" />;
  const e = real.electricity || {};
  const c = real.chilledwater || {};
  const f = real.forecaster || {};
  const faults = Object.entries(ev.by_fault || {}).sort((a, b) => b[1].n - a[1].n);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2"><DataSource kind="sim" /> <DataSource kind="real" /></div>
        <h1 className="h-title">{t('How ECOGUARD decides', 'ECOGUARD कैसे तय करता है')}</h1>
        <p className="h-sub max-w-3xl">{t('Five trained models and nine checks work together. Each card says what the model learned from, how well it did on data it never saw, and where you meet it in the app.', 'पाँच ट्रेन किए गए मॉडल और नौ जाँच साथ मिलकर काम करते हैं। हर कार्ड बताता है कि मॉडल ने किस डेटा से सीखा, बिना देखे डेटा पर कितना सही रहा, और ऐप में कहाँ दिखता है।')}</p>
      </div>

      <About id="models" points={[
        ['A model here is a formula learned from past readings. It is never a chatbot guessing.', 'मॉडल यानी पुरानी रीडिंग से सीखा गया फ़ॉर्मूला, कोई अंदाज़ा लगाने वाला चैटबॉट नहीं।'],
        ['Every score below is on data the model did not train on, so it shows how it will do in real use.', 'नीचे हर स्कोर उस डेटा पर है जिस पर मॉडल ने नहीं सीखा, ताकि असली काम का अंदाज़ा मिले।'],
        ['Money and carbon are worked out by plain arithmetic in code, not by a model.', 'पैसा और कार्बन सीधे हिसाब से निकलते हैं, मॉडल से नहीं।'],
        ['Your Yes / No on each alert is saved as a label, so the room models can be retrained on this building.', 'हर अलर्ट पर आपका हाँ / ना एक लेबल बनता है, जिससे मॉडल इसी बिल्डिंग पर फिर से सीखते हैं।'],
      ]} />

      {/* the path one reading takes */}
      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">{t('What happens to one reading', 'एक रीडिंग के साथ क्या होता है')}</h2>
        <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            [Gauge, t('Reading arrives', 'रीडिंग आती है'), t('power, people, water, every 15 min', 'बिजली, लोग, पानी, हर 15 मिनट')],
            [Camera, t('People counted', 'लोग गिने'), t('camera model, or the PIR sensor', 'कैमरा मॉडल या PIR सेंसर')],
            [Brain, t('Expected use', 'अनुमानित खपत'), t('room model: what it should use now', 'कमरे का मॉडल: अभी कितनी लगनी चाहिए')],
            [ListChecks, t('Nine checks', 'नौ जाँच'), t('compare, then physics rules', 'तुलना, फिर भौतिकी के नियम')],
            [CheckCircle2, t('Alert + fix', 'अलर्ट + उपाय'), t('cost in rupees, one-tap fix', 'रुपये में नुकसान, एक टैप उपाय')],
            [ThumbsUp, t('Your Yes / No', 'आपका हाँ / ना'), t('becomes a training label', 'ट्रेनिंग लेबल बनता है')],
          ].map(([Icon, a, b], i) => (
            <li key={a} className="relative rounded-xl border border-ink-200 bg-ink-50 p-3">
              <div className="flex items-center gap-2 font-medium text-ink-900"><span className="readout text-xs text-leaf-600">{i + 1}</span><Icon size={15} className="text-leaf-600" aria-hidden />{a}</div>
              <div className="mt-1 text-xs text-ink-500">{b}</div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModelCard icon={Brain} title={t('Room model: how much a room should use', 'कमरे का मॉडल: कितनी बिजली लगनी चाहिए')}
          kind={t('Huber regression, one per room · trained on the simulated block', 'ह्यूबर रिग्रेशन, हर कमरे का अलग')}
          learned={t('A year of 15-minute readings from Academic Block A. It looks at how many people are inside, how hot it is, daylight and the hour. Huber regression ignores the waste hidden in the training data, so it learns normal use, not wasteful use.', 'एकेडमिक ब्लॉक A की साल भर की रीडिंग। यह देखता है अंदर कितने लोग हैं, कितनी गर्मी है, धूप और समय। ह्यूबर रिग्रेशन ट्रेनिंग डेटा की बर्बादी को नज़रअंदाज़ करता है।')}
          stats={[['30', t('inputs per room', 'हर कमरे के इनपुट')], [`${live?.rooms?.length || 8}`, t('rooms, one model each', 'कमरे, हर एक का मॉडल')]]}
          where={[[t('Rooms: the "Should use" column', 'कमरे: "लगनी चाहिए" कॉलम'), '/rooms'], [t('Room page: grey dashed line', 'कमरे का पेज: धूसर डैश लाइन'), '/rooms/CR-201'], [t('Next 24 hours', 'अगले 24 घंटे'), '/forecast']]} />

        <ModelCard icon={ListChecks} title={t('Waste detector: nine checks', 'बर्बादी पकड़ने वाला: नौ जाँच')}
          kind={t('Room model + physics rules · scored on a simulated year', 'कमरे का मॉडल + भौतिकी नियम')}
          learned={t(`We hid ${num(ev.faults_with_waste, 0)} real-world faults in a simulated year (AC left on, leaks, loose joints and more) and never told the detector where they were.`, `हमने सिम्युलेटेड साल में ${num(ev.faults_with_waste, 0)} खराबियाँ छिपाईं और डिटेक्टर को नहीं बताया कि कहाँ।`)}
          stats={[[`${num((ev.recall || 0) * 100, 1)}%`, t('of faults caught', 'खराबियाँ पकड़ीं')], [`${num((ev.precision || 0) * 100, 1)}%`, t('of alerts were real', 'अलर्ट सही निकले')]]}
          where={[[t('Alerts', 'अलर्ट'), '/alerts'], [t('Live building: Needs attention', 'लाइव बिल्डिंग: ध्यान दें'), '/']]} />

        <ModelCard icon={Camera} title={t('People counter (camera)', 'लोग गिनने वाला (कैमरा)')}
          kind={t('YOLO11n object detector · pretrained on the COCO image set', 'YOLO11n ऑब्जेक्ट डिटेक्टर')}
          learned={t('Finds each person in a camera frame. The count is stored; the picture is thrown away at once. It stops ECOGUARD from ever switching off a room with people in it.', 'कैमरा फ्रेम में हर इंसान को ढूँढता है। गिनती रखी जाती है, तस्वीर तुरंत मिटा दी जाती है।')}
          stats={[[cv?.ready ? t('Ready', 'तैयार') : t('Off', 'बंद'), cv?.ready ? (cv.weights || 'yolo11n.pt') : t('needs the server with the camera add-on', 'कैमरा ऐड-ऑन वाले सर्वर पर चलता है')], ['0', t('photos kept', 'तस्वीरें रखी गईं')]]}
          where={[[t('People count', 'कमरे में कितने लोग'), '/camera']]} />

        <ModelCard icon={Snowflake} title={t('Real-building baselines', 'असली इमारतों के बेसलाइन')}
          kind={t('LightGBM, one model for all buildings · BDG2 open data', 'LightGBM, सभी इमारतों का एक मॉडल')}
          learned={t(`${num(e.train_rows / 1e6, 1)} million hourly rows from ${num(e.buildings, 0)} real classrooms, labs and offices (2016), tested on 2017. A second model does the same for cooling (chilled water) in ${num(c.buildings, 0)} buildings.`, `${num(e.buildings, 0)} असली क्लासरूम, लैब और ऑफिस की ${num(e.train_rows / 1e6, 1)} मिलियन घंटेवार रीडिंग (2016) पर सीखा, 2017 पर परखा।`)}
          stats={[[`${num(e.median_cvrmse, 1)}%`, t('typical hourly error, electricity', 'आम घंटेवार गलती, बिजली')], [`${num(e.ashrae_g14_pass_pct, 0)}%`, t('of buildings pass ASHRAE Guideline 14', 'इमारतें ASHRAE गाइडलाइन 14 पास')]]}
          where={[[t('Tested on 659 buildings', '659 इमारतों पर परखा'), '/real']]} />

        <ModelCard icon={LineChart} title={t('Day-ahead forecaster', 'अगले दिन का अनुमान')}
          kind={t(`LSTM + MLP (PyTorch), ${num(f.parameters / 1000, 0)} k parameters · BDG2 open data`, 'LSTM + MLP (PyTorch)')}
          learned={t(`Reads a building's last 7 days of hourly use and the weather, and predicts the next 24 hours. Trained on ${num(f.buildings, 0)} real buildings.`, `किसी इमारत के पिछले 7 दिन और मौसम देखकर अगले 24 घंटे बताता है। ${num(f.buildings, 0)} असली इमारतों पर सीखा।`)}
          stats={f.median_cvrmse ? [[`${num(f.median_cvrmse.model, 1)}%`, t(`typical error (vs ${num(f.median_cvrmse.yesterday, 0)}% for "same as yesterday")`, `आम गलती ("कल जैसा" की ${num(f.median_cvrmse.yesterday, 0)}%)`)], [`${num(f.model_beats_both_pct, 0)}%`, t('of buildings where it beats both simple forecasts', 'इमारतें जहाँ यह दोनों आसान अनुमानों से बेहतर')]] : [['–', t('not trained yet', 'अभी ट्रेन नहीं')]]}
          where={[[t('Any real building: "Forecast made the night before"', 'कोई भी असली इमारत: "रात पहले किया गया अनुमान"'), '/real']]}
          note={t('For Academic Block A itself, "Next 24 hours" uses the room models, because the simulated block uses almost no power at night, unlike the real buildings this model learned from. Once real meters are fitted and a few weeks of history exist, the same model can forecast the block.', 'एकेडमिक ब्लॉक A के लिए "अगले 24 घंटे" कमरे के मॉडल से बनता है, क्योंकि सिम्युलेटेड ब्लॉक रात में लगभग बिजली नहीं लेता। असली मीटर लगने के बाद यही मॉडल ब्लॉक का अनुमान दे सकता है।')} />
      </div>

      <section className="card card-pad">
        <h2 className="font-semibold text-ink-900">{t('Detector report card, fault by fault', 'हर खराबी पर डिटेक्टर का रिपोर्ट कार्ड')}</h2>
        <p className="h-sub">{t('Caught: share of that fault the detector found. Time to catch: half of them were found within this time.', 'पकड़ा: उस खराबी का कितना हिस्सा मिला। पकड़ने में समय: आधे इतने समय में मिल गए।')}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-ink-200 text-left text-xs text-ink-500">
              <th className="py-2 font-medium">{t('Fault', 'खराबी')}</th><th className="font-medium">{t('Times hidden', 'कितनी बार')}</th><th className="font-medium">{t('Caught', 'पकड़ा')}</th><th className="font-medium">{t('Time to catch', 'पकड़ने में समय')}</th><th className="font-medium">{t('Waste in that year', 'उस साल बर्बादी')}</th>
            </tr></thead>
            <tbody>
              {faults.map(([k, v]) => (
                <tr key={k} className="border-b border-ink-100 last:border-0">
                  <td className="py-2 text-ink-900">{FAULT_NAMES[k] || k}</td>
                  <td className="readout">{v.n}</td>
                  <td><span className="readout">{num(v.recall * 100, 0)}%</span><span className="ml-2 inline-block h-1.5 w-16 rounded bg-ink-100 align-middle"><span className="block h-1.5 rounded bg-leaf-500" style={{ width: `${v.recall * 100}%` }} /></span></td>
                  <td className="readout">{v.median_delay_h < 1 ? `${num(v.median_delay_h * 60, 0)} min` : v.median_delay_h < 48 ? `${num(v.median_delay_h, 1)} h` : `${num(v.median_delay_h / 24, 0)} days`}</td>
                  <td className="readout text-ink-700">{v.waste_kwh ? `${num(v.waste_kwh, 0)} kWh` : ''}{v.waste_kwh && v.waste_l ? ' · ' : ''}{v.waste_l ? `${num(v.waste_l / 1000, 0)} kL` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-500">{t('A loose joint takes days to show because the wall heats slowly; ECOGUARD waits until the rise is certain before calling an electrician.', 'ढीला जोड़ दिखने में दिन लगते हैं क्योंकि दीवार धीरे गर्म होती है; पक्का होने पर ही इलेक्ट्रीशियन बुलाया जाता है।')}</p>
      </section>
    </div>
  );
}

function ModelCard({ icon: Icon, title, kind, learned, stats, where, note }) {
  return (
    <section className="card card-pad flex flex-col">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-leaf-50 p-2 text-leaf-700"><Icon size={18} aria-hidden /></span>
        <div><h2 className="font-semibold text-ink-900">{title}</h2><div className="text-xs text-ink-500">{kind}</div></div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-700">{learned}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {stats.map(([v, l]) => (
          <div key={l} className="rounded-lg bg-ink-50 p-2.5"><dt className="readout text-xl font-medium text-leaf-700">{v}</dt><dd className="text-xs text-ink-500">{l}</dd></div>
        ))}
      </dl>
      {note && <p className="mt-3 rounded-lg border border-volt-200 bg-volt-50 p-2.5 text-xs leading-relaxed text-volt-800">{note}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {where.map(([l, to]) => <Link key={l} to={to} className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-700 hover:border-leaf-500 hover:text-leaf-700">{l}<ArrowRight size={12} aria-hidden /></Link>)}
      </div>
    </section>
  );
}
