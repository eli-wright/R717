#!/usr/bin/env node
/*
 * Checks assets/props.json and assets/js/props.js (the same code the site runs).
 *   node tests/test_props.js
 * 1. Every check value from the rebuild brief (CoolProp, ASHRAE reference).
 * 2. The flash gas worked example gives 17.5 %.
 * 3. Input validation (evap above cond, out of range, CO2 above critical).
 * 4. Interpolation accuracy against exact CoolProp values at random off-grid
 *    points (tests/ref_points.json, written by tools/gen_props.py).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const R = require("../assets/js/props.js");

const root = path.join(__dirname, "..");
R.setData(JSON.parse(fs.readFileSync(path.join(root, "assets/props.json"), "utf8")));
const refs = JSON.parse(fs.readFileSync(path.join(__dirname, "ref_points.json"), "utf8"));

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; } else { fail++; console.log("  FAIL  " + label); }
}
function eqRound(actual, expected, dp, label) {
  const a = Number(actual.toFixed(dp)), e = Number(expected.toFixed(dp));
  ok(Math.abs(a - e) < 1e-9, `${label}: got ${actual.toFixed(dp)} expected ${expected.toFixed(dp)}`);
}

// ------------------------------------------------------------ 1. check values
console.log("1. Check values (CoolProp, ASHRAE reference)");
const checks = [
  // fluid, T, field, expected, decimals
  ["R717", -40, "P", 10.39, 2], ["R717", -40, "hg", 597.2, 1], ["R717", -40, "hf", 0.0, 1],
  ["R717", -28, "P", 14.68, 2],
  ["R717", -10, "P", 23.72, 2], ["R717", -10, "psig", 9.02, 2],
  ["R717", -5, "P", 26.89, 2], ["R717", -5, "psig", 12.19, 2], ["R717", -5, "hf", 37.5, 1],
  ["R717", -5, "hg", 609.5, 1], ["R717", -5, "hfg", 572.0, 1],
  ["R717", 0, "P", 30.39, 2], ["R717", 0, "hf", 42.9, 1], ["R717", 0, "hg", 611.1, 1],
  ["R717", 5, "hfg", 564.4, 1],
  ["R717", 20, "P", 48.18, 2], ["R717", 20, "hf", 64.6, 1], ["R717", 20, "hg", 617.1, 1],
  ["R717", 85, "P", 166.41, 2], ["R717", 85, "psig", 151.72, 2], ["R717", 85, "hf", 137.6, 1],
  ["R717", 85, "hg", 630.7, 1],
  ["R717", 95, "P", 195.80, 2],
  ["R717", 100, "P", 211.89, 2], ["R717", 100, "hf", 155.0, 1],
  ["R134a", 0, "hf", 12.2, 1], ["R134a", 0, "hg", 103.1, 1],
  ["R744", 75, "hf", 67.6, 1], ["R744", 75, "hg", 122.6, 1],
];
for (const [k, T, field, exp, dp] of checks) {
  const s = R.sat(k, T);
  ok(!!s, `${k} ${T}F exists`);
  if (s) eqRound(s[field], exp, dp, `${k} ${T}F ${field}`);
}
// psig convention
ok(Math.abs(R.ATM - 14.696) < 1e-12, "psig = psia - 14.696");

// table extent and density (1 F steps)
const ext = { R717: [-60, 120], R134a: [-40, 150], R744: [-60, 87] };
for (const k of Object.keys(ext)) {
  const f = R.fluid(k);
  ok(f.tmin === ext[k][0] && f.tmax === ext[k][1] && f.dt === 1, `${k} table ${ext[k][0]}..${ext[k][1]} F at 1 F`);
  ok(f.sat.P.length === ext[k][1] - ext[k][0] + 1, `${k} has ${ext[k][1] - ext[k][0] + 1} rows`);
  for (const col of ["P", "hf", "hg", "vf", "vg"]) ok(f.sat[col].length === f.sat.P.length, `${k} column ${col}`);
}
// CO2 critical point and no fake saturation rows above it
const co2 = R.fluid("R744");
eqRound(co2.crit.T, 87.8, 1, "CO2 critical temperature");
ok(R.sat("R744", 95) === null && R.sat("R744", 100) === null, "CO2 has no 95 F / 100 F saturation rows");
ok(R.parseState("R744", 95, "F").kind === "supercritical", "CO2 95 F upstream is blocked as transcritical");
ok(R.parseState("R744", 1200, "PSIA").kind === "supercritical", "CO2 1200 psia upstream is blocked");
ok(/gas cooler pressure/.test(R.parseState("R744", 100, "F").msg), "transcritical message names gas cooler pressure + outlet temp");

// the old hand table's errors are gone
ok(Math.abs(R.sat("R717", -5).P - 23.74) > 3, "-5 F is not 23.74 psia (that was -10 F)");
ok(Math.abs(R.sat("R717", 95).P - 197.2) > 1, "95 F is not 197.2 psia (that was 100 F)");
ok(Number(R.sat("R717", 0).hf.toFixed(1)) === 42.9, "0 F hf is 42.9, not 43.8");
ok(R.sat("R134a", 0).hg > 100, "R-134a hg is not ~10 BTU/lb low");

// ---------------------------------------------------------- 2. worked example
console.log("2. Flash gas worked example (85 F liquid to -5 F)");
const up = R.parseState("R717", 85, "F"), dn = R.parseState("R717", -5, "F");
const fg = R.flash("R717", up, dn, 0);
ok(fg.ok, "flash calc runs");
eqRound(fg.x * 100, 17.5, 1, "flash gas %");
eqRound(fg.hIn, 137.6, 1, "h before valve");
eqRound(fg.hf, 37.5, 1, "hf at -5 F");
eqRound(fg.hfg, 572.0, 1, "hfg at -5 F");
eqRound((137.6 - 37.5) / 572.0 * 100, 17.5, 1, "hand math with the page's rounded numbers");
// same example entered as gauge pressures
const upG = R.parseState("R717", 151.7, "PSIG"), dnG = R.parseState("R717", 12.2, "PSIG");
eqRound(upG.T, 85.0, 1, "151.7 psig is 85 F");
eqRound(dnG.T, -5.0, 1, "12.2 psig is -5 F");
eqRound(R.flash("R717", upG, dnG, 0).x * 100, 17.5, 1, "flash % from psig inputs");
eqRound(R.parseState("R717", 9.0, "PSIG").T, -10.0, 0, "9.0 psig is about -10 F (not -5 F)");

// ---------------------------------------------------------- 3. validation
console.log("3. Input validation");
ok(!R.flash("R717", dn, up, 0).ok, "evap above cond is rejected");
ok(R.parseState("R717", 130, "F").kind === "range", "130 F ammonia warns (out of table), no clamping");
ok(R.parseState("R717", -70, "F").kind === "range", "-70 F ammonia warns (out of table)");
ok(R.parseState("R717", 400, "PSIG").kind === "range", "400 psig ammonia warns (out of table)");
ok(R.flash("R717", up, dn, -2).ok === false, "negative subcooling rejected");
const sub = R.flash("R717", up, dn, 3.6);
ok(sub.ok && sub.x < fg.x, "subcooling lowers flash gas");

// ------------------------------------------------------ 4. interpolation
console.log("4. Interpolation vs exact CoolProp at off-grid points");
const tol = {
  R717: { h2: 0.6, T2: 1.0, tph: 1.5 },
  R134a: { h2: 0.15, T2: 0.6, tph: 1.5 },
  R744: { h2: 0.3, T2: 1.0, tph: 2.5 },
};
for (const k of Object.keys(refs.fluids)) {
  const rf = refs.fluids[k];
  let eP = 0, eH = 0, eVg = 0, eVf = 0, eT = 0, eH2 = 0, eT2 = 0, eTph = 0;
  for (const p of rf.sat) {
    const s = R.sat(k, p.T);
    eP = Math.max(eP, Math.abs(s.P / p.P - 1));
    eH = Math.max(eH, Math.abs(s.hf - p.hf), Math.abs(s.hg - p.hg));
    eVg = Math.max(eVg, Math.abs(s.vg / p.vg - 1));
    eVf = Math.max(eVf, Math.abs(s.vf / p.vf - 1));
  }
  for (const p of rf.tsat) eT = Math.max(eT, Math.abs(R.tsat(k, p.P) - p.T));
  for (const p of rf.isen) {
    const c = R.sat(k, p.Tc), s = R.isen(k, p.Te, c.P);
    eH2 = Math.max(eH2, Math.abs(s.h - p.h2));
    eT2 = Math.max(eT2, Math.abs(s.T - p.T2));
  }
  let nT = 0;
  for (const p of rf.tph) {
    const t = R.tAtPH(k, p.P, p.h);
    if (!t) continue;
    nT++;
    eTph = Math.max(eTph, Math.abs(t.T - p.T));
  }
  console.log(`   ${k.padEnd(6)} P ${(eP * 100).toFixed(4)}%  h ${eH.toFixed(3)}  vg ${(eVg * 100).toFixed(3)}%  ` +
    `vf ${(eVf * 100).toFixed(4)}%  Tsat ${eT.toFixed(4)}F  h2 ${eH2.toFixed(3)}  T2 ${eT2.toFixed(2)}F  T(P,h) ${eTph.toFixed(2)}F (${nT} pts)`);
  ok(eP < 0.0005, `${k} saturation P within 0.05%`);
  ok(eH < 0.05, `${k} hf/hg within 0.05 BTU/lb`);
  ok(eVg < 0.002 && eVf < 0.001, `${k} specific volumes within 0.2%`);
  ok(eT < 0.01, `${k} Tsat(P) within 0.01 F`);
  ok(eH2 < tol[k].h2, `${k} isentropic discharge h within ${tol[k].h2} BTU/lb`);
  ok(eT2 < tol[k].T2, `${k} isentropic discharge T within ${tol[k].T2} F`);
  ok(nT >= 30 && eTph < tol[k].tph, `${k} chart hover T(P,h) within ${tol[k].tph} F`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
