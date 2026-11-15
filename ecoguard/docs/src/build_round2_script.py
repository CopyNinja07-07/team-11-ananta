"""Round 2 live review: what to open, what to click, what to say.

    python docs/src/build_round2_script.py && node docs/src/build_pdf.cjs docs/ECOGUARD-Round2-Live-Script.html
"""
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1]
FIGMA = "https://www.figma.com/design/kabn1QXWM5ErOoPpBOfjqr"

STEPS = [
    ("Before the call (once)", [
        "In Figma press <b>Share</b> → <b>Anyone with the link</b> → <b>can view</b>, then <b>Copy link</b>. Paste that link in the submission form.",
        "Attach <b>ECOGUARD-Round2-Design-Document.pdf</b> to the form as the documentation pack.",
        "Open two tabs: the Figma file, and the prototype (Figma → page <b>02 Product screens + prototype</b> → ▶ Present).",
        "Close every other app. Zoom the browser to 100%.",
    ]),
    ("1 · The problem in one line (30 s)", [
        "Say: <i>“ECOGUARD finds the power and water a building wastes, room by room, and tells the caretaker how to fix it. Round 1 was too broad, so we narrowed it to one academic block in Jammu.”</i>",
        "Show PDF page 3 (ECOGUARD in plain words), page 4 (the narrowing funnel) and page 5 (personas: estate officer, caretaker, lab in-charge, principal).",
    ]),
    ("2 · The documents (1 min)", [
        "PDF page 6 sitemap: <i>“Five groups, named by the question the user asks.”</i>",
        "Pages 7–8 user flows, pages 9–10 DFD level 0 and level 1. Point at the sensors on the left of level 0 and the data stores D1–D5 in level 1 (D5 is the trained models).",
        "Page 11: one system, five parts. <i>“Sensors, simulation, backend, dashboard and this design all use one building file.”</i>",
    ]),
    ("3 · The prototype (3 min): estate officer, desktop", [
        "Flow <b>Estate officer · desktop</b>. Start on Live building: the 3D block moves. Click <b>Grid on</b> (it explains itself), then <b>हिं</b> (the screen turns Hindi) and <b>EN</b> to come back. Scroll: the sidebar and top bar stay fixed.",
        "Click <b>Alerts</b>. Read one card aloud: what it means, why ECOGUARD thinks so, what to do. Click <b>Switch room off</b>: it turns into a green Done line. Click <b>Yes</b>. Say: <i>“Every Yes or No becomes a label, so the model learns this building.”</i>",
        "Click <b>Rooms</b> → a room: actual vs expected power, and the How to read line under the chart. Then <b>Cooling & AC</b> (Reset AC to 24 °C), <b>Water tank & pump</b>, <b>Inside the walls</b> (the gap no meter shows).",
        "Click <b>Savings & carbon</b>: −19.2% electricity and −22.6% water over a simulated year. Then <b>How it decides</b>: each trained model with its score, and <b>Tested on 659 buildings</b>: real open data.",
        "Click <b>Plans & pricing</b> and tap a slider: the saving changes. Then <b>Add a building</b>: how a campus would set it up.",
    ]),
    ("4 · The prototype (1 min): caretaker, phone", [
        "Switch the flow to <b>Caretaker · phone</b>. Tap ☰: the menu slides in as an overlay. Tap <b>Alerts</b>, scroll to the bottom.",
        "Say: <i>“Same screens, built responsive, for the person walking the corridors.”</i>",
    ]),
    ("5 · Show it live in Figma (if asked)", [
        "<b>A component:</b> page <b>03 Components</b> → select <b>Alert card</b>. In the right panel show its variants (states).",
        "<b>A variant:</b> on page <b>04 Screens built from components</b>, select an alert card and switch its variant in the right panel.",
        "<b>Auto-layout:</b> select a <b>KPI card</b> or <b>Button</b>; the right panel shows auto-layout (direction, gap, padding). Change the text: the card grows.",
        "<b>Variables and styles:</b> click the Variables icon on the left bar: 64 colours, spacing and radius. Text styles are in the right panel.",
        "<b>Prototype wiring:</b> on page 02 open the <b>Prototype</b> tab and select a sidebar item: the blue noodle shows Navigate · Smart animate · 250 ms.",
    ]),
]

QA = [
    ("Why Figma?", "Components, variants, auto-layout, variables and a clickable prototype in one file, shared by one link, free for students."),
    ("How did you build the prototype?", "Frames for every screen, hotspots on every link (Navigate, Smart animate), an after-click copy of the screen for every button, tab and slider (Dissolve, keeps the scroll), an overlay for the phone menu, an animated GIF for the 3D view, and fixed layers for the sidebar and top bar so long pages scroll."),
    ("Is the data real?", "Every number comes from our simulated Academic Block A (a year of 15-minute readings with 558 injected faults), and the 659 real buildings page uses the open BDG2 data set. Each screen is labelled simulated or real."),
    ("How do design and code stay the same?", "The Figma variables are the Tailwind tokens of the React app, and the hi-fi screens are the real app screens. Handoff is the variables plus the repo."),
    ("Can it work with real hardware?", "Yes. An ESP32 sends the same JSON reading to /api/ingest (or MQTT). The simulator uses exactly that path, so real boards replace it with no other change."),
    ("What about empty, error and loading states?", "PDF page 17 and every screen: no readings yet, nothing wasted, server offline, power cut, loading. Contrast and 44 px touch targets are on the same page."),
    ("Which AI models are inside?", "A room model (Huber regression) for expected power, nine checks on top, YOLO for people counts, LightGBM baselines and an LSTM day-ahead forecaster trained on real BDG2 buildings. Numbers are always computed in code; advice is fixed English and Hindi sentences."),
]

CSS = """
@page { size: A4; margin: 14mm 15mm; }
body { font-family: 'IBM Plex Sans', sans-serif; color: #10231C; font-size: 10.5pt; line-height: 1.5; }
.eyebrow { font: 500 9pt 'JetBrains Mono', monospace; letter-spacing: 1.5px; text-transform: uppercase; color: #2F7549; }
h1 { font: 700 24pt 'Space Grotesk', sans-serif; margin: 2mm 0 2mm; }
h2 { font: 700 13pt 'Space Grotesk', sans-serif; margin: 6mm 0 2mm; padding-bottom: 1mm; border-bottom: 2px solid #B5D8BF; }
ol, ul { margin: 0; padding-left: 5mm; } li { margin: 1.2mm 0; }
i { color: #245C3A; }
.box { background: #EEF5EE; border: 1px solid #B5D8BF; border-radius: 3mm; padding: 4mm 5mm; margin-top: 4mm; }
dt { font-weight: 600; margin-top: 2.5mm; } dd { margin: 0.5mm 0 0 0; color: #34463E; }
.qa { break-before: page; }
"""


def main():
    secs = "".join(f"<h2>{t}</h2><ol>{''.join(f'<li>{x}</li>' for x in items)}</ol>" for t, items in STEPS)
    qa = "".join(f"<dt>{q}</dt><dd>{a}</dd>" for q, a in QA)
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>ECOGUARD · Round 2 live script</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<div class="eyebrow">Team 11 · Round 2 UI/UX · 18 Nov</div>
<h1>Live review script</h1>
<p>About 6 minutes. The jury scores four things, 5 marks each: visual design and tool craft, usability and user flow, completeness of the documents, and the clickable prototype with how we built it. Each step below covers one of them.</p>
<div class="box">Figma file: <b>{FIGMA}</b><br>Prototype: in Figma open page 02 and press ▶ Present, or use the links on the <b>00 Start here</b> board.</div>
{secs}
<div class="qa"><div class="eyebrow">Questions the jury may ask</div><h1>Short answers</h1><dl>{qa}</dl>
<h2>Submission checklist (from the rubric)</h2>
<ul><li>Every screen and module: 18 screens, desktop and phone, each explained in the PDF</li><li>Consistent colours, fonts, spacing, icons: variables and text styles</li><li>Style guide: PDF pages 15–16, Figma page 01</li><li>Components, variants, auto-layout: Figma page 03 and 04</li><li>Empty, error and loading states, accessibility: PDF page 17</li><li>Prototype clickable end to end: two flows, overlay, every button and slider, Hindi, moving 3D</li><li>DFD level 0 and 1, user flows, sitemap, wireframes, personas, rationale: PDF pages 3–18</li><li>Every member can explain the file: everyone reads this script once</li><li>Submit by 18 Nov</li></ul></div>
</body></html>"""
    out = DOCS / "ECOGUARD-Round2-Live-Script.html"
    out.write_text(html)
    print("wrote", out)


if __name__ == "__main__":
    main()
