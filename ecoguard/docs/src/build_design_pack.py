"""Builds docs/ECOGUARD-Round2-Design-Pack.html (and the PDF via build_pdf.py)."""
from pathlib import Path

from diagram import Diagram
from wireframes import SCREENS, svg as wire

HERE = Path(__file__).parent
OUT = HERE.parent

# ---------------------------------------------------------------- sitemap
sm = Diagram(900, 330)
sm.node("home", 380, 10, 140, 44, "ECOGUARD AI\ndashboard", "start")
pages = [("ov", "Overview", "KPIs · map"), ("rooms", "Rooms", "8 rooms"), ("alerts", "Alerts", "open · history"), ("cam", "Camera", "YOLO count"),
         ("hvac", "HVAC", "comfort · AC"), ("water", "Water & Pump", "tank · flows"), ("wall", "Heat & Damp", "walls"),
         ("fc", "Forecast", "next 24 h"), ("sav", "Savings", "before/after"), ("real", "Real Bldgs", "BDG2 sandbox"), ("sim", "Simulator", "demo"), ("set", "Settings", "modes")]
for i, (k, t, sub) in enumerate(pages):
    sm.node(k, 4 + i * 74.5, 110, 70, 52, f"{t}\n{sub}", "screen")
    sm.edge("home", k)
sm.node("room", 40, 230, 150, 50, "Room detail\n(/rooms/:id)", "screen")
sm.edge("rooms", "room")
sm.edge("ov", "room", "map tile")
sm.node("drawer", 240, 230, 170, 50, "Alert actions\nswitch off · 24 C · confirm", "note")
sm.edge("alerts", "drawer")
sm.node("bld", 600, 230, 170, 50, "Building sandbox\n(/real/:id) what-if", "screen")
sm.edge("real", "bld")
sm.node("voice", 430, 230, 150, 50, "Voice commands\n(header mic, EN / HI)", "note")
sm.edge("home", "voice", "")
SITEMAP = sm.render(width=680)

# ---------------------------------------------------------------- user flows
def flow(steps, w=880):
    d = Diagram(w, 90)
    n = len(steps)
    bw = (w - 20 - (n - 1) * 18) / n
    for i, (label, kind) in enumerate(steps):
        d.node(i, 10 + i * (bw + 18), 15, bw, 60, label, kind)
        if i:
            d.edge(i - 1, i)
    return d.render(width=680)

FLOW1 = flow([("Phone buzz /\ndashboard badge", "start"), ("Overview:\nalert card", "screen"), ("Read advice\n(EN / हिन्दी)", "screen"),
              ("Real waste?", "decision"), ("Switch room off\n(or wait 15 min:\nauto)", "process"), ("Savings updated\nlabel saved", "screen")])
FLOW2 = flow([("Heat & Damp Walls", "start"), ("Circuit shows\n'Hot joint'", "screen"), ("Open room\ndetail", "screen"),
              ("See R rising\nover days", "screen"), ("Ticket to\nelectrician", "process"), ("R back to\nnormal", "screen")])
FLOW3 = flow([("Night water\nalert on F1", "start"), ("Water & Pump:\nflow never 0", "screen"), ("Same floor:\nearth leakage up?", "decision"),
              ("Leak inside wall\n→ close valve", "process"), ("Ticket to\nplumber", "process"), ("Litres saved\non Savings", "screen")])
FLOW4 = flow([("Estate officer", "start"), ("Savings &\nCarbon", "screen"), ("Before vs after\n(full year)", "screen"),
              ("Waste-type\ntable", "screen"), ("Export /\npresent", "process")])

# ---------------------------------------------------------------- DFD level 0
d0 = Diagram(900, 360)
d0.node("sys", 330, 120, 240, 110, "0. ECOGUARD AI\nwaste detection & control", "process")
d0.node("sens", 10, 20, 190, 60, "Room sensor nodes\n(ESP32: V, I, kWh, people)", "entity")
d0.node("wat", 10, 150, 190, 60, "Water node\n(flow, tank, sump, pump)", "entity")
d0.node("cam", 10, 280, 190, 60, "Cameras / timetable\n(occupancy)", "entity")
d0.node("fm", 700, 20, 190, 60, "Facility manager\n(dashboard)", "entity")
d0.node("maint", 700, 150, 190, 60, "Electrician / plumber\n(tickets)", "entity")
d0.node("relay", 700, 280, 190, 60, "Relays, pump, valves\n(actuators)", "entity")
d0.edge("sens", "sys", "energy & voltage readings")
d0.edge("wat", "sys", "flow & level readings")
d0.edge("cam", "sys", "headcount")
d0.edge("sys", "fm", "alerts, advice, savings", bend=-12)
d0.edge("fm", "sys", "confirm / dismiss,\nmanual actions, settings", bend=-12)
d0.edge("sys", "maint", "work orders")
d0.edge("sys", "relay", "switch off, pump off,\nclose valve")
DFD0 = d0.render(width=680)

# ---------------------------------------------------------------- DFD level 1
d1 = Diagram(940, 560)
d1.node("sens", 10, 30, 170, 56, "Sensor nodes\n(rooms + water)", "entity")
d1.node("p1", 230, 30, 170, 56, "1.0 Ingest &\nvalidate readings", "process")
d1.node("ds1", 460, 30, 200, 44, "D1 Readings\n(energy, water, occupancy)", "store")
d1.node("p2", 230, 150, 170, 56, "2.0 Predict normal use\n(trained baseline)", "process")
d1.node("ds5", 10, 150, 170, 44, "D5 Model\n(baseline.json)", "store")
d1.node("p3", 230, 270, 170, 64, "3.0 Detect waste\n(rules + hidden heat\n+ water checks)", "process")
d1.node("ds2", 460, 280, 200, 44, "D2 Alerts\n(+ manager labels)", "store")
d1.node("p4", 460, 400, 170, 56, "4.0 Advise\n(EN / Hindi, ₹, kg CO₂)", "process")
d1.node("p5", 700, 270, 170, 64, "5.0 Decide & control\n(auto after grace,\ntickets)", "process")
d1.node("ds3", 700, 160, 200, 44, "D3 Control actions", "store")
d1.node("relay", 740, 30, 180, 56, "Relays / pump /\nvalves", "entity")
d1.node("p6", 230, 400, 170, 56, "6.0 Forecast\nnext 24 h", "process")
d1.node("p7", 700, 400, 170, 56, "7.0 Track savings\n& carbon", "process")
d1.node("ds4", 700, 500, 200, 44, "D4 Savings daily", "store")
d1.node("fm", 230, 500, 170, 50, "Facility manager", "entity")
d1.node("maint", 10, 400, 170, 50, "Maintenance staff", "entity")
d1.edge("sens", "p1", "readings")
d1.edge("p1", "ds1", "stored")
d1.edge("p1", "p2", "live reading")
d1.edge("ds5", "p2", "coefficients")
d1.edge("p2", "p3", "expected kW")
d1.edge("p3", "ds2", "alerts")
d1.edge("ds2", "p4", "")
d1.edge("p3", "p5", "open alerts")
d1.edge("p5", "ds3", "")
d1.edge("p5", "relay", "commands")
d1.edge("ds1", "p6", "history", bend=40)
d1.edge("p5", "p7", "avoided kWh / L")
d1.edge("p7", "ds4", "")
d1.edge("p4", "fm", "advice", bend=10)
d1.edge("p6", "fm", "forecast")
d1.edge("fm", "ds2", "confirm / dismiss", bend=-60)
d1.edge("p5", "maint", "tickets", bend=90)
DFD1 = d1.render(width=680)

# ---------------------------------------------------------------- module coverage (Round 1 -> screens)
COVER = [
    ("Data collection: IoT sensors, meters, CCTV", "Camera Occupancy (YOLO person count) · room nodes over HTTP or MQTT · Rooms · Water & Pump"),
    ("Intelligence engine: anomaly detection", "Alerts · Overview map · Room detail chart (actual vs expected)"),
    ("Intelligence engine: forecasting", "Forecast (simulated block) · LSTM day-ahead forecaster on real buildings (Real Buildings)"),
    ("Real data, trained models", "Real Buildings: 659 real classrooms, labs and offices (BDG2), LightGBM baselines, what-if sandbox"),
    ("Intelligence engine: cross-utility (energy + water)", "Water & Pump (pump links both) · Heat & Damp Walls (damp wall + leak)"),
    ("Decision & control automation (HVAC, lighting, water)", "HVAC & Comfort (reset to 24 C, open door) · alert actions · automatic, manual and scheduled modes"),
    ("User interface: portal, voice, reports, AI insights", "All screens · voice commands (EN/HI) · advice in English/Hindi · labelled CSV export"),
    ("Savings & carbon (ER entity)", "Savings & Carbon (live + full-year before vs after)"),
    ("Fail-safe: manual override, safe rules", "'Not waste' stops auto action · relays never cut occupied rooms · nodes run local safe rules when the server is down"),
]

STYLE_COLORS = [("brand-700", "#047857", "Primary actions, active nav, positive numbers"), ("brand-50", "#ecfdf5", "Selected nav, 'in use' rooms"),
                ("energy", "#d97706", "Electricity values, energy alerts"), ("water", "#0284c7", "Water values, water alerts"),
                ("hidden", "#7c3aed", "Wiring heat / earth leakage (hidden waste)"), ("danger", "#dc2626", "Open alerts, switch-off, power cut"),
                ("ink-900", "#0f172a", "Headings, key numbers"), ("ink-500", "#64748b", "Secondary text"), ("ink-100", "#f1f5f9", "Page background, tiles")]

PERSONAS = [
    ("Facility Manager", "Runs the block day to day; looks at the phone between rounds.",
     ["Know which room is wasting right now, without walking every floor", "Act in one tap, and not be blamed for switching off a class"],
     ["Finds out about leaks from the electricity/water bill a month later", "Guard rounds catch lights at 10 pm, too late"],
     "Overview, Alerts, one-tap Switch off, Hindi advice"),
    ("Estate Officer / Admin", "Owns the budget and the green-campus report.",
     ["Show money and CO₂ saved with numbers that hold up", "Decide where to spend on repairs"],
     ["No sub-metering: one bill for the whole block", "Cannot prove that an intervention worked"],
     "Savings & Carbon (before vs after), Forecast"),
    ("Electrician / Plumber", "Gets called after something breaks.",
     ["Get told before it breaks, with the exact room or floor", "Fewer emergency calls"],
     ["Loose joints are found only after a burn smell or a trip", "Leaks inside walls are found only when paint peels"],
     "Heat & Damp Walls, work-order tickets"),
    ("Faculty / Students (occupants)", "Use the rooms; not dashboard users.",
     ["Room is ready and comfortable when class starts", "Never lose power mid-class"],
     ["AC set to 16 °C, doors open", "Lights left on by the previous class"],
     "Nothing to learn: ECOGUARD never switches off an occupied room"),
]

FIGMA = [
    "Make one page per screen in the sitemap, each a 1440 × 900 desktop frame, plus one 390 × 844 phone frame for Overview.",
    "Create colour styles from the table above (brand, energy, water, hidden, danger, ink) and text styles: H1 20/28 semibold, H2 16 semibold, body 14, small 12, label 12 uppercase.",
    "Build components with auto-layout: Sidebar item (variants: default / active / with badge), KPI card, Alert card (variants: energy / water / hidden × open / actioned / dismissed), Room tile (in use / empty / wasting / wiring risk), Button (primary / ghost / danger), Pill.",
    "Use a 4 px spacing grid: 16 px card padding, 12 px gaps between cards, 24 px page padding.",
    "Assemble screens from components only (no loose rectangles), so a jury member can click any element and see it is an instance.",
    "Prototype links: sidebar items → screens; room tile → Room detail; alert 'Switch room off' → overlay toast 'Switch-off sent'; 'Not waste' → card variant Dismissed. Use Smart Animate, 200 ms ease-out.",
    "Design the three states on Overview and Alerts: Loading (skeleton), Empty ('Nothing is being wasted right now'), Error ('Could not reach the ECOGUARD server' + Retry).",
    "Hand-off: turn on Dev Mode; tokens map 1:1 to tailwind.config.js names in the code.",
]


def section_wireframes():
    out = []
    for i, name in enumerate(SCREENS):
        out.append(f'<div class="card" style="margin-bottom:4mm"><h3 style="margin-top:0">W{i+1}. {name}</h3>{wire(name, 0.43)}</div>')
    return "\n".join(out)


def build(shots: dict[str, str]):
    css = (HERE / "common.css").read_text()
    persona_html = "".join(
        f'<div class="card"><span class="tag">Persona</span><h3>{n}</h3><p class="muted small">{d}</p>'
        f'<b class="small">Goals</b><ul class="small">{"".join(f"<li>{g}</li>" for g in goals)}</ul>'
        f'<b class="small">Pain points</b><ul class="small">{"".join(f"<li>{p}</li>" for p in pains)}</ul>'
        f'<b class="small">Served by:</b> <span class="small">{served}</span></div>'
        for n, d, goals, pains, served in PERSONAS)
    colors = "".join(f'<div class="swatch"><i style="background:{hx}"></i><div><b>{nm}</b> <span class="muted small">{hx}</span><br><span class="small">{use}</span></div></div>' for nm, hx, use in STYLE_COLORS)
    items = list(shots.items())
    def shot(t, p, style=""):
        return f'<div style="break-inside:avoid;{style}"><h3 style="font-size:10pt">{t}</h3><img class="shot" src="{p}"></div>'
    shots_html = (shot(*items[0]) if items else "") + '<div class="grid2">' + "".join(
        shot(t, p, "max-width:45mm" if "Phone" in t else "") for t, p in items[1:]) + "</div>"
    cover_rows = "".join(f"<tr><td>{a}</td><td>{b}</td></tr>" for a, b in COVER)
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>ECOGUARD AI: Round 2 UI/UX Design Pack</title><style>{css}</style></head><body>
<div class="page cover">
  <div class="brand">ANANTA HACKATHON 2026 · SANGAM · ROUND 2</div>
  <h1>ECOGUARD AI<br>UI/UX Design Pack</h1>
  <p style="font-size:13pt">Energy and water waste detector for an academic block: classrooms, a computer lab and offices.</p>
  <div class="kv" style="margin-top:10mm">
    <b>Team</b><span>Team 11, Viltrumites</span>
    <b>Problem statement</b><span>PS 11: Intelligent Energy and Water Waste Detector for Buildings</span>
    <b>Contents</b><span>Design goals and rationale · Personas · Sitemap · User flows · DFD Level 0 and 1 · Wireframes (10 screens) · High-fidelity screens · Style guide · States and accessibility · Tool workflow</span>
    <b>Live prototype</b><span>React dashboard connected to the simulated building (see README in the ecoguard folder of our repository)</span>
  </div>
</div>

<div class="page">
<h2>1. Design goals and rationale</h2>
<p>Our Round 1 plan covered every kind of building and every kind of waste. The jury's main feedback was that it was too broad. For Round 2 we fixed one setting that everyone can picture, <b>one academic block with five classrooms, a computer lab and two offices</b>, and designed for every connected energy and water waste inside it.</p>
<table><tr><th style="width:32%">Decision</th><th>Why</th></tr>
<tr><td>Building map is the first thing on the home screen</td><td>A facility manager thinks in rooms and floors, not in meter IDs. Colour shows what is happening in each room (in use, empty, wasting, wiring risk), so the problem is found in one look.</td></tr>
<tr><td>Every alert says what, where, since when, what it costs in rupees, and what to do</td><td>Studies of feedback systems show that people act on money and clear next steps, not on kWh charts. The rupee figure is computed in code, never guessed by a language model.</td></tr>
<tr><td>Advice in English and Hindi, one tap to switch</td><td>Facility and maintenance staff on Indian campuses are often more comfortable in Hindi.</td></tr>
<tr><td>Two buttons on every alert: "Correct" and "Not waste"</td><td>Each answer becomes a label that retrains the model for this building. "Not waste" also stops any automatic action, so people stay in control.</td></tr>
<tr><td>Automatic mode with a 15-minute grace period</td><td>Fast enough to stop most waste, slow enough for a manager to stop a wrong action. It never switches off a room with people in it.</td></tr>
<tr><td>A separate "Heat &amp; Damp Walls" screen</td><td>This is our novel module. Waste that no normal meter shows (hot wiring joints, current leaking into damp walls) needs its own explanation, with a picture of how it is measured.</td></tr>
<tr><td>Energy and water on the same screens, with the pump in the middle</td><td>The pump is where energy and water meet. An overflowing tank wastes both, so we show them together instead of in two separate apps.</td></tr>
<tr><td>Savings page with a full-year before vs after</td><td>Answers the estate officer's real question: did it work, and how much did it save?</td></tr>
</table>
</div>

<div class="page">
<h3>Round 1 plan → Round 2 screens (consistency check)</h3>
<table><tr><th style="width:42%">Module in our Round 1 PPT</th><th>Where it lives now</th></tr>{cover_rows}</table>
</div>

<div class="page">
<h2>2. Personas</h2>
<p class="muted small">Proto-personas built from our literature review of campus energy and water studies and the roles that run our own university blocks.</p>
<div class="grid2">{persona_html}</div>
</div>

<div class="page">
<h2>3. Sitemap</h2>
{SITEMAP}
<p class="small muted">Twelve top-level screens in a fixed sidebar (a drawer on phones). Room detail opens from the Rooms table or from any tile on the building map. Every screen is at most two clicks from Overview.</p>
<h2>4. User flows</h2>
<h3>Flow A: respond to waste (facility manager), 2 taps</h3>{FLOW1}
<h3>Flow B: catch a hot wiring joint before it fails (electrician)</h3>{FLOW2}
<h3>Flow C: find a leak hidden inside a wall (plumber)</h3>{FLOW3}
<h3>Flow D: report savings (estate officer)</h3>{FLOW4}
</div>

<div class="page">
<h2>5. Data flow diagram: Level 0 (context)</h2>
{DFD0}
<p class="small muted">The whole system as one process. Three kinds of sensors feed it; it talks to people (the facility manager and maintenance staff) and to actuators (relays, pump, valves).</p>
<h2>6. Data flow diagram: Level 1</h2>
{DFD1}
<p class="small muted">D1 to D4 are tables in our database (energy_readings, water_readings, occupancy_records → D1; alerts → D2; control_actions → D3; savings_daily → D4). D5 is the trained model file.</p>
</div>

<div class="page">
<h2>7. Wireframes (low fidelity)</h2>
<p class="small muted">Desktop frame 1440 × 900. The grey sidebar and header are shared by every screen. Dashed boxes are charts.</p>
{section_wireframes()}
</div>

<div class="page">
<h2>8. High-fidelity screens (working prototype)</h2>
<p class="small muted">Screens captured from the running prototype, fed by the simulated building.</p>
{shots_html}
</div>

<div class="page">
<h2>9. Style guide</h2>
<div class="grid2">
<div><h3>Colour</h3>{colors}<p class="small muted">Each resource has one colour everywhere: energy amber, water blue, hidden waste violet. Text contrast is at least 4.5:1 on white.</p></div>
<div>
<h3>Typography</h3>
<p style="font-size:20pt;font-weight:600;margin:0">Inter 20 semibold: page title</p>
<p style="font-size:14pt;font-weight:600;margin:0">Inter 16 semibold: card title</p>
<p style="font-size:11pt;margin:0">Inter 14 regular: body and advice text</p>
<p style="font-size:9pt;margin:0;text-transform:uppercase;letter-spacing:1px;color:#64748b">Inter 12 medium: labels</p>
<h3>Spacing and shape</h3>
<ul class="small"><li>4 px grid; card padding 16-20 px; gap 12 px; page padding 24 px</li><li>Card radius 14 px, button radius 8 px, pills fully round</li><li>One shadow level (cards only)</li></ul>
<h3>Icons</h3>
<p class="small">Lucide line icons at 16-18 px: Zap (energy), Droplets (water), Flame (wall heat), Bell (alerts), PowerOff (switch off), Wrench (ticket), Leaf (carbon).</p>
<h3>Components</h3>
<ul class="small"><li><b>KPI card</b>: label, big number + unit, one-line context</li><li><b>Alert card</b>: kind icon, title, kind pill, status pill, place and time, advice, cost line, actions</li><li><b>Room tile</b>: 4 states (in use, empty, wasting, wiring risk)</li><li><b>Buttons</b>: primary, ghost, danger; disabled when the action makes no sense (e.g. switching off an occupied room)</li><li><b>Toggle</b> (role=switch), <b>tabs</b>, <b>select</b>, <b>meter bar</b></li></ul>
</div></div>
<h2>10. States and accessibility</h2>
<table><tr><th>State</th><th>What the user sees</th></tr>
<tr><td>Loading</td><td>Spinner with "Loading the building…" (announced to screen readers)</td></tr>
<tr><td>Empty</td><td>"Nothing is being wasted right now", "No readings yet: start the gateway", "Before-vs-after not run yet"</td></tr>
<tr><td>Error</td><td>Red banner "Could not reach the ECOGUARD server" with a Retry button; header pill "Backend offline"; live view falls back to polling every 5 s</td></tr>
<tr><td>Power cut</td><td>Header pill turns red "Power cut"; energy rules pause (meters read zero), water rules continue</td></tr>
</table>
<ul class="small"><li>Colour is never the only signal: every room tile and alert also has a text label.</li><li>All charts have text KPIs next to them; meters use role="meter" with values.</li><li>Keyboard: every control is a real button or link with a visible focus ring.</li><li>Readable sizes: body 14 px, minimum 11 px for chart ticks; layout works down to 390 px phones.</li></ul>
<h2>11. Tool workflow</h2>
<p class="small">We built the clickable prototype directly in code (React + Tailwind + Recharts), connected to live simulated data, so every screen shows realistic numbers and every button really works. The design tokens live in <code>tailwind.config.js</code> and are the same names as in this guide. To present the design file, the screens are rebuilt in Figma as follows:</p>
<ol class="small">{"".join(f"<li>{s}</li>" for s in FIGMA)}</ol>
</div>
</body></html>"""
    (OUT / "ECOGUARD-Round2-Design-Pack.html").write_text(html)
    return OUT / "ECOGUARD-Round2-Design-Pack.html"
