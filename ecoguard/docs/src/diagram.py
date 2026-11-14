"""Tiny helper to draw box-and-arrow diagrams as SVG (no external tools needed)."""
from html import escape

STYLES = {
    "entity": ("#f1f5f9", "#475569", 0),     # external entity: square box
    "process": ("#ecfdf5", "#047857", 40),   # process: rounded
    "store": ("#eff6ff", "#0369a1", 0),      # data store: open box
    "screen": ("#ffffff", "#047857", 8),
    "start": ("#047857", "#047857", 30),
    "decision": ("#fffbeb", "#d97706", 0),
    "note": ("#fafafa", "#94a3b8", 6),
}


class Diagram:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.nodes, self.edges = {}, []

    def node(self, key, x, y, w, h, label, kind="process"):
        self.nodes[key] = (x, y, w, h, label, kind)
        return self

    def edge(self, a, b, label="", side=None, bend=0):
        self.edges.append((a, b, label, side, bend))
        return self

    def _anchor(self, key, tx, ty):
        x, y, w, h, *_ = self.nodes[key]
        cx, cy = x + w / 2, y + h / 2
        dx, dy = tx - cx, ty - cy
        if dx == 0 and dy == 0:
            return cx, cy
        # clip the line from the centre to the box edge
        sx = (w / 2) / abs(dx) if dx else float("inf")
        sy = (h / 2) / abs(dy) if dy else float("inf")
        s = min(sx, sy)
        return cx + dx * s, cy + dy * s

    def render(self, width=None):
        out = [f'<svg viewBox="0 0 {self.w} {self.h}" width="{width or self.w}" xmlns="http://www.w3.org/2000/svg">',
               '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
               '<path d="M0,0 L10,5 L0,10 z" fill="#475569"/></marker></defs>']
        for a, b, label, side, bend in self.edges:
            ax, ay, aw, ah, *_ = self.nodes[a]
            bx, by, bw, bh, *_ = self.nodes[b]
            acx, acy, bcx, bcy = ax + aw / 2, ay + ah / 2, bx + bw / 2, by + bh / 2
            mx, my = (acx + bcx) / 2, (acy + bcy) / 2
            if bend:
                # perpendicular offset for a curved arrow (used for two-way flows)
                dx, dy = bcx - acx, bcy - acy
                ln = (dx * dx + dy * dy) ** 0.5 or 1
                mx, my = mx - dy / ln * bend, my + dx / ln * bend
            x1, y1 = self._anchor(a, mx, my)
            x2, y2 = self._anchor(b, mx, my)
            out.append(f'<path d="M{x1:.1f},{y1:.1f} Q{mx:.1f},{my:.1f} {x2:.1f},{y2:.1f}" fill="none" stroke="#475569" stroke-width="1.6" marker-end="url(#ar)"/>')
            if label:
                lines = label.split("\n")
                for i, ln_ in enumerate(lines):
                    out.append(f'<text x="{mx:.1f}" y="{my - 4 + (i - (len(lines) - 1) / 2) * 12:.1f}" font-size="10.5" text-anchor="middle" fill="#334155" '
                               f'paint-order="stroke" stroke="#ffffff" stroke-width="4">{escape(ln_)}</text>')
        for key, (x, y, w, h, label, kind) in self.nodes.items():
            fill, stroke, r = STYLES[kind]
            if kind == "store":
                out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="none"/>')
                out.append(f'<path d="M{x+w},{y} L{x},{y} L{x},{y+h} L{x+w},{y+h}" fill="none" stroke="{stroke}" stroke-width="1.8"/>')
                out.append(f'<line x1="{x+30}" y1="{y}" x2="{x+30}" y2="{y+h}" stroke="{stroke}" stroke-width="1.2"/>')
            elif kind == "decision":
                cx, cy = x + w / 2, y + h / 2
                out.append(f'<polygon points="{cx},{y} {x+w},{cy} {cx},{y+h} {x},{cy}" fill="{fill}" stroke="{stroke}" stroke-width="1.8"/>')
            else:
                out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{min(r, h/2)}" fill="{fill}" stroke="{stroke}" stroke-width="1.8"/>')
            color = "#ffffff" if kind == "start" else "#0f172a"
            lines = label.split("\n")
            tx = x + w / 2 + (15 if kind == "store" else 0)
            for i, ln_ in enumerate(lines):
                weight = "600" if i == 0 else "400"
                size = 12 if i == 0 else 10.5
                out.append(f'<text x="{tx}" y="{y + h / 2 + 4 + (i - (len(lines) - 1) / 2) * 14:.1f}" font-size="{size}" font-weight="{weight}" text-anchor="middle" fill="{color}">{escape(ln_)}</text>')
        out.append("</svg>")
        return "\n".join(out)
