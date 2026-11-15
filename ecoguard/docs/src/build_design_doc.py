"""Round 2 design document: every board as a full landscape page, plus the screens.

    python docs/src/boards.py            # refresh the boards first
    python docs/src/build_design_doc.py  # -> docs/ECOGUARD-Round2-Design-Document.html
    node docs/src/build_pdf.cjs docs/ECOGUARD-Round2-Design-Document.html
"""
import re
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1]
BOARDS = DOCS / "design" / "boards"
FIGMA = "https://www.figma.com/design/kabn1QXWM5ErOoPpBOfjqr"
PROTO = "https://www.figma.com/proto/kabn1QXWM5ErOoPpBOfjqr/ECOGUARD?page-id=1%3A2&scaling=contain"

SECTIONS = [
    ("PLAIN", "ECOGUARD in plain words"),
    ("01-problem", "How we narrowed Round 1 to one block"),
    ("02-personas", "Personas"),
    ("03-sitemap", "Sitemap"),
    ("04-flow-waste", "User flow 1: a wasted room"),
    ("05-flow-walls", "User flow 2: heat and damp in the walls"),
    ("06-dfd0", "Data flow diagram, level 0"),
    ("07-dfd1", "Data flow diagram, level 1"),
    ("SYSTEM", "One system, five parts"),
    ("08-wireframes", "Wireframes: key layouts"),
    ("08b-wireframes-1", "Wireframes: every screen (1 of 2)"),
    ("08c-wireframes-2", "Wireframes: every screen (2 of 2)"),
    ("09-style", "Style guide: colour, type, parts"),
    ("09b-spacing-icons", "Style guide: spacing, radius, icons"),
    ("10-states", "States and accessibility"),
    ("11-rationale", "Design rationale"),
    ("TOOLS", "Tool workflow and why these tools"),
    ("PROTO", "What every click does in the prototype"),
    ("DESKTOP", "Every screen explained"),
    ("PHONE", "The same screens on a phone"),
    ("GLOSSARY", "Words used in this document"),
]

# Every desktop screen with three short lists: what it shows, what you can do, how to read it.
DESKTOP = [
    ("live", "Live building", "The home screen. One look tells the estate officer what the block is doing now.",
     ["Five readings for today: power now, energy and water used, money saved, CO₂ avoided.", "A live 3D model of the block. Each room is coloured by what is happening in it.", "Needs attention: the open alerts, each with its cost so far."],
     ["Click any room in the 3D view to open that room.", "Switch between 3D and a flat floor plan.", "Fix an alert with one tap, or answer Right call? Yes / No."],
     "Green room: in use. Grey: empty. Yellow: wasting power. Amber sparks are electricity moving to each room; blue drops are water moving to the tank and floors."),
    ("alerts", "Alerts", "Every problem ECOGUARD has found, newest first.",
     ["What the alert means, in one sentence.", "Why ECOGUARD thinks so: the readings behind it, such as people seen and extra power drawn.", "What to do, in English or Hindi, and the cost in rupees so far."],
     ["Press the green fix button: switch a room off, reset an AC, stop the pump, send a technician.", "Answer Yes or No. The answer is saved as a training label.", "Filter by Open, History or kind of waste; download the labels as CSV."],
     "Coloured bar on the left: amber for power, blue for water, ember for the walls. A red High priority pill means a safety risk or fast loss."),
    ("rooms", "Rooms", "All rooms side by side, so the odd one out is easy to spot.",
     ["People counted in each room.", "Using: the power it draws now.", "Should use: what the room model expects for those people and today's heat."],
     ["Click a room to open its own page."],
     "A room is marked wasting when it is empty and uses more than 0.2 kW above its normal empty level."),
    ("room", "Room detail", "One room in depth. Reached from the 3D view, the rooms list or an alert.",
     ["People, power now against what it should be, wiring resistance and earth leakage.", "A chart of the last 24 hours, 72 hours or 7 days.", "The open alerts for this room."],
     ["Switch the room off (locked while people are inside).", "Change the chart range."],
     "Orange line: power really drawn. Grey dashed line: what it should draw. Green area: people. Orange above grey while green is at zero is waste."),
    ("hvac", "Cooling & AC", "HVAC means heating, ventilation and air conditioning. Here it is the split ACs.",
     ["Each AC room: temperature, humidity, AC power and people.", "Rooms set too cold, or cooling with a door open."],
     ["Reset an AC to 24 °C with one tap."],
     "One line per AC room. The green band (23 to 27 °C) is comfortable. Each degree below 24 °C costs about 6% more AC power (BEE)."),
    ("water", "Water tank & pump", "Where water meets electricity: lifting water to the roof costs power.",
     ["Roof tank and underground sump levels, and whether the pump is running.", "Water used by each floor, hour by hour.", "The lowest flow at night, which should be zero."],
     ["Stop the pump or close a floor valve from an alert."],
     "Blue line: roof tank. Grey dashed: sump. Light blue bars: pump running. At night every floor's flow should fall to zero; one that does not has a leak or a running cistern."),
    ("wiring", "Inside the walls", "Waste no ordinary meter can see, because it happens inside the wall.",
     ["Wiring resistance of each room, worked out from the voltage drop.", "Earth leakage on each floor.", "Leaks inside the wall: night water flow and rising leakage on the same floor."],
     ["Send an electrician or plumber from the alert."],
     "Resistance rising above its installed value means a joint is loosening and turning power into heat. Leakage above 10 mA points to a damp wall."),
    ("camera", "People count", "ECOGUARD never switches off a room with people in it. This page is how it knows.",
     ["Live headcount of every room, against its seats.", "A YOLO person detector that counts people in a photo or webcam frame."],
     ["Pick a room and upload a photo, or use the webcam, to count it."],
     "Only the number is kept. The picture is deleted at once, in line with India's DPDP Act 2023."),
    ("savings", "Savings & carbon", "What ECOGUARD has saved, in kWh, litres, rupees and CO₂.",
     ["Waste caught and waste avoided, per day.", "A full simulated year run twice: without ECOGUARD and with it."],
     ["Read the totals; nothing to change here."],
     "Carbon = energy saved × 0.716 kg CO₂ per kWh (Central Electricity Authority grid factor). Money uses ₹7 per kWh and ₹50 per 1,000 litres."),
    ("forecast", "Next 24 hours", "How much power the block will use in each of the next 24 hours.",
     ["Actual use for the last 24 hours and the forecast for the next 24.", "The expected bill, the peak hour, and yesterday's forecast error."],
     ["Plan ahead: cool rooms before the peak, run the pump when demand is low."],
     "Dark bars: what really happened. Light bars: the forecast. The forecast adds up each room's model using the usual timetable and Jammu temperatures."),
    ("models", "How it decides", "Every trained model in one place, with honest scores on data it never saw.",
     ["What happens to one reading, in six steps.", "Five models: room model, waste detector, people counter, real-building baselines, day-ahead LSTM forecaster.", "The detector's report card, fault by fault."],
     ["Jump from each model to the screen where it is used."],
     "Caught: share of hidden faults found. Time to catch: half were found within this time. Error: typical hourly miss as a share of average use."),
    ("real", "Tested on 659 buildings", "The same ideas checked on real meters from the open BDG2 data set.",
     ["Avoidable electricity, cooling used while closed, leak nights.", "Model report card on 2017, a year the models never trained on."],
     ["Filter by classrooms, labs or offices and open any building."],
     "Every number on this page is real meter data, marked with the blue Real meters tag."),
    ("realb", "Real building detail", "One real building, a whole year of hourly meters.",
     ["Actual use against what the model expected, week by week.", "A forecast made the night before by the LSTM, next to 'same as yesterday'.", "A sandbox: what ECOGUARD would have saved."],
     ["Move the week, day and sandbox sliders; the year is recalculated live."],
     "Grey bands: building closed. Red bands: waste events, three or more hours far above the model."),
    ("plans", "Plans & pricing", "How a campus would buy ECOGUARD.",
     ["Plans per building block, what the sensor kit holds, and the rollout steps."],
     ["Move the sliders to your campus size and bill to see the saving and payback."],
     "Saving and payback come from the simulated year's results."),
    ("setup", "Add a building", "Describe a new building in four steps.",
     ["Floors, rooms and their equipment, the water tank, the tariff."],
     ["Fill the steps and download one building file."],
     "The server and every sensor box read that one file, so a new block needs no new code."),
    ("simulator", "Test mode", "A safe place to break things and watch ECOGUARD find them.",
     ["Three steps: pick a fault, wait a reading or two, open Alerts.", "What is really broken right now, marked Detected or Not yet."],
     ["Create a fault, cut the power for an hour, change the speed of time."],
     "The detector is never told what was injected. It has to find it from the readings alone."),
    ("settings", "Settings", "How much ECOGUARD may do on its own.",
     ["Automatic, scheduled or suggest-only.", "Advice language, grace time, work orders."],
     ["Change any setting; every action can be undone."],
     "Whatever the setting, an occupied room is never switched off."),
]
PHONE = [("live", "Live building"), ("menu", "Menu"), ("alerts", "Alerts"), ("rooms", "Rooms"), ("room", "Room detail"), ("water", "Water tank & pump")]

GLOSSARY = [
    ("kW and kWh", "kW is power at one moment. kWh is energy over time: 1 kW for 1 hour is 1 kWh, about ₹7 here."),
    ("HVAC", "Heating, ventilation and air conditioning. In this block, the split ACs."),
    ("Sump", "The underground tank that the municipal supply fills. The pump lifts water from it to the roof tank."),
    ("Earth leakage", "Current that escapes to earth instead of returning through the wire. Damp walls and worn insulation raise it."),
    ("Wiring resistance", "How hard the wire resists current. A loose joint raises it and turns power into heat inside the wall."),
    ("CO₂ factor", "0.716 kg of CO₂ per kWh, the Central Electricity Authority's average for India's grid."),
    ("BEE 24 °C", "The Bureau of Energy Efficiency's recommended default AC temperature."),
    ("YOLO", "A computer-vision model that finds people in an image. ECOGUARD keeps only the count."),
    ("LSTM", "A neural network that reads a sequence (here, 7 days of hourly use) and predicts what comes next."),
    ("LightGBM", "A fast tree-based model. Used to learn the normal use of real buildings."),
    ("CV(RMSE)", "Typical hourly error as a share of average use. ASHRAE Guideline 14 accepts below 30%."),
    ("BDG2", "Building Data Genome 2: open, real hourly meter data from 1,636 buildings."),
    ("Simulated vs real", "Academic Block A is simulated in code. The 659 buildings are real meters. Every screen is tagged with which one it shows."),
]


def board(name):
    svg = (BOARDS / f"{name}.svg").read_text()
    svg = re.sub(r"<\?xml[^>]*>", "", svg)
    return f'<section class="page board">{svg}</section>'


def head(eyebrow, title, sub=""):
    s = f'<div class="eyebrow">{eyebrow}</div><h1>{title}</h1>'
    return s + (f'<p class="sub">{sub}</p>' if sub else "")


def contents():
    rows = []
    page = 3
    for key, title in SECTIONS:
        rows.append(f'<li><span>{title}</span><b>{page}</b></li>')
        page += {"DESKTOP": (len(DESKTOP) + 1) // 2}.get(key, 1)
    return f'''<section class="page plain">
{head("Contents", "What is in this document", "Round 2 asks for the design story and the design itself. The story is here. The design itself is the Figma file.")}
<div class="two">
  <ol class="toc">{"".join(rows)}</ol>
  <div class="card dark">
    <div class="eyebrow light">Open the design</div>
    <p class="big"><a href="{PROTO}">▶ Play the clickable prototype</a></p>
    <p>Two flows start on the screens page: <b>Estate officer · desktop</b> and <b>Caretaker · phone</b>. Every menu item, link, alert button, tab, slider and top-bar chip responds. Long pages scroll with the sidebar and top bar fixed.</p>
    <p class="big"><a href="{FIGMA}">Open the Figma file</a></p>
    <ul>
      <li><b>01 Start here</b>: cover, style guide, states, wireframes</li>
      <li><b>02 Product screens + prototype</b>: 18 desktop and 18 phone screens, plus an after-click copy for every control</li>
      <li><b>03 Components</b>: colour, spacing and radius variables, nine components with variants and auto-layout</li>
      <li><b>04 Screens built from components</b>: six screens drawn only from those parts</li>
    </ul>
  </div>
</div>
</section>'''


def system():
    parts = [
        ("1", "Sensors (IoT)", "ESP32 node per room: voltage at board and room, current, earth leakage, temperature, humidity, people count. One water node at the pump.", "sensors/ · gateway.mjs plays the ESP32s today; a real board sends the same JSON."),
        ("2", "Simulation", "A full Academic Block A in code: timetable, Jammu weather, power cuts, the pump and tank, and 12 kinds of waste injected at random.", "sensors/sim/ · 35,040 readings a year, 558 faults"),
        ("3", "Backend", "FastAPI. Cleans each reading, runs 9 checks (they cover all 12 kinds of waste) on top of the trained room models, counts people with YOLO, prices waste in ₹ and kg CO₂, sends back commands.", "backend/app/ · /api/ingest, /api/live, /api/alerts"),
        ("4", "Dashboard", "React app on desktop and phone. The same screens you see in Figma, fed live every 15 minutes over a WebSocket, in English or Hindi.", "frontend/ · 18 screens"),
        ("5", "Design", "This Figma file. Its colours, spacing and type are the dashboard's Tailwind tokens, so design and code cannot drift apart.", "Figma pages 01–04"),
    ]
    cards = "".join(f'<div class="part"><div class="num">{n}</div><h3>{t}</h3><p>{d}</p><code>{c}</code></div>' + ('<div class="arrow">→</div>' if n != "5" else "") for n, t, d, c in parts)
    return f'''<section class="page plain">
{head("How it fits together", "One system, five parts", "Every part reads the same building file (config/campus.json), so a new block means editing one file, not code.")}
<div class="parts">{cards}</div>
<div class="card note"><b>Plugging in real hardware.</b> An ESP32 posts one JSON reading every 15 minutes to <code>/api/ingest</code> (or publishes it on MQTT topic <code>ecoguard/block-a/readings</code>). The reply carries any command: switch a room off, stop the pump, close a valve. The simulated gateway uses exactly this path, so swapping it for real boards changes nothing else.</div>
</section>'''


def tools():
    steps = [
        ("Frames", "One frame per screen: Desktop 1440 × 900 and Phone 390 × 844. Long screens scroll inside the frame; the sidebar and top bar are fixed children, so they stay put like in the app."),
        ("Components", "Variables for 64 colours plus spacing and radius, nine text styles, and nine components (Button, Pill, Data source, Nav item, KPI card, Room tile, Alert card, Sidebar, Top bar). Each has variants for its states and is built in auto-layout, so it grows with its text."),
        ("Prototyping", "Two flows: Estate officer on desktop, Caretaker on phone. Links use Navigate with Smart animate (200 ms, ease out). Every button, tab and slider dissolves into its after-click copy and keeps the scroll position. The phone menu is an overlay that slides in; the 3D view is an animated GIF."),
        ("Handoff", "The Figma variables are the same tokens as the app's Tailwind config, and every hi-fi screen is the real React screen with simulated data. A developer reads spacing, colour and type straight from the variables; nothing is re-drawn by hand."),
    ]
    why = [
        ("Figma", "Components, variants, auto-layout, variables and a clickable prototype in one file, shared with the jury by one link, free on the education plan."),
        ("React + Tailwind", "Utility classes map one to one onto the Figma variables, so design and code use the same names."),
        ("Python + SVG", "DFDs, flows and sitemap are drawn from one script, so they stay consistent with each other and stay editable in Figma."),
        ("Simulated block", "Every number on every screen comes from the simulated Academic Block A, so the prototype shows realistic data, not lorem ipsum."),
    ]
    a = "".join(f'<div class="part"><div class="num">{i + 1}</div><h3>{t}</h3><p>{d}</p></div>' + ('<div class="arrow">→</div>' if i < 3 else "") for i, (t, d) in enumerate(steps))
    b = "".join(f'<li><b>{t}.</b> {d}</li>' for t, d in why)
    return f'''<section class="page plain">
{head("Tool workflow", "How we built it, and why these tools", "Frames, then components, then the prototype, then handoff to code. The same order we would show live in the file.")}
<div class="parts">{a}</div>
<div class="card note"><ul class="why">{b}</ul></div>
</section>'''


def explained(items):
    out = []
    for i in range(0, len(items), 2):
        cards = []
        for k, t, lead, shows, do, read in items[i:i + 2]:
            li = lambda xs: "".join(f"<li>{x}</li>" for x in xs)
            cards.append(f'''<div class="ex"><img src="img/screens/d_{k}.jpg" alt="{t}">
<div class="extext"><h2>{t}</h2><p class="lead">{lead}</p>
<h4>What it shows</h4><ul>{li(shows)}</ul><h4>What you can do</h4><ul>{li(do)}</ul>
<h4>How to read it</h4><p>{read}</p></div></div>''')
        part = f" ({i // 2 + 1} of {(len(items) + 1) // 2})"
        out.append(f'<section class="page plain">{head("Hi-fi · the real app, simulated data", "Every screen explained" + part)}<div class="exs">{"".join(cards)}</div></section>')
    return "".join(out)


def phones():
    figs = "".join(f'<figure><img src="img/screens/m_{k}.jpg" alt="{t}"><figcaption>{t}</figcaption></figure>' for k, t in PHONE)
    return f'<section class="page plain">{head("Responsive", "The same screens on a phone", "The caretaker walks the corridors with a phone. The sidebar becomes a menu that slides in; tables become cards; every button stays at least 44 px tall.")}<div class="gal p">{figs}</div></section>'


def plain():
    pts = [
        ("What it is", ["ECOGUARD is software plus small sensor boxes that find the electricity and water a building wastes.", "It names the room, the cause, the cost in rupees and the fix.", "It was built for Academic Block A in Jammu: three floors, eight rooms, washrooms, a sump, a pump and a roof tank."]),
        ("What it watches", ["Power in every room, compared with what the room should use for the people inside.", "The pump, the tanks and the water flow on each floor.", "Two kinds of waste that no meter shows: heat from loose wiring inside the walls, and damp walls leaking current."]),
        ("What it does", ["Raises an alert with a plain explanation and one-tap fix.", "Can act on its own: switch an empty room off, reset an AC, stop the pump, close a valve.", "Never switches off a room with people in it."]),
        ("How we know it works", ["A full simulated year with 558 hidden faults: 95% caught, 99% of alerts correct.", "The same year run with and without ECOGUARD: 19.2% less electricity and 22.6% less water.", "The models were also tested on 659 real buildings from open data."]),
    ]
    cards = "".join(f'<div class="pl"><h3>{t}</h3><ul>{"".join(f"<li>{x}</li>" for x in xs)}</ul></div>' for t, xs in pts)
    return f'<section class="page plain">{head("Start here", "ECOGUARD in plain words", "If you read one page, read this one.")}<div class="pls">{cards}</div></section>'


def proto():
    rows = [
        ("Sidebar, links, rooms", "Every menu item and link opens its screen (Navigate, Smart animate 200 ms). The sidebar and top bar stay fixed while the page scrolls."),
        ("3D building", "Moves (animated GIF of the live 3D view). Click it to open a room."),
        ("Alert buttons", "Switch room off, Reset AC to 24 °C, Stop pump: the button turns into a green Done line. Yes / No: the card thanks you and saves the label."),
        ("Tabs and ranges", "3D / Floor plan, Open / History / All, 24 h / 72 h / 7 d, Classrooms / Labs / Offices: each shows its own view."),
        ("Sliders", "On Plans and real buildings, tap the left or right half of a slider to move it low or high; the numbers update."),
        ("Top bar", "Time, temperature and Grid on open a short explanation. The mic opens the voice panel. EN / हिं switches the live screen to Hindi and back."),
        ("About this page", "Every screen opens with short notes; click the heading to fold them away."),
        ("Phone", "The ☰ menu slides in as an overlay and closes with a tap outside. Alerts buttons work as on desktop."),
    ]
    trs = "".join(f"<tr><th>{a}</th><td>{b}</td></tr>" for a, b in rows)
    return f'<section class="page plain">{head("Prototype map", "What every click does", "Figma page 02 holds each screen, plus a copy of it for every button, slider and tab in its after-click state. Press ▶ Present on Live building.")}<table class="pm">{trs}</table></section>'


def glossary():
    rows = "".join(f"<div class=\"gl\"><b>{a}</b><span>{b}</span></div>" for a, b in GLOSSARY)
    return f'<section class="page plain">{head("Glossary", "Words used in this document")}<div class="gls">{rows}</div></section>'


CSS = """
@page { size: 1600px 1000px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #F4F2EC; }
body { font-family: 'IBM Plex Sans', sans-serif; color: #10231C; counter-reset: pg; }
.page { width: 1600px; height: 1000px; position: relative; overflow: hidden; break-after: page; counter-increment: pg; }
.page::after { content: counter(pg); position: absolute; right: 64px; bottom: 30px; font: 500 13px 'JetBrains Mono', monospace; color: #8A958E; }
.board svg { width: 1600px; height: 1000px; display: block; }
.plain { padding: 72px 64px 80px; } .plain .two { height: 760px; } .plain .card.dark { align-self: start; }
.eyebrow { font: 500 14px 'JetBrains Mono', monospace; letter-spacing: 2px; text-transform: uppercase; color: #2F7549; }
.eyebrow.light { color: #8EC29F; }
h1 { font: 700 44px 'Space Grotesk', sans-serif; margin: 10px 0 8px; letter-spacing: -0.5px; }
.sub { font-size: 19px; color: #34463E; max-width: 1150px; margin: 0 0 36px; line-height: 1.45; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.toc { list-style: none; padding: 0; margin: 0; columns: 1; }
.toc li { display: flex; justify-content: space-between; border-bottom: 1px solid #DEE2DA; padding: 9px 0; font-size: 17px; }
.toc b { font: 500 15px 'JetBrains Mono', monospace; color: #66756D; }
.card { background: #fff; border: 1px solid #DEE2DA; border-radius: 16px; padding: 32px; }
.card.dark { background: #0F2A20; color: #C9CFC7; border: 0; font-size: 17px; line-height: 1.5; }
.card.dark b { color: #fff; }
.card.dark a { color: #EDBF48; font: 600 26px 'Space Grotesk', sans-serif; }
.card.dark ul { padding-left: 20px; }
.card.dark li { margin: 6px 0; }
.big { margin: 20px 0 8px; }
.parts { display: flex; align-items: stretch; gap: 0; margin-top: 8px; }
.part { flex: 1; background: #fff; border: 1px solid #DEE2DA; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; }
.part .num { width: 36px; height: 36px; border-radius: 50%; background: #0F2A20; color: #fff; display: grid; place-items: center; font: 700 17px 'Space Grotesk'; }
.part h3 { font: 700 23px 'Space Grotesk', sans-serif; margin: 14px 0 8px; }
.part p { font-size: 15.5px; line-height: 1.5; color: #34463E; margin: 0 0 14px; flex: 1; }
.part code, .note code { font: 500 12.5px 'JetBrains Mono', monospace; color: #245C3A; }
.arrow { align-self: center; font: 700 30px 'Space Grotesk'; color: #8A958E; padding: 0 10px; }
.note { margin-top: 36px; font-size: 17px; line-height: 1.55; background: #EEF5EE; border-color: #B5D8BF; }
.gal { display: grid; gap: 22px 36px; }
.gal.d { grid-template-columns: 1fr 1fr; }
.gal.p { grid-template-columns: repeat(6, 1fr); }
.exs { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
.ex { display: flex; flex-direction: column; gap: 14px; }
.ex img { width: 100%; height: 330px; object-fit: cover; object-position: top; border-radius: 10px; border: 1px solid #DEE2DA; }
.extext h2 { font: 700 26px 'Space Grotesk', sans-serif; margin: 0; }
.extext .lead { font-size: 16px; color: #34463E; margin: 4px 0 6px; }
.extext h4 { font: 500 11.5px 'JetBrains Mono', monospace; letter-spacing: 1.5px; text-transform: uppercase; color: #2F7549; margin: 10px 0 3px; }
.extext ul { margin: 0; padding-left: 18px; font-size: 14.5px; line-height: 1.45; color: #10231C; }
.extext li { margin: 2px 0; }
.extext p { font-size: 14.5px; line-height: 1.45; margin: 0; color: #10231C; }
.pls { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.pl { background: #fff; border: 1px solid #DEE2DA; border-top: 6px solid #3E8E5A; border-radius: 16px; padding: 26px 30px; }
.pl h3 { font: 700 26px 'Space Grotesk', sans-serif; margin: 0 0 10px; }
.pl ul { margin: 0; padding-left: 20px; font-size: 18px; line-height: 1.5; } .pl li { margin: 6px 0; }
.pm { width: 100%; border-collapse: collapse; font-size: 18px; background: #fff; border-radius: 16px; overflow: hidden; }
.pm th { text-align: left; width: 300px; font: 600 20px 'Space Grotesk', sans-serif; padding: 18px 24px; border-bottom: 1px solid #DEE2DA; vertical-align: top; }
.pm td { padding: 18px 24px; border-bottom: 1px solid #DEE2DA; line-height: 1.45; color: #34463E; }
.gls { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 40px; }
.gl { display: flex; flex-direction: column; border-bottom: 1px solid #DEE2DA; padding: 10px 0; }
.gl b { font: 600 19px 'Space Grotesk', sans-serif; } .gl span { font-size: 16px; color: #34463E; line-height: 1.45; margin-top: 2px; }
.why { margin: 0; padding-left: 20px; } .why li { margin: 6px 0; }
figure { margin: 0; }
.gal.d img { width: 100%; height: 340px; object-fit: cover; object-position: top; border-radius: 10px; border: 1px solid #DEE2DA; display: block; }
.gal.p img { width: 100%; height: 520px; object-fit: cover; object-position: top; border-radius: 18px; border: 6px solid #10231C; display: block; }
figcaption { font: 600 16px 'Space Grotesk', sans-serif; margin-top: 8px; }
"""


def main():
    pages = [board("00-cover"), contents()]
    for key, _ in SECTIONS:
        if key == "SYSTEM":
            pages.append(system())
        elif key == "TOOLS":
            pages.append(tools())
        elif key == "DESKTOP":
            pages.append(explained(DESKTOP))
        elif key == "PHONE":
            pages.append(phones())
        elif key == "PLAIN":
            pages.append(plain())
        elif key == "PROTO":
            pages.append(proto())
        elif key == "GLOSSARY":
            pages.append(glossary())
        else:
            pages.append(board(key))
    html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ECOGUARD · Round 2 design document</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>{''.join(pages)}</body></html>"""
    out = DOCS / "ECOGUARD-Round2-Design-Document.html"
    out.write_text(html)
    print("wrote", out)


if __name__ == "__main__":
    main()
