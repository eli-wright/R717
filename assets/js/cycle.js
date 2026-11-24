/* R-717 Training — animated refrigeration cycle (SVG schematic + canvas particles). */
(function () {
  "use strict";
  var C = window.R717, R = window.R717Props;
  var NS = "http://www.w3.org/2000/svg";
  var RGB = { liquid: [91, 149, 255], two: [69, 219, 232], vapor: [238, 246, 255], hot: [255, 174, 79] };
  var SPEED = { liquid: 34, two: 82, vapor: 128, hot: 128 };

  // ------------------------------------------------------------- layouts
  var LAYOUTS = {
    wide: {
      W: 1000, H: 600, fs: 16, fss: 12,
      comps: {
        comp: { x: 765, y: 405, w: 150, h: 90, lx: 840, ly: 566, la: "middle" },
        osep: { x: 805, y: 155, w: 70, h: 150, lx: 790, ly: 226, la: "end" },
        cond: { x: 410, y: 45, w: 280, h: 100, lx: 550, ly: 174, la: "middle" },
        rec: { x: 140, y: 129, w: 180, h: 62, lx: 230, ly: 104, la: "middle" },
        exv: { x: 98, y: 282, w: 44, h: 36, lx: 170, ly: 296, la: "start" },
        evap: { x: 380, y: 440, w: 300, h: 100, lx: 530, ly: 410, la: "middle" }
      },
      divider: { x1: 330, x2: 760, y: 300, lx: 760 },
      segs: [
        { id: "A", pts: [[840, 405], [840, 305]], stops: [[0, "hot"]] },
        { id: "B", pts: [[840, 155], [840, 68], [690, 68]], stops: [[0, "hot"]] },
        { id: "C", coil: 1, pts: [[690, 68], [425, 68], [425, 95], [675, 95], [675, 122], [410, 122]], stops: [[0, "hot"], [0.24, "two"], [0.82, "two"], [1, "liquid"]] },
        { id: "D", pts: [[410, 122], [350, 122], [350, 152], [318, 152]], stops: [[0, "liquid"]] },
        { id: "E", hidden: 1, pts: [[318, 152], [262, 170], [230, 180], [230, 191]], stops: [[0, "liquid"]] },
        { id: "F", pts: [[230, 191], [230, 232], [120, 232], [120, 282]], stops: [[0, "liquid"]] },
        { id: "G", hidden: 1, pts: [[120, 282], [120, 318]], stops: [[0, "liquid"], [1, "two"]] },
        { id: "H", pts: [[120, 318], [120, 465], [392, 465]], stops: [[0, "two"]] },
        { id: "I", coil: 1, pts: [[392, 465], [668, 465], [668, 490], [392, 490], [392, 515], [668, 515], [690, 515]], stops: [[0, "two"], [0.3, "two"], [1, "vapor"]] },
        { id: "J", pts: [[690, 515], [840, 515], [840, 495]], stops: [[0, "vapor"]] },
        { id: "K", hidden: 1, pts: [[840, 495], [840, 405]], stops: [[0, "vapor"], [1, "hot"]] }
      ]
    },
    tall: {
      W: 600, H: 900, fs: 24, fss: 17,
      comps: {
        comp: { x: 435, y: 600, w: 130, h: 80, lx: 424, ly: 632, la: "end" },
        osep: { x: 468, y: 310, w: 64, h: 140, lx: 450, ly: 374, la: "end" },
        cond: { x: 140, y: 55, w: 300, h: 100, lx: 290, ly: 190, la: "middle" },
        rec: { x: 100, y: 232, w: 180, h: 56, lx: 296, ly: 252, la: "start" },
        exv: { x: 70, y: 409, w: 40, h: 32, lx: 134, ly: 422, la: "start" },
        evap: { x: 140, y: 730, w: 300, h: 100, lx: 290, ly: 690, la: "middle" }
      },
      divider: { x1: 330, x2: 445, y: 425, lx: 445 },
      segs: [
        { id: "A", pts: [[500, 600], [500, 450]], stops: [[0, "hot"]] },
        { id: "B", pts: [[500, 310], [500, 78], [440, 78]], stops: [[0, "hot"]] },
        { id: "C", coil: 1, pts: [[440, 78], [155, 78], [155, 105], [425, 105], [425, 132], [140, 132]], stops: [[0, "hot"], [0.24, "two"], [0.82, "two"], [1, "liquid"]] },
        { id: "D", pts: [[140, 132], [78, 132], [78, 255], [102, 255]], stops: [[0, "liquid"]] },
        { id: "E", hidden: 1, pts: [[102, 255], [160, 270], [190, 279], [190, 288]], stops: [[0, "liquid"]] },
        { id: "F", pts: [[190, 288], [190, 350], [90, 350], [90, 409]], stops: [[0, "liquid"]] },
        { id: "G", hidden: 1, pts: [[90, 409], [90, 441]], stops: [[0, "liquid"], [1, "two"]] },
        { id: "H", pts: [[90, 441], [90, 752], [155, 752]], stops: [[0, "two"]] },
        { id: "I", coil: 1, pts: [[155, 752], [425, 752], [425, 780], [155, 780], [155, 808], [425, 808], [450, 808]], stops: [[0, "two"], [0.3, "two"], [1, "vapor"]] },
        { id: "J", pts: [[450, 808], [500, 808], [500, 680]], stops: [[0, "vapor"]] },
        { id: "K", hidden: 1, pts: [[500, 680], [500, 600]], stops: [[0, "vapor"], [1, "hot"]] }
      ]
    }
  };

  var NAMES = {
    comp: ["Compressor", "Vapor → hot gas"],
    osep: ["Oil separator", "Catches oil mist"],
    cond: ["Condenser", "Hot gas → liquid"],
    rec: ["Receiver", "Stores liquid"],
    exv: ["Expansion valve", "Pressure drops"],
    evap: ["Evaporator", "Liquid boils → vapor"]
  };
  var ORDER = ["comp", "osep", "cond", "rec", "exv", "evap"];

  function stepInfo() {
    var ex = R.cycle("R717", -5, 85, 0), lo = R.sat("R717", -5), hi = R.sat("R717", 85), h5 = R.sat("R717", 5);
    var F = C.fmt;
    return {
      comp: { n: "01", inS: "vapor", outS: "hot", title: "Compressor",
        lead: "Pulls in cold, low-pressure vapor and squeezes it. Pressure and temperature both go up.",
        body: "The compressor creates the pressure difference between the low side and the high side. It raises the pressure until the gas can condense at a temperature above the air or water that cools the condenser. Screw compressors are the most common type in large ammonia plants; reciprocating compressors are also used.",
        formula: "Work per pound = h₂ − h₁",
        ex: "Example: −5°F suction (" + F(lo.psig, 1) + " psig) to 85°F condensing (" + F(hi.psig, 1) + " psig). Ideal (isentropic) compression gives about " + F(ex.T2, 0) + "°F discharge gas. Oil-injected screw compressors run much cooler because the oil carries heat away." },
      osep: { n: "02", inS: "hot", outS: "hot", title: "Oil separator",
        lead: "Removes oil mist from the hot discharge gas and sends it back to the compressor.",
        body: "Compressors need oil, and some leaves with the discharge gas. The separator slows the gas and catches the oil by changing its direction, by impact and with coalescing elements. A little still gets past. In an ammonia system that oil does not mix with the ammonia; it sinks and collects in low-side vessels, where it is drained from oil pots.",
        formula: null, ex: null },
      cond: { n: "03", inS: "hot", outS: "liquid", title: "Condenser",
        lead: "Rejects heat to air or water. The gas cools, condenses to liquid and may subcool.",
        body: "Three things happen in order. First the hot gas desuperheats: its temperature drops at constant pressure until it reaches the saturation temperature. Then it condenses at constant temperature, giving up its latent heat. Finally the liquid may subcool a few degrees below saturation. Evaporative condensers are the most common type on large ammonia plants.",
        formula: "Heat rejected = h₂ − h₃ (heat absorbed + compressor work)",
        ex: "At 85°F, ammonia condenses at " + F(hi.psig, 1) + " psig." },
      rec: { n: "04", inS: "liquid", outS: "liquid", title: "High-pressure receiver",
        lead: "Stores liquid and absorbs swings in the system charge.",
        body: "Liquid drains from the condenser into the receiver. The receiver gives the charge somewhere to go as loads, defrosts and seasons change, and keeps a steady supply of liquid for the expansion devices. The liquid is saturated at receiver pressure, so pressure drop or heat gain in the liquid line can make some of it flash before the valve.",
        formula: null, ex: null },
      exv: { n: "05", inS: "liquid", outS: "two", title: "Expansion valve",
        lead: "Drops the pressure. Part of the liquid flashes to vapor and chills the rest.",
        body: "The valve is a restriction: high pressure in, low pressure out. No heat is added or removed and no work is done, so the enthalpy stays the same — a straight vertical drop on the P-h diagram. At the lower pressure the boiling point is far lower, so some liquid boils at once (flash gas), and that boiling cools the rest to the evaporator temperature.",
        formula: "h₃ = h₄ (constant enthalpy)",
        ex: "85°F liquid expanded to −5°F: " + F(ex.x4 * 100, 1) + "% flashes to vapor." },
      evap: { n: "06", inS: "two", outS: "vapor", title: "Evaporator",
        lead: "Absorbs heat from the room or process. The liquid boils at a steady low temperature.",
        body: "Cold liquid boils as it picks up heat from air, glycol, brine or product. While it boils, the pressure and temperature stay nearly constant. The vapor then returns toward the compressor, usually through an accumulator or recirculator vessel that removes any liquid.",
        formula: "Refrigeration effect = h₁ − h₄",
        ex: "Ammonia absorbs about " + F(h5.hfg, 0) + " BTU/lb when it boils at 5°F." }
    };
  }
  var STATE_LABEL = { liquid: "Liquid", two: "Liquid + vapor", vapor: "Vapor", hot: "Hot gas" };

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function pts2d(p) { return p.map(function (q, i) { return (i ? "L" : "M") + q[0] + " " + q[1]; }).join(""); }

  // ------------------------------------------------------------- art
  function capsuleH(b) { var r = b.h / 2; return "M" + (b.x + r) + " " + b.y + "H" + (b.x + b.w - r) + "A" + r + " " + r + " 0 0 1 " + (b.x + b.w - r) + " " + (b.y + b.h) + "H" + (b.x + r) + "A" + r + " " + r + " 0 0 1 " + (b.x + r) + " " + b.y + "Z"; }
  function capsuleV(b) { var r = b.w / 2; return "M" + b.x + " " + (b.y + r) + "A" + r + " " + r + " 0 0 1 " + (b.x + b.w) + " " + (b.y + r) + "V" + (b.y + b.h - r) + "A" + r + " " + r + " 0 0 1 " + b.x + " " + (b.y + b.h - r) + "Z"; }
  function inset(b, d) { return { x: b.x + d, y: b.y + d, w: b.w - 2 * d, h: b.h - 2 * d }; }
  function fan(g, cx, cy, r, spinners) {
    el("circle", { cx: cx, cy: cy, r: r, fill: "#0a1627", stroke: "rgba(200,220,245,.45)", "stroke-width": 1.2 }, g);
    var bl = el("g", {}, g);
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2;
      el("path", { d: "M" + cx + " " + cy + "Q" + (cx + Math.cos(a + .5) * r * .9) + " " + (cy + Math.sin(a + .5) * r * .9) + " " + (cx + Math.cos(a) * r * .85) + " " + (cy + Math.sin(a) * r * .85) + "Z", fill: "rgba(159,214,255,.55)" }, bl);
    }
    el("circle", { cx: cx, cy: cy, r: 2.5, fill: "#cfe8ff" }, g);
    spinners.push({ g: bl, cx: cx, cy: cy, s: 1.6 });
  }
  function rotor(g, cx, cy, r, lobes, spinners, dir) {
    var d = "";
    for (var i = 0; i <= 64; i++) {
      var a = i / 64 * Math.PI * 2, rr = r * (0.78 + 0.22 * Math.cos(lobes * a));
      d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1);
    }
    var gg = el("g", {}, g);
    el("path", { d: d + "Z", fill: "rgba(159,214,255,.18)", stroke: "rgba(200,225,250,.7)", "stroke-width": 1.2 }, gg);
    el("circle", { cx: cx, cy: cy, r: 3, fill: "#cfe8ff" }, gg);
    spinners.push({ g: gg, cx: cx, cy: cy, s: 2.4 * dir });
  }
  function heatArrows(g, b, up, color) {
    // heat flows into the evaporator from the room air below it
    for (var i = 0; i < 3; i++) {
      var x = b.x + b.w * (0.28 + i * 0.22), y0 = up ? b.y - 6 : b.y + b.h + 30, y1 = up ? b.y - 30 : b.y + b.h + 6;
      el("path", { d: "M" + x + " " + y0 + "C" + (x - 6) + " " + ((y0 + y1) / 2) + " " + (x + 6) + " " + ((y0 + y1) / 2) + " " + x + " " + y1, stroke: color, "stroke-width": 1.6, fill: "none", "class": "cut-flow", opacity: .7 }, g);
    }
  }
  var ART = {
    cond: function (g, b, sp) {
      el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: "url(#steel)", stroke: "rgba(200,220,245,.4)" }, g);
      var i = inset(b, 6);
      el("rect", { x: i.x, y: i.y, width: i.w, height: i.h, rx: 6, fill: "#06101e" }, g);
      for (var x = i.x + 6; x < i.x + i.w; x += 7) el("line", { x1: x, x2: x, y1: i.y + 2, y2: i.y + i.h - 2, stroke: "rgba(150,185,230,.07)" }, g);
      fan(g, b.x + b.w * 0.3, b.y - 2, 15, sp); fan(g, b.x + b.w * 0.7, b.y - 2, 15, sp);
    },
    evap: function (g, b) {
      el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: "url(#steel)", stroke: "rgba(200,220,245,.4)" }, g);
      var i = inset(b, 6);
      el("rect", { x: i.x, y: i.y, width: i.w, height: i.h, rx: 6, fill: "#06101e" }, g);
      for (var x = i.x + 6; x < i.x + i.w; x += 7) el("line", { x1: x, x2: x, y1: i.y + 2, y2: i.y + i.h - 2, stroke: "rgba(150,185,230,.07)" }, g);
      heatArrows(g, b, false, "#ffae4f");
    },
    rec: function (g, b, sp, id) {
      el("path", { d: capsuleH(b), fill: "url(#steel)", stroke: "rgba(200,220,245,.5)", "stroke-width": 1.3 }, g);
      var i = inset(b, 4), cp = el("clipPath", { id: id }, g);
      el("path", { d: capsuleH(i) }, cp);
      el("path", { d: capsuleH(i), fill: "#050c17" }, g);
      var lv = el("g", { "clip-path": "url(#" + id + ")" }, g);
      var y = i.y + i.h * 0.42, d = "M" + (i.x - 40) + " " + y;
      for (var x = i.x - 40; x < i.x + i.w + 80; x += 20) d += "Q" + (x + 5) + " " + (y - 2.5) + " " + (x + 10) + " " + y + "T" + (x + 20) + " " + y;
      d += "V" + (i.y + i.h + 4) + "H" + (i.x - 40) + "Z";
      el("path", { d: d, fill: "url(#liqGrad)", "class": "cut-wave" }, lv);
    },
    osep: function (g, b, sp, id) {
      el("path", { d: capsuleV(b), fill: "url(#steel)", stroke: "rgba(200,220,245,.5)", "stroke-width": 1.3 }, g);
      var i = inset(b, 4), cp = el("clipPath", { id: id }, g);
      el("path", { d: capsuleV(i) }, cp);
      el("path", { d: capsuleV(i), fill: "#050c17" }, g);
      var lv = el("g", { "clip-path": "url(#" + id + ")" }, g);
      el("rect", { x: i.x, y: i.y + i.h * 0.84, width: i.w, height: i.h * 0.2, fill: "url(#oilGrad)" }, lv);
      for (var k = 0; k < 5; k++) el("line", { x1: i.x + 4, x2: i.x + i.w - 4, y1: i.y + i.h * 0.2 + k * 4, y2: i.y + i.h * 0.2 + k * 4, stroke: "rgba(200,220,245,.35)", "stroke-dasharray": "3 2" }, lv);
      for (var j = 0; j < 4; j++) {
        var c = el("circle", { cx: i.x + i.w * (0.25 + j * 0.17), cy: i.y + i.h * 0.32, r: 1.8, fill: "#e0a34f", "class": "cut-drop" }, lv);
        c.style.setProperty("--dy", (i.h * 0.5) + "px"); c.style.animationDelay = (j * 0.4) + "s";
      }
    },
    comp: function (g, b, sp) {
      el("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14, fill: "url(#steel)", stroke: "rgba(200,220,245,.5)", "stroke-width": 1.3 }, g);
      el("rect", { x: b.x + 8, y: b.y + 8, width: b.w - 16, height: b.h - 16, rx: 10, fill: "#050c17" }, g);
      var r = Math.min(b.h * 0.33, b.w * 0.2);
      rotor(g, b.x + b.w / 2 - r * 0.92, b.y + b.h / 2, r, 4, sp, 1);
      rotor(g, b.x + b.w / 2 + r * 0.92, b.y + b.h / 2, r * 0.9, 6, sp, -0.67);
    },
    exv: function (g, b) {
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2, s = b.w / 2;
      el("path", { d: "M" + (cx - s) + " " + (cy - s * .8) + "L" + cx + " " + cy + "L" + (cx - s) + " " + (cy + s * .8) + "Z M" + (cx + s) + " " + (cy - s * .8) + "L" + cx + " " + cy + "L" + (cx + s) + " " + (cy + s * .8) + "Z", fill: "url(#steel)", stroke: "rgba(220,235,250,.75)", "stroke-width": 1.4, transform: "rotate(90 " + cx + " " + cy + ")" }, g);
      el("line", { x1: cx, y1: cy, x2: cx + s * 1.3, y2: cy, stroke: "rgba(220,235,250,.75)", "stroke-width": 1.6 }, g);
      el("rect", { x: cx + s * 1.3, y: cy - s * .6, width: 5, height: s * 1.2, rx: 2, fill: "#9fd6ff" }, g);
    }
  };

  // ------------------------------------------------------------- module
  C.register("cycle", function () {
    var stage = document.getElementById("cycleStage");
    if (!stage) return;
    var INFO = stepInfo();
    var svg = el("svg", { "aria-hidden": "false" }), canvas = document.createElement("canvas");
    stage.insertBefore(canvas, stage.firstChild);
    stage.insertBefore(svg, canvas);
    var ctx = canvas.getContext("2d");
    var L, samples, parts = [], spinners = [], nodes = {}, cam, spd = 1, playing = !C.Motion.reduced, selected = null, layoutName = "";
    var playBtn = document.getElementById("cyclePlay"), zoomBtn = document.getElementById("cycleZoomOut");
    var detail = document.getElementById("cycleDetail"), stepBtns = C.$$("#cycleSteps button");

    function build() {
      var name = stage.clientWidth < 640 ? "tall" : "wide";
      if (name === layoutName) return;
      layoutName = name; L = LAYOUTS[name];
      stage.style.aspectRatio = L.W + " / " + L.H;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      spinners = []; nodes = {};
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      // divider
      var dv = L.divider;
      el("line", { x1: dv.x1, x2: dv.x2, y1: dv.y, y2: dv.y, stroke: "rgba(150,185,230,.25)", "stroke-dasharray": "6 6" }, svg);
      el("text", { x: dv.lx, y: dv.y - 9, "text-anchor": "end", "class": "svg-sub", style: "font-size:" + L.fss + "px" }, svg).textContent = layoutName === "tall" ? "HIGH SIDE" : "HIGH-PRESSURE SIDE";
      el("text", { x: dv.lx, y: dv.y + L.fss + 6, "text-anchor": "end", "class": "svg-sub", style: "font-size:" + L.fss + "px" }, svg).textContent = layoutName === "tall" ? "LOW SIDE" : "LOW-PRESSURE SIDE";
      // external pipes
      var gp = el("g", { "class": "pipe" }, svg);
      L.segs.forEach(function (s) {
        if (s.hidden || s.coil) return;
        var c = RGB[s.stops[0][1]];
        el("path", { d: pts2d(s.pts), stroke: "#1c2f4a", "stroke-width": 12, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round" }, gp);
        el("path", { d: pts2d(s.pts), stroke: "#081322", "stroke-width": 7.5, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round" }, gp);
        el("path", { d: pts2d(s.pts), stroke: "rgb(" + c + ")", "stroke-opacity": .28, "stroke-width": 2, fill: "none", "stroke-linejoin": "round" }, gp);
      });
      // components
      ORDER.forEach(function (key) {
        var b = L.comps[key], g = el("g", { "class": "comp-node", tabindex: 0, role: "button", "aria-label": NAMES[key][0] + ". " + INFO[key].lead + " Select to zoom in." }, svg);
        var pad = 12;
        el("rect", { x: b.x - pad, y: b.y - pad - (key === "cond" ? 18 : 0), width: b.w + 2 * pad, height: b.h + 2 * pad + (key === "cond" ? 18 : 0), rx: 14, "class": "focus-ring" }, g);
        ART[key](g, b, spinners, "cyc-" + key + "-clip-" + layoutName);
        // coils inside
        L.segs.forEach(function (s) {
          if (!s.coil) return;
          if ((key === "cond" && s.id === "C") || (key === "evap" && s.id === "I")) {
            el("path", { d: pts2d(s.pts), stroke: "#22395a", "stroke-width": 7, fill: "none", "stroke-linejoin": "round" }, g);
            el("path", { d: pts2d(s.pts), stroke: "#0a1729", "stroke-width": 3.5, fill: "none", "stroke-linejoin": "round" }, g);
          }
        });
        var t1 = el("text", { x: b.lx, y: b.ly, "text-anchor": b.la, "class": "svg-label", style: "font-size:" + L.fs + "px" }, g);
        t1.textContent = NAMES[key][0];
        var t2 = el("text", { x: b.lx, y: b.ly + L.fss + 6, "text-anchor": b.la, "class": "svg-sub", style: "font-size:" + L.fss + "px" }, g);
        t2.textContent = NAMES[key][1];
        el("rect", { x: b.x - pad, y: b.y - pad, width: b.w + 2 * pad, height: b.h + 2 * pad, "class": "hit" }, g);
        g.addEventListener("click", function () { select(key); });
        g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(key); } });
        nodes[key] = g;
      });
      sample();
      cam = selected ? camFor(selected) : { x: 0, y: 0, w: L.W, h: L.H };
      applyCam();
      if (selected) dimOthers(selected);
    }

    // sample the loop into points with color and speed; build a time lookup
    function sample() {
      var xs = [], ys = [], cs = [], ts = [0], step = 3;
      L.segs.forEach(function (s) {
        var lens = [], tot = 0;
        for (var i = 1; i < s.pts.length; i++) { var d = Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]); lens.push(d); tot += d; }
        var n = Math.max(2, Math.round(tot / step));
        for (var k = 0; k < n; k++) {
          var dist = k / n * tot, j = 0;
          while (j < lens.length - 1 && dist > lens[j]) { dist -= lens[j]; j++; }
          var u = lens[j] ? dist / lens[j] : 0, a = s.pts[j], b = s.pts[j + 1];
          xs.push(a[0] + (b[0] - a[0]) * u); ys.push(a[1] + (b[1] - a[1]) * u);
          cs.push(colorAt(s.stops, k / n));
        }
      });
      var n = xs.length;
      for (var i = 1; i < n; i++) {
        var ds = Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
        ts.push(ts[i - 1] + ds / cs[i - 1].v);
      }
      var T = ts[n - 1] + Math.hypot(xs[0] - xs[n - 1], ys[0] - ys[n - 1]) / cs[n - 1].v;
      var lut = new Int32Array(4096), j2 = 0;
      for (var q = 0; q < 4096; q++) { var tt = q / 4096 * T; while (j2 < n - 1 && ts[j2 + 1] <= tt) j2++; lut[q] = j2; }
      samples = { xs: xs, ys: ys, cs: cs, ts: ts, T: T, n: n, lut: lut };
      var N = layoutName === "tall" ? 120 : 150;
      if (parts.length !== N) { parts = []; for (var p = 0; p < N; p++) parts.push(p / N * T); }
      else for (var p2 = 0; p2 < N; p2++) parts[p2] = p2 / N * T;
    }
    function colorAt(stops, t) {
      if (stops.length === 1) { var k0 = stops[0][1]; return { r: RGB[k0], v: SPEED[k0] }; }
      for (var i = 0; i < stops.length - 1; i++) {
        if (t <= stops[i + 1][0]) {
          var a = stops[i], b = stops[i + 1], u = (t - a[0]) / (b[0] - a[0] || 1);
          var ca = RGB[a[1]], cb = RGB[b[1]];
          return { r: [ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, ca[2] + (cb[2] - ca[2]) * u].map(Math.round), v: SPEED[a[1]] + (SPEED[b[1]] - SPEED[a[1]]) * u };
        }
      }
      var kl = stops[stops.length - 1][1];
      return { r: RGB[kl], v: SPEED[kl] };
    }

    function applyCam() {
      svg.setAttribute("viewBox", cam.x + " " + cam.y + " " + cam.w + " " + cam.h);
      draw(0);
    }
    var angle = 0;
    function draw(dt) {
      var fit = C.fitCanvas(canvas, 2), s = fit.w / cam.w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(fit.dpr * s, 0, 0, fit.dpr * s, -cam.x * fit.dpr * s, -cam.y * fit.dpr * s);
      ctx.globalCompositeOperation = "lighter";
      var S = samples, T = S.T;
      for (var i = 0; i < parts.length; i++) {
        parts[i] = (parts[i] + dt * spd) % T;
        var idx = S.lut[Math.floor(parts[i] / T * 4096) % 4096], c = S.cs[idx].r;
        var x = S.xs[idx], y = S.ys[idx];
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0.16)";
        ctx.beginPath(); ctx.arc(x, y, 6.5, 0, 6.2832); ctx.fill();
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0.95)";
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      if (dt) {
        angle += dt * spd * 120;
        spinners.forEach(function (sp) { sp.g.setAttribute("transform", "rotate(" + (angle * sp.s).toFixed(1) + " " + sp.cx + " " + sp.cy + ")"); });
      }
    }
    var loop = new C.Loop(stage, function (dt) { draw(dt); });
    loop.playing = playing;

    function camFor(key) {
      var b = L.comps[key], ar = L.W / L.H;
      var w = Math.max(b.w * 2.6, layoutName === "tall" ? 320 : 380), h = w / ar;
      if (h < b.h * 2.8) { h = b.h * 2.8; w = h * ar; }
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (key === "rec" && layoutName === "tall") cx += 60;
      if (key === "osep") cx -= layoutName === "tall" ? 40 : 50;
      if (key === "exv") cx += 50;
      var x = Math.max(0, Math.min(L.W - w, cx - w / 2)), y = Math.max(0, Math.min(L.H - h, cy - h / 2));
      return { x: x, y: y, w: w, h: h };
    }
    var camCancel = null;
    function flyTo(target, dur) {
      if (camCancel) camCancel();
      var a = { x: cam.x, y: cam.y, w: cam.w, h: cam.h };
      camCancel = C.tween(dur || 850, function (k) {
        cam = { x: a.x + (target.x - a.x) * k, y: a.y + (target.y - a.y) * k, w: a.w + (target.w - a.w) * k, h: a.h + (target.h - a.h) * k };
        svg.setAttribute("viewBox", cam.x + " " + cam.y + " " + cam.w + " " + cam.h);
        if (!loop.id) draw(0);
      });
    }
    var spdCancel = null;
    function easeSpeed(to) {
      if (spdCancel) spdCancel();
      var from = spd;
      spdCancel = C.tween(450, function (k) { spd = from + (to - from) * k; }, { ease: C.ease.out });
    }
    function dimOthers(key) { ORDER.forEach(function (k) { nodes[k].classList.toggle("dim", !!key && k !== key); }); }

    function pill(s) { return '<span class="pill state-' + s + '"><i></i>' + STATE_LABEL[s] + "</span>"; }
    function renderDetail(key) {
      if (!key) {
        detail.innerHTML = '<span class="card-tag">The whole loop</span><h3>Four processes, one closed loop</h3>' +
          '<p class="muted">Low-pressure vapor is <b>compressed</b>, the hot gas is <b>condensed</b> to liquid, the liquid is <b>expanded</b> through a valve, and the cold liquid <b>evaporates</b> as it absorbs heat. Then it starts again.</p>' +
          '<p class="muted small">Choose a component on the diagram, or a step above, to zoom in.</p>';
        return;
      }
      var d = INFO[key];
      detail.innerHTML = '<span class="card-tag">Step ' + d.n + "</span><h3>" + d.title + "</h3>" +
        '<div class="io">' + pill(d.inS) + '<svg aria-hidden="true"><use href="#i-arrow"/></svg>' + pill(d.outS) + "</div>" +
        '<p><b>' + d.lead + "</b></p><p class=\"muted\">" + d.body + "</p>" +
        (d.formula ? '<div class="formula">' + d.formula + "</div>" : "") +
        (d.ex ? '<p class="muted small">' + d.ex + "</p>" : "");
    }
    function select(key) {
      if (selected === key) { reset(); return; }
      selected = key;
      stepBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.step === key)); });
      dimOthers(key);
      easeSpeed(0);
      flyTo(camFor(key));
      renderDetail(key);
      zoomBtn.hidden = false;
    }
    function reset() {
      selected = null;
      stepBtns.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      dimOthers(null);
      easeSpeed(1);
      flyTo({ x: 0, y: 0, w: L.W, h: L.H });
      renderDetail(null);
      zoomBtn.hidden = true;
    }
    stepBtns.forEach(function (b) { b.addEventListener("click", function () { select(b.dataset.step); }); });
    zoomBtn.addEventListener("click", reset);
    function syncPlay() {
      playBtn.setAttribute("aria-pressed", String(playing));
      playBtn.innerHTML = '<svg aria-hidden="true"><use href="#i-' + (playing ? "pause" : "play") + '"/></svg><span class="txt">' + (playing ? "Pause" : "Play") + "</span>";
      playBtn.setAttribute("aria-label", playing ? "Pause the animation" : "Play the animation");
    }
    playBtn.addEventListener("click", function () {
      playing = !playing; loop.playing = playing; loop.force = playing && C.Motion.reduced;
      if (playing && selected) easeSpeed(0);
      syncPlay(); loop.sync();
    });
    C.bus.addEventListener("motion", function () {
      if (C.Motion.reduced) { playing = false; loop.playing = false; loop.force = false; }
      else { playing = true; loop.playing = true; }
      syncPlay(); loop.sync(); draw(0);
    });
    syncPlay();
    build();
    if (window.ResizeObserver) new ResizeObserver(function () { build(); draw(0); }).observe(stage);
    else window.addEventListener("resize", function () { build(); draw(0); });
  });
})();
