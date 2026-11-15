"""Round 2 design boards as plain SVG.

Each board is one Figma frame. Paste the SVG into Figma (or drag the file in) and every
box, line and text stays editable. Colours and fonts are the app's own tokens.

    python docs/src/boards.py      -> docs/design/boards/*.svg
"""
import re
from html import escape
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "design" / "boards"

# tokens (same as frontend/tailwind.config.js)
C = dict(
    ink900="#10231C", ink800="#1E332A", ink700="#34463E", ink500="#66756D", ink400="#8A958E",
    ink300="#C9CFC7", ink200="#DEE2DA", ink100="#ECEEE8", ink50="#F4F2EC", white="#FFFFFF",
    night950="#0A1C15", night900="#0F2A20", night800="#163628", night700="#21453A",
    leaf50="#EEF5EE", leaf200="#B5D8BF", leaf300="#8EC29F", leaf500="#3E8E5A", leaf600="#2F7549", leaf700="#245C3A",
    volt50="#FBF4DF", volt200="#F2D27A", volt300="#EDBF48", volt500="#C98A00", volt700="#865A00",
    river50="#E8F3F7", river200="#A3D0DE", river300="#72B5CA", river500="#1C8DB5", river700="#0F5F7C",
    ember50="#F8ECE5", ember200="#E3AE92", ember300="#D48A63", ember500="#B4532A", ember700="#7A341A",
    alarm50="#FBEBE8", alarm200="#EBA79D", alarm500="#C0392B",
)
DISPLAY, SANS, MONO = "Space Grotesk", "IBM Plex Sans", "JetBrains Mono"
W, H = 1600, 1000


def width_of(text, size, font=SANS):
    k = 0.6 if font == MONO else 0.56 if font == DISPLAY else 0.53
    return len(text) * size * k


def wrap(text, maxw, size, font=SANS):
    lines, cur = [], ""
    for word in text.split():
        trial = (cur + " " + word).strip()
        if width_of(trial, size, font) > maxw and cur:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


class Board:
    def __init__(self, name, title, eyebrow, dark=False, w=W, h=H):
        self.name, self.w, self.h, self.dark = name, w, h, dark
        self.el = []
        bg = C["night900"] if dark else C["ink50"]
        self.el.append(f'<rect width="{w}" height="{h}" fill="{bg}"/>')
        if dark:
            self.grid(0, 0, w, h, C["night800"])
        fg = C["white"] if dark else C["ink900"]
        self.text(64, 72, eyebrow.upper(), 13, C["leaf300"] if dark else C["leaf600"], MONO, 500, spacing=2)
        self.text(64, 116, title, 36, fg, DISPLAY, 600)
        self.text(w - 64, 72, "ECOGUARD · ROUND 2 UI/UX", 12, C["ink400"], MONO, 400, anchor="end", spacing=1.5)

    # primitives -----------------------------------------------------------
    def grid(self, x, y, w, h, color, step=64):
        lines = [f'<path d="' + " ".join(f"M{x + i},{y} V{y + h}" for i in range(0, w + 1, step))
                 + " " + " ".join(f"M{x},{y + j} H{x + w}" for j in range(0, h + 1, step))
                 + f'" stroke="{color}" stroke-width="1"/>']
        self.el += lines

    def rect(self, x, y, w, h, fill, stroke=None, r=12, sw=1.5, dash=None, opacity=None):
        s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity is not None else ""
        self.el.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{s}{d}{o}/>')

    def text(self, x, y, s, size=15, fill=None, font=SANS, weight=400, anchor="start", spacing=0):
        fill = fill or C["ink900"]
        ls = f' letter-spacing="{spacing}"' if spacing else ""
        self.el.append(f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" font-weight="{weight}" '
                       f'fill="{fill}" text-anchor="{anchor}"{ls}>{escape(s)}</text>')

    def para(self, x, y, s, maxw, size=15, fill=None, font=SANS, weight=400, lh=1.45, anchor="start"):
        lines = wrap(s, maxw, size, font)
        for i, ln in enumerate(lines):
            self.text(x, y + i * size * lh, ln, size, fill, font, weight, anchor)
        return y + len(lines) * size * lh

    def line(self, x1, y1, x2, y2, color=None, sw=1.6, dash=None, arrow=True):
        color = color or C["ink500"]
        d = f' stroke-dasharray="{dash}"' if dash else ""
        m = ' marker-end="url(#ar)"' if arrow else ""
        self.el.append(f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{color}" stroke-width="{sw}" fill="none"{d}{m}/>')

    def path(self, d, color=None, sw=1.6, dash=None, arrow=True):
        color = color or C["ink500"]
        da = f' stroke-dasharray="{dash}"' if dash else ""
        m = ' marker-end="url(#ar)"' if arrow else ""
        self.el.append(f'<path d="{d}" stroke="{color}" stroke-width="{sw}" fill="none"{da}{m}/>')

    def pill(self, x, y, label, fg, bg, border, size=12):
        w = width_of(label, size, MONO) + 20
        self.rect(x, y, w, size + 12, bg, border, r=6, sw=1)
        self.text(x + 10, y + size + 3, label, size, fg, MONO, 500)
        return x + w + 8

    def card(self, x, y, w, h, fill=None, stroke=None, r=16):
        self.rect(x, y + 3, w, h, C["ink200"], r=r, opacity=0.6)
        self.rect(x, y, w, h, fill or C["white"], stroke or C["ink200"], r=r)

    def box(self, x, y, w, h, title, sub="", kind="process"):
        """A labelled node; text is wrapped to fit inside the box."""
        st = {
            "process": (C["leaf50"], C["leaf600"], 14, C["ink900"]),
            "entity": (C["white"], C["ink700"], 4, C["ink900"]),
            "screen": (C["white"], C["leaf600"], 10, C["ink900"]),
            "start": (C["night900"], C["night900"], 24, C["white"]),
            "power": (C["volt50"], C["volt500"], 10, C["ink900"]),
            "water": (C["river50"], C["river500"], 10, C["ink900"]),
            "walls": (C["ember50"], C["ember500"], 10, C["ink900"]),
            "alarm": (C["alarm50"], C["alarm500"], 10, C["ink900"]),
            "note": (C["ink100"], C["ink300"], 8, C["ink700"]),
        }[kind]
        fill, stroke, r, fg = st
        self.rect(x, y, w, h, fill, stroke, r=r, sw=1.8)
        tl = wrap(title, w - 24, 15, DISPLAY)
        sl = wrap(sub, w - 24, 12.5) if sub else []
        total = len(tl) * 19 + len(sl) * 17
        ty = y + (h - total) / 2 + 14
        for ln in tl:
            self.text(x + w / 2, ty, ln, 15, fg, DISPLAY, 600, "middle")
            ty += 19
        for ln in sl:
            self.text(x + w / 2, ty + 1, ln, 12.5, C["ink300"] if kind == "start" else C["ink500"], SANS, 400, "middle")
            ty += 17

    def store(self, x, y, w, h, ident, label):
        self.rect(x, y, w, h, C["river50"], r=0)
        self.path(f"M{x + w},{y} H{x} V{y + h} H{x + w}", C["river700"], 1.8, arrow=False)
        self.line(x + 44, y, x + 44, y + h, C["river700"], 1.2, arrow=False)
        self.text(x + 22, y + h / 2 + 5, ident, 13, C["river700"], MONO, 500, "middle")
        self.text(x + 56, y + h / 2 + 5, label, 14, C["ink900"], SANS, 500)

    def label(self, x, y, s, color=None, anchor="middle"):
        w = width_of(s, 11.5, MONO) + 12
        bx = x - w / 2 if anchor == "middle" else x
        self.rect(bx, y - 13, w, 19, C["night900"] if self.dark else C["ink50"], r=4)
        self.text(bx + w / 2, y + 1, s, 11.5, color or (C["ink300"] if self.dark else C["ink700"]), MONO, 400, "middle")

    def svg(self):
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
                f'<path d="M0,0 L10,5 L0,10 z" fill="{C["ink500"]}"/></marker></defs>')
        body = "".join(self.el)
        rnd = lambda v: re.sub(r'(\d+)\.(\d)\d*', lambda m: m.group(1) if m.group(2) == "0" else m.group(1) + "." + m.group(2), v)
        body = re.sub(r'="([^"]*)"', lambda m: '="' + rnd(m.group(1)) + '"', body)
        body = body.replace(' text-anchor="start"', '').replace(' font-weight="400"', '')
        return head + body + "</svg>"


# boards -----------------------------------------------------------------
def cover():
    b = Board("00-cover", "", "Team 11 · PS 11 · Round 2", dark=True)
    b.el = b.el[:2]  # bg + grid only
    b.text(96, 150, "TEAM 11 · PS 11 · ROUND 2 · UI/UX", 14, C["leaf300"], MONO, 500, spacing=2)
    b.text(96, 300, "ECOGUARD", 120, C["white"], DISPLAY, 700, spacing=-2)
    b.para(100, 372, "Finds the power and water a campus block wastes, room by room, and tells the caretaker the fix in plain words.", 900, 30, C["ink200"], DISPLAY, 500, 1.3)
    x = 100
    for lab, fg, bg in [("POWER", C["volt300"], C["night800"]), ("WATER", C["river300"], C["night800"]), ("INSIDE THE WALLS", C["ember300"], C["night800"])]:
        x = b.pill(x, 500, lab, fg, bg, C["night700"], 14) + 4
    stats = [("−19.2%", "electricity, simulated year"), ("−22.6%", "water, simulated year"), ("659", "real buildings tested"), ("12", "connected wastes caught")]
    for i, (n, t) in enumerate(stats):
        sx = 100 + i * 350
        b.rect(sx, 700, 320, 150, C["night800"], C["night700"], r=16)
        b.text(sx + 24, 776, n, 52, C["white"], MONO, 500)
        b.text(sx + 24, 818, t, 16, C["ink300"])
    b.text(100, 940, "Academic Block A, Jammu · classrooms, a computer lab and offices", 15, C["ink400"], MONO)
    return b


def problem():
    b = Board("01-problem", "From every building to one block we can prove", "Why the design looks the way it does")
    steps = [
        ("Round 1", "Every building, every kind of waste", "Homes, hostels, hospitals and offices with every sensor we could name. Too broad to prove.", 1000, C["ink300"], C["ink900"]),
        ("Choice 1", "Campus buildings in Jammu", "Fixed timetables, rooms empty for hours, one bill for the block, no sub-meters.", 820, C["leaf200"], C["ink900"]),
        ("Choice 2", "One academic block", "Three floors, eight rooms, washrooms, a sump, a pump and a roof tank.", 640, C["leaf300"], C["ink900"]),
        ("Choice 3", "Twelve connected wastes", "Power, water and the walls, each traced to the room, the cause, the cost and the fix.", 460, C["leaf500"], C["white"]),
        ("Proof", "A full year and 659 real buildings", "35,040 simulated readings with 558 faults, and real meters from the open BDG2 data set.", 300, C["leaf700"], C["white"]),
    ]
    for i, (n, t, body, w, fill, fg) in enumerate(steps):
        y = 180 + i * 150
        cx = 560
        w = max(w * 0.9, width_of(t, 20, DISPLAY) + 60)
        b.rect(cx + 60 - w / 2, y, w, 96, fill, r=12)
        b.text(cx + 60, y + 56, t, 20, fg, DISPLAY, 600, "middle")
        b.text(1120, y + 30, n.upper(), 12, C["leaf600"], MONO, 500, spacing=1.5)
        b.para(1120, y + 56, body, 420, 15, C["ink700"])
    return b


PERSONAS = [
    ("Estate officer", "Rakesh, 46", "Looks after power, water and repairs for the whole block. Pays the bill but cannot see where it goes.",
     ["Know which room is wasting, right now", "Show the principal what was saved"],
     ["One bill, no sub-meters", "Finds leaks only when the wall shows a stain"],
     "Desktop in the office, phone on rounds", C["leaf600"], C["leaf50"]),
    ("Caretaker", "Bashir, 38", "Opens and locks rooms, switches the pump, fixes small faults. Reads Hindi faster than English.",
     ["A short instruction he can act on", "Not be blamed for every high bill"],
     ["Long reports in English", "Alerts that turn out to be wrong"],
     "Phone only, voice and Hindi", C["volt700"], C["volt50"]),
    ("Lab in-charge", "Neha, 31", "Runs the computer lab. Forty PCs and three ACs that students leave on after the last class.",
     ["Find out who left what on", "Keep the lab cool without wasting"],
     ["No idea what the lab costs", "PCs left on overnight"],
     "Laptop, checks once a day", C["river700"], C["river50"]),
    ("Principal / finance", "Dr. Kaul, 55", "Signs the bills and the budget. Wants proof, in rupees and carbon, before spending on hardware.",
     ["Monthly saving in rupees", "Carbon numbers for the campus report"],
     ["Pilots that never show results", "Dashboards full of charts"],
     "Monthly PDF and a phone glance", C["ember700"], C["ember50"]),
]


def personas():
    b = Board("02-personas", "Four people, four different questions", "Personas")
    for i, (role, name, bio, goals, pains, device, accent, tint) in enumerate(PERSONAS):
        x, y, w, h = 64 + i * 374, 170, 350, 770
        b.card(x, y, w, h)
        b.rect(x, y, w, 8, accent, r=4)
        b.rect(x + 24, y + 34, 64, 64, tint, accent, r=32)
        b.text(x + 56, y + 75, name[0], 26, accent, DISPLAY, 700, "middle")
        b.text(x + 104, y + 58, role, 20, C["ink900"], DISPLAY, 600)
        b.text(x + 104, y + 84, name, 14, C["ink500"], MONO)
        yy = b.para(x + 24, y + 140, bio, w - 48, 15, C["ink700"])
        for head, items, col in [("WANTS", goals, C["leaf600"]), ("FRUSTRATED BY", pains, C["alarm500"])]:
            yy += 26
            b.text(x + 24, yy, head, 12, col, MONO, 500, spacing=1.5)
            yy += 10
            for it in items:
                yy += 8
                b.rect(x + 24, yy + 2, 6, 6, col, r=3)
                yy = b.para(x + 40, yy + 10, it, w - 64, 14.5, C["ink900"])
        b.rect(x + 24, y + h - 120, w - 48, 92, C["ink50"], C["ink200"], r=10)
        b.text(x + 40, y + h - 92, "USES ECOGUARD ON", 11.5, C["ink500"], MONO, 500, spacing=1.5)
        b.para(x + 40, y + h - 66, device, w - 80, 15, C["ink900"], DISPLAY, 500)
    return b


NAV = [
    ("Right now", [("Live building", "/"), ("Alerts", "/alerts"), ("Rooms", "/rooms")]),
    ("Where waste hides", [("Cooling & AC", "/hvac"), ("Water tank & pump", "/water"), ("Inside the walls", "/wiring"), ("People count", "/camera")]),
    ("Results", [("Savings & carbon", "/savings"), ("Next 24 hours", "/forecast"), ("How it decides", "/models"), ("Tested on 659 buildings", "/real")]),
    ("For your campus", [("Plans & pricing", "/plans"), ("Add a building", "/setup")]),
    ("Control room", [("Test mode", "/simulator"), ("Settings", "/settings")]),
]


def sitemap():
    b = Board("03-sitemap", "Grouped by the question the user is asking", "Sitemap")
    b.box(650, 160, 300, 70, "ECOGUARD", "one building, live", "start")
    cols = [C["leaf600"], C["ember500"], C["river500"], C["volt500"], C["ink700"]]
    cw = 280
    for i, (g, items) in enumerate(NAV):
        x = 64 + i * 298
        b.path(f"M800,230 V270 H{x + cw / 2} V310", C["ink400"])
        b.rect(x, 312, cw, 52, C["white"], cols[i], r=10, sw=2)
        b.text(x + cw / 2, 344, g, 17, C["ink900"], DISPLAY, 600, "middle")
        for j, (lab, route) in enumerate(items):
            y = 400 + j * 82
            b.path(f"M{x + 24},364 V{y + 30} H{x + 44}", C["ink300"], 1.4, arrow=False)
            b.rect(x + 44, y, cw - 44, 60, C["white"], C["ink200"], r=10)
            b.text(x + 62, y + 27, lab, 15.5, C["ink900"], SANS, 500)
            b.text(x + 62, y + 47, route, 12, C["ink500"], MONO)
    # detail pages
    b.rect(64, 800, 1472, 136, C["ink100"], C["ink300"], r=12, dash="6 6")
    b.text(88, 836, "ONE LEVEL DEEPER", 12, C["ink500"], MONO, 500, spacing=1.5)
    for k, (t, s) in enumerate([("Room detail", "/rooms/:id · reached from the 3D view, plan, rooms list and every alert"),
                                ("Alert detail", "cause, cost per hour, fix, Yes / No feedback"),
                                ("Real building", "/real/:id · any of the 659 BDG2 buildings")]):
        x = 88 + k * 480
        b.text(x, 878, t, 17, C["ink900"], DISPLAY, 600)
        b.para(x, 902, s, 440, 13.5, C["ink700"])
    return b


def flow_waste():
    b = Board("04-flow-waste", "A wasted room, from reading to fixed", "User flow 1 · caretaker and estate officer")
    y = 300
    nodes = [
        (64, "Reading arrives", "every 15 min: power, people, water", "entity"),
        (318, "Check against the timetable", "room empty but drawing power?", "process"),
        (572, "Alert with a name", "room, cause, ₹ per hour, fix", "power"),
        (826, "Caretaker hears it", "phone, Hindi voice", "screen"),
        (1080, "Switches it off", "on his round", "screen"),
        (1334, "Right call?", "Yes / No", "start"),
    ]
    for x, t, s, k in nodes:
        b.box(x, y, 200, 110, t, s, k)
    for i in range(len(nodes) - 1):
        b.line(nodes[i][0] + 200, y + 55, nodes[i + 1][0] - 4, y + 55)
    # branches from feedback
    b.path(f"M1434,410 V520 H1180", C["leaf600"])
    b.label(1310, 512, "yes", C["leaf600"])
    b.box(940, 480, 236, 90, "Saving is counted", "kWh, ₹ and CO₂ go to Savings", "process")
    b.path(f"M1434,410 V640 H1180", C["alarm500"])
    b.label(1310, 632, "no", C["alarm500"])
    b.box(940, 600, 236, 90, "Learn from it", "label stored, rule gets stricter for that room", "alarm")
    b.path("M940,525 H700 V700", C["ink400"], dash="5 5")
    b.box(560, 700, 280, 96, "Estate officer sees the day", "Savings page, monthly PDF for the principal", "screen")
    # decision side branch
    b.path("M418,410 V520 H318", C["ink400"])
    b.label(400, 470, "room busy")
    b.box(64, 480, 250, 80, "No alert", "people inside, power is expected", "note")
    b.rect(64, 850, 1472, 90, C["white"], C["ink200"], r=12)
    b.para(88, 884, "Design choices: one alert names one room and one action. The rupee cost is worked out by code, the words are only phrased by the language model. Every alert asks one question back, so the block builds its own labelled data.", 1420, 15, C["ink700"])
    return b


def flow_walls():
    b = Board("05-flow-walls", "Heat and damp inside the walls", "User flow 2 · the gap no meter shows")
    lanes = [("Power side", C["volt500"], C["volt50"]), ("Water side", C["river500"], C["river50"])]
    for i, (lab, col, tint) in enumerate(lanes):
        y = 170 + i * 330
        b.rect(64, y, 1472, 300, tint, col, r=14, sw=1.2)
        b.text(88, y + 36, lab.upper(), 13, col, MONO, 500, spacing=1.5)
    p = [(110, "Board meter vs room meters", "sum of rooms is lower than the board", "power"),
         (400, "Gap grows with the square of current", "I²R, worst at peak AC load", "process"),
         (690, "Hot, loose joint suspected", "wall and floor named", "walls"),
         (980, "Electrician checks that joint", "thermal gun, before it burns", "screen"),
         (1270, "Loss falls back", "gap returns to normal", "start")]
    w = [(110, "Pump on, tank not rising", "or tank rising with taps closed", "water"),
         (400, "Night flow above zero", "no one inside, water still moving", "process"),
         (690, "Hidden leak suspected", "earth-leakage on that wall rises", "walls"),
         (980, "Plumber opens that wall", "one place, not the whole floor", "screen"),
         (1270, "Night flow back to zero", "litres saved are counted", "start")]
    for row, y in [(p, 240), (w, 570)]:
        for x, t, s, k in row:
            b.box(x, y, 240, 110, t, s, k)
        for i in range(4):
            b.line(row[i][0] + 240, y + 55, row[i + 1][0] - 4, y + 55)
    b.rect(64, 880, 1472, 70, C["white"], C["ink200"], r=12)
    b.para(88, 921, "The walls page shows both on one section drawing of the block, so the estate officer sees which wall to open before anything is broken.", 1420, 15, C["ink700"])
    return b


def dfd0():
    b = Board("06-dfd0", "Data flow, level 0: ECOGUARD and the world around it", "Data flow diagram")
    b.rect(620, 380, 360, 220, C["leaf50"], C["leaf600"], r=110, sw=2.5)
    b.text(800, 478, "0.0 ECOGUARD", 26, C["ink900"], DISPLAY, 700, "middle")
    b.text(800, 510, "detects, costs and explains waste", 15, C["ink700"], SANS, 400, "middle")
    ents = [
        (90, 190, "Room sensor nodes", "ESP32 + camera: power, people, temp"),
        (90, 440, "Water sensors", "flow, tank and sump level, pump"),
        (90, 690, "Main board meter", "total kW, earth leakage"),
        (1230, 190, "Estate officer", "web dashboard"),
        (1230, 440, "Caretaker", "phone, Hindi voice"),
        (1230, 690, "Principal / finance", "monthly report"),
    ]
    for x, y, t, s in ents:
        b.box(x, y, 280, 96, t, s, "entity")
    for y, lab in [(238, "readings, 15 min"), (488, "flow, levels"), (738, "board kW, leakage")]:
        b.path(f"M370,{y} C500,{y} 520,490 616,490")
        b.label(470, y - 12 if y < 488 else y + 22, lab)
    for y, lab in [(238, "alerts, savings"), (488, "spoken fix"), (738, "₹ and CO₂ report")]:
        b.path(f"M984,490 C1080,490 1100,{y} 1226,{y}")
        b.label(1120, y - 12 if y != 488 else y - 12, lab)
    b.path("M1230,270 C1000,330 960,360 900,384", C["leaf600"], dash="6 5")
    b.label(1060, 330, "Yes / No feedback", C["leaf600"])
    b.box(620, 800, 360, 90, "Weather and timetable", "outside temp, class hours", "entity")
    b.line(800, 800, 800, 604)
    return b


def dfd1():
    b = Board("07-dfd1", "Data flow, level 1: inside ECOGUARD", "Data flow diagram")
    pr = [(90, 200, "1.0 Ingest and count", "check readings, count people (YOLO)"),
          (90, 520, "2.0 Detect waste", "room model + 9 checks"),
          (620, 200, "3.0 Cost and carbon", "₹ per kWh and per kL, 0.716 kg CO₂/kWh"),
          (620, 520, "4.0 Explain", "sentence templates, EN or हिं"),
          (1150, 360, "5.0 Learn from feedback", "Yes / No becomes a label")]
    for x, y, t, s in pr:
        b.box(x, y, 330, 120, t, s, "process")
    st = [(90, 380, "D1", "Readings"), (620, 380, "D2", "Alerts"), (1150, 600, "D3", "Labels"), (1150, 200, "D4", "Building config"), (620, 700, "D5", "Trained models")]
    for x, y, i, t in st:
        b.store(x, y, 330, 54, i, t)
    b.line(255, 320, 255, 376); b.label(310, 352, "clean rows")
    b.line(255, 434, 255, 516); b.label(310, 478, "window")
    b.path("M420,580 C520,580 520,260 616,260"); b.label(520, 420, "fault, room, kWh")
    b.line(785, 320, 785, 376); b.label(840, 352, "alert + ₹")
    b.line(785, 434, 785, 516); b.label(840, 478, "facts only")
    b.path("M950,580 C1050,580 1050,420 1146,420"); b.label(1060, 545, "to user")
    b.line(1315, 480, 1315, 596); b.label(1375, 540, "label")
    b.path("M1150,627 C700,700 300,700 255,644"); b.label(700, 690, "stricter thresholds per room")
    b.path("M1150,207 C800,160 300,160 255,196"); b.label(700, 168, "floors, rooms, AC, PCs, tariff")
    b.path("M616,727 C480,727 440,700 420,620"); b.label(500, 760, "expected kW per room")
    b.rect(90, 820, 1390, 110, C["white"], C["ink200"], r=12)
    b.para(114, 856, "Numbers are always computed in code (2.0 and 3.0); 4.0 only fills them into fixed English and Hindi sentences, so advice can never invent a number. D5 holds the trained room models; Yes / No labels in D3 are used to retrain them. D4 is a single JSON file, so a new building is a config edit, not new code.", 1340, 15, C["ink700"])
    return b


def wf_frame(b, x, y, w, h, title):
    b.rect(x, y, w, h, C["white"], C["ink300"], r=10, sw=1.5)
    b.rect(x, y, w, 30, C["ink100"], r=10)
    b.text(x + 14, y + 20, title, 12, C["ink700"], MONO, 500)


def g(b, x, y, w, h, r=4, fill=None):
    b.rect(x, y, w, h, fill or C["ink100"], C["ink300"], r=r, sw=1)


def wireframes():
    b = Board("08-wireframes", "Wireframes: what goes where, before colour", "Low fidelity")
    # desktop: live building
    x, y = 64, 170
    wf_frame(b, x, y, 900, 560, "Live building · desktop")
    g(b, x + 12, y + 42, 150, 506, 6, C["ink200"])
    for k in range(9):
        g(b, x + 24, y + 70 + k * 40, 120, 20, 4, C["ink100"])
    g(b, x + 176, y + 42, 300, 22); g(b, x + 176, y + 72, 460, 12)
    for k in range(5):
        g(b, x + 176 + k * 142, y + 100, 132, 72, 8, C["white"])
    g(b, x + 176, y + 186, 440, 300, 10, C["ink200"])
    b.text(x + 396, y + 340, "3D building / floor plan", 14, C["ink500"], MONO, 400, "middle")
    for k in range(3):
        g(b, x + 176 + k * 148, y + 496, 140, 40, 6)
    for k in range(4):
        g(b, x + 630, y + 186 + k * 90, 258, 80, 8, C["white"])
        b.rect(x + 630, y + 186 + k * 90, 5, 80, C["ink400"], r=2)
    # phone: alert
    px, py = 1000, 170
    wf_frame(b, px, py, 260, 560, "Alert · phone")
    g(b, px + 12, py + 44, 236, 40, 6)
    for k in range(3):
        g(b, px + 12, py + 96 + k * 140, 236, 128, 8, C["white"])
        b.rect(px + 12, py + 96 + k * 140, 5, 128, C["ink400"], r=2)
        g(b, px + 26, py + 110 + k * 140, 150, 14); g(b, px + 26, py + 132 + k * 140, 200, 10); g(b, px + 26, py + 150 + k * 140, 180, 10)
        g(b, px + 26, py + 184 + k * 140, 70, 26, 6); g(b, px + 104, py + 184 + k * 140, 70, 26, 6)
    # room detail
    rx, ry = 1296, 170
    wf_frame(b, rx, ry, 240, 560, "Room · phone")
    g(b, rx + 12, ry + 44, 160, 20); g(b, rx + 12, ry + 74, 216, 120, 8, C["ink200"])
    for k in range(4):
        g(b, rx + 12 + (k % 2) * 112, ry + 206 + (k // 2) * 70, 104, 60, 8, C["white"])
    g(b, rx + 12, ry + 350, 216, 190, 8, C["ink200"])
    notes = [("1", "Numbers first: five readouts answer 'how bad is it right now'."),
             ("2", "The building is the main object, not a chart. Click a room to open it."),
             ("3", "Alerts sit beside the building so cause and place are seen together."),
             ("4", "On a phone the alert card is the whole app: one room, one fix, Yes / No.")]
    for k, (n, t) in enumerate(notes):
        nx = 64 + k * 372
        b.rect(nx, 770, 30, 30, C["night900"], r=15)
        b.text(nx + 15, 791, n, 14, C["white"], MONO, 500, "middle")
        b.para(nx + 44, 790, t, 310, 14.5, C["ink700"])
    return b


def style_guide():
    b = Board("09-style", "Style guide: a campus in the hills", "Colour, type and parts")
    groups = [("Leaf · the system", ["#EEF5EE", "#B5D8BF", "#6DB283", "#3E8E5A", "#245C3A", "#143524"]),
              ("Volt · electricity", ["#FBF4DF", "#F2D27A", "#E3A91C", "#C98A00", "#865A00", "#4A3100"]),
              ("River · water", ["#E8F3F7", "#A3D0DE", "#3F98B4", "#1C8DB5", "#0F5F7C", "#083546"]),
              ("Ember · inside walls", ["#F8ECE5", "#E3AE92", "#C56C40", "#B4532A", "#7A341A", "#3F1B0D"]),
              ("Alarm · act now", ["#FBEBE8", "#EBA79D", "#D2574A", "#C0392B", "#80241B", "#40120D"]),
              ("Stone and night · neutrals", ["#F4F2EC", "#DEE2DA", "#8A958E", "#34463E", "#0F2A20", "#0A1C15"])]
    for i, (name, sw) in enumerate(groups):
        y = 170 + i * 92
        b.text(64, y + 18, name, 15, C["ink900"], DISPLAY, 600)
        for k, hx in enumerate(sw):
            sx = 64 + k * 118
            b.rect(sx, y + 30, 110, 40, hx, C["ink200"], r=8, sw=1)
            b.text(sx, y + 86 - 2, hx, 11, C["ink500"], MONO)
    # type
    tx = 840
    b.text(tx, 188, "TYPE", 12, C["leaf600"], MONO, 500, spacing=1.5)
    rows = [("Space Grotesk 600 · 36", "What the building is doing", DISPLAY, 36, 600),
            ("Space Grotesk 600 · 20", "Classroom 103 · door open", DISPLAY, 20, 600),
            ("IBM Plex Sans 400 · 15", "AC is fighting an open door. Close it to save ₹18 an hour.", SANS, 15, 400),
            ("JetBrains Mono 500 · 28", "12.4 kW   1,870 L   ₹46,210", MONO, 28, 500),
            ("JetBrains Mono 500 · 11 caps", "LIVE · EVERY 15 MINUTES", MONO, 11, 500)]
    y = 230
    for meta, sample, f, s, wgt in rows:
        b.text(tx, y, meta, 11.5, C["ink500"], MONO)
        b.text(tx, y + s + 10, sample, s, C["ink900"], f, wgt)
        y += s + 46
    # parts
    py = 760
    b.text(64, py, "PARTS", 12, C["leaf600"], MONO, 500, spacing=1.5)
    b.rect(64, py + 20, 150, 44, C["night900"], r=10); b.text(139, py + 48, "Primary", 15, C["white"], SANS, 500, "middle")
    b.rect(230, py + 20, 150, 44, C["white"], C["ink300"], r=10); b.text(305, py + 48, "Ghost", 15, C["ink900"], SANS, 500, "middle")
    xx = 400
    for lab, fg, bg, bd in [("POWER", C["volt700"], C["volt50"], C["volt200"]), ("WATER", C["river700"], C["river50"], C["river200"]),
                            ("INSIDE WALLS", C["ember700"], C["ember50"], C["ember200"]), ("ACT NOW", C["alarm500"], C["alarm50"], C["alarm200"])]:
        xx = b.pill(xx, py + 29, lab, fg, bg, bd)
    # kpi
    b.card(64, py + 90, 240, 120)
    b.rect(64, py + 90, 240, 5, C["volt400"] if "volt400" in C else C["volt300"], r=2)
    b.text(84, py + 124, "ENERGY TODAY", 11, C["ink500"], MONO, 500, spacing=1)
    b.text(84, py + 166, "212 kWh", 28, C["ink900"], MONO, 500)
    b.text(84, py + 192, "9.4 kWh caught as waste", 12.5, C["ink500"])
    # alert card
    b.card(324, py + 90, 470, 120)
    b.rect(324, py + 90, 6, 120, C["volt500"], r=3)
    b.text(348, py + 124, "AC fighting an open door", 17, C["ink900"], DISPLAY, 600)
    b.text(348, py + 148, "Classroom 103 · first floor · ₹18 per hour", 13, C["ink700"])
    b.rect(348, py + 164, 92, 30, C["leaf50"], C["leaf200"], r=8); b.text(394, py + 184, "✓ Yes", 13, C["leaf700"], SANS, 500, "middle")
    b.rect(448, py + 164, 92, 30, C["white"], C["ink300"], r=8); b.text(494, py + 184, "✕ No", 13, C["ink700"], SANS, 500, "middle")
    rules = ["Colour always means a resource: amber is power, blue is water, ember is the walls.",
             "Red only for 'act now', never for decoration.",
             "Every number is in mono so digits line up.",
             "Text on colour passes WCAG AA (4.5:1)."]
    y = py + 20
    for r in rules:
        b.rect(840, y + 4, 6, 6, C["leaf500"], r=3)
        y = b.para(856, y + 12, r, 680, 14.5, C["ink700"]) + 6
    return b


def states():
    b = Board("10-states", "Every screen handles these states", "States and accessibility")
    cards = [
        ("Loading", "Loading the building…", "Spinner with words, read out by screen readers.", "note"),
        ("No readings yet", "Start the sensor gateway or connect the ESP32 nodes.", "First-run state, tells the user the next step.", "note"),
        ("Nothing wasted", "Every room, the tank and the pump are checked every 15 minutes.", "An empty list is good news, said plainly.", "process"),
        ("Server offline", "Could not reach the ECOGUARD server. Retry.", "Keeps the last data on screen, marks it stale.", "alarm"),
        ("Power cut", "Grid off. Loads that come back on are watched.", "Header chip turns red; comeback waste is tracked.", "alarm"),
        ("No 3D support", "Falls back to the floor plan.", "Same rooms and colours, works on old phones.", "note"),
    ]
    for i, (t, msg, why, k) in enumerate(cards):
        x, y = 64 + (i % 3) * 496, 180 + (i // 3) * 260
        b.box(x, y, 470, 130, t, msg, k)
        b.para(x + 4, y + 162, why, 460, 14.5, C["ink700"])
    b.rect(64, 720, 1472, 220, C["night900"], r=16)
    b.text(96, 764, "ACCESSIBILITY", 12, C["leaf300"], MONO, 500, spacing=1.5)
    acc = ["Skip link, landmarks and one h1 per page", "Keyboard reaches every room in the 3D view through a list",
           "Reduced motion stops the flowing particles", "Hindi advice and voice read-out for the caretaker",
           "Status never by colour alone: always a word too", "Touch targets 44 px on phone"]
    for k, a in enumerate(acc):
        ax, ay = 96 + (k % 2) * 720, 810 + (k // 2) * 42
        b.rect(ax, ay - 10, 8, 8, C["leaf300"], r=4)
        b.text(ax + 20, ay, a, 16, C["white"])
    return b



# every screen, low fidelity --------------------------------------------------
# blocks in a 340 x 200 content box: (x, y, w, h, label, kind) kind: b=box, d=dark/visual, t=text line, c=chart
SCREENS = [
    ("Live building", "/", "Five readouts, the building in 3D or plan, alerts beside it.",
     [(0, 0, 60, 30, "", "b"), (68, 0, 60, 30, "", "b"), (136, 0, 60, 30, "", "b"), (204, 0, 60, 30, "", "b"), (272, 0, 68, 30, "", "b"),
      (0, 40, 210, 160, "3D / plan", "d"), (220, 40, 120, 36, "", "a"), (220, 82, 120, 36, "", "a"), (220, 124, 120, 36, "", "a"), (220, 166, 120, 34, "", "a")]),
    ("Alerts", "/alerts", "Filter by kind, every alert with cost, fix and Yes / No.",
     [(0, 0, 340, 22, "filters", "b"), (0, 30, 340, 52, "", "a"), (0, 88, 340, 52, "", "a"), (0, 146, 340, 52, "", "a")]),
    ("Rooms", "/rooms", "Every room as a card: people, kW now, waste today.",
     [(i % 4 * 86, 0 + i // 4 * 100, 80, 92, "", "b") for i in range(8)]),
    ("Room detail", "/rooms/:id", "One room: live readouts, today's curve, its alerts.",
     [(0, 0, 160, 22, "", "t"), (0, 30, 80, 44, "", "b"), (88, 30, 80, 44, "", "b"), (176, 30, 80, 44, "", "b"), (264, 30, 76, 44, "", "b"),
      (0, 84, 220, 116, "kW today vs expected", "c"), (230, 84, 110, 116, "", "a")]),
    ("Cooling & AC", "/hvac", "Each AC: set point, door, people; overcool and door-open flagged.",
     [(0, 0, 340, 60, "outside vs inside temp", "c"), (0, 70, 108, 130, "", "b"), (116, 70, 108, 130, "", "b"), (232, 70, 108, 130, "", "b")]),
    ("Water tank & pump", "/water", "Sump, pump, roof tank as one line; night flow and overflow.",
     [(0, 0, 70, 120, "sump", "d"), (90, 40, 60, 40, "pump", "b"), (170, 0, 70, 120, "tank", "d"), (260, 0, 80, 120, "", "a"), (0, 132, 340, 68, "litres per hour", "c")]),
    ("Inside the walls", "/wiring", "Section drawing of the block: hot joints and damp walls by floor.",
     [(0, 0, 220, 200, "section of block", "d"), (230, 0, 110, 60, "", "b"), (230, 70, 110, 60, "", "b"), (230, 140, 110, 60, "", "b")]),
    ("People count", "/camera", "Head count from the camera, no faces stored, timetable beside it.",
     [(0, 0, 200, 130, "count only", "d"), (210, 0, 130, 130, "timetable", "b"), (0, 140, 340, 60, "people by hour", "c")]),
    ("Savings & carbon", "/savings", "Same year with and without ECOGUARD: kWh, litres, rupees, CO2.",
     [(0, 0, 80, 44, "", "b"), (88, 0, 80, 44, "", "b"), (176, 0, 80, 44, "", "b"), (264, 0, 76, 44, "", "b"), (0, 54, 340, 146, "before vs after by month", "c")]),
    ("Next 24 hours", "/forecast", "Tomorrow's load from the model against last week and yesterday.",
     [(0, 0, 340, 130, "forecast with band", "c"), (0, 140, 108, 60, "", "b"), (116, 140, 108, 60, "", "b"), (232, 140, 108, 60, "", "b")]),
    ("Tested on 659 buildings", "/real", "Real meters: model score per building, pass ASHRAE 14 or not.",
     [(0, 0, 340, 22, "search, filter", "b"), (0, 30, 200, 170, "score spread", "c"), (210, 30, 130, 170, "", "a")]),
    ("How it decides", "/models", "Each trained model: what it learned, its score, where it is used.",
     [(0, 0, 340, 50, "one reading, six steps", "b"), (0, 60, 166, 66, "", "a"), (174, 60, 166, 66, "", "a"), (0, 134, 166, 66, "", "a"), (174, 134, 166, 66, "", "a")]),
    ("Test mode", "/simulator", "Inject any of the twelve faults, change speed, watch it get caught.",
     [(0, 0, 160, 200, "fault list", "b"), (170, 0, 170, 90, "controls", "b"), (170, 100, 170, 100, "log", "a")]),
    ("Settings", "/settings", "Building, tariff, alert rules per room, language, voice.",
     [(0, 0, 90, 200, "sections", "b"), (100, 0, 240, 36, "", "t"), (100, 44, 240, 36, "", "t"), (100, 88, 240, 36, "", "t"), (100, 132, 240, 36, "", "t")]),
    ("Onboarding", "/setup", "Add a building in four steps: floors, rooms, meters, tariff.",
     [(0, 0, 340, 16, "step 1 · 2 · 3 · 4", "t"), (0, 26, 340, 130, "form", "b"), (220, 166, 120, 34, "Next", "d")]),
    ("Phone: alert", "phone", "One room, one fix, Yes / No; read aloud in Hindi.",
     [(110, 0, 120, 200, "", "p")]),
]


def mini(b, x, y, idx, sc):
    name, route, note, blocks = sc
    W_, H_ = 352, 400
    b.rect(x, y, W_, H_, C["white"], C["ink300"], r=10, sw=1.4)
    b.rect(x + 12, y + 12, 26, 18, C["night900"], r=4)
    b.text(x + 25, y + 26, f"{idx:02d}", 11, C["white"], MONO, 500, "middle")
    b.text(x + 46, y + 27, name, 15, C["ink900"], DISPLAY, 600)
    b.text(x + W_ - 12, y + 27, route, 11, C["ink500"], MONO, 400, "end")
    ox, oy = x + 6, y + 42
    for bx, by, bw, bh, lab, k in blocks:
        X, Y = ox + bx, oy + by * 1.45
        bh = bh * 1.45
        if k == "d":
            b.rect(X, Y, bw, bh, C["ink200"], C["ink300"], r=6, sw=1)
        elif k == "c":
            b.rect(X, Y, bw, bh, C["white"], C["ink300"], r=6, sw=1)
            pts = " ".join(f"{X + 8 + i * (bw - 16) / 9:.0f},{Y + bh - 14 - ((i * 37) % 23) / 23 * (bh - 34):.0f}" for i in range(10))
            b.el.append(f'<polyline points="{pts}" fill="none" stroke="{C["ink400"]}" stroke-width="1.5"/>')
        elif k == "a":
            b.rect(X, Y, bw, bh, C["white"], C["ink300"], r=6, sw=1)
            b.rect(X, Y, 4, bh, C["ink400"], r=2)
            b.rect(X + 10, Y + 8, bw * 0.6, 6, C["ink200"], r=3)
            if bh > 30:
                b.rect(X + 10, Y + 20, bw * 0.8, 5, C["ink100"], r=2)
        elif k == "t":
            b.rect(X, Y, bw, min(bh, 22), C["ink100"], C["ink300"], r=4, sw=1)
        elif k == "p":
            b.rect(X, Y, bw, bh, C["ink100"], C["ink400"], r=16, sw=1.4)
            b.rect(X + 10, Y + 20, bw - 20, 80, C["white"], C["ink300"], r=6, sw=1)
            b.rect(X + 10, Y + 20, 4, 80, C["ink400"], r=2)
            b.rect(X + 18, Y + 76, 40, 16, C["ink200"], r=4); b.rect(X + 64, Y + 76, 40, 16, C["ink200"], r=4)
            b.rect(X + 10, Y + 110, bw - 20, 80, C["white"], C["ink300"], r=6, sw=1)
        else:
            b.rect(X, Y, bw, bh, C["ink100"], C["ink300"], r=6, sw=1)
        if lab and k == "c":
            b.text(X + 8, Y + 16, lab, 10.5, C["ink500"], MONO)
        elif lab:
            b.text(X + bw / 2, Y + bh / 2 + 4, lab, 10.5, C["ink500"], MONO, 400, "middle")
    b.para(x + 12, y + 360, note, W_ - 24, 12.5, C["ink700"])


def wireframes_all(part):
    chunk = SCREENS[part * 8:(part + 1) * 8]
    b = Board(f"08{'bc'[part]}-wireframes-{part + 1}", f"Every screen, low fidelity ({part + 1} of 2)", "Wireframes")
    for i, sc in enumerate(chunk):
        mini(b, 64 + (i % 4) * 372, 150 + (i // 4) * 420, part * 8 + i + 1, sc)
    return b


def spacing_icons():
    b = Board("09b-spacing-icons", "Spacing, radius and icons", "Style guide, part 2")
    b.text(64, 188, "SPACING · 4 PX BASE", 12, C["leaf600"], MONO, 500, spacing=1.5)
    for i, v in enumerate([4, 8, 12, 16, 24, 32, 48, 64]):
        y = 210 + i * 44
        b.rect(64, y, v * 4, 24, C["leaf200"], r=3)
        b.text(64 + v * 4 + 14, y + 17, f"{v} px", 13, C["ink700"], MONO)
    b.para(64, 600, "Cards use 16 inside and 20 between. Screen edges 24 on desktop, 16 on phone. Touch targets never below 44.", 560, 14.5, C["ink700"])
    b.text(720, 188, "RADIUS", 12, C["leaf600"], MONO, 500, spacing=1.5)
    for i, (r, lab) in enumerate([(4, "pill 6"), (10, "button 10"), (16, "card 16"), (24, "start node 24")]):
        x = 720 + i * 200
        b.rect(x, 210, 160, 100, C["white"], C["ink300"], r=r, sw=1.5)
        b.text(x + 80, 266, lab, 13, C["ink700"], MONO, 400, "middle")
    b.text(720, 380, "ICONS · LUCIDE, 1.75 STROKE, 16 / 20 PX", 12, C["leaf600"], MONO, 500, spacing=1.5)
    icons = [
        ("Power", C["volt500"], '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
        ("Water", C["river500"], '<path d="M12 2.7s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11z"/>'),
        ("Walls", C["ember500"], '<path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/>'),
        ("Alert", C["alarm500"], '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
        ("Room", C["ink700"], '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2"/>'),
        ("Cooling", C["river700"], '<path d="M4 4h16v8H4zM7 16v4M12 16v5M17 16v4"/>'),
        ("Savings", C["leaf600"], '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
        ("Leaf", C["leaf600"], '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>'),
    ]
    for i, (lab, col, d) in enumerate(icons):
        x, y = 720 + (i % 4) * 200, 410 + (i // 4) * 130
        b.rect(x, y, 160, 110, C["white"], C["ink200"], r=12)
        b.el.append(f'<g transform="translate({x + 62},{y + 22}) scale(1.5)" fill="none" stroke="{col}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">{d}</g>')
        b.text(x + 80, y + 94, lab, 13, C["ink700"], SANS, 500, "middle")
    b.para(720, 700, "One icon set everywhere. The icon colour follows the resource, so a bolt is always amber and a drop is always blue.", 760, 14.5, C["ink700"])
    return b


RATIONALE = [
    ("Narrowed to one block", "Round 1 covered every building and lost marks for it. One academic block lets us show every waste inside it, end to end, with numbers we can defend."),
    ("The building is the home screen", "A facility manager thinks in rooms and floors, not in charts. The 3D view and plan answer 'where' before 'how much'."),
    ("Colour means a resource", "Amber is power, blue is water, ember is the walls. Users learn it once and read every screen faster. Red is kept for 'act now'."),
    ("One alert, one room, one fix", "Each alert names the room, the cause, the rupees per hour and the action. The caretaker can act without opening anything else."),
    ("Yes / No on every alert", "Two taps teach the system. Wrong alerts get rarer for that room, and the campus builds its own labelled data."),
    ("Hindi and voice", "The caretaker is the person who switches things off. He gets the fix read aloud in Hindi on his phone."),
    ("Numbers in code, words from templates", "Rupees, kWh and CO2 are computed by fixed formulas and dropped into fixed English and Hindi sentences, so the advice can never invent a number."),
    ("Real and simulated side by side", "Every page says where its numbers come from: the simulated Jammu block or the 659 real BDG2 buildings."),
    ("Tools", "Figma for the design file, components and prototype. React and Tailwind use the same tokens, so the build matches the file."),
]


def rationale():
    b = Board("11-rationale", "Why the design looks the way it does", "Design rationale")
    for i, (t, body) in enumerate(RATIONALE):
        x, y = 64 + (i % 3) * 496, 170 + (i // 3) * 260
        b.rect(x, y, 470, 236, C["white"], C["ink200"], r=14)
        b.text(x + 24, y + 40, f"{i + 1:02d}", 13, C["leaf600"], MONO, 500)
        b.text(x + 64, y + 40, t, 19, C["ink900"], DISPLAY, 600)
        b.para(x + 24, y + 80, body, 420, 15, C["ink700"])
    return b


BOARDS = [cover, problem, personas, sitemap, flow_waste, flow_walls, dfd0, dfd1, wireframes, lambda: wireframes_all(0), lambda: wireframes_all(1), style_guide, spacing_icons, states, rationale]

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for fn in BOARDS:
        bd = fn()
        (OUT / f"{bd.name}.svg").write_text(bd.svg(), encoding="utf-8")
        print(bd.name)
