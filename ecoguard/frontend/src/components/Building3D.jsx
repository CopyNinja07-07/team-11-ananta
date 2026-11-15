import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { roomState } from './FloorMap';
import { floorIds, floorShort, num } from '../lib/format';

// A live 3D model of the block. Every room is a glass box coloured by what is
// happening inside. Amber sparks run from the distribution board to each room at a
// speed that follows its load; blue drops run from the sump, through the pump, up
// to the roof tank and down to each floor's washrooms. Hot wiring glows ember
// inside the wall. Built from the building config, so more floors or rooms just work.

const C = {
  busy: 0x3e8e5a, idle: 0x8ea69a, waste: 0xe3a91c, hidden: 0xb4532a,
  volt: 0xedbf48, water: 0x3f98b4, ember: 0xd48a63, slab: 0x2c5446, ground: 0x0f2a20, line: 0x21453a,
};
const ROOM = { w: 3.2, d: 3.6, h: 2.4 }, WASH = 1.8, GAP = 0.35, STOREY = 3.1;

function layout(rooms, floors) {
  // x position of every room, floor by floor, plus the washroom block at the end
  const out = {}; let maxX = 0;
  floors.forEach((f) => {
    let x = 0;
    rooms.filter((r) => r.floor === f).forEach((r) => { out[r.id] = { x: x + ROOM.w / 2, y: f * STOREY, floor: f }; x += ROOM.w + GAP; });
    out[`WASH-${f}`] = { x: x + WASH / 2, y: f * STOREY, floor: f, wash: true };
    maxX = Math.max(maxX, x + WASH);
  });
  return { pos: out, width: maxX };
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

export default function Building3D({ live, building, fallback }) {
  const mount = useRef(null);
  const state = useRef({});
  const nav = useNavigate();
  const [labels, setLabels] = useState([]);
  const [hover, setHover] = useState(null);
  const ok = useMemo(webglOk, []);
  const floors = useMemo(() => floorIds(building, live?.rooms).slice().reverse(), [building, live?.rooms?.length]);
  const geo = useMemo(() => layout(live?.rooms || [], floors), [live?.rooms?.length, floors.join()]);

  // build the scene once per layout
  useEffect(() => {
    if (!ok || !mount.current) return undefined;
    const el = mount.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a1c15, 40, 90);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    const W = geo.width, H = floors.length * STOREY;
    const center = new THREE.Vector3(W / 2 + 0.6, H / 2 - 0.2, 0);
    camera.position.set(center.x + W * 0.42, center.y + H * 0.65 + 2, 15.5 + W * 0.25);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true; controls.enableZoom = false; controls.enablePan = false;
    controls.minPolarAngle = 0.6; controls.maxPolarAngle = 1.45;
    controls.minAzimuthAngle = -1.0; controls.maxAzimuthAngle = 1.0;
    controls.autoRotate = !reduced; controls.autoRotateSpeed = 0.35;

    scene.add(new THREE.HemisphereLight(0xf4f2ec, 0x0f2a20, 1.1));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.4); sun.position.set(10, 25, 15); scene.add(sun);

    // ground with a blueprint grid
    const grid = new THREE.GridHelper(80, 80, C.line, C.line); grid.position.set(center.x, -0.02, 0); grid.material.opacity = 0.45; grid.material.transparent = true; scene.add(grid);

    const rooms = {};
    floors.forEach((f) => {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.18, ROOM.d + 0.8), new THREE.MeshStandardMaterial({ color: C.slab, roughness: 0.85, metalness: 0.05 }));
      slab.position.set(W / 2, f * STOREY - 0.09, 0); scene.add(slab);
    });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.14, ROOM.d + 0.8), new THREE.MeshStandardMaterial({ color: C.slab, transparent: true, opacity: 0.55 }));
    roof.position.set(W / 2, floors.length * STOREY - 0.07, 0); scene.add(roof);
    Object.entries(geo.pos).forEach(([id, p]) => {
      const w = p.wash ? WASH : ROOM.w;
      const mat = new THREE.MeshStandardMaterial({ color: C.idle, transparent: true, opacity: 0.32, roughness: 0.3, metalness: 0.1, emissive: 0x000000 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, ROOM.h, ROOM.d), mat);
      box.position.set(p.x, p.y + ROOM.h / 2, 0); box.userData.id = id; scene.add(box);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0xf4f2ec, transparent: true, opacity: 0.55 }));
      edges.position.copy(box.position); scene.add(edges);
      // a strip inside the back wall: lights up ember for hot wiring, river blue for a damp wall
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: C.ember, transparent: true, opacity: 0 }));
      strip.position.set(p.x, p.y + ROOM.h * 0.75, -ROOM.d / 2 + 0.06); scene.add(strip);
      rooms[id] = { box, mat, edges, strip, p };
    });

    // power: board at the left foot of the building, riser up the side, a branch into each room
    const boardPos = new THREE.Vector3(-1.6, 0.6, ROOM.d / 2 + 0.3);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: 0x21453a, emissive: 0x6b5200, emissiveIntensity: 0.6 }));
    board.position.copy(boardPos); scene.add(board);
    const powerPaths = {};
    Object.entries(geo.pos).forEach(([id, p]) => {
      if (p.wash) return;
      const pts = [boardPos.clone(), new THREE.Vector3(-1.6, p.y + 2.1, ROOM.d / 2 + 0.3), new THREE.Vector3(p.x, p.y + 2.1, ROOM.d / 2 + 0.3), new THREE.Vector3(p.x, p.y + 1.2, 0)];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), new THREE.LineBasicMaterial({ color: C.volt, transparent: true, opacity: 0.18 })));
      powerPaths[id] = curve;
    });

    // water: sump in the ground, pump, riser to a roof tank, drops down to each floor's washroom
    const xr = W + 1.4;
    const sump = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), new THREE.MeshStandardMaterial({ color: 0x0f5f7c, transparent: true, opacity: 0.8 }));
    sump.position.set(xr + 0.6, 0.25, 1.4); scene.add(sump);
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0x147a9e }));
    pump.position.set(xr, 0.3, 0); scene.add(pump);
    const roofY = floors.length * STOREY + 0.2;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xf4f2ec, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    tank.position.set(W - 1.2, roofY + 0.7, 0); scene.add(tank);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1, 28), new THREE.MeshStandardMaterial({ color: C.water, transparent: true, opacity: 0.85 }));
    scene.add(fill);
    const riser = new THREE.CatmullRomCurve3([new THREE.Vector3(xr + 0.6, 0.3, 1.4), new THREE.Vector3(xr, 0.3, 0), new THREE.Vector3(xr, roofY + 1.2, 0), new THREE.Vector3(W - 1.2, roofY + 1.4, 0)], false, 'catmullrom', 0.05);
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(riser.getPoints(60)), new THREE.LineBasicMaterial({ color: C.water, transparent: true, opacity: 0.25 })));
    const downs = {};
    floors.forEach((f) => {
      const wp = geo.pos[`WASH-${f}`];
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(W - 1.2, roofY, 0), new THREE.Vector3(wp.x, roofY - 0.2, -ROOM.d / 2 + 0.3), new THREE.Vector3(wp.x, f * STOREY + 0.6, -ROOM.d / 2 + 0.3)], false, 'catmullrom', 0.05);
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(40)), new THREE.LineBasicMaterial({ color: C.water, transparent: true, opacity: 0.15 })));
      downs[f] = c;
    });

    // ambience: twinkling stars around the block, rings pulsing out from its foot,
    // and a thin sensor sweep moving up and down the floors every few seconds
    const SN = 260;
    const sg = new THREE.BufferGeometry();
    const spos = new Float32Array(SN * 3), sphase = new Float32Array(SN);
    for (let i = 0; i < SN; i += 1) {
      const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 26;
      spos[i * 3] = center.x + Math.cos(a) * r; spos[i * 3 + 1] = Math.random() * (H + 14) - 2; spos[i * 3 + 2] = Math.sin(a) * r - 6;
      sphase[i] = Math.random() * Math.PI * 2;
    }
    sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    const scol = new Float32Array(SN * 3); sg.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(stars);
    const rings = [0, 1, 2].map((k) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.06, 64), new THREE.MeshBasicMaterial({ color: 0x6db283, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(W / 2, 0.01, 0); m.userData.k = k; scene.add(m); return m;
    });
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, ROOM.d + 1.4), new THREE.MeshBasicMaterial({ color: 0x8ec29f, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    sweep.rotation.x = -Math.PI / 2; sweep.position.set(W / 2, 0, 0); scene.add(sweep);
    const sweepEdge = new THREE.LineSegments(new THREE.EdgesGeometry(sweep.geometry), new THREE.LineBasicMaterial({ color: 0xb5d8bf, transparent: true, opacity: 0.5 }));
    sweepEdge.rotation.x = -Math.PI / 2; scene.add(sweepEdge);

    // particles: a fixed pool, each tied to a path and a speed that the live data updates
    const N = 420;
    const pg = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(points);
    const parts = Array.from({ length: N }, (_, i) => ({ t: (i * 0.618) % 1, path: null, speed: 0 }));

    const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
    const pick = (ev) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObjects(Object.values(rooms).map((x) => x.box))[0];
      return hit?.object.userData.id || null;
    };
    let downAt = null;
    const onMove = (ev) => { const id = pick(ev); setHover(id); renderer.domElement.style.cursor = id && !id.startsWith('WASH') ? 'pointer' : 'grab'; };
    const onDown = (ev) => { downAt = [ev.clientX, ev.clientY]; };
    const onUp = (ev) => {
      if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;
      const id = pick(ev); if (id && !id.startsWith('WASH')) nav(`/rooms/${id}`);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const baseOffset = camera.position.clone().sub(center);
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      // narrow screens: step back so the whole block fits across
      const k = Math.max(1, 1.55 / camera.aspect);
      camera.position.copy(center).add(baseOffset.clone().multiplyScalar(k));
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    const tmp = new THREE.Vector3(); const clock = new THREE.Clock(); let raf = 0; let frame = 0;
    const colV = new THREE.Color(C.volt), colW = new THREE.Color(C.water);
    const tick = () => {
      const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime;
      const s = state.current;
      // room colours and the wall strips
      Object.entries(rooms).forEach(([id, r]) => {
        const st = s.status?.[id] || 'idle';
        r.mat.color.setHex(C[st] ?? C.idle);
        r.mat.opacity = st === 'idle' ? 0.16 : 0.55;
        r.mat.emissive.setHex(st === 'waste' || st === 'hidden' ? C[st] : 0x000000);
        r.mat.emissiveIntensity = st === 'waste' || st === 'hidden' ? 0.35 + 0.25 * Math.sin(t * 3) : 0;
        const strip = s.strip?.[id];
        r.strip.material.color.setHex(strip === 'damp' ? C.water : C.ember);
        r.strip.material.opacity = strip ? 0.55 + 0.45 * Math.sin(t * 4) : 0;
        r.edges.material.opacity = s.hover === id ? 1 : 0.5;
      });
      if (s.tank != null) { const h = Math.max(0.05, s.tank / 100) * 1.3; fill.scale.set(1, h, 1); fill.position.set(W - 1.2, roofY + h / 2 + 0.05, 0); }
      // particles
      for (let i = 0; i < N; i += 1) {
        const p = parts[i];
        if (!p.path || p.t >= 1) {
          const job = s.jobs?.[i % (s.jobs.length || 1)];
          p.path = job ? (job.kind === 'power' ? powerPaths[job.id] : job.kind === 'riser' ? riser : downs[job.f]) : null;
          p.speed = job?.speed || 0; p.kind = job?.kind; p.t = p.t >= 1 ? 0 : p.t;
        }
        if (!p.path || p.speed <= 0) { pos[i * 3 + 1] = -100; continue; }
        p.t += dt * p.speed * (reduced ? 0.25 : 1);
        p.path.getPointAt(Math.min(1, p.t), tmp);
        pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
        const c = p.kind === 'power' ? colV : colW;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
      board.material.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 2);
      const motion = reduced ? 0 : 1;
      for (let i = 0; i < SN; i += 1) {
        const b = 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.7 * motion + sphase[i]));
        scol[i * 3] = 0.55 * b; scol[i * 3 + 1] = 0.85 * b; scol[i * 3 + 2] = 0.65 * b;
      }
      sg.attributes.color.needsUpdate = true;
      stars.rotation.y = t * 0.01 * motion;
      rings.forEach((m) => {
        const ph = ((t * 0.25 * motion + m.userData.k / 3) % 1);
        const r = 2 + ph * (W * 0.75);
        m.scale.set(r, r, 1); m.material.opacity = 0.35 * (1 - ph);
      });
      const sy = (0.5 - 0.5 * Math.cos(t * 0.6 * motion)) * H;
      sweep.position.y = sy; sweepEdge.position.set(W / 2, sy, 0);
      pump.rotation.y += s.pumpOn ? dt * 6 : 0;
      controls.update();
      renderer.render(scene, camera);
      // project room centres for the HTML labels, a few times a second is enough
      if ((frame += 1) % 6 === 0) {
        const w = el.clientWidth, h = el.clientHeight;
        setLabels(Object.entries(rooms).filter(([id]) => !id.startsWith('WASH')).map(([id, r]) => {
          tmp.set(r.p.x, r.p.y + ROOM.h + 0.25, ROOM.d / 2).project(camera);
          return { id, x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h };
        }));
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, [ok, geo, floors.join()]);

  // live data -> what the animation shows
  useEffect(() => {
    if (!live?.rooms) return;
    const status = {}, strip = {}; const jobs = [];
    live.rooms.forEach((r) => {
      status[r.id] = roomState(r, live.alerts);
      if (live.alerts?.some((a) => a.target === r.id && a.rule === 'wall_heat')) strip[r.id] = 'heat';
      const n = Math.max(1, Math.round(Math.min(10, r.kw * 1.6)));
      for (let k = 0; k < n; k += 1) jobs.push({ kind: 'power', id: r.id, speed: 0.12 + Math.min(0.5, r.kw / 16) });
    });
    floorIds(building, live.rooms).forEach((f) => {
      const flow = live.water?.floor_l?.[f] ?? 0;
      const a = live.alerts?.find((x) => x.target === `F${f}` && x.end == null);
      if (a) { status[`WASH-${f}`] = 'waste'; if (a.rule === 'earth_leak') strip[`WASH-${f}`] = 'damp'; }
      const n = Math.round(Math.min(8, flow / 4));
      for (let k = 0; k < n; k += 1) jobs.push({ kind: 'down', f, speed: 0.25 });
    });
    if (live.water?.pump_on) for (let k = 0; k < 14; k += 1) jobs.push({ kind: 'riser', speed: 0.3 });
    // spread jobs over the particle pool so busy rooms get more sparks
    state.current = { ...state.current, status, strip, jobs: jobs.length ? jobs : [], tank: live.water?.tank_pct, pumpOn: live.water?.pump_on };
  }, [live?.ts, live?.alerts?.length]);
  useEffect(() => { state.current.hover = hover; }, [hover]);

  if (!ok) return fallback;
  const room = (id) => live.rooms.find((r) => r.id === id);
  return (
    <div className="relative">
      <div ref={mount} className="blueprint relative h-[380px] w-full overflow-hidden rounded-xl bg-night-950 sm:h-[460px]" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
        {labels.map((l) => {
          const r = room(l.id); if (!r) return null;
          const st = roomState(r, live.alerts);
          return (
            <div key={l.id} className={`absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[10px] leading-tight transition-opacity ${hover === l.id ? 'opacity-100' : 'opacity-80'} ${st === 'waste' ? 'border-volt-300 bg-volt-900/80 text-volt-100' : st === 'hidden' ? 'border-ember-300 bg-ember-900/80 text-ember-100' : 'border-night-700 bg-night-900/80 text-ink-100'}`}
              style={{ left: l.x, top: l.y }}>
              {l.id} <span className="text-volt-300">{num(r.kw, 1)}kW</span>{r.people > 0 && <span className="text-leaf-300"> · {r.people}p</span>}
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-ink-300">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-volt-300" />power flow</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-river-400" />water flow</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-leaf-500" />in use</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-volt-400" />wasting</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-ember-500" />hot wiring</span>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] text-ink-400">drag to turn · click a room</div>
      {/* screen readers and keyboard users get the same information as a list */}
      <ul className="sr-only">
        {live.rooms.map((r) => <li key={r.id}>{r.name}, {floorShort(r.floor, building)} floor: {roomState(r, live.alerts)}, {num(r.kw, 2)} kilowatts, {r.people} people</li>)}
      </ul>
    </div>
  );
}
