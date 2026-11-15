import { useEffect, useRef, useState } from 'react';
import { Camera as CamIcon, ImageUp, ShieldCheck, Users, Video, VideoOff } from 'lucide-react';
import { useApp } from '../App';
import { api } from '../lib/api';
import { num } from '../lib/format';
import About from '../components/About';

export default function Camera() {
  const { live } = useApp();
  const rooms = live?.rooms || [];
  const [zone, setZone] = useState('CR-201');
  const [status, setStatus] = useState(null);
  const [img, setImg] = useState(null);         // object URL of the frame being shown
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [cam, setCam] = useState(false);
  const video = useRef(null);
  const stream = useRef(null);

  useEffect(() => { api.cvStatus().then(setStatus).catch(() => setStatus({ ready: false, reason: 'server unreachable' })); }, []);
  useEffect(() => () => stopCam(), []);

  const send = async (blob) => {
    setBusy(true); setErr(null);
    setImg((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    try { setRes(await api.cvCount(blob, zone)); } catch (e) { setErr(e.message); setRes(null); } finally { setBusy(false); }
  };
  const startCam = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      video.current.srcObject = stream.current;
      await video.current.play();
      setCam(true);
    } catch (e) { setErr(`Camera not available: ${e.message}`); }
  };
  function stopCam() { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCam(false); }
  const snap = () => {
    const v = video.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob((b) => b && send(b), 'image/jpeg', 0.85);
  };
  const room = rooms.find((r) => r.id === zone);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-title">People count</h1>
        <p className="h-sub max-w-3xl">Counts people in a room from a CCTV frame or a phone photo with a YOLO person detector, running on the ECOGUARD server. The count tells the system whether a room is really empty before it switches anything off.</p>
      </div>
      <About id="camera" points={[
        ["ECOGUARD never switches off a room that has people in it. The camera count is how it knows.", "ECOGUARD कभी लोगों वाला कमरा बंद नहीं करता। कैमरे की गिनती से उसे यह पता चलता है।"],
        ["A YOLO person detector runs on the ECOGUARD server and counts the people in one frame.", "ECOGUARD सर्वर पर YOLO मॉडल एक फ्रेम में लोगों को गिनता है।"],
        ["Only the number is saved. The picture is deleted straight away and never leaves the server.", "सिर्फ़ गिनती रखी जाती है। तस्वीर तुरंत मिटा दी जाती है और सर्वर से बाहर नहीं जाती।"],
        ["Rooms without a camera use a cheap motion (PIR) sensor instead.", "जिन कमरों में कैमरा नहीं, वहाँ सस्ता मोशन (PIR) सेंसर इस्तेमाल होता है।"],
      ]} />

      <section className="card card-pad">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-ink-900">Every room right now</h2>
          <span className="text-xs text-ink-500">Tap a room to count it from a photo below</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rooms.map((r) => {
            const full = Math.min(100, (r.people / Math.max(1, r.cap)) * 100);
            return (
              <button key={r.id} onClick={() => setZone(r.id)} aria-pressed={zone === r.id}
                className={`rounded-xl border p-3 text-left transition hover:border-leaf-500 ${zone === r.id ? 'border-leaf-500 bg-leaf-50' : 'border-ink-200 bg-white'}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-900">{r.name}</span>
                  <span className="readout text-sm text-ink-700">{r.people}<span className="text-ink-400">/{r.cap}</span></span>
                </div>
                <div className="mt-2 h-1.5 rounded bg-ink-100"><div className="h-1.5 rounded bg-leaf-500" style={{ width: `${full}%` }} /></div>
                <div className={`mt-2 text-xs ${r.people > 0 ? 'text-leaf-700' : 'text-ink-500'}`}>{r.people > 0 ? 'In use: never switched off' : 'Empty: safe to switch off'}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card card-pad space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-ink-700">Room
              <select value={zone} onChange={(e) => setZone(e.target.value)} className="ml-2 rounded-lg border border-ink-300 px-2 py-1.5 text-sm">
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="btn-ghost cursor-pointer">
              <ImageUp size={14} />Upload photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
            </label>
            {!cam
              ? <button className="btn-ghost" onClick={startCam}><Video size={14} />Use webcam</button>
              : <><button className="btn-primary" onClick={snap} disabled={busy}><CamIcon size={14} />Count now</button><button className="btn-ghost" onClick={stopCam}><VideoOff size={14} />Stop</button></>}
          </div>
          <div className="relative overflow-hidden rounded-xl bg-ink-900/5">
            <video ref={video} className={cam ? 'w-full' : 'hidden'} muted playsInline />
            {!cam && img && (
              <div className="relative">
                <img src={img} alt="Frame sent for counting" className="w-full" />
                {res?.boxes.map((b, i) => (
                  <div key={i} className="absolute rounded border-2 border-emerald-400" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
                    <span className="absolute -top-5 left-0 rounded bg-emerald-500 px-1 text-[10px] font-semibold text-white">{Math.round(b.conf * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
            {!cam && !img && (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-ink-500">
                <Users size={28} className="text-ink-300" />
                <div className="text-sm">Upload a classroom photo or turn on the webcam</div>
              </div>
            )}
            {busy && <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-ink-700">Counting…</div>}
          </div>
          {err && <div className="text-sm text-danger" role="alert">{err}</div>}
        </section>

        <aside className="space-y-3">
          <div className="card card-pad">
            <div className="label">People counted</div>
            <div className="mt-1 text-4xl font-semibold text-brand-700">{res ? res.people : '–'}</div>
            {res && <div className="mt-1 text-sm text-ink-500">{room?.name}: {res.stored ? `${res.stored.occupancy_pct}% of ${room?.cap ?? ''} seats` : ''} · {num(res.ms, 0)} ms on the server</div>}
            {room && <div className="mt-3 text-sm text-ink-700">Room sensor right now: <b>{room.people}</b> people</div>}
          </div>
          <div className="card card-pad text-sm text-ink-700">
            <div className="flex items-center gap-2 font-medium text-ink-900"><ShieldCheck size={16} className="text-brand-700" />Privacy</div>
            <p className="mt-1">The frame is processed in memory and thrown away. Only the number of people is stored, never the picture or any face. This follows the data-minimisation rule of India's DPDP Act 2023.</p>
          </div>
          <div className="card card-pad text-sm text-ink-700">
            <div className="font-medium text-ink-900">Model</div>
            <p className="mt-1">{status?.ready ? <>YOLO11n person detector ({status.weights}), confidence ≥ {status.conf}. On a CCTV stream, <code>cv/camera_node.py</code> sends one count a minute per room.</> : <>Camera module not active: {status?.reason || '…'}. The rest of ECOGUARD keeps working on PIR and timetable data.</>}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
