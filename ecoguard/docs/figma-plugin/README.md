# Figma plugin: product screens and prototype

Builds page "02 Product screens + prototype" in the Round 2 Figma file from the running app,
so the design always matches the code.

1. Start the backend and the sensor gateway (see the main README).
2. `node capture.cjs d` and `node capture.cjs m` take every screen on desktop (1440 wide) and phone (390 wide)
   at 2x, full length, record where every link and button sits, and click each button, slider and tab
   once to capture what it changes.
3. `python docs/figma-plugin/build_data.py` cuts each screen into 800 px slices and writes `data.js`.
4. `cat data.js main.js > code.js`, then in Figma: Plugins > Development > Import plugin from manifest,
   and run it.

What the plugin makes:
- one scrolling frame per screen, with the sidebar and top bar as fixed layers
- a transparent hotspot over every link, wired with Navigate + Smart animate
- the phone menu as an overlay
- an "after you click" copy of the screen for every button, slider, tab and top-bar chip, wired so a
  click shows the change and a second click goes back
- the two flows: Estate officer · desktop and Caretaker · phone
- the "00 Start here" board with prototype links

`shots/`, `data.js` and `code.js` are generated and not kept in git.
