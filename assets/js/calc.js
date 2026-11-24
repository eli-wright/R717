/* R-717 Training — recirculated system sizing calculator (Module 08). */
(function () {
  "use strict";
  var C = window.R717, R = window.R717Props;

  C.register("calc", function () {
    var $ = function (id) { return document.getElementById(id); };
    var form = $("szForm");
    if (!form) return;
    var inputs = ["szFluid", "szTR", "szTe", "szTl", "szN", "szK"].map($);
    var out = $("szOut"), msg = $("szMsg");
    var DEF = { R717: [-20, 85], R134a: [0, 95], R744: [-40, 15] };

    function row(k, v, unit, work, hi) {
      return '<div class="cr' + (hi ? " hi" : "") + '"><span class="k">' + k + '</span><span class="v">' + v +
        (unit ? "<small>" + unit + "</small>" : "") + "</span>" + (work ? '<span class="w">' + work + "</span>" : "") + "</div>";
    }
    function run() {
      var F = C.fmt, k = $("szFluid").value, f = R.fluid(k);
      var TR = parseFloat($("szTR").value), Te = parseFloat($("szTe").value), Tl = parseFloat($("szTl").value);
      var N = parseFloat($("szN").value), K = parseFloat($("szK").value);
      var errs = [];
      if (!(TR > 0)) errs.push("Load must be above 0 TR.");
      var se = R.parseState(k, Te, "F"), sl = R.parseState(k, Tl, "F");
      if (!se.ok) errs.push("Evaporating temperature: " + se.msg);
      if (!sl.ok) errs.push("Make-up liquid temperature: " + sl.msg);
      if (!(N >= 1)) errs.push("Overfeed ratio must be 1 or more.");
      if (!(K > 0)) errs.push("K must be above 0 ft/s.");
      msg.className = "msg";
      if (errs.length) { msg.classList.add("err"); msg.textContent = errs.join(" "); out.innerHTML = ""; return; }
      var r = R.sizing(k, TR, Te, Tl, N, K), e = r.e, l = r.l;
      msg.textContent = "";
      if (Tl <= Te) { msg.classList.add("info"); msg.textContent = "The make-up liquid is colder than the evaporator, so it does not flash. That is unusual; check the inputs."; }
      out.innerHTML = [
        row("Load", F(r.Q, 0), "BTU/min", F(TR, TR % 1 ? 1 : 0) + " TR × 200 BTU/min per TR"),
        row("Evaporator saturation", F(e.psig, 1), "psig", F(Te, 1) + "°F · " + F(e.P, 2) + " psia · hf " + F(e.hf, 1) + " · hg " + F(e.hg, 1) + " · hfg " + F(e.hfg, 1) + " BTU/lb"),
        row("Densities", F(e.rhoL, 2) + " / " + F(e.rhoV, 4), "lb/ft³", "liquid ρL / vapor ρV at " + F(Te, 1) + "°F · vapor volume vg = " + F(e.vg, 3) + " ft³/lb"),
        row("Boiled in the coils", F(r.mEvap, 2), "lb/min", F(r.Q, 0) + " ÷ (" + F(e.hg, 1) + " − " + F(e.hf, 1) + ")", true),
        row("Vapor to the compressors", F(r.mSuc, 2), "lb/min", F(r.Q, 0) + " ÷ (" + F(e.hg, 1) + " − " + F(l.hf, 1) + ") · make-up liquid at " + F(Tl, 0) + "°F (hf " + F(l.hf, 1) + "), includes " + F(r.mFlash, 2) + " lb/min flash gas"),
        row("Pumped liquid", F(r.mPump, 2), "lb/min", F(N, N % 1 ? 1 : 0) + " × " + F(r.mEvap, 2) + " · " + F(r.mLiqReturn, 2) + " lb/min returns as liquid"),
        row("Pump flow", F(r.gpm, 1), "GPM", "(" + F(r.mPump, 2) + " ÷ " + F(e.rhoL, 2) + ") × 7.48", true),
        row("Suction vapor flow", F(r.acfm, 0), "ACFM", F(r.mSuc, 2) + " lb/min × " + F(e.vg, 3) + " ft³/lb", true),
        row("Max separation velocity", F(r.v, 2), "ft/s", F(K, 2) + " × √((" + F(e.rhoL, 2) + " − " + F(e.rhoV, 4) + ") ÷ " + F(e.rhoV, 4) + ")"),
        row("Min vapor flow area", F(r.A, 2), "ft²", F(r.acfm, 0) + " ÷ (60 × " + F(r.v, 2) + ")"),
        row("Vertical vessel, min ID", F(r.Din, 1), "in", "√(4 × " + F(r.A, 2) + " ÷ π) = " + F(r.D, 2) + " ft", true)
      ].join("") + '<p class="cite" style="margin-top:6px">First-pass numbers for learning. Real vessel sizing also covers liquid hold-up and surge volume, nozzle velocities, level control and the governing codes.</p>';
    }
    var t = 0;
    inputs.forEach(function (i) { i.addEventListener("input", function () { clearTimeout(t); t = setTimeout(run, 100); }); });
    $("szFluid").addEventListener("change", function () { var d = DEF[$("szFluid").value]; $("szTe").value = d[0]; $("szTl").value = d[1]; run(); });
    run();

    // emergency ventilation quick check (Module 07): 30 air changes per hour
    var vl = $("ventL"), vw = $("ventW"), vh = $("ventH");
    function vent() {
      var V = parseFloat(vl.value) * parseFloat(vw.value) * parseFloat(vh.value);
      if (!(V > 0)) { $("ventOut").textContent = "—"; $("ventVol").textContent = "Enter the room size"; return; }
      $("ventOut").textContent = C.fmt(V * 30 / 60, 0) + " cfm";
      $("ventVol").textContent = C.fmt(V, 0) + " ft³ gross volume × 30 ÷ 60";
    }
    [vl, vw, vh].forEach(function (i) { i.addEventListener("input", vent); });
    vent();
  });
})();
