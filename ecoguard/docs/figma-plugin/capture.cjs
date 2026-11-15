// Base screens (as cap2) + the "after click" state of every button, slider, tab and chip,
// so the Figma prototype can show what each control does.
const { chromium } = require('playwright'); const fs = require('fs');
const API = process.env.API || 'http://localhost:8000'; const OUT = process.env.OUT || 'shots'; fs.mkdirSync(OUT, { recursive: true });
const D = [['live', '/'], ['alerts', '/alerts'], ['rooms', '/rooms'], ['room', '/rooms/CR-103'], ['hvac', '/hvac'], ['water', '/water'], ['wiring', '/wiring'], ['camera', '/camera'],
  ['savings', '/savings'], ['forecast', '/forecast'], ['models', '/models'], ['real', '/real'], ['realb', '/real/__FIRST__'], ['plans', '/plans'], ['setup', '/setup'], ['simulator', '/simulator'], ['settings', '/settings']];
const STATE_PAGES = { d: D.map((x) => x[0]), m: D.map((x) => x[0]) };
const ONLY = process.argv[2];
const PAGES = process.env.PAGES ? process.env.PAGES.split(',') : null;
const SEL = 'main button, main input[type=range], header button';
async function prep(ctx) {
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  await ctx.route('**/api/**', (r) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })));
}
async function controls(p) {
  return p.evaluate((SEL) => {
    const out = []; const sx = scrollX, sy = scrollY; const hdr = document.querySelector('header');
    [...document.querySelectorAll(SEL)].forEach((el, i) => {
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      if (el.disabled || el.closest('a')) return;
      if (el.getAttribute('aria-label') === 'Open menu') return;
      const lab = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
      const fixed = !!hdr && hdr.contains(el);
      out.push({ i, kind: el.tagName === 'INPUT' ? 'range' : 'button', label: lab, x: r.x + sx, y: r.y + (fixed ? 0 : sy), w: r.width, h: r.height, fixed });
    });
    return out;
  }, SEL);
}
async function pageInfo(p) {
  return p.evaluate(() => {
    const sx = scrollX, sy = scrollY; const links = [];
    for (const a of document.querySelectorAll('a[href]')) { const r = a.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const fixed = !!a.closest('aside'); links.push({ href: a.getAttribute('href'), x: r.x + sx, y: r.y + (fixed ? 0 : sy), w: r.width, h: r.height, fixed, text: a.textContent.trim().slice(0, 40) }); }
    const hdr = document.querySelector('header').getBoundingClientRect(); const side = document.querySelector('aside');
    const mb = document.querySelector('button[aria-label="Open menu"]'); if (mb && mb.getBoundingClientRect().width > 0) { const r = mb.getBoundingClientRect(); links.push({ href: 'MENU', x: r.x, y: r.y, w: r.width, h: r.height, fixed: true }); }
    const cv = document.querySelector('main canvas'); let canvas = null;
    if (cv) { const r = cv.getBoundingClientRect(); canvas = { x: r.x + sx, y: r.y + sy, w: r.width, h: r.height }; if (location.pathname === '/') links.push({ href: '/rooms/CR-103', x: r.x + sx, y: r.y + sy, w: r.width, h: r.height, fixed: false }); }
    return { links, canvas, H: document.documentElement.scrollHeight, header: { x: hdr.x, w: hdr.width, h: hdr.height }, side: side && side.getBoundingClientRect().width > 0 ? side.getBoundingClientRect().width : 0 };
  });
}
async function act(p, c, frac) {
  const h = (await p.$$(SEL))[c.i]; if (!h) return false;
  if (c.kind === 'range') {
    await h.evaluate((el, frac) => { const mn = +el.min || 0, mx = +el.max || 100, st = +el.step || 1; let v = mn + (mx - mn) * frac; v = Math.round(v / st) * st; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, frac);
  } else await h.click({ timeout: 3000 }).catch(() => {});
  return true;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const meta = fs.existsSync(OUT + '/meta.json') ? JSON.parse(fs.readFileSync(OUT + '/meta.json')) : {};
  const first = (await (await fetch(API + '/api/real/portfolio')).json()).sandbox[0].id;
  for (const [tag, vp] of [['d', { width: 1440, height: 900 }], ['m', { width: 390, height: 844 }]]) {
    if (ONLY && ONLY !== tag) continue;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 }); await prep(ctx); const p = await ctx.newPage();
    const load = async (route, name) => { await p.goto(API + route, { waitUntil: 'load' }); await p.waitForTimeout(name === 'live' ? 4500 : 2400); };
    for (let [name, route] of D) {
      if (PAGES && !PAGES.includes(name)) continue;
      route = route.replace('__FIRST__', first);
      await load(route, name);
      const info = await pageInfo(p); const H = Math.min(info.H, 4000);
      await p.screenshot({ path: `${OUT}/${tag}_${name}.png`, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: H } });
      await p.screenshot({ path: `${OUT}/${tag}_${name}_top.png` });
      const ctl = STATE_PAGES[tag].includes(name) ? await controls(p) : [];
      const states = [];
      for (const c of ctl.slice(0, 40)) {
        for (const frac of c.kind === 'range' ? [0.15, 0.85] : [null]) {
          await load(route, name);
          if (!(await act(p, c, frac))) continue; await p.waitForTimeout(name === 'live' ? 900 : 700);
          const sH = Math.min(await p.evaluate(() => document.documentElement.scrollHeight), 4000);
          const canvas = await p.evaluate(() => { const cv = document.querySelector('main canvas'); if (!cv) return null; const r = cv.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; });
          const id = `${tag}_${name}__s${states.length}`;
          // back to the top first: a full-page shot taken while scrolled bakes the sticky top bar into the middle
          await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
          await p.screenshot({ path: `${OUT}/${id}.png`, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: sH } });
          states.push({ id, ...c, frac, H: sH, canvas });
        }
      }
      meta[`${tag}_${name}`] = { route, H, ...info, states }; console.log(tag, name, H, info.links.length, 'states', states.length);
    }
    if (tag === 'm' && !PAGES) {
      await load('/', 'live'); await p.click('button[aria-label="Open menu"]'); await p.waitForTimeout(500);
      const links = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] a[href]')].map((a) => { const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), x: r.x, y: r.y, w: r.width, h: r.height, fixed: true }; }));
      await p.screenshot({ path: `${OUT}/m_menu.png` }); meta.m_menu = { route: 'menu', H: 844, links, header: { x: 0, w: 390, h: 0 }, side: 0, states: [] };
    }
    if (tag === 'd' && !PAGES) {
      await load('/', 'live'); await p.click('header button:has-text("हिं")'); await p.waitForTimeout(1200);
      const info = await pageInfo(p); const H = Math.min(info.H, 4000);
      await p.screenshot({ path: `${OUT}/d_livehi.png`, fullPage: true, clip: { x: 0, y: 0, width: 1440, height: H } }); await p.screenshot({ path: `${OUT}/d_livehi_top.png` });
      meta.d_livehi = { route: '/', H, ...info, states: [] };
      await load('/', 'live'); const cv = await p.$('main canvas'); fs.mkdirSync(OUT + '/gif', { recursive: true });
      for (let k = 0; k < 48; k += 1) { await cv.screenshot({ path: `${OUT}/gif/f${String(k).padStart(2, '0')}.png`, scale: 'css' }); await p.waitForTimeout(90); }
    }
    await ctx.close();
    fs.writeFileSync(OUT + (ONLY ? '/meta_' + ONLY + '.json' : '/meta.json'), JSON.stringify(meta));
  }
  await b.close();
})();
