/*
 * R-717 Training — property library.
 * Every number comes from assets/props.json, which tools/gen_props.py builds
 * from CoolProp (ASHRAE reference: h = 0 for saturated liquid at -40 F).
 * Works in the browser (window.R717Props) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.R717Props = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ATM = 14.696; // psia, sea-level standard atmosphere
  var DATA = null;

  function setData(d) { DATA = d; ATM = (d.meta && d.meta.atm_psia) || ATM; return d; }
  function data() { return DATA; }
  function load(url) {
    return fetch(url, { cache: "force-cache" }).then(function (r) {
      if (!r.ok) throw new Error("props.json HTTP " + r.status);
      return r.json();
    }).then(setData);
  }
  function fluid(k) { return DATA.fluids[k]; }
  function keys() { return Object.keys(DATA.fluids); }
  function psig(P) { return P - ATM; }
  function psiaFromPsig(Pg) { return Pg + ATM; }

  // --------------------------------------------------------------- saturation
  // 1 F table, linear in T for h and v_f, log-linear for P and v_g.
  function sat(k, T) {
    var f = fluid(k), s = f.sat, n = s.P.length;
    if (!(T >= f.tmin - 1e-9 && T <= f.tmax + 1e-9)) return null;
    var x = (T - f.tmin) / f.dt, i = Math.floor(x);
    if (i >= n - 1) i = n - 2;
    if (i < 0) i = 0;
    var u = x - i;
    // 3-point (quadratic) Lagrange interpolation; exact at table rows. The
    // curvature matters near CO2's critical point.
    var j = (u < 0.5 && i > 0) || i >= n - 2 ? i - 1 : i;   // rows j, j+1, j+2
    var t = x - j;
    var L0 = (t - 1) * (t - 2) / 2, L1 = -t * (t - 2), L2 = t * (t - 1) / 2;
    var lin = function (a) { return a[j] * L0 + a[j + 1] * L1 + a[j + 2] * L2; };
    var lg = function (a) { return Math.exp(Math.log(a[j]) * L0 + Math.log(a[j + 1]) * L1 + Math.log(a[j + 2]) * L2); };
    var P = lg(s.P), hf = lin(s.hf), hg = lin(s.hg), vf = lin(s.vf), vg = lg(s.vg);
    return {
      T: T, P: P, psig: P - ATM, hf: hf, hg: hg, hfg: hg - hf,
      vf: vf, vg: vg, rhoL: 1 / vf, rhoV: 1 / vg, sf: lin(s.sf), sg: lin(s.sg)
    };
  }

  // Saturation temperature for an absolute pressure (psia), inside the 1 F table.
  function tsat(k, P) {
    var f = fluid(k), a = f.sat.P, n = a.length;
    if (!(P >= a[0] * (1 - 1e-9) && P <= a[n - 1] * (1 + 1e-9))) return null;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (a[m] <= P) lo = m; else hi = m; }
    var u = (Math.log(P) - Math.log(a[lo])) / (Math.log(a[hi]) - Math.log(a[lo]));
    return f.tmin + (lo + u) * f.dt;
  }

  // Saturation by pressure across the whole dome (triple to critical); used by
  // the P-h chart outside the 1 F table range.
  function domeAtP(k, P) {
    var f = fluid(k);
    var t = tsat(k, P);
    if (t !== null) { var s = sat(k, t); return { T: t, P: P, hf: s.hf, hg: s.hg }; }
    var d = f.dome, a = d.P, n = a.length;
    if (P < a[0] || P > a[n - 1]) return null;
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (a[m] <= P) lo = m; else hi = m; }
    var u = (Math.log(P) - Math.log(a[lo])) / (Math.log(a[hi]) - Math.log(a[lo]));
    var L = function (arr) { return arr[lo] + (arr[hi] - arr[lo]) * u; };
    return { T: L(d.T), P: P, hf: L(d.hf), hg: L(d.hg) };
  }

  // ------------------------------------------------- isentropic compression
  function isenAlong(f, j, P) {
    var is = f.isen, H = is.h[j], TT = is.T[j], n = is.n;
    var l0 = Math.log(is.p0[j]), lt = Math.log(is.ptop);
    var pos = (Math.log(P) - l0) / (lt - l0) * n;
    var i = Math.floor(pos);
    if (i < 0) i = 0;
    if (i > n - 1) i = n - 1;
    var w = pos - i;
    return { h: H[i] + (H[i + 1] - H[i]) * w, T: TT[i] + (TT[i + 1] - TT[i]) * w };
  }
  // State after ideal (isentropic) compression from saturated vapor at Te to pressure P.
  function isen(k, Te, P) {
    var f = fluid(k), is = f.isen, m = is.h.length;
    var x = (Te - is.te0) / is.dte, i = Math.floor(x);
    if (i > m - 2) i = m - 2;
    if (i < 0) i = 0;
    var u = x - i;
    var a = isenAlong(f, i, P), b = isenAlong(f, i + 1, P);
    return { h: a.h + (b.h - a.h) * u, T: a.T + (b.T - a.T) * u, P: P };
  }
  function isenPath(k, Te, P2, steps) {
    steps = steps || 24;
    var s1 = sat(k, Te), out = [{ P: s1.P, h: s1.hg, T: Te }];
    var l1 = Math.log(s1.P), l2 = Math.log(P2);
    for (var i = 1; i <= steps; i++) {
      var p = Math.exp(l1 + (l2 - l1) * i / steps);
      var st = isen(k, Te, p);
      // blend out the tiny interpolation offset at the start so the path leaves point 1 exactly
      var w = Math.min(1, i / 3), ref = isen(k, Te, s1.P);
      out.push({ P: p, h: st.h - (ref.h - s1.hg) * (1 - w), T: st.T - (ref.T - Te) * (1 - w) });
    }
    return out;
  }

  // --------------------------------------------------- temperature anywhere
  function tAtPH(k, P, h) {
    var f = fluid(k);
    var d = domeAtP(k, P);
    if (d && h >= d.hf && h <= d.hg) return { T: d.T, x: (h - d.hf) / (d.hg - d.hf), region: "two-phase" };
    var g = f.tgrid;
    var fx = (h - g.hmin) / (g.hmax - g.hmin) * g.nh;
    var fy = (Math.log10(P) - g.lpmin) / (g.lpmax - g.lpmin) * g.np;
    if (fx < 0 || fy < 0 || fx > g.nh || fy > g.np) return null;
    var i = Math.min(Math.floor(fx), g.nh - 1), j = Math.min(Math.floor(fy), g.np - 1);
    var u = fx - i, v = fy - j, G = g.T;
    var c00 = G[j][i], c10 = G[j][i + 1], c01 = G[j + 1][i], c11 = G[j + 1][i + 1];
    if (c00 == null || c10 == null || c01 == null || c11 == null) return null;
    var T = c00 * (1 - u) * (1 - v) + c10 * u * (1 - v) + c01 * (1 - u) * v + c11 * u * v;
    var region;
    if (P >= f.crit.P) region = T >= f.crit.T ? "supercritical" : "compressed liquid";
    else region = d && h < d.hf ? "subcooled liquid" : "superheated vapor";
    return { T: T, x: null, region: region };
  }

  // --------------------------------------------------------- input parsing
  // value + unit ("F", "PSIG", "PSIA") -> {ok, T, P} or {ok:false, msg, kind}
  function parseState(k, value, unit) {
    var f = fluid(k);
    if (!isFinite(value)) return { ok: false, kind: "empty", msg: "Enter a number." };
    var crit = f.crit, T, P;
    if (unit === "F") {
      T = value;
      if (T > crit.T) return { ok: false, kind: "supercritical", msg: transMsg(f) };
      if (T < f.tmin || T > f.tmax) return { ok: false, kind: "range", msg: rangeMsg(f) };
      P = sat(k, T).P;
    } else {
      P = unit === "PSIG" ? value + ATM : value;
      if (P <= 0) return { ok: false, kind: "range", msg: "Absolute pressure must be above zero." };
      if (P > crit.P) return { ok: false, kind: "supercritical", msg: transMsg(f) };
      T = tsat(k, P);
      if (T === null) return { ok: false, kind: "range", msg: rangeMsg(f) };
    }
    return { ok: true, T: T, P: P };
  }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function rangeMsg(f) {
    var a = sat(keyOf(f), f.tmin), b = sat(keyOf(f), f.tmax);
    return "Outside the table for " + f.short + ": " + f.tmin + "°F to " + f.tmax + "°F (" +
      fmt(a.psig, 1) + " to " + fmt(b.psig, 1) + " psig). Nothing was rounded to the edge.";
  }
  function transMsg(f) {
    return f.short + " has its critical point at " + fmt(f.crit.T, 1) + "°F and " +
      fmt(f.crit.P - ATM, 0) + " psig. Above it there is no liquid and no saturation pressure, so this " +
      "calculation does not apply. A transcritical CO₂ system needs the gas cooler pressure and the " +
      "gas cooler outlet temperature.";
  }
  function keyOf(f) { for (var k in DATA.fluids) if (DATA.fluids[k] === f) return k; return null; }

  // ------------------------------------------------------------ flash gas
  // up/down: {T,P} saturation states; sc: subcooling F
  function flash(k, up, down, sc) {
    sc = sc || 0;
    var f = fluid(k), res = { ok: false };
    if (!(down.T < up.T)) {
      res.msg = "The evaporator (after the valve) must be colder than the liquid line (before the valve). " +
        "Right now the downstream saturation temperature is " + fmt(down.T, 1) + "°F and upstream is " +
        fmt(up.T, 1) + "°F.";
      return res;
    }
    if (sc < 0) { res.msg = "Subcooling can't be negative."; return res; }
    var Tl = up.T - sc;
    if (Tl < f.tmin) { res.msg = "That much subcooling puts the liquid below the table (" + f.tmin + "°F)."; return res; }
    var liq = sat(k, Tl), lo = sat(k, down.T);
    var hIn = liq.hf;            // saturated-liquid enthalpy at the actual liquid temperature
    var x = (hIn - lo.hf) / lo.hfg;
    res.ok = true;
    res.Tliq = Tl; res.hIn = hIn; res.hf = lo.hf; res.hg = lo.hg; res.hfg = lo.hfg;
    res.Pup = up.P; res.Pdown = down.P; res.Tup = up.T; res.Tdown = down.T;
    if (x <= 0) {
      res.x = 0; res.note = "The liquid is already at or below the evaporator temperature, so no flash gas forms.";
    } else res.x = x;
    // share of volume right after the valve
    var vV = res.x * lo.vg, vL = (1 - res.x) * lo.vf;
    res.volFrac = vV / (vV + vL);
    res.vg = lo.vg; res.vf = lo.vf;
    return res;
  }

  // ---------------------------------------------------------- simple cycle
  function cycle(k, Te, Tc, sc) {
    sc = sc || 0;
    var e = sat(k, Te), c = sat(k, Tc);
    if (!e || !c || !(Te < Tc)) return null;
    var T3 = Tc - sc, l = sat(k, T3);
    if (!l) return null;
    var two = isen(k, Te, c.P);
    var h1 = e.hg, h2 = two.h, h3 = l.hf, h4 = h3;
    var x4 = (h4 - e.hf) / e.hfg;
    var RE = h1 - h4, W = h2 - h1;
    return {
      e: e, c: c,
      p1: { P: e.P, h: h1, T: Te, label: "1" },
      p2: { P: c.P, h: h2, T: two.T, label: "2" },
      p2s: { P: c.P, h: c.hg, T: Tc },
      p3s: { P: c.P, h: c.hf, T: Tc },
      p3: { P: c.P, h: h3, T: T3, label: "3" },
      p4: { P: e.P, h: h4, T: Te, x: x4, label: "4" },
      RE: RE, W: W, QR: h2 - h3, COP: RE / W, x4: x4,
      mPerTR: 200 / RE, CR: c.P / e.P, T2: two.T, path12: isenPath(k, Te, c.P, 24)
    };
  }

  // ------------------------------------------- recirculator / sizing calc
  // TR, Te (F), Tliq (F, make-up liquid), N (overfeed), K (ft/s)
  function sizing(k, TR, Te, Tliq, N, K) {
    var e = sat(k, Te), l = sat(k, Tliq);
    if (!e || !l) return null;
    var Q = TR * 200;                         // BTU/min
    var mEvap = Q / (e.hg - e.hf);            // boiled in the coils; pumped liquid enters at hf(Te)
    var mSuc = Q / (e.hg - l.hf);             // vapor leaving the vessel; make-up enters at hf(Tliq)
    var mPump = N * mEvap;
    var gpm = mPump / e.rhoL * 7.48052;
    var acfm = mSuc * e.vg;
    var v = K * Math.sqrt((e.rhoL - e.rhoV) / e.rhoV);
    var A = acfm / (60 * v);
    var D = Math.sqrt(4 * A / Math.PI);
    return {
      e: e, l: l, Q: Q, mEvap: mEvap, mSuc: mSuc, mFlash: mSuc - mEvap, mPump: mPump,
      mLiqReturn: mPump - mEvap, gpm: gpm, acfm: acfm, v: v, A: A, D: D, Din: D * 12
    };
  }

  return {
    load: load, setData: setData, data: data, fluid: fluid, keys: keys,
    sat: sat, tsat: tsat, domeAtP: domeAtP, isen: isen, isenPath: isenPath, tAtPH: tAtPH,
    parseState: parseState, flash: flash, cycle: cycle, sizing: sizing,
    psig: psig, psiaFromPsig: psiaFromPsig, fmt: fmt,
    get ATM() { return ATM; }
  };
});
