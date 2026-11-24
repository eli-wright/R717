#!/usr/bin/env python3
"""
Generate assets/props.json — every refrigerant property used on the site.

Source: CoolProp (pip install CoolProp). Nothing in props.json is typed by hand.

Reference state: ASHRAE — h = 0 BTU/lb and s = 0 BTU/lb-R for saturated liquid
at -40 F (-40 C). This matches the IIAR / ASHRAE tables that techs use.

Gauge pressure on the site is psig = psia - 14.696 (sea-level atmosphere).

Run:  python3 tools/gen_props.py
"""
import json
import math
import os
import sys
from datetime import date

import CoolProp
import CoolProp.CoolProp as CP

# ---------------------------------------------------------------- unit helpers
PA_PER_PSI = 6894.757293168
J_PER_KG_PER_BTU_LB = 2326.0                 # IT Btu
J_PER_KGK_PER_BTU_LBR = 4186.8
FT3LB_PER_M3KG = 16.018463373960138          # 1 m3/kg in ft3/lb
ATM_PSIA = 14.696


def f2k(t_f):
    return (t_f + 459.67) * 5.0 / 9.0


def k2f(t_k):
    return t_k * 9.0 / 5.0 - 459.67


def psia(p_pa):
    return p_pa / PA_PER_PSI


def pa(p_psia):
    return p_psia * PA_PER_PSI


def btu(h_jkg):
    return h_jkg / J_PER_KG_PER_BTU_LB


def btur(s):
    return s / J_PER_KGK_PER_BTU_LBR


def ft3(v_m3kg):
    return v_m3kg * FT3LB_PER_M3KG


def r(x, n):
    v = round(float(x), n)
    return 0.0 if v == 0 else v          # no "-0.0"


# ---------------------------------------------------------------- fluids
FLUIDS = {
    "R717": {
        "cp": "Ammonia",
        "name": "Ammonia (R-717)",
        "short": "R-717",
        "tmin": -60, "tmax": 120,
        "isotherms": [-40, 0, 40, 80, 120, 160, 200, 250, 300, 400, 500],
        "view": {"op": {"hmin": -60, "hmax": 820, "pmin": 4, "pmax": 400},
                 "full": {"hmin": -110, "hmax": 820, "pmin": 2, "pmax": 3000}},
    },
    "R134a": {
        "cp": "R134a",
        "name": "R-134a",
        "short": "R-134a",
        "tmin": -40, "tmax": 150,
        "isotherms": [-40, 0, 40, 80, 120, 160, 200, 250, 300],
        "view": {"op": {"hmin": -10, "hmax": 150, "pmin": 6, "pmax": 500},
                 "full": {"hmin": -25, "hmax": 150, "pmin": 3, "pmax": 1200}},
    },
    "R744": {
        "cp": "CarbonDioxide",
        "name": "CO₂ (R-744)",
        "short": "R-744",
        "tmin": -60, "tmax": 87,
        "isotherms": [-40, 0, 40, 80, 120, 160, 200, 250],
        "view": {"op": {"hmin": -20, "hmax": 200, "pmin": 80, "pmax": 1600},
                 "full": {"hmin": -20, "hmax": 200, "pmin": 70, "pmax": 3000}},
    },
}

ISEN_STEP_F = 2          # isentropic compression paths every 2 F of evaporating temp
ISEN_SEGMENTS = 24       # points along each path, uniform in log(P)
TGRID_NH, TGRID_NP = 90, 70   # T(h, log P) grid size for chart hover


def sat(fluid, t_f, q):
    t = f2k(t_f)
    p = CP.PropsSI("P", "T", t, "Q", q, fluid)
    h = CP.PropsSI("H", "T", t, "Q", q, fluid)
    d = CP.PropsSI("D", "T", t, "Q", q, fluid)
    s = CP.PropsSI("S", "T", t, "Q", q, fluid)
    return p, h, 1.0 / d, s


def build(key, cfg):
    fl = cfg["cp"]
    CP.set_reference_state(fl, "ASHRAE")

    t_crit_k = CP.PropsSI("Tcrit", fl)
    p_crit = CP.PropsSI("pcrit", fl)
    t_trip_k = CP.PropsSI("Ttriple", fl)
    p_trip = CP.PropsSI("P", "T", t_trip_k + 1e-6, "Q", 0, fl)
    h_crit = CP.PropsSI("H", "T", t_crit_k, "P", p_crit * 1.0000001, fl)

    out = {
        "name": cfg["name"],
        "short": cfg["short"],
        "coolprop": fl,
        "tmin": cfg["tmin"], "tmax": cfg["tmax"], "dt": 1,
        "crit": {"T": r(k2f(t_crit_k), 2), "P": r(psia(p_crit), 2), "h": r(btu(h_crit), 2)},
        "triple": {"T": r(k2f(t_trip_k), 2), "P": r(psia(p_trip), 3)},
        "view": cfg["view"],
    }

    # ---- 1 F saturation table ------------------------------------------
    cols = {k: [] for k in ("P", "hf", "hg", "vf", "vg", "sf", "sg")}
    for t_f in range(cfg["tmin"], cfg["tmax"] + 1):
        p, hf, vf, sf = sat(fl, t_f, 0)
        _, hg, vg, sg = sat(fl, t_f, 1)
        cols["P"].append(r(psia(p), 4))
        cols["hf"].append(r(btu(hf), 4))
        cols["hg"].append(r(btu(hg), 4))
        cols["vf"].append(r(ft3(vf), 6))
        cols["vg"].append(r(ft3(vg), 5))
        cols["sf"].append(r(btur(sf), 5))
        cols["sg"].append(r(btur(sg), 5))
    out["sat"] = cols

    # ---- full dome for the P-h chart (triple point to critical point) ----
    dome = {"T": [], "P": [], "hf": [], "hg": []}
    t_lo = math.ceil(k2f(t_trip_k) + 0.5)
    t_hi = k2f(t_crit_k)
    temps = []
    t = t_lo
    while t < t_hi - 6:
        temps.append(float(t))
        t += 4
    # tighten near the critical point so the dome closes smoothly
    for frac in (6, 4, 2.5, 1.5, 0.8, 0.4, 0.15, 0.05):
        temps.append(t_hi - frac)
    for t_f in temps:
        p, hf, _, _ = sat(fl, t_f, 0)
        _, hg, _, _ = sat(fl, t_f, 1)
        dome["T"].append(r(t_f, 2))
        dome["P"].append(r(psia(p), 3))
        dome["hf"].append(r(btu(hf), 2))
        dome["hg"].append(r(btu(hg), 2))
    out["dome"] = dome

    # ---- isotherms for the chart background ------------------------------
    pv = cfg["view"]["full"]
    n_iso = 70
    logs = [math.log10(pv["pmin"]) + i * (math.log10(pv["pmax"]) - math.log10(pv["pmin"])) / n_iso
            for i in range(n_iso + 1)]
    isotherms = []
    for t_f in cfg["isotherms"]:
        tk = f2k(t_f)
        pts = []
        if tk < t_crit_k:
            psat = psia(CP.PropsSI("P", "T", tk, "Q", 0, fl))
            # liquid branch: high P down to saturation
            for lp in reversed(logs):
                p_ = 10 ** lp
                if p_ <= psat * 1.0005:
                    break
                h = CP.PropsSI("H", "T", tk, "P", pa(p_), fl)
                pts.append([r(btu(h), 2), r(p_, 3)])
            hf = btu(CP.PropsSI("H", "T", tk, "Q", 0, fl))
            hg = btu(CP.PropsSI("H", "T", tk, "Q", 1, fl))
            pts.append([r(hf, 2), r(psat, 3)])
            pts.append([r(hg, 2), r(psat, 3)])
            for lp in reversed(logs):
                p_ = 10 ** lp
                if p_ >= psat * 0.9995:
                    continue
                h = CP.PropsSI("H", "T", tk, "P", pa(p_), fl)
                pts.append([r(btu(h), 2), r(p_, 3)])
        else:
            for lp in reversed(logs):
                p_ = 10 ** lp
                h = CP.PropsSI("H", "T", tk, "P", pa(p_), fl)
                pts.append([r(btu(h), 2), r(p_, 3)])
        isotherms.append({"T": t_f, "pts": pts})
    out["isotherms"] = isotherms

    # ---- isentropic compression paths -----------------------------------
    # For each evaporating temperature Te: start at saturated vapor, follow
    # constant entropy up to P_sat(tmax). Points are uniform in log(P).
    p_top = CP.PropsSI("P", "T", f2k(cfg["tmax"]), "Q", 0, fl) * 1.02
    te_list = list(range(cfg["tmin"], cfg["tmax"], ISEN_STEP_F))
    paths_h, paths_t, paths_p0 = [], [], []
    for te in te_list:
        p0 = CP.PropsSI("P", "T", f2k(te), "Q", 1, fl)
        s0 = CP.PropsSI("S", "T", f2k(te), "Q", 1, fl)
        hs, ts = [], []
        for i in range(ISEN_SEGMENTS + 1):
            lp = math.log(p0) + i * (math.log(p_top) - math.log(p0)) / ISEN_SEGMENTS
            p_ = math.exp(lp)
            if i == 0:
                h = CP.PropsSI("H", "T", f2k(te), "Q", 1, fl)
                tt = f2k(te)
            else:
                h = CP.PropsSI("H", "P", p_, "S", s0, fl)
                tt = CP.PropsSI("T", "P", p_, "S", s0, fl)
            hs.append(r(btu(h), 3))
            ts.append(r(k2f(tt), 2))
        paths_h.append(hs)
        paths_t.append(ts)
        paths_p0.append(r(psia(p0), 5))
    out["isen"] = {
        "te0": te_list[0], "dte": ISEN_STEP_F, "n": ISEN_SEGMENTS,
        "ptop": r(psia(p_top), 4),
        "p0": paths_p0, "h": paths_h, "T": paths_t,
    }

    # ---- temperature grid T(h, log P) for chart hover read-outs ----------
    # T is continuous across the saturation lines, so bilinear interpolation
    # is good everywhere; the site uses exact saturation data inside the dome.
    nh, npp = TGRID_NH, TGRID_NP
    h_lo, h_hi = pv["hmin"], pv["hmax"]
    lp_lo, lp_hi = math.log10(pv["pmin"]), math.log10(pv["pmax"])
    grid = []
    for j in range(npp + 1):
        p_ = 10 ** (lp_lo + j * (lp_hi - lp_lo) / npp)
        row = []
        for i in range(nh + 1):
            h_ = h_lo + i * (h_hi - h_lo) / nh
            try:
                tk = CP.PropsSI("T", "P", pa(p_), "H", h_ * J_PER_KG_PER_BTU_LB, fl)
                row.append(r(k2f(tk), 1) if tk > t_trip_k - 0.01 else None)
            except ValueError:
                row.append(None)
        grid.append(row)
    out["tgrid"] = {"hmin": h_lo, "hmax": h_hi, "nh": nh,
                    "lpmin": r(lp_lo, 6), "lpmax": r(lp_hi, 6), "np": npp, "T": grid}
    return out


def ref_points(key, cfg, rnd):
    """Exact CoolProp values at random off-grid points (used by tests/test_props.mjs)."""
    fl = cfg["cp"]
    CP.set_reference_state(fl, "ASHRAE")
    tmin, tmax = cfg["tmin"], cfg["tmax"]
    out = {"sat": [], "tsat": [], "isen": [], "tph": []}
    for _ in range(30):
        t_f = rnd.uniform(tmin, tmax)
        p, hf, vf, _ = sat(fl, t_f, 0)
        _, hg, vg, _ = sat(fl, t_f, 1)
        out["sat"].append({"T": t_f, "P": psia(p), "hf": btu(hf), "hg": btu(hg),
                           "vf": ft3(vf), "vg": ft3(vg)})
    p_lo = psia(CP.PropsSI("P", "T", f2k(tmin), "Q", 0, fl))
    p_hi = psia(CP.PropsSI("P", "T", f2k(tmax), "Q", 0, fl))
    for _ in range(20):
        p_ = math.exp(rnd.uniform(math.log(p_lo), math.log(p_hi)))
        out["tsat"].append({"P": p_, "T": k2f(CP.PropsSI("T", "P", pa(p_), "Q", 0, fl))})
    for _ in range(40):
        te = rnd.uniform(tmin, tmax - 6)
        tc = rnd.uniform(te + 5, tmax)
        s0 = CP.PropsSI("S", "T", f2k(te), "Q", 1, fl)
        pc = CP.PropsSI("P", "T", f2k(tc), "Q", 0, fl)
        out["isen"].append({"Te": te, "Tc": tc,
                            "h2": btu(CP.PropsSI("H", "P", pc, "S", s0, fl)),
                            "T2": k2f(CP.PropsSI("T", "P", pc, "S", s0, fl))})
    v = cfg["view"]["op"]
    while len(out["tph"]) < 40:
        h_ = rnd.uniform(v["hmin"], v["hmax"])
        p_ = 10 ** rnd.uniform(math.log10(v["pmin"]), math.log10(v["pmax"]))
        try:
            tk = CP.PropsSI("T", "P", pa(p_), "H", h_ * J_PER_KG_PER_BTU_LB, fl)
        except ValueError:
            continue
        if tk < CP.PropsSI("Ttriple", fl) + 1:
            continue
        out["tph"].append({"P": p_, "h": h_, "T": k2f(tk)})
    return out


def env_data():
    """100-year GWP and ODP from CoolProp's fluid library (ammonia is not listed there)."""
    out = {}
    for key, name, cp_name in (("R744", "CO\u2082 (R-744)", "CarbonDioxide"), ("R134a", "R-134a", "R134a"),
                               ("R404A", "R-404A", "R404A"), ("R11", "R-11", "R11"), ("R12", "R-12", "R12")):
        def get(prop):
            try:
                return CP.PropsSI(prop, cp_name)
            except ValueError:
                return 0.0          # CoolProp lists no ODP for chlorine-free fluids
        out[key] = {"name": name, "gwp": r(get("GWP100"), 0), "odp": r(get("ODP"), 2), "src": "CoolProp"}
    out["R717"] = {"name": "Ammonia (R-717)", "gwp": 0, "odp": 0,
                   "src": "ASHRAE 34 / IPCC (not a greenhouse gas; CoolProp lists no value)"}
    return out


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data = {
        "meta": {
            "source": "CoolProp %s (PropsSI)" % CoolProp.__version__,
            "generator": "tools/gen_props.py",
            "generated": date.today().isoformat(),
            "reference": "ASHRAE: h = 0 BTU/lb and s = 0 BTU/lb-R for saturated liquid at -40 F",
            "atm_psia": ATM_PSIA,
            "units": {"T": "F", "P": "psia", "h": "BTU/lb", "v": "ft3/lb", "s": "BTU/lb-R"},
            "note": "psig = psia - 14.696 (sea-level atmosphere)",
        },
        "fluids": {k: build(k, v) for k, v in FLUIDS.items()},
        "env": env_data(),
    }
    for k, v in FLUIDS.items():
        data["fluids"][k]["M"] = r(CP.PropsSI("M", v["cp"]) * 1000, 3)   # g/mol = lb/lbmol
    data["meta"]["M_air"] = r(CP.PropsSI("M", "Air") * 1000, 3)
    # Water boiling points for the "pot of water" and "mountain" analogies.
    # 10,000 ft pressure from the U.S. Standard Atmosphere (troposphere formula).
    p10k = 101325.0 * (1 - 2.25577e-5 * 3048.0) ** 5.25588
    data["water"] = {
        "sea": {"P": ATM_PSIA, "T": r(k2f(CP.PropsSI("T", "P", pa(ATM_PSIA), "Q", 0, "Water")), 2)},
        "10k": {"P": r(psia(p10k), 3), "T": r(k2f(CP.PropsSI("T", "P", p10k, "Q", 0, "Water")), 2)},
    }
    path = os.path.join(root, "assets", "props.json")
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print("wrote", path, os.path.getsize(path), "bytes")

    import random
    rnd = random.Random(717)
    refs = {k: ref_points(k, v, rnd) for k, v in FLUIDS.items()}
    rpath = os.path.join(root, "tests", "ref_points.json")
    os.makedirs(os.path.dirname(rpath), exist_ok=True)
    with open(rpath, "w") as f:
        json.dump({"note": "Exact CoolProp values (ASHRAE ref) at random off-grid points. "
                           "Generated by tools/gen_props.py.", "fluids": refs}, f, indent=0)
    print("wrote", rpath)

    # quick human check
    for key, t_list in (("R717", [-40, -28, -10, -5, 0, 5, 20, 85, 95, 100]),
                        ("R134a", [0]), ("R744", [75, 87])):
        fdat = data["fluids"][key]
        for t_f in t_list:
            i = t_f - fdat["tmin"]
            s = fdat["sat"]
            p = s["P"][i]
            print("%-6s %5d F  P=%8.2f psia (%8.2f psig)  hf=%6.1f  hg=%6.1f  hfg=%6.1f  vg=%8.4f"
                  % (key, t_f, p, p - ATM_PSIA, s["hf"][i], s["hg"][i], s["hg"][i] - s["hf"][i], s["vg"][i]))


if __name__ == "__main__":
    sys.exit(main())
