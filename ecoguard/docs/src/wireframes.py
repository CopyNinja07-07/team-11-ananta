"""Low-fidelity wireframes for every screen, drawn as plain SVG boxes.
Coordinates are on a 1440 x 900 desktop frame (sidebar 240 px, header 50 px)."""

FRAME_W, FRAME_H = 1440, 900

COMMON = [
    (0, 0, 240, 900, "Sidebar: logo + 9 nav items", "nav"),
    (240, 0, 1200, 50, "Header: block name · sim clock · temp · grid status · language", "nav"),
]

SCREENS = {
    "Overview": [
        (264, 70, 700, 50, "Title + one-line purpose", "text"),
        *[(264 + i * 233, 135, 220, 100, k, "kpi") for i, k in enumerate(["Power now", "Energy today", "Water today", "Saved today", "CO2 avoided"])],
        (264, 255, 660, 420, "Building map: 3 floors x rooms, colour = in use / empty / wasting / wiring risk", "main"),
        (264, 690, 660, 70, "Tank % · Sump % · Pump state", "kpi"),
        (944, 255, 472, 30, "Open alerts + See all", "text"),
        (944, 295, 472, 220, "Alert card: what, where, since, advice, Rs, actions", "card"),
        (944, 525, 472, 220, "Alert card", "card"),
    ],
    "Rooms": [
        (264, 70, 700, 50, "Title + purpose", "text"),
        (264, 135, 1152, 520, "Table: room · floor · people · using · should use · difference · status (row click -> room)", "main"),
    ],
    "Room detail": [
        (264, 65, 120, 20, "< All rooms", "text"),
        (264, 95, 600, 45, "Room name, floor, seats", "text"),
        (1250, 95, 166, 40, "Switch off now", "button"),
        *[(264 + i * 290, 160, 278, 95, k, "kpi") for i, k in enumerate(["People", "Using vs should", "Wiring resistance", "Earth leakage"])],
        (264, 275, 1152, 330, "Chart: actual vs expected kW + people (24h / 72h / 7d)", "chart"),
        (264, 625, 1152, 180, "Alerts for this room", "card"),
    ],
    "Alerts": [
        (264, 70, 800, 50, "Title + 'your answers train the model'", "text"),
        (1230, 75, 186, 40, "Download labels CSV", "button"),
        (264, 135, 400, 40, "Tabs: Open | History | All   + type filter", "button"),
        *[(264 + (i % 2) * 586, 190 + (i // 2) * 230, 566, 215, "Alert card: advice EN/HI, Rs, kWh/L, Switch off / Correct / Not waste", "card") for i in range(6)],
    ],
    "Water & Pump": [
        (264, 70, 900, 50, "Title + energy-water link line", "text"),
        *[(264 + i * 290, 135, 278, 95, k, "kpi") for i, k in enumerate(["Overhead tank %", "Sump %", "Pump state", "Lowest night flow"])],
        (264, 250, 1152, 300, "Chart: tank level, sump level, pump on (48 h)", "chart"),
        (264, 570, 1152, 260, "Chart: flow per floor, stacked (leaks never reach zero)", "chart"),
    ],
    "Heat in Walls": [
        (264, 70, 900, 50, "Title + 'waste no meter can see'", "text"),
        (264, 135, 1152, 210, "How we measure: board V1 -> wall wire (hot joint) -> room V2  +  3 formulas", "main"),
        (264, 365, 1152, 330, "Table per circuit: R0 · R now · change bar · heat at full load · status", "main"),
        (264, 715, 1152, 130, "Earth leakage by floor (3 tiles)", "kpi"),
    ],
    "Forecast": [
        (264, 70, 900, 50, "Title + inputs used", "text"),
        *[(264 + i * 290, 135, 278, 95, k, "kpi") for i, k in enumerate(["Next 24 h kWh", "Expected bill", "Peak hour", "Yesterday's error"])],
        (264, 250, 1152, 380, "Bar chart: last 24 h actual | next 24 h forecast", "chart"),
    ],
    "Savings & Carbon": [
        (264, 70, 900, 50, "Title", "text"),
        *[(264 + i * 290, 135, 278, 95, k, "kpi") for i, k in enumerate(["Money saved", "Energy avoided", "Water avoided", "CO2 avoided"])],
        (264, 250, 1152, 220, "Chart: waste caught vs avoided per day", "chart"),
        *[(264 + i * 388, 490, 376, 110, k, "kpi") for i, k in enumerate(["Electricity before/after", "Water before/after", "Bill before/after"])],
        (264, 620, 1152, 120, "Monthly electricity: without vs with", "chart"),
        (264, 755, 1152, 120, "Table: waste type, before, after, cut by %", "main"),
    ],
    "Simulator": [
        (264, 70, 900, 50, "Title + 'detector never sees the truth'", "text"),
        (264, 135, 566, 230, "Create a fault: type + where + button", "card"),
        (850, 135, 566, 230, "Power cut · speed buttons", "card"),
        (264, 385, 1152, 300, "Ground truth list: fault · where · since · Detected? · Fix", "main"),
    ],
    "Settings": [
        (264, 70, 900, 50, "Title", "text"),
        (264, 135, 1152, 380, "Toggles: automatic mode, auto tickets · grace period · repair time · language", "card"),
        (264, 535, 1152, 140, "Detector report card: % caught, % real, test size", "card"),
    ],
}

FILL = {"nav": "#e2e8f0", "text": "#f8fafc", "kpi": "#f1f5f9", "main": "#f8fafc", "card": "#ffffff", "chart": "#f8fafc", "button": "#cbd5e1"}


def svg(name: str, scale: float = 0.42) -> str:
    w, h = FRAME_W * scale, FRAME_H * scale
    parts = [f'<svg viewBox="0 0 {FRAME_W} {FRAME_H}" width="{w:.0f}" height="{h:.0f}" xmlns="http://www.w3.org/2000/svg">',
             f'<rect x="0" y="0" width="{FRAME_W}" height="{FRAME_H}" fill="#fff" stroke="#94a3b8" stroke-width="3"/>']
    for x, y, bw, bh, label, kind in COMMON + SCREENS[name]:
        dash = ' stroke-dasharray="10 6"' if kind == "chart" else ""
        parts.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" rx="10" fill="{FILL[kind]}" stroke="#94a3b8" stroke-width="2"{dash}/>')
        if kind == "chart":
            parts.append(f'<polyline points="{x+20},{y+bh-30} {x+bw*0.3},{y+bh*0.55} {x+bw*0.55},{y+bh*0.7} {x+bw*0.8},{y+bh*0.35} {x+bw-20},{y+bh*0.5}" fill="none" stroke="#94a3b8" stroke-width="3"/>')
        size = 26 if kind != "nav" else 22
        # wrap long labels roughly
        words, lines, cur = label.split(), [], ""
        maxc = max(10, int(bw / (size * 0.55)))
        for wd in words:
            if len(cur) + len(wd) + 1 > maxc:
                lines.append(cur)
                cur = wd
            else:
                cur = (cur + " " + wd).strip()
        lines.append(cur)
        ty = y + bh / 2 - (len(lines) - 1) * size * 0.6
        if kind == "nav" and bw == 240:
            ty = y + 60
        for i, ln in enumerate(lines[:4]):
            parts.append(f'<text x="{x + bw / 2}" y="{ty + i * size * 1.2}" font-size="{size}" text-anchor="middle" fill="#475569">{ln}</text>')
    parts.append("</svg>")
    return "\n".join(parts)
