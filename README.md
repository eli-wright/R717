# R-717 Ammonia Refrigeration Training

Interactive training site for industrial ammonia refrigeration, served by GitHub Pages from `main`:
https://eli-wright.github.io/R717/

It is a static site with no build step: `index.html` plus `assets/`.

## Layout

| Path | What it is |
|---|---|
| `index.html` | All course content (11 modules) |
| `assets/css/site.css` | Visual system |
| `assets/js/props.js` | Property lookups and calculations (shared by the site and the tests) |
| `assets/js/*.js` | Hero, cycle diagram, P-h chart, components, recirculator, flash gas, sizing, page wiring |
| `assets/props.json` | Refrigerant properties, generated from CoolProp |
| `assets/vendor/gsap-3.12.5/` | GSAP and ScrollTrigger 3.12.5 (pinned, self-hosted) |
| `tools/gen_props.py` | Generates `assets/props.json` and `tests/ref_points.json` |
| `tests/` | Property test and headless browser check |

## Property data

Every property number comes from CoolProp, never typed by hand. The reference state is ASHRAE
(h = 0 BTU/lb and s = 0 for saturated liquid at -40 F), which matches the IIAR / ASHRAE tables.
Gauge pressure uses psig = psia - 14.696 (sea-level atmosphere).

Saturation tables are in 1 F steps: R-717 from -60 to 120 F, R-134a from -40 to 150 F,
CO2 from -60 to 87 F (critical point 87.8 F).

```bash
pip install CoolProp
python3 tools/gen_props.py
```

## Checks

```bash
node tests/test_props.js
```

Checks every reference value, the 17.5 % flash gas worked example, input validation, and the
site's interpolation against exact CoolProp values at random points.

```bash
node tests/visual_check.js
```

Needs Playwright with Chromium. Opens the site at desktop, phone and reduced-motion settings,
fails on console errors, checks that every number written in the HTML matches `props.json`,
checks for horizontal overflow, exercises the interactive parts and saves screenshots to
`tests/screens/`.
