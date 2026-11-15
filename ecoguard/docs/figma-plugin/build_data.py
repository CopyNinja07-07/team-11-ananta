"""capture.cjs screenshots -> plugin data.js: 800 px slices per screen, plus for every control
the small changed patch it causes (diffed against the base screen), and a 3D GIF."""
import base64, io, json, glob
import numpy as np
from scipy import ndimage
from PIL import Image

D = 'shots/'
m = {**json.load(open(D + 'meta_d.json')), **json.load(open(D + 'meta_m.json'))}
TITLE = {'live': 'Live building', 'livehi': 'Live building · Hindi', 'alerts': 'Alerts', 'rooms': 'Rooms', 'room': 'Room detail',
         'hvac': 'Cooling & AC', 'water': 'Water tank & pump', 'wiring': 'Inside the walls', 'camera': 'People count',
         'savings': 'Savings & carbon', 'forecast': 'Next 24 hours', 'models': 'How it decides', 'real': 'Tested on 659 buildings',
         'realb': 'Real building detail', 'plans': 'Plans & pricing', 'setup': 'Add a building', 'simulator': 'Test mode',
         'settings': 'Settings', 'menu': 'Menu'}
ROUTE = {'/': 'live', '/alerts': 'alerts', '/rooms': 'rooms', '/hvac': 'hvac', '/water': 'water', '/wiring': 'wiring', '/camera': 'camera',
         '/savings': 'savings', '/forecast': 'forecast', '/models': 'models', '/real': 'real', '/plans': 'plans', '/setup': 'setup',
         '/simulator': 'simulator', '/settings': 'settings', 'MENU': 'menu'}
SC = 2


def dest(h):
    if h.startswith('/rooms/'): return 'room'
    if h.startswith('/real/'): return 'realb'
    return ROUTE.get(h.split('?')[0])


def enc(im, q):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True); return base64.b64encode(b.getvalue()).decode()


IM = {}; S = []
for k, v in m.items():
    tag, name = k.split('_', 1); W = 1440 if tag == 'd' else 390
    H = v['H'] if k != 'm_menu' else 844
    s = {'key': k, 'tag': tag, 'name': name, 'title': TITLE[name], 'H': H, 'W': W}
    full = Image.open(D + k + '.png').convert('RGB')
    q = 74
    sl = []; y = 0; i = 0
    while y < H:
        h = min(800, H - y); IM[f'{k}#{i}'] = enc(full.crop((0, y * SC, full.size[0], (y + h) * SC)), q); sl.append([f'{k}#{i}', y, h]); y += h; i += 1
    s['slices'] = sl
    if k != 'm_menu':
        top = Image.open(D + k + '_top.png'); hx, hw, hh = v['header']['x'], v['header']['w'], v['header']['h']
        IM[k + '_hdr'] = enc(top.crop((int(hx * SC), 0, int((hx + hw) * SC), int(hh * SC))), 85); s['hdr'] = [hx, 0, hw, hh]
        if v['side']: IM[k + '_side'] = enc(top.crop((0, 0, int(v['side'] * SC), 900 * SC)), 85); s['side'] = [0, 0, v['side'], 900]
        s['bg'] = list(top.convert('RGB').getpixel((top.size[0] - 6, top.size[1] - 6)))
    else:
        s['bg'] = [20, 40, 30]
    links = []
    for l in v['links']:
        d = dest(l['href'])
        if name == 'livehi' and d == 'live' and not l['fixed']: continue
        if not d or d == name: continue
        if l['y'] + l['h'] > H and not l['fixed']: continue
        links.append([round(l['x']), round(l['y']), round(l['w']), round(l['h']), d, 1 if l['fixed'] else 0, (l.get('text') or l['href'])[:30]])
    s['links'] = links
    if v.get('canvas') and name in ('live', 'livehi'): s['canvas'] = [round(v['canvas'][c]) for c in 'xywh']

    # ---- control states
    base = np.asarray(full).astype(np.int16)
    ctl = {}; states = []
    alert_btns = 0
    for st in v.get('states', []):
        lab = st['label']
        # keep the file light: fold-away notes only where they matter, live-screen alert buttons for the first two cards
        if lab.startswith('About this page') and name not in ('live', 'alerts'): continue
        if lab in ('EN', 'हिं'):
            s.setdefault('lang', {})[lab] = [round(st['x']), round(st['y']), round(st['w']), round(st['h']), 1 if st['fixed'] else 0]
            continue
        img = Image.open(D + st['id'] + '.png').convert('RGB'); a = np.asarray(img).astype(np.int16)
        hmin = min(a.shape[0], base.shape[0])
        diff = np.abs(a[:hmin] - base[:hmin]).max(axis=2) > 60
        cv = v.get('canvas'); cv2 = st.get('canvas')
        if cv and cv2 and abs(cv['y'] - cv2['y']) < 1 and abs(cv['h'] - cv2['h']) < 1:
            diff[int(cv['y'] * SC):int((cv['y'] + cv['h']) * SC), int(cv['x'] * SC):int((cv['x'] + cv['w']) * SC)] = False
        # rendering noise is scattered; a real change is one blob touching the control
        B = 16
        hh, ww = diff.shape[0] // B, diff.shape[1] // B
        bl = diff[:hh * B, :ww * B].reshape(hh, B, ww, B).sum((1, 3)) > 12
        lab_, n = ndimage.label(ndimage.binary_dilation(bl, iterations=3))
        cx0, cy0 = st['x'] * SC / B, st['y'] * SC / B
        cx1, cy1 = (st['x'] + st['w']) * SC / B, (st['y'] + st['h']) * SC / B
        keep_ids = []
        for comp in range(1, n + 1):
            ys_, xs_ = np.nonzero(lab_ == comp)
            dx = max(0, cx0 - xs_.max(), xs_.min() - cx1); dy = max(0, cy0 - ys_.max(), ys_.min() - cy1)
            if dx <= 4 and dy <= 8: keep_ids.append(comp)
        mask = np.isin(lab_, keep_ids) & bl
        ys, xs = np.nonzero(mask)
        ys = ys * B; xs = xs * B
        same_h = a.shape[0] == base.shape[0]
        key = (round(st['x']), round(st['y']), round(st['w']), round(st['h']))
        c = ctl.setdefault(key, {'rect': list(key) + [1 if st['fixed'] else 0], 'label': lab, 'kind': st['kind'], 'states': []})
        if len(ys) == 0 and same_h:
            continue
        sid = len(states)
        if same_h:
            pad = 10 * SC
            y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + B + pad)
            x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + B + pad)
            if (y1 - y0) * (x1 - x0) > 0.6 * a.shape[0] * a.shape[1]: continue  # whole page changed: not a control state
            fixed = bool(st['fixed']) and y0 / SC < 900
            pk = st['id']
            IM[pk] = enc(img.crop((x0, y0, x1, y1)), 82)
            patches = [[pk, x0 / SC, y0 / SC, (x1 - x0) / SC, (y1 - y0) / SC, 1 if fixed else 0]]
            states.append({'sid': sid, 'label': lab, 'patches': patches, 'H': H, 'cut': None})
        else:
            first = int(ys.min() / SC) if len(ys) else hmin // SC
            cut = (first // 800) * 800
            nH = min(a.shape[0] // SC, 4000)
            patches = []; y = cut; i = 0
            while y < nH:
                h = min(800, nH - y); pk = f"{st['id']}#{i}"
                IM[pk] = enc(img.crop((0, y * SC, img.size[0], (y + h) * SC)), 68); patches.append([pk, 0, y, W, h, 0]); y += h; i += 1
            keep = bool(cv and cv2 and abs(cv['y'] - cv2['y']) < 1)
            states.append({'sid': sid, 'label': lab, 'patches': patches, 'H': nH, 'cut': cut, 'first': first, 'keepgif': keep})
        c['states'].append([sid, st.get('frac')])
    s['controls'] = list(ctl.values()); s['states'] = states
    S.append(s)

# moving 3D for the live screen
frames = sorted(glob.glob(D + 'gif/f*.png'))
if frames:
    ims = [Image.open(f).convert('RGB') for f in frames]
    pal = ims[len(ims) // 2].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    q = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in ims]
    b = io.BytesIO(); q[0].save(b, 'GIF', save_all=True, append_images=q[1:], duration=110, loop=0, optimize=True)
    IM['gif3d'] = base64.b64encode(b.getvalue()).decode()
    print('gif', round(len(b.getvalue()) / 1e6, 2), 'MB', ims[0].size)

open('data.js', 'w').write('const IM=' + json.dumps(IM) + ';\nconst SCREENS=' + json.dumps(S) + ';\n')
print(round(sum(len(x) for x in IM.values()) / 1e6, 1), 'MB', len(S), 'screens', sum(len(s['states']) for s in S), 'states')
for s in S:
    if s['states']: print(s['key'], [(x['label'][:18], x['cut'] is not None) for x in s['states']])
