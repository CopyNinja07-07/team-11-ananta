// ECOGUARD Round 2, pass 3: the Figma file becomes the product.
// Page 02 = every real app screen, full length, scrolling, sidebar and top bar fixed, every link live.
// Old explainer boards leave Figma (they now live in the design PDF).
const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const rgb = a => ({ r: a[0] / 255, g: a[1] / 255, b: a[2] / 255 });
const ease = { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
const overlay = dest => [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: dest.id, navigation: 'OVERLAY', transition: { type: 'MOVE_IN', direction: 'RIGHT', matchLayers: false, easing: { type: 'EASE_OUT' }, duration: 0.25 }, preserveScrollPosition: false, resetVideoPosition: false }] }];
const closeOverlay = [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'CLOSE' }] }];
const swap = dest => [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: dest.id, navigation: 'NAVIGATE', transition: { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.3 }, preserveScrollPosition: true, resetVideoPosition: false }] }];
const nav = dest => [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: dest.id, navigation: 'NAVIGATE', transition: ease, preserveScrollPosition: false, resetVideoPosition: false }] }];
const hashes = {};
function imgHash(key) { if (!hashes[key]) hashes[key] = figma.createImage(figma.base64Decode(IM[key])).hash; return hashes[key]; }
function picture(parent, key, x, y, w, h, name) {
  const r = figma.createRectangle(); parent.appendChild(r); r.name = name; r.resize(w, h); r.x = x; r.y = y;
  r.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: imgHash(key) }]; r.locked = true; return r;
}
function hot(parent, x, y, w, h, name) {
  // keep every hotspot inside its frame: anything sticking out widens the scroll area and shifts the screen sideways
  const W = parent.width; if (x < 0) { w += x; x = 0; } if (x + w > W) w = W - x; if (y < 0) { h += y; y = 0; }
  const r = figma.createRectangle(); parent.appendChild(r); r.name = 'Hotspot · ' + name;
  r.resize(Math.max(4, w), Math.max(4, h)); r.x = x; r.y = y; r.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.001 }]; return r;
}
let T; // text helper after fonts load
async function addHot(f, rect, name, reactions) {
  const [x, y, w, h, fx] = rect;
  if (fx) {
    const g = f.children.find(c => c.name === 'Top bar (fixed)'); if (!g) return;
    const r = hot(g, x - g.x, y, w, h, name); await r.setReactionsAsync(reactions); links++; return;
  }
  const r = hot(f, x, y, w, h, name); f.insertChild(f.children.length - f.numberOfFixedChildren, r);
  await r.setReactionsAsync(reactions); links++;
}
let links = 0;

async function main() {
  for (const f of [['Space Grotesk', 'Bold'], ['IBM Plex Sans', 'Regular'], ['IBM Plex Sans', 'Medium'], ['JetBrains Mono', 'Medium']]) await figma.loadFontAsync({ family: f[0], style: f[1] });
  T = (parent, s, fam, st, size, col, x, y, w) => { const t = figma.createText(); parent.appendChild(t); t.fontName = { family: fam, style: st }; t.fontSize = size; t.characters = s; t.fills = [{ type: 'SOLID', color: hex(col) }]; t.x = x; t.y = y; if (w) { t.resize(w, t.height); t.textAutoResize = 'HEIGHT'; } return t; };

  const docs = await figma.getNodeByIdAsync('0:1');
  const screens = await figma.getNodeByIdAsync('1:2');
  await figma.setCurrentPageAsync(screens);

  // 1. component-built screens move to their own page; screenshot screens and phones go
  let built = figma.root.children.find(p => p.name.startsWith('04 '));
  if (!built) { built = figma.createPage(); built.name = '04 Screens built from components'; }
  for (const n of [...screens.children]) {
    if (n.type === 'FRAME' && n.name.startsWith('Desktop · ') && n.y < 1000 && !n.getPluginData('shot')) {
      for (const h of n.findAll(x => x.name.startsWith('Hotspot · '))) h.remove();
      await n.setReactionsAsync([]);
      built.appendChild(n);
    } else n.remove();
  }
  // tidy page 04 in one row with titles
  let bx = 0; await figma.setCurrentPageAsync(built);
  for (const n of built.children.filter(c => c.type === 'TEXT')) n.remove();
  for (const n of built.children.filter(c => c.type === 'FRAME').sort((a, b) => a.x - b.x)) { n.x = bx; n.y = 120; T(built, n.name.replace('Desktop · ', ''), 'Space Grotesk', 'Bold', 32, '#14241C', bx, 50); bx += n.width + 160; }
  T(built, 'These screens are drawn only with the components on page 03 (Button, Pill, KPI card, Room tile, Alert card, Sidebar, Top bar), all in auto-layout. Select any card to see its component and variant.', 'IBM Plex Sans', 'Regular', 22, '#5A6660', 0, -20, 1800);
  await figma.setCurrentPageAsync(screens);
  screens.name = '02 Product screens + prototype';

  // 2. build every screen
  const ROWS = [
    ['Right now', ['live', 'livehi', 'alerts', 'rooms', 'room']],
    ['Where waste hides', ['hvac', 'water', 'wiring', 'camera']],
    ['Results', ['savings', 'forecast', 'models', 'real', 'realb']],
    ['For your campus · Control room', ['plans', 'setup', 'simulator', 'settings']],
  ];
  const F = {};
  const byKey = Object.fromEntries(SCREENS.map(s => [s.key, s]));
  function frameFor(s, x, y) {
    const vpH = s.tag === 'd' ? 900 : 844;
    const f = figma.createFrame(); screens.appendChild(f); f.setPluginData('shot', '1');
    f.name = (s.tag === 'd' ? 'Desktop · ' : 'Phone · ') + s.title; f.x = x; f.y = y;
    f.resize(s.W, s.key === 'm_menu' ? 844 : Math.min(vpH, Math.max(vpH, 1)));
    f.fills = [{ type: 'SOLID', color: rgb(s.bg) }]; f.clipsContent = true;
    // long screens come in 800 px slices so no single image is too tall for the prototype viewer
    for (const [key, sy, sh] of s.slices) picture(f, key, 0, sy, s.W, sh, 'Screen · ' + s.title + (s.slices.length > 1 ? ' · part ' + (Math.round(sy / 800) + 1) : ''));
    if (s.canvas && IM.gif3d) picture(f, 'gif3d', s.canvas[0], s.canvas[1], s.canvas[2], s.canvas[3], '3D building · moving');
    if (s.H > vpH) f.overflowDirection = 'VERTICAL';
    F[s.key] = f; return f;
  }
  let y = 0;
  for (const [label, keys] of ROWS) {
    T(screens, label.toUpperCase(), 'JetBrains Mono', 'Medium', 28, '#3C7A55', 0, y);
    let x = 0;
    for (const k of keys) { const s = byKey['d_' + k]; T(screens, s.title, 'Space Grotesk', 'Bold', 40, '#14241C', x, y + 50); frameFor(s, x, y + 120); x += 1440 + 140; }
    y += 120 + 900 + 220;
  }
  T(screens, 'PHONE · CARETAKER AND ON THE MOVE', 'JetBrains Mono', 'Medium', 28, '#3C7A55', 0, y);
  const phones = ['menu', 'live', 'alerts', 'rooms', 'room', 'hvac', 'water', 'wiring', 'camera', 'savings', 'forecast', 'models', 'real', 'realb', 'plans', 'setup', 'simulator', 'settings'];
  phones.forEach((k, i) => { const s = byKey['m_' + k]; const x = (i % 9) * (390 + 110), yy = y + 120 + Math.floor(i / 9) * (844 + 200); T(screens, s.title, 'Space Grotesk', 'Bold', 26, '#14241C', x, yy - 50); frameFor(s, x, yy); });

  // 3. links, fixed sidebar and top bar
  for (const s of SCREENS) {
    const f = F[s.key], pre = s.tag + '_';
    const target = d => F[pre + d];
    const content = s.links.filter(l => !l[5]);
    for (const [x, yy, w, h, d, , name] of content) { const t = target(d); if (!t) continue; const r = hot(f, x, yy, w, h, name); await r.setReactionsAsync(nav(t)); links++; }
    if (s.key === 'm_menu') {
      for (const [x, yy, w, h, d, , name] of s.links) { const t = target(d); if (!t) continue; const r = hot(f, x, yy, w, h, name); await r.setReactionsAsync(nav(t)); links++; }
      const back = hot(f, 290, 0, 100, 844, 'Close menu'); await back.setReactionsAsync(closeOverlay); links++;
      continue;
    }
    let fixed = 0;
    if (s.hdr) {
      const g = figma.createFrame(); f.appendChild(g); g.name = 'Top bar (fixed)'; g.fills = []; g.clipsContent = false;
      g.x = s.hdr[0]; g.y = 0; g.resize(s.hdr[2], s.hdr[3]);
      picture(g, s.key + '_hdr', 0, 0, s.hdr[2], s.hdr[3], 'Top bar');
      for (const [x, yy, w, h, d, fx, name] of s.links) if (fx && !(s.side && x < s.side[2])) { const t = target(d); if (!t) continue; const r = hot(g, x - s.hdr[0], yy, w, h, name); await r.setReactionsAsync(d === 'menu' ? overlay(t) : nav(t)); links++; }
      fixed++;
    }
    if (s.side) {
      const g = figma.createFrame(); f.appendChild(g); g.name = 'Sidebar (fixed)'; g.fills = []; g.clipsContent = false;
      g.x = 0; g.y = 0; g.resize(s.side[2], 900);
      picture(g, s.key + '_side', 0, 0, s.side[2], 900, 'Sidebar');
      for (const [x, yy, w, h, d, fx, name] of s.links) if (fx && x < s.side[2]) { const t = target(d); if (!t) continue; const r = hot(g, x, yy, w, h, name); await r.setReactionsAsync(nav(t)); links++; }
      const logo = hot(g, 0, 0, s.side[2], 80, 'Logo'); if (s.name !== 'live') { await logo.setReactionsAsync(nav(F.d_live)); links++; } else logo.remove();
      fixed++;
    }
    f.numberOfFixedChildren = fixed;
  }
  // 3b. after-click states: each one is a copy of its screen with the changed part pasted on top
  let sy0 = y + 120 + 2 * (844 + 200) + 200;
  T(screens, 'AFTER YOU CLICK · WHAT EVERY BUTTON, SLIDER AND TAB DOES', 'JetBrains Mono', 'Medium', 28, '#3C7A55', 0, sy0);
  sy0 += 120;
  const SF = {};   // key -> [state frames]
  const insertContent = (f, node) => f.insertChild(f.children.length - f.numberOfFixedChildren, node);
  const topBar = f => f.children.find(c => c.name === 'Top bar (fixed)');
  for (const s of SCREENS) {
    if (!s.states || !s.states.length) continue;
    const base = F[s.key]; const list = SF[s.key] = [];
    T(screens, s.title + ' · ' + (s.tag === 'd' ? 'desktop' : 'phone'), 'Space Grotesk', 'Bold', 32, '#14241C', 0, sy0);
    let x = 0;
    for (const st of s.states) {
      const c = base.clone(); screens.appendChild(c); c.x = x; c.y = sy0 + 60; x += s.W + 80;
      const seen = list.filter(x => x.getPluginData('label') === (st.label || 'option')).length;
      c.name = base.name + ' · after: ' + (st.label || 'option') + (seen ? ' (' + (seen + 1) + ')' : ''); c.setPluginData('label', st.label || 'option'); c.setPluginData('shot', '1'); c.setPluginData('state', '1');
      if (st.cut != null) {
        for (const n of [...c.children]) if (n.name.startsWith('Screen · ') && n.y + n.height > st.cut) n.remove();
        for (const n of [...c.children]) if (n.name.startsWith('Hotspot · ') && n.y >= st.cut) n.remove();
        const g = c.children.find(n => n.name === '3D building · moving'); if (g && g.y >= st.cut) g.remove();
      }
      for (const [key, px, py, pw, ph, fx] of st.patches) {
        const r = figma.createRectangle(); r.name = 'Changed · ' + st.label; r.resize(pw, ph);
        r.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: imgHash(key) }]; r.locked = true;
        if (fx && topBar(c)) { const g = topBar(c); g.appendChild(r); r.x = px - g.x; r.y = py; }
        else { insertContent(c, r); r.x = px; r.y = py; }
      }
      list.push(c);
    }
    sy0 += 60 + (s.tag === 'd' ? 900 : 844) + 200;
  }
  // wire every control: base -> its state; in a state, same control goes back (toggle), others go to their own state
  for (const s of SCREENS) {
    if (!s.controls || !s.controls.length) continue;
    const base = F[s.key]; const list = SF[s.key] || [];
    const frames = [[base, null], ...list.map((f, i) => [f, s.states[i]])];
    for (const [f, cur] of frames) {
      const lim = cur && cur.first != null ? cur.first : cur && cur.cut;
      for (const c of s.controls) {
        const mine = cur && c.states.some(([sid]) => sid === cur.sid);
        // page grew or shrank: controls below the change moved, so only the ones above it (and the fixed top bar) stay live
        let rect = c.rect;
        if (cur && cur.cut != null && !mine && !c.rect[4] && c.rect[1] + c.rect[3] > lim) {
          // a note was inserted at the first changed row, so everything under it moved down by the page's growth
          const dy = (cur.H || s.H) - s.H;
          if (c.rect[1] < lim || c.rect[1] + dy + c.rect[3] > (cur.H || s.H)) continue;
          rect = [c.rect[0], c.rect[1] + dy, c.rect[2], c.rect[3], c.rect[4]];
        }
        if (c.kind === 'range' && c.states.length === 2) {
          const [x, yy, w, h, fx] = rect;
          const lo = list[c.states.find(([, fr]) => fr < 0.5)[0]], hi = list[c.states.find(([, fr]) => fr > 0.5)[0]];
          await addHot(f, [x, yy, w / 2, h, fx], 'Slider low · ' + c.label, swap(lo === f ? base : lo));
          await addHot(f, [x + w / 2, yy, w / 2, h, fx], 'Slider high · ' + c.label, swap(hi === f ? base : hi));
          continue;
        }
        let to;
        if (!c.states.length) to = cur ? base : null;          // e.g. the tab that is already selected
        else if (mine) to = base;                               // click again: back
        else to = list[c.states[0][0]];
        if (to && to !== f) await addHot(f, rect, c.label, swap(to));
      }
    }
  }
  // language: हिं on the live screen opens the Hindi version, EN brings it back
  const L = SCREENS.find(s => s.key === 'd_live');
  if (L && L.lang && F.d_livehi) {
    for (const f of [F.d_live, ...(SF.d_live || [])]) await addHot(f, L.lang['हिं'], 'हिं', swap(F.d_livehi));
    await addHot(F.d_livehi, L.lang['EN'], 'EN', swap(F.d_live));
  }

  screens.flowStartingPoints = [{ nodeId: F.d_live.id, name: 'Estate officer · desktop' }, { nodeId: F.m_live.id, name: 'Caretaker · phone' }];

  // 4. page 01: keep cover, style guide, states and wireframes; explainer boards move to the PDF
  await figma.setCurrentPageAsync(docs);
  const drop = /^(01|02|03|04|05|06|07|11) /;
  for (const n of [...docs.children]) if (drop.test(n.name) || n.name === '00 Start here') n.remove();
  for (const n of docs.children.filter(c => c.type === 'TEXT')) n.remove();
  const order = ['00', '09 ', '09b', '10 ', '08 ', '08b'];
  const keep = docs.children.filter(c => c.type === 'FRAME').sort((a, b) => order.findIndex(o => a.name.startsWith(o)) - order.findIndex(o => b.name.startsWith(o)));
  const board = startHere(docs, F.d_live, F.m_live);
  let cx = board.width + 200;
  for (const n of keep) { n.x = cx; n.y = 0; cx += n.width + 200; }
  docs.name = '01 Start here · cover · style guide · wireframes';
  const comps = await figma.getNodeByIdAsync('1:3'); if (comps && !comps.name.startsWith('03')) comps.name = '03 Components';

  await figma.setCurrentPageAsync(screens);
  const done = T(screens, `BUILD COMPLETE · ${links} links · ${new Date().toLocaleTimeString()}`, 'JetBrains Mono', 'Medium', 28, '#3C7A55', 0, -260); done.name = 'Build complete';
  figma.viewport.scrollAndZoomIntoView([F.d_live]);
  return links;
}

function startHere(page, live, phone) {
  const b = figma.createFrame(); page.appendChild(b); b.name = '00 Start here'; b.resize(1600, 1100); b.x = 0; b.y = 0;
  b.fills = [{ type: 'SOLID', color: hex('#0F2A20') }];
  const key = figma.fileKey || 'kabn1QXWM5ErOoPpBOfjqr';
  T(b, 'START HERE · TEAM 11 · ROUND 2 UI/UX', 'JetBrains Mono', 'Medium', 18, '#8EC29F', 96, 88);
  T(b, 'ECOGUARD', 'Space Grotesk', 'Bold', 96, '#FFFFFF', 96, 130);
  T(b, 'Finds the power and water a building wastes, room by room, and fixes it. Built for Academic Block A, Jammu.', 'IBM Plex Sans', 'Regular', 26, '#C9CFC7', 96, 260, 1300);
  const link = (txt, node, yy) => { const t = T(b, txt, 'IBM Plex Sans', 'Medium', 30, '#EDBF48', 96, yy); const url = `https://www.figma.com/proto/${key}/ECOGUARD?node-id=${node.id.replace(':', '-')}&starting-point-node-id=${encodeURIComponent(node.id)}&scaling=contain`; t.setRangeHyperlink(0, txt.length, { type: 'URL', value: url }); t.setRangeTextDecoration(0, txt.length, 'UNDERLINE'); };
  link('▶  Play the desktop prototype (estate officer)', live, 360);
  link('▶  Play the phone prototype (caretaker)', phone, 415);
  const rows = [
    ['01  Start here, cover, style guide, wireframes', 'Colours, type, spacing, icons, the empty / error / loading states, and a wireframe of every screen.'],
    ['02  Product screens + prototype', 'All 17 screens of the app on desktop and phone, exactly as the live app draws them, with realistic data from the simulated block. Press ▶ Present: the sidebar, the phone menu, every room and alert link work, and every button, slider, tab and top-bar chip shows what it does (Switch room off, Yes / No, Reset AC, the Plans sliders, Grid on, the mic, English / Hindi). Click the same control again to go back. Long pages scroll with the sidebar and top bar fixed. Below the screens, the AFTER YOU CLICK rows hold each state.'],
    ['03  Components', 'Variables for colour, spacing and radius, nine text styles, and nine components with variants and auto-layout.'],
    ['04  Screens built from components', 'Six key screens drawn only from those components, to show how the system is put together.'],
    ['Design document (PDF)', 'Data flow diagrams level 0 and 1, user flows, sitemap, personas and design rationale.'],
  ];
  let yy = 520;
  for (const [h, d] of rows) { T(b, h, 'Space Grotesk', 'Bold', 26, '#FFFFFF', 96, yy); const t = T(b, d, 'IBM Plex Sans', 'Regular', 20, '#C9CFC7', 96, yy + 38, 1380); yy += 38 + t.height + 30; }
  return b;
}

main().then(n => figma.closePlugin(`ECOGUARD product screens: ${n} links`)).catch(e => { console.error(e); figma.closePlugin('ECOGUARD stopped: ' + (e && e.message ? e.message : e)); });
