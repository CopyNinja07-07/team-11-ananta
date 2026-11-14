"""Plain-language advice for facility staff, in English and Hindi.

The numbers (kW, litres, rupees) are always computed in code. The text is a
template, so the advice can never invent a number. An LLM could rephrase
these later, but it would only rephrase; it would never do the maths.
"""
from .campus import TARIFF, ZONES, to_ist

FLOOR_EN = {"F0": "ground floor", "F1": "first floor", "F2": "second floor"}
FLOOR_HI = {"F0": "ग्राउंड फ्लोर", "F1": "पहली मंज़िल", "F2": "दूसरी मंज़िल"}


def _name(target: str) -> str:
    return ZONES[target]["name"] if target in ZONES else FLOOR_EN.get(target, target)


def per_day_rs(kw: float = 0.0, lph: float = 0.0, hours: float = 24) -> int:
    return round(kw * hours * TARIFF["rsPerKWh"] + lph * hours / 1000 * TARIFF["rsPerKL"])


def advise(rule: str, target: str, info: dict, start_ms: int) -> tuple[str, str]:
    since = to_ist(start_ms).strftime("%I:%M %p").lstrip("0")
    name = _name(target)
    if rule == "empty_room":
        kw = info.get("extra_kw", 0)
        cause = info.get("cause", "something left on")
        rs = round(kw * TARIFF["rsPerKWh"])
        en = (f"{name} has been empty since {since} but is still drawing {kw:.1f} kW ({cause}). "
              f"That is about Rs {rs} every hour. Switch it off from the dashboard, or ask the guard to check the room.")
        hi = (f"{name} {since} से खाली है, फिर भी {kw:.1f} kW बिजली चल रही है। "
              f"हर घंटे लगभग ₹{rs} का नुकसान। डैशबोर्ड से बंद करें या गार्ड से कमरा चेक करवाएँ।")
    elif rule == "over_use":
        kw, exp = info.get("extra_kw", 0), info.get("expected_kw", 0)
        en = (f"{name} is using {kw:.1f} kW more than normal for this many people and this weather "
              f"(normal is about {exp:.1f} kW). Check if a door or window is open with the AC on, or the AC is set too cold. Set it to 24-26 °C.")
        hi = (f"{name} में इतने लोगों और इस मौसम के हिसाब से {kw:.1f} kW ज़्यादा बिजली लग रही है। "
              f"देखें कि AC चलते हुए दरवाज़ा/खिड़की खुली तो नहीं, या AC बहुत ठंडा तो नहीं। AC 24-26 °C पर रखें।")
    elif rule == "overcool":
        t, kw = info.get("t_in", 0), info.get("extra_kw", 0)
        rs = round(kw * TARIFF["rsPerKWh"])
        en = (f"{name} is at {t:.1f} °C inside: the AC is set far too cold. Every degree below 24 °C costs about 6% more power "
              f"(BEE). Setting it to 24 °C saves about {kw:.1f} kW, roughly Rs {rs} an hour, and the room stays comfortable.")
        hi = (f"{name} अंदर से {t:.1f} °C है: AC बहुत ठंडा सेट है। 24 °C से हर एक डिग्री कम पर लगभग 6% ज़्यादा बिजली लगती है (BEE)। "
              f"24 °C करने से लगभग {kw:.1f} kW, यानी हर घंटे करीब ₹{rs} बचेंगे।")
    elif rule == "door_open":
        t, kw = info.get("t_in", 0), info.get("ac_kw", 0)
        en = (f"The AC in {name} is running flat out ({kw:.1f} kW) but the room is still {t:.1f} °C. A door or window is probably open. "
              f"Close it: the AC will cool the room faster and use about a third less power.")
        hi = (f"{name} का AC पूरी ताकत ({kw:.1f} kW) से चल रहा है फिर भी कमरा {t:.1f} °C है। शायद दरवाज़ा या खिड़की खुली है। "
              f"बंद करें: कमरा जल्दी ठंडा होगा और लगभग एक-तिहाई बिजली बचेगी।")
    elif rule == "wall_heat":
        r, r0 = info.get("r_now", 0), info.get("r0", 0)
        peak = info.get("peak_heat_w", 0)
        en = (f"The wiring to {name} has gone from {r0:.2f} to {r:.2f} ohm. That extra resistance turns into heat inside the wall: "
              f"about {info.get('heat_w', 0):.0f} W right now and up to {peak} W when everything in the room is on. "
              f"This usually means a loose or burnt joint. Get an electrician to tighten or replace it before it causes a fire.")
        hi = (f"{name} की वायरिंग का रेज़िस्टेंस {r0:.2f} से बढ़कर {r:.2f} ओम हो गया है। यह दीवार के अंदर गर्मी बन रही है: "
              f"अभी लगभग {info.get('heat_w', 0):.0f} W, और सब चालू होने पर {peak} W तक। "
              f"ज़्यादातर यह ढीला या जला हुआ जोड़ होता है। आग लगने से पहले इलेक्ट्रीशियन से ठीक करवाएँ।")
    elif rule == "earth_leak":
        ma = info.get("leak_ma", 0)
        en = (f"Current is leaking to earth on the {FLOOR_EN.get(target, target)} ({ma:.0f} mA, safe is under 10). "
              f"This often happens when a wall gets damp from a hidden pipe leak, or insulation is damaged. Check for damp patches and test the RCCB.")
        hi = (f"{FLOOR_HI.get(target, target)} पर करंट अर्थ में लीक हो रहा है ({ma:.0f} mA, सुरक्षित सीमा 10 से कम)। "
              f"अक्सर यह दीवार में छुपे पाइप लीक से आई नमी या खराब इंसुलेशन से होता है। सीलन देखें और RCCB टेस्ट करें।")
    elif rule == "night_flow":
        lph = info.get("lph", 0)
        rs = per_day_rs(lph=lph)
        if info.get("inside_wall"):
            en = (f"Water is flowing on the {FLOOR_EN.get(target)} at {lph:.0f} L/hour while the building is empty, and the earth-leakage "
                  f"on the same floor is rising. Together these point to a pipe leaking inside a wall. About {lph * 24 / 1000:.1f} kL (Rs {rs}) lost per day. Call the plumber.")
            hi = (f"{FLOOR_HI.get(target)} पर बिल्डिंग खाली होने पर भी {lph:.0f} लीटर/घंटा पानी बह रहा है, और उसी मंज़िल पर अर्थ-लीकेज बढ़ रहा है। "
                  f"दोनों मिलकर दीवार के अंदर पाइप लीक की ओर इशारा करते हैं। रोज़ लगभग {lph * 24 / 1000:.1f} kL (₹{rs}) का नुकसान। प्लंबर बुलाएँ।")
        else:
            en = (f"Water is flowing on the {FLOOR_EN.get(target)} at {lph:.0f} L/hour while nobody is in the building "
                  f"({info.get('cause', 'leak')}). About {lph * 24 / 1000:.1f} kL (Rs {rs}) lost per day.")
            hi = (f"{FLOOR_HI.get(target)} पर कोई नहीं है फिर भी {lph:.0f} लीटर/घंटा पानी बह रहा है "
                  f"(टंकी का फ्लश या लीक)। रोज़ लगभग {lph * 24 / 1000:.1f} kL (₹{rs}) का नुकसान।")
    elif rule == "overflow":
        en = ("The overhead tank is full but the pump is still running, so water is pouring out of the overflow pipe. "
              "The float switch is probably stuck. Turn the pump off and replace the float switch.")
        hi = ("छत की टंकी भर चुकी है पर पंप चल रहा है, पानी ओवरफ़्लो से बह रहा है। "
              "फ़्लोट स्विच शायद अटका है। पंप बंद करें और फ़्लोट स्विच बदलें।")
    elif rule == "dry_run":
        en = ("The pump is running but no water is coming out. The sump is probably empty (supply did not come, or the inlet valve is shut). "
              "A pump running dry wastes power and burns its seal. Turn it off and check the sump.")
        hi = ("पंप चल रहा है पर पानी नहीं आ रहा। नीचे की टंकी (सम्प) शायद खाली है। "
              "सूखा पंप बिजली बर्बाद करता है और सील जला देता है। पंप बंद करें और सम्प चेक करें।")
    else:
        en = hi = "Unusual reading, please check."
    return en, hi
