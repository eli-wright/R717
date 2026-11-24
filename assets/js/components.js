/* R-717 Training — component cards with animated cutaways, and a detail dialog. */
(function () {
  "use strict";
  var C = window.R717;
  var uid = 0;

  // ------------------------------------------------- cutaway primitives
  function wave(x, y, w, h, color) {
    var d = "M" + (x - 40) + " " + y;
    for (var i = x - 40; i < x + w + 60; i += 20) d += "q5 -3 10 0t10 0";
    d += "V" + (y + h) + "H" + (x - 40) + "Z";
    return '<path class="cut-wave" d="' + d + '" fill="' + (color || "url(#liqGrad)") + '"/>';
  }
  function hcap(x, y, w, h) { var r = h / 2; return "M" + (x + r) + " " + y + "H" + (x + w - r) + "a" + r + " " + r + " 0 0 1 0 " + h + "H" + (x + r) + "a" + r + " " + r + " 0 0 1 0 " + (-h) + "Z"; }
  function vcap(x, y, w, h) { var r = w / 2; return "M" + x + " " + (y + r) + "a" + r + " " + r + " 0 0 1 " + w + " 0V" + (y + h - r) + "a" + r + " " + r + " 0 0 1 " + (-w) + " 0Z"; }
  function vessel(shape, x, y, w, h, level, inner, liquid) {
    var id = "cv" + (++uid), path = shape === "h" ? hcap : vcap, d = 4;
    var ip = path(x + d, y + d, w - 2 * d, h - 2 * d), ly = y + d + (h - 2 * d) * (1 - level);
    return '<path class="cut-shell" d="' + path(x, y, w, h) + '"/>' +
      '<clipPath id="' + id + '"><path d="' + ip + '"/></clipPath>' +
      '<path class="cut-inner" d="' + ip + '"/>' +
      '<g clip-path="url(#' + id + ')">' + (level > 0 ? wave(x, ly, w, h, liquid) : "") + (inner || "") + "</g>" +
      '<path d="' + path(x, y, w, h) + '" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1" transform="translate(0 1.5)"/>';
  }
  function pipe(d, color, flow) {
    return '<path d="' + d + '" fill="none" stroke="#1c2f4a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (flow ? ' class="cut-flow"' : "") + "/>";
  }
  function drops(x0, x1, y, dy, n, color, r) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = x0 + (x1 - x0) * (i + 0.5) / n;
      s += '<circle class="cut-drop" cx="' + x.toFixed(1) + '" cy="' + y + '" r="' + (r || 1.8) + '" fill="' + (color || "#8fc0ff") + '" style="--dy:' + dy + 'px;animation-delay:' + (i * 0.37).toFixed(2) + 's"/>';
    }
    return s;
  }
  function bubbles(x0, x1, y, dy, n, r) {
    var s = "";
    for (var i = 0; i < n; i++) {
      var x = x0 + (x1 - x0) * ((i * 0.618) % 1);
      s += '<circle class="cut-bub" cx="' + x.toFixed(1) + '" cy="' + y + '" r="' + (r || 2.2) + '" fill="none" stroke="#eaf6ff" stroke-opacity=".8" style="--dy:' + dy + 'px;animation-delay:' + (i * 0.43).toFixed(2) + 's"/>';
    }
    return s;
  }
  function impeller(cx, cy, r, cls) {
    var s = '<g class="cut-spin ' + (cls || "fast") + '">';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, b = a + 0.9;
      s += '<path d="M' + cx + " " + cy + "Q" + (cx + Math.cos(b) * r * .7).toFixed(1) + " " + (cy + Math.sin(b) * r * .7).toFixed(1) + " " + (cx + Math.cos(a) * r).toFixed(1) + " " + (cy + Math.sin(a) * r).toFixed(1) + '" stroke="#9fd6ff" stroke-width="1.6" fill="none"/>';
    }
    return s + '<circle cx="' + cx + '" cy="' + cy + '" r="2.5" fill="#cfe8ff"/></g>';
  }
  function rotor(cx, cy, r, lobes, rev) {
    var d = "";
    for (var i = 0; i <= 60; i++) {
      var a = i / 60 * Math.PI * 2, rr = r * (0.76 + 0.24 * Math.cos(lobes * a));
      d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return '<g class="cut-spin' + (rev ? " rev" : "") + '"><path d="' + d + 'Z" fill="rgba(159,214,255,.16)" stroke="rgba(200,225,250,.75)" stroke-width="1.2"/><circle cx="' + cx + '" cy="' + cy + '" r="2.5" fill="#cfe8ff"/></g>';
  }
  function label(x, y, t, a) { return '<text x="' + x + '" y="' + y + '" text-anchor="' + (a || "middle") + '" class="svg-sub" style="font-size:6.6px;letter-spacing:.02em">' + t + "</text>"; }
  var LIQ = "#5b95ff", TWO = "#45dbe8", VAP = "#eef6ff", HOT = "#ffae4f";

  var VIZ = {
    hpr: function (big) {
      return pipe("M60 8V36", TWO, 1) + pipe("M140 92V114", LIQ, 1) + vessel("h", 24, 34, 152, 60, 0.58) +
        (big ? label(60, 6, "from condenser", "start") + label(144, 118, "liquid to valves", "start") : "");
    },
    accumulator: function (big) {
      return pipe("M30 40H76", TWO, 1) + pipe("M100 10V2", VAP, 1) + pipe("M100 112V118", LIQ, 0) +
        vessel("v", 76, 8, 48, 104, 0.2, drops(86, 114, 44, 42, 4, "#8fc0ff", 2)) +
        (big ? label(26, 34, "suction in", "start") + label(108, 6, "dry vapor out", "start") : "");
    },
    recirculator: function (big) {
      return pipe("M52 6V22", TWO, 1) + pipe("M150 22V6", VAP, 1) + pipe("M100 74V88", LIQ, 0) + pipe("M114 102H178", LIQ, 1) +
        vessel("h", 22, 18, 156, 58, 0.42, drops(48, 64, 30, 18, 2, "#8fc0ff")) +
        '<circle cx="100" cy="102" r="13" fill="#0a1627" stroke="rgba(200,220,245,.6)" stroke-width="1.4"/>' + impeller(100, 102, 10) +
        (big ? label(40, 4, "wet return", "end") + label(156, 4, "to compressors", "start") + label(180, 112, "to evaporators", "end") : "");
    },
    intercooler: function (big) {
      var coil = '<path d="M84 96h32l-32-8h32l-32-8h32" fill="none" stroke="' + LIQ + '" stroke-width="2" stroke-opacity=".9"/>';
      return pipe("M30 92H84", HOT, 1) + pipe("M100 10V2", VAP, 1) +
        vessel("v", 76, 8, 48, 104, 0.48, coil + bubbles(84, 116, 102, -40, 5, 2)) +
        (big ? label(26, 86, "booster gas", "start") + label(108, 6, "to high stage", "start") : "");
    },
    economizer: function (big) {
      return pipe("M20 70H48", LIQ, 1) + pipe("M152 70H182", LIQ, 1) + pipe("M100 40V8", VAP, 1) +
        vessel("h", 48, 40, 104, 56, 0.5, bubbles(64, 136, 86, -28, 6, 2)) +
        (big ? label(20, 64, "liquid in", "start") + label(182, 64, "subcooled liquid", "end") + label(106, 6, "flash vapor to side port", "start") : "");
    },
    surge: function (big) {
      var coil = '<rect x="50" y="78" width="100" height="34" rx="6" fill="#06101e" stroke="rgba(200,220,245,.4)"/><path d="M58 88h84v14H58" fill="none" stroke="#22395a" stroke-width="4"/>';
      return pipe("M64 44V80", LIQ, 1) + pipe("M136 80V44", TWO, 1) + pipe("M176 20H196", VAP, 1) + coil +
        vessel("h", 30, 4, 140, 42, 0.5) + (big ? label(198, 14, "dry suction", "end") + label(100, 122, "flooded evaporator") : "");
    },
    cpr: function (big) {
      return pipe("M60 8V34", LIQ, 1) + pipe("M140 92V116", LIQ, 1) + vessel("h", 24, 34, 152, 58, 0.5) +
        '<circle cx="122" cy="18" r="13" fill="#0a1627" stroke="rgba(200,220,245,.6)"/><path d="M122 34V31" stroke="rgba(200,220,245,.6)" stroke-width="3"/>' +
        '<g class="cut-needle" style="transform-origin:122px 18px"><path d="M122 18l7-6" stroke="' + HOT + '" stroke-width="1.8" stroke-linecap="round"/></g>' +
        (big ? label(56, 6, "liquid in", "end") + label(146, 118, "steady-pressure liquid out", "start") : "");
    },
    thermosyphon: function (big) {
      var hx = '<rect x="130" y="80" width="54" height="30" rx="6" fill="#06101e" stroke="rgba(200,220,245,.45)"/><path d="M136 88h42M136 95h42M136 102h42" stroke="' + HOT + '" stroke-opacity=".55"/>';
      return pipe("M60 62V100H130", LIQ, 1) + pipe("M184 92H192V36H150", TWO, 1) + hx +
        vessel("h", 20, 8, 140, 56, 0.55) + '<g>' + bubbles(188, 196, 90, -46, 3, 1.8) + "</g>" +
        (big ? label(157, 76, "oil cooler") + label(196, 30, "vapor + liquid back", "end") : "");
    },
    oilSeparator: function (big) {
      var mist = drops(40, 120, 40, 30, 6, "#e0a34f", 1.6);
      var pad = '<rect x="132" y="38" width="14" height="36" rx="2" fill="url(#steel)" stroke="rgba(200,220,245,.5)" stroke-dasharray="2 2"/>';
      return pipe("M8 50H24", HOT, 1) + pipe("M176 50H196", HOT, 1) + pipe("M100 92V112", "#e0a34f", 1) +
        vessel("h", 22, 24, 156, 70, 0.18, mist + pad, "url(#oilGrad)") +
        (big ? label(8, 44, "hot gas + oil", "start") + label(196, 44, "clean gas", "end") + label(106, 116, "oil back to compressor", "start") : "");
    },
    compressor: function (big) {
      return pipe("M14 60H32", VAP, 1) + pipe("M168 44H190", HOT, 1) +
        '<rect x="30" y="22" width="140" height="78" rx="16" class="cut-shell"/><rect x="38" y="30" width="124" height="62" rx="12" class="cut-inner"/>' +
        rotor(82, 61, 26, 4, false) + rotor(124, 61, 22, 6, true) +
        (big ? label(12, 54, "suction", "start") + label(190, 38, "discharge", "end") : "");
    },
    pump: function (big) {
      return pipe("M14 70H72", LIQ, 1) + pipe("M100 34V8H190", LIQ, 1) +
        '<circle cx="100" cy="66" r="34" class="cut-shell"/><circle cx="100" cy="66" r="28" class="cut-inner"/>' + impeller(100, 66, 24) +
        '<rect x="134" y="52" width="48" height="28" rx="6" fill="url(#steel)" stroke="rgba(200,220,245,.45)"/>' +
        (big ? label(14, 64, "liquid in", "start") + label(190, 20, "to evaporators", "end") + label(158, 92, "canned motor") : "");
    }
  };
  function svgFor(key, big) {
    return '<svg viewBox="' + (big ? "-36 -22 272 168" : "0 0 200 124") + '" aria-hidden="true" focusable="false">' + VIZ[key](big) + "</svg>";
  }

  // ------------------------------------------------- dialog content
  var DETAIL = {
    hpr: { t: "High-pressure receiver (HPR)", d: "Stores the high-pressure liquid that drains from the condenser. It is the buffer for the system charge: as loads, defrosts and seasons change, the liquid level here rises and falls. It keeps a steady supply of liquid for the expansion valves and for the make-up feed to recirculators.", f: [["Where", "High side, after the condenser."], ["State inside", "Saturated liquid with vapor above it."], ["Watch for", "Liquid level, and liquid-line flashing from pressure drop or heat gain."]] },
    accumulator: { t: "Accumulator (suction trap)", d: "Sits in the suction line ahead of the compressors. It slows the vapor so droplets fall out, and holds any liquid that comes back from the evaporators — after a defrost or a load change, for example. This protects the compressors from liquid slugging. Collected liquid is boiled off or transferred back into the system.", f: [["Where", "Low side, compressor suction."], ["State inside", "Vapor, with some liquid at the bottom."], ["Watch for", "High-level alarms. Oil collects here too and is drained from its oil pot."]] },
    recirculator: { t: "Recirculator package", d: "The heart of a liquid overfeed system. A low-pressure vessel holds cold liquid. Pumps send it to the evaporators at two to four times the rate that boils off. The wet mixture returns to the vessel, where the liquid drops out and dry vapor goes to the compressors. A level control feeds make-up liquid from the high side.", f: [["Where", "Low side, between the evaporators and the compressors."], ["Typical overfeed", "2:1 to 4:1."], ["Watch for", "Level control, pump NPSH, and oil drained from its oil pot."]] },
    intercooler: { t: "Intercooler", d: "Typically used in two-stage systems, between the low-stage (booster) and high-stage compressors. It desuperheats the booster discharge gas, which saves high-stage power, and it usually subcools the liquid going to the low-temperature evaporators too.<ul class=\"clean\"><li><b>Flash type:</b> liquid is fed into the vessel and boils at the intermediate pressure. The booster gas bubbles through or mixes with it and is cooled close to saturation.</li><li><b>Shell-and-coil type:</b> high-pressure liquid flows through a coil sitting in the boiling intermediate liquid. It is subcooled without dropping its pressure, so it can travel to distant evaporators without flashing.</li></ul>", f: [["Where", "Between booster and high-stage compressors."], ["Pressure", "Intermediate."], ["Saves", "High-stage power, and flash gas at the low-stage evaporators."]] },
    economizer: { t: "Economizer", d: "Flashes part of the high-pressure liquid at an intermediate pressure. That cools the rest of the liquid, so less flash gas forms at the evaporator valves and each pound does more cooling. On a screw compressor the flash vapor goes to a side (economizer) port partway through compression, where it takes less energy to compress.", f: [["Where", "In the liquid line, tied to a screw compressor's side port."], ["Effect", "Subcools the main liquid."], ["Best when", "The lift between condensing and evaporating is large."]] },
    surge: { t: "Surge drum", d: "Sits above or beside a flooded evaporator, often a chiller. Liquid flows down to the evaporator by gravity, boils, and the vapor-liquid mix rises back to the drum. The drum separates the vapor from the liquid, sends dry vapor to suction, and holds a level that keeps the evaporator flooded. Its volume also absorbs surges when the load changes.", f: [["Where", "Low side, right at the evaporator it serves."], ["Feed", "Float or level control."], ["Watch for", "Oil collects at the low point and must be drained."]] },
    cpr: { t: "Controlled pressure receiver (CPR)", d: "A receiver held at a steady, controlled pressure that is lower than the condensing pressure. It feeds liquid to the evaporators at a stable pressure, no matter how the condensing pressure swings with the weather. Many systems also send hot gas defrost condensate to it.", f: [["Where", "Between the high side and the evaporators."], ["Pressure", "Controlled, below condensing."], ["Benefit", "Steady liquid feed and a place for defrost condensate."]] },
    thermosyphon: { t: "Thermosyphon receiver", d: "A receiver, or a section of one, that gives liquid first priority to the thermosyphon oil coolers on screw compressors. Liquid flows down by gravity to the oil cooler, boils as it takes heat from the oil, and the lighter vapor-liquid mix rises back to the receiver. The vapor goes on to the condenser. No pump is needed.", f: [["Where", "High side, below the condenser and above the oil coolers."], ["Moves by", "Gravity and boiling (thermosyphon)."], ["Heat goes to", "The condenser."]] },
    oilSeparator: { t: "Oil separator", d: "On the compressor discharge. It catches oil mist from the hot gas — by slowing the gas, changing its direction and using coalescing elements for the finest droplets — and returns the oil to the compressor. Good separation keeps oil off condenser and evaporator surfaces, where it insulates and cuts heat transfer.", f: [["Where", "Compressor discharge, before the condenser."], ["State", "Hot, superheated gas."], ["Watch for", "Oil level and element condition. Oil that gets past ends up in the low side."]] },
    compressor: { t: "Screw compressor", d: "The workhorse of large ammonia plants. Two meshing rotors trap vapor and squeeze it as it moves along the rotors. Oil is injected to seal, lubricate and cool, so the discharge runs much cooler than a reciprocating compressor at the same conditions. The oil is then removed by the oil separator and cooled in an oil cooler. Capacity is controlled with a slide valve, variable speed, or both.", f: [["Takes in", "Low-pressure vapor."], ["Puts out", "Hot, high-pressure gas with oil mist."], ["Must never get", "Liquid. That is what accumulators and recirculators prevent."]] },
    pump: { t: "Refrigerant pump", d: "Moves cold liquid from the recirculator to the evaporators. The liquid in the vessel is saturated, so the only margin against flashing at the pump inlet is the liquid height above the pump (NPSH). Sealless canned-motor pumps are common because there is no shaft seal to leak.", f: [["Where", "Below the recirculator vessel."], ["Needs", "Enough liquid height above the inlet, and short, full-size suction piping."], ["Watch for", "Cavitation noise and unsteady pump pressure."]] }
  };

  C.register("components", function () {
    var cards = C.$$("#compGrid .comp-card");
    if (!cards.length) return;
    cards.forEach(function (c) { c.querySelector(".viz").innerHTML = svgFor(c.dataset.comp, false); });
    var dlg = document.getElementById("compDialog"), viz = document.getElementById("cdViz"), body = document.getElementById("cdBody");
    var opener = null;
    function open(card) {
      var k = card.dataset.comp, d = DETAIL[k];
      opener = card;
      viz.innerHTML = svgFor(k, true);
      body.innerHTML = '<span class="card-tag">Component</span><h3 id="cdTitle">' + d.t + '</h3><div class="muted">' + d.d + '</div><div class="cd-facts">' +
        d.f.map(function (x) { return "<div><b>" + x[0] + "</b>" + x[1] + "</div>"; }).join("") + "</div>";
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
      if (!C.Motion.reduced && dlg.animate) {
        var a = card.getBoundingClientRect(), b = dlg.getBoundingClientRect();
        var sx = a.width / b.width, sy = a.height / b.height, dx = (a.left + a.width / 2) - (b.left + b.width / 2), dy = (a.top + a.height / 2) - (b.top + b.height / 2);
        dlg.animate([{ transform: "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")", opacity: 0.4, borderRadius: "18px" }, { transform: "none", opacity: 1 }],
          { duration: 480, easing: "cubic-bezier(.16,1,.3,1)" });
        body.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 160, easing: "ease-out", fill: "backwards" });
      }
      document.getElementById("cdClose").focus();
    }
    function close() {
      var done = function () { if (dlg.open) dlg.close(); if (opener) opener.focus(); };
      if (!C.Motion.reduced && dlg.animate && opener) {
        var a = opener.getBoundingClientRect(), b = dlg.getBoundingClientRect();
        var an = dlg.animate([{ transform: "none", opacity: 1 }, { transform: "translate(" + ((a.left + a.width / 2) - (b.left + b.width / 2)) + "px," + ((a.top + a.height / 2) - (b.top + b.height / 2)) + "px) scale(" + (a.width / b.width) + "," + (a.height / b.height) + ")", opacity: 0 }],
          { duration: 300, easing: "cubic-bezier(.5,0,.75,0)" });
        an.onfinish = done;
      } else done();
    }
    cards.forEach(function (c) { c.addEventListener("click", function () { open(c); }); });
    document.getElementById("cdClose").addEventListener("click", close);
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
  });

  window.R717Cutaway = svgFor;
})();
