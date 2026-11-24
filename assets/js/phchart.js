/* R-717 Training — P-h diagram drawn from props.json (log pressure axis). */
(function () {
  "use strict";
  var R = window.R717Props, C = window.R717;
  var NS = "http://www.w3.org/2000/svg";
  var COL = { liquid: "#5b95ff", two: "#45dbe8", vapor: "#eef6ff", hot: "#ffae4f", ice: "#5fe3f0" };
  var count = 0;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function niceStep(span, n) {
    var raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 3.5 ? 2.5 : r < 7 ? 5 : 10) * mag;
  }
  function pfmt(P) { return P < 10 ? (Math.round(P * 10) / 10).toString() : C.fmt(P, 0); }

  function PHChart(root, opts) {
    this.root = root; this.o = opts || {}; this.id = "ph" + (++count);
    this.fluid = this.o.fluid || "R717"; this.view = this.o.view || "op"; this.mode = this.o.mode || "cycle";
    this.ax = this.range(); this.cyc = null; this.fr = null; this.pts = [];
    this.build();
    this.resize();
    var self = this;
    if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(root);
    else window.addEventListener("resize", function () { self.resize(); });
  }
  var P = PHChart.prototype;

  P.range = function () {
    var v = R.fluid(this.fluid).view[this.view];
    return { h0: v.hmin, h1: v.hmax, l0: Math.log10(v.pmin), l1: Math.log10(v.pmax) };
  };

  P.build = function () {
    var id = this.id;
    var svg = this.svg = el("svg", { role: "img", "aria-label": this.o.label || "Pressure-enthalpy diagram" });
    this.root.appendChild(svg);
    var defs = el("defs", null, svg);
    var g = el("linearGradient", { id: id + "-dome", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: 0, "stop-color": "#5fe3f0", "stop-opacity": 0.11 }, g);
    el("stop", { offset: 1, "stop-color": "#5b95ff", "stop-opacity": 0.03 }, g);
    var f = el("filter", { id: id + "-blur", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    el("feGaussianBlur", { stdDeviation: 4 }, f);
    var cp = el("clipPath", { id: id + "-clip" }, defs);
    this.clipRect = el("rect", null, cp);
    var mk = function (name, a, b) {
      var lg = el("linearGradient", { id: id + "-" + name, gradientUnits: "userSpaceOnUse" }, defs);
      el("stop", { offset: 0, "stop-color": a }, lg); el("stop", { offset: 1, "stop-color": b }, lg);
      return lg;
    };
    this.gradComp = mk("comp", COL.vapor, COL.hot);
    this.gradEvap = mk("evap", COL.two, COL.vapor);
    this.gradExp = mk("exp", COL.liquid, COL.two);

    this.gGrid = el("g", { "class": "ph-grid" }, svg);
    this.gAxis = el("g", { "class": "ph-axis" }, svg);
    this.gContent = el("g", null, svg);
    this.gContent.style.transition = "opacity .22s ease";
    var clip = el("g", { "clip-path": "url(#" + id + "-clip)" }, this.gContent);
    this.pDome = el("path", { "class": "ph-dome", fill: "url(#" + id + "-dome)" }, clip);
    this.gQual = el("g", null, clip);
    this.gIso = el("g", null, clip);
    this.gRegion = el("g", null, clip);
    this.gOver = el("g", { "class": "ph-cycle" }, clip);
    this.gCrit = el("g", null, this.gContent);
    this.gAnnot = el("g", null, this.gContent);
    this.gPts = el("g", null, this.gContent);
    this.gHover = el("g", { "class": "ph-hover", "pointer-events": "none", opacity: 0 }, svg);
    this.hx = el("line", null, this.gHover); this.hy = el("line", null, this.gHover);
    this.hd = el("circle", { r: 4 }, this.gHover);
    this.hit = el("rect", { fill: "transparent" }, svg);
    svg.appendChild(this.gPts);   // points sit above the hover layer so they stay focusable and clickable
    this.tip = document.createElement("div");
    this.tip.className = "ph-tip"; this.tip.setAttribute("aria-hidden", "true");
    this.root.appendChild(this.tip);
    var self = this;
    this.hit.addEventListener("pointermove", function (e) { self.hover(e); });
    this.hit.addEventListener("pointerdown", function (e) { self.hover(e); });
    this.hit.addEventListener("pointerleave", function () { self.unhover(); });
  };

  P.resize = function () {
    var w = Math.max(280, Math.floor(this.root.clientWidth - 12));
    var ratio = this.o.ratio || (w < 560 ? 0.92 : 0.6);
    var h = Math.round(Math.max(300, Math.min(this.o.maxH || 560, w * ratio)));
    if (w === this.W && h === this.H) return;
    this.W = w; this.H = h;
    var narrow = w < 520;
    this.m = { l: narrow ? 58 : 66, r: narrow ? 10 : 18, t: 14, b: 46 };
    this.svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    this.svg.setAttribute("width", w); this.svg.setAttribute("height", h);
    var pw = w - this.m.l - this.m.r, ph = h - this.m.t - this.m.b;
    this.pw = pw; this.ph = ph;
    var r = { x: this.m.l, y: this.m.t, width: pw, height: ph };
    for (var k in r) { this.clipRect.setAttribute(k, r[k]); this.hit.setAttribute(k, r[k]); }
    this.renderAll();
  };

  P.sx = function (h) { var a = this.ax; return this.m.l + (h - a.h0) / (a.h1 - a.h0) * this.pw; };
  P.sy = function (p) { var a = this.ax; return this.m.t + (a.l1 - Math.log10(p)) / (a.l1 - a.l0) * this.ph; };
  P.ih = function (x) { var a = this.ax; return a.h0 + (x - this.m.l) / this.pw * (a.h1 - a.h0); };
  P.ip = function (y) { var a = this.ax; return Math.pow(10, a.l1 - (y - this.m.t) / this.ph * (a.l1 - a.l0)); };
  P.path = function (pts) {
    var s = "";
    for (var i = 0; i < pts.length; i++) s += (i ? "L" : "M") + this.sx(pts[i][0]).toFixed(1) + " " + this.sy(pts[i][1]).toFixed(1);
    return s;
  };

  P.renderAll = function () { if (!this.W) return; this.renderStatic(); this.renderDyn(); };

  P.renderStatic = function () {
    var self = this, f = R.fluid(this.fluid), a = this.ax, m = this.m;
    clear(this.gGrid); clear(this.gAxis); clear(this.gQual); clear(this.gIso); clear(this.gRegion); clear(this.gCrit);
    var x0 = m.l, x1 = m.l + this.pw, y0 = m.t, y1 = m.t + this.ph;
    // h grid
    var step = niceStep(a.h1 - a.h0, Math.max(4, Math.round(this.pw / 95)));
    for (var h = Math.ceil(a.h0 / step) * step; h <= a.h1 + 1e-9; h += step) {
      var x = this.sx(h);
      el("line", { x1: x, x2: x, y1: y0, y2: y1, "class": Math.abs(h) < 1e-9 ? "major" : "" }, this.gGrid);
      el("text", { x: x, y: y1 + 17, "text-anchor": "middle" }, this.gAxis).textContent = C.fmt(h, step < 1 ? 1 : 0);
    }
    // log P grid
    var decH = this.ph / (a.l1 - a.l0);
    for (var d = Math.floor(a.l0); d <= Math.ceil(a.l1); d++) {
      [1, 2, 5].forEach(function (mul) {
        var p = mul * Math.pow(10, d), lp = Math.log10(p);
        if (lp < a.l0 - 1e-9 || lp > a.l1 + 1e-9) return;
        var y = self.sy(p);
        el("line", { x1: x0, x2: x1, y1: y, y2: y, "class": mul === 1 ? "major" : "" }, self.gGrid);
        if (mul === 1 || decH > 70) el("text", { x: x0 - 8, y: y + 4, "text-anchor": "end" }, self.gAxis).textContent = pfmt(p);
      });
    }
    el("rect", { x: x0, y: y0, width: this.pw, height: this.ph, fill: "none", stroke: "rgba(150,185,230,.18)" }, this.gGrid);
    el("text", { x: (x0 + x1) / 2, y: this.H - 8, "text-anchor": "middle", "class": "title" }, this.gAxis).textContent = "Enthalpy, h (BTU/lb)";
    var t = el("text", { x: 0, y: 0, "text-anchor": "middle", "class": "title", transform: "translate(" + (m.l < 60 ? 12 : 14) + " " + ((y0 + y1) / 2) + ") rotate(-90)" }, this.gAxis);
    t.textContent = "Pressure (psia, log scale)";

    // dome
    var d = f.dome, liq = [], vap = [];
    for (var i = 0; i < d.P.length; i++) { liq.push([d.hf[i], d.P[i]]); vap.push([d.hg[i], d.P[i]]); }
    var dome = liq.concat([[f.crit.h, f.crit.P]]).concat(vap.reverse());
    this.pDome.setAttribute("d", this.path(dome) + "Z");
    // quality lines
    for (var q = 1; q <= 9; q++) {
      var qp = [];
      for (var j = 0; j < d.P.length; j++) qp.push([d.hf[j] + q / 10 * (d.hg[j] - d.hf[j]), d.P[j]]);
      qp.push([f.crit.h, f.crit.P]);
      el("path", { d: this.path(qp), "class": "ph-quality" }, this.gQual);
    }
    // isotherms
    // isotherm labels: next to the saturated-vapor line where the isotherm leaves the dome,
    // otherwise where it enters the plot; skip any label that would collide with another
    var placed = [], blocked = this.blocked = [];
    var place = function (x, y, t, g, cls) {
      for (var q = 0; q < placed.length; q++) if (Math.abs(placed[q][0] - x) < 44 && Math.abs(placed[q][1] - y) < 13) return;
      for (var b = 0; b < blocked.length; b++) { var B = blocked[b]; if (x < B[2] && x + 40 > B[0] && y > B[1] && y - 11 < B[3]) return; }
      placed.push([x, y]);
      el("text", { x: x, y: y, "class": cls }, g).textContent = t;
    };
    var narrow0 = this.W < 560, yl0 = y0 + 20;
    blocked.push([x0, yl0 - 12, x0 + (narrow0 ? 70 : 150), yl0 + 4], [x1 - (narrow0 ? 60 : 160), yl0 - 12, x1, yl0 + 4]);
    var ccx = this.sx(f.crit.h), ccy = this.sy(f.crit.P);
    if (ccy >= y0 && ccy <= y1) blocked.push([ccx - 190, ccy - 22, ccx + 190, ccy + 30]);
    f.isotherms.forEach(function (iso) {
      el("path", { d: self.path(iso.pts), "class": "ph-iso" }, self.gIso);
      var pts = iso.pts, corner = -1;
      for (var k = 0; k < pts.length - 1; k++) if (pts[k][1] === pts[k + 1][1]) { corner = k + 1; break; }
      var t = C.fmt(iso.T, 0) + "°F";
      if (corner >= 0) {
        var cxp = self.sx(pts[corner][0]), cyp = self.sy(pts[corner][1]);
        if (cxp >= x0 && cxp <= x1 - 40 && cyp >= y0 + 12 && cyp <= y1 - 4) { place(cxp + 6, cyp - 5, t, self.gIso, "ph-iso-label"); return; }
      }
      for (var j = corner >= 0 ? corner : 0; j < pts.length; j++) {
        var px = self.sx(pts[j][0]), py = self.sy(pts[j][1]);
        if (px >= x0 && px <= x1 - 40 && py >= y0 && py <= y1 - 4) { place(px + 4, Math.max(y0 + 12, py - 4), t, self.gIso, "ph-iso-label"); return; }
      }
    });
    // critical point
    var cx = this.sx(f.crit.h), cy = this.sy(f.crit.P), narrow = this.W < 560;
    if (cy >= y0 && cy <= y1 && cx >= x0 && cx <= x1) {
      el("path", { d: "M" + cx + " " + (cy - 6) + "l6 6-6 6-6-6z", "class": "ph-crit" }, this.gCrit);
      var l1 = "Critical point", l2 = C.fmt(f.crit.T, 1) + "°F · " + C.fmt(f.crit.P, 0) + " psia";
      var room = 175, anchor, tx, ty = cy + 4;
      if (cx + 12 + room < x1) { anchor = "start"; tx = cx + 12; }
      else if (cx - 12 - room > x0) { anchor = "end"; tx = cx - 12; }
      else { anchor = "middle"; tx = Math.max(x0 + 90, Math.min(x1 - 90, cx)); ty = cy + 22; }
      var ct = el("text", { x: tx, y: ty - 6, "text-anchor": anchor, "class": "ph-crit-label" }, this.gCrit);
      ct.textContent = l1;
      el("text", { x: tx, y: ty + 7, "text-anchor": anchor, "class": "ph-crit-label" }, this.gCrit).textContent = l2;
    }
    // region labels sit along the top edge, clear of the cycle annotations
    var yl = y0 + 20, pTop = this.ip(yl), dm = R.domeAtP(this.fluid, pTop);
    el("text", { x: x0 + 10, y: yl, "class": "ph-region" }, this.gRegion).textContent = narrow ? "Liquid" : "Subcooled liquid";
    el("text", { x: x1 - 10, y: yl, "text-anchor": "end", "class": "ph-region" }, this.gRegion).textContent = narrow ? "Vapor" : "Superheated vapor";
    var dmB = dm || R.domeAtP(this.fluid, this.ip(y1 - 14));
    if (dmB) {
      var mx = (this.sx(dmB.hf) + this.sx(dmB.hg)) / 2;
      el("text", { x: mx, y: dm ? yl : y1 - 14, "text-anchor": "middle", "class": "ph-region" }, this.gRegion).textContent = "Liquid + vapor";
    }
  };

  // ---------------------------------------------------------- dynamic layer
  P.renderDyn = function () {
    clear(this.gOver); clear(this.gAnnot); clear(this.gPts); this.pts = [];
    if (this.mode === "cycle" && this.cyc) this.drawCycle();
    if (this.mode === "flash" && this.fr) this.drawFlash();
  };

  P.seg = function (pts, stroke, cls) {
    return el("path", { d: this.path(pts), stroke: stroke, "class": cls || "line" }, this.gOver);
  };
  P.point = function (h, p, color, label, info, pos) {
    var x = this.sx(h), y = this.sy(p), g = el("g", { "class": "ph-pt", tabindex: 0, role: "img", "aria-label": info.aria }, this.gPts);
    el("circle", { cx: x, cy: y, r: 11, "class": "halo", stroke: color }, g);
    el("circle", { cx: x, cy: y, r: 5.5, fill: color, "class": "core" }, g);
    if (label) {
      var dx = pos && pos[0] || 12, dy = pos && pos[1] || -10;
      el("text", { x: x + dx, y: y + dy, "text-anchor": dx < 0 ? "end" : "start" }, g).textContent = label;
    }
    var self = this, rec = { x: x, y: y, info: info, color: color };
    this.pts.push(rec);
    g.addEventListener("focus", function () { self.showTip(rec.x, rec.y, rec.info.html); self.cross(rec.x, rec.y); });
    g.addEventListener("blur", function () { self.unhover(); });
    g.addEventListener("pointerenter", function () { self.showTip(rec.x, rec.y, rec.info.html); self.cross(rec.x, rec.y); });
    g.addEventListener("pointerleave", function () { self.unhover(); });
    return g;
  };
  P.annot = function (x, y, text, cls, anchor) {
    var t = el("text", { x: x, y: y, "class": "ph-annot " + (cls || ""), "text-anchor": anchor || "middle" }, this.gAnnot);
    t.textContent = text; return t;
  };
  function stateHtml(title, P, T, h, extra) {
    return '<span class="r">' + title + "</span>P <b>" + C.fmt(P, 1) + "</b> psia &middot; <b>" + C.fmt(P - R.ATM, 1) +
      "</b> psig<br>T <b>" + C.fmt(T, 1) + "</b>&deg;F<br>h <b>" + C.fmt(h, 1) + "</b> BTU/lb" + (extra ? "<br>" + extra : "");
  }
  function ariaOf(title, P, T, h) {
    return title + ": " + C.fmt(P, 1) + " psia, " + C.fmt(P - R.ATM, 1) + " psig, " + C.fmt(T, 1) + " degrees F, enthalpy " + C.fmt(h, 1) + " BTU per pound";
  }

  P.drawCycle = function () {
    var p = this.cyc, c = R.cycle(this.fluid, p.Te, p.Tc, p.SC);
    if (!c) return;
    var self = this, s = function (pt) { return [pt.h, pt.P]; };
    var loop = c.path12.map(function (q) { return [q.h, q.P]; })
      .concat([s(c.p2s), s(c.p3s), s(c.p3), s(c.p4), s(c.p1)]);
    el("path", { d: this.path(loop), stroke: COL.ice, "class": "glow", filter: "url(#" + this.id + "-blur)" }, this.gOver);
    // gradients follow the segments
    var set = function (g, a, b) { g.setAttribute("x1", a[0]); g.setAttribute("y1", a[1]); g.setAttribute("x2", b[0]); g.setAttribute("y2", b[1]); };
    var X = function (pt) { return [self.sx(pt.h), self.sy(pt.P)]; };
    set(this.gradComp, X(c.p1), X(c.p2));
    set(this.gradEvap, X(c.p4), X(c.p1));
    set(this.gradExp, X(c.p3), X(c.p4));
    this.seg(c.path12.map(function (q) { return [q.h, q.P]; }), "url(#" + this.id + "-comp)");
    this.seg([s(c.p2), s(c.p2s)], COL.hot);
    this.seg([s(c.p2s), s(c.p3s)], COL.two);
    if (p.SC > 0.05) this.seg([s(c.p3s), s(c.p3)], COL.liquid);
    this.seg([s(c.p3), s(c.p4)], "url(#" + this.id + "-exp)");
    this.seg([s(c.p4), s(c.p1)], "url(#" + this.id + "-evap)");
    el("path", { d: this.path(loop), "class": "flow" }, this.gOver);

    // annotations
    var y2 = this.sy(c.p2.P), y1 = this.sy(c.p1.P), xm = (this.sx(c.p3.h) + this.sx(c.p2s.h)) / 2;
    if (this.W > 420) {
      this.annot(xm, y2 - 10, "Condensing · " + C.fmt(p.Tc, 0) + "°F", "ice");
      this.annot((this.sx(c.p4.h) + this.sx(c.p1.h)) / 2, y1 + 20, "Evaporating · " + C.fmt(p.Te, 0) + "°F", "ice");
      var midIdx = Math.floor(c.path12.length / 2), mq = c.path12[midIdx];
      this.annot(this.sx(mq.h) + 10, this.sy(mq.P), "Compression", "hot", "start");
      this.annot(this.sx(c.p3.h) - 8, (y1 + y2) / 2, "Expansion", "liq", "end");
    }
    var e = c.e;
    this.point(c.p1.h, c.p1.P, COL.vapor, "1", {
      aria: ariaOf("Point 1, compressor inlet, saturated vapor", c.p1.P, c.p1.T, c.p1.h),
      html: stateHtml("1 · Compressor inlet (saturated vapor)", c.p1.P, c.p1.T, c.p1.h)
    }, [10, 18]);
    this.point(c.p2.h, c.p2.P, COL.hot, "2", {
      aria: ariaOf("Point 2, compressor discharge, superheated gas", c.p2.P, c.p2.T, c.p2.h),
      html: stateHtml("2 · Discharge (ideal, isentropic)", c.p2.P, c.p2.T, c.p2.h)
    }, [10, -10]);
    this.point(c.p3.h, c.p3.P, COL.liquid, "3", {
      aria: ariaOf("Point 3, liquid at the expansion valve", c.p3.P, c.p3.T, c.p3.h),
      html: stateHtml("3 · Liquid to the valve" + (p.SC > 0.05 ? " (subcooled " + C.fmt(p.SC, 0) + "°F)" : " (saturated)"), c.p3.P, c.p3.T, c.p3.h)
    }, [-12, -10]);
    this.point(c.p4.h, c.p4.P, COL.two, "4", {
      aria: ariaOf("Point 4, after the expansion valve, " + C.fmt(c.x4 * 100, 1) + " percent vapor", c.p4.P, c.p4.T, c.p4.h),
      html: stateHtml("4 · After the valve (liquid + vapor)", c.p4.P, c.p4.T, c.p4.h, "Quality x <b>" + C.fmt(c.x4, 3) + "</b> (" + C.fmt(c.x4 * 100, 1) + "% vapor)")
    }, [-12, 18]);
    this.last = c;
  };

  P.drawFlash = function () {
    var r = this.fr, m = this.m, x0 = m.l, x1 = m.l + this.pw, self = this;
    var yU = this.sy(r.Pup), yD = this.sy(r.Pdown);
    [[yU, r.Pup, r.Tup], [yD, r.Pdown, r.Tdown]].forEach(function (z) {
      el("line", { x1: x0, x2: x1, y1: z[0], y2: z[0], stroke: "rgba(234,242,252,.28)", "stroke-dasharray": "4 5" }, self.gOver);
      var dmz = R.domeAtP(self.fluid, z[1]), lx = dmz ? (self.sx(dmz.hf) + self.sx(dmz.hg)) / 2 + 30 : x1 - 8;
      self.annot(lx, z[0] - 8, C.fmt(z[1] - R.ATM, 1) + " psig · " + C.fmt(z[2], 1) + "°F", "", dmz ? "middle" : "end");
    });
    var xA = this.sx(r.hIn), xF = this.sx(r.hf), xG = this.sx(r.hg);
    // throttling line
    el("path", { d: "M" + xA + " " + yU + "V" + (yD - 8), stroke: COL.two, "stroke-width": 2.4, fill: "none" }, this.gOver);
    el("path", { d: "M" + (xA - 5) + " " + (yD - 13) + "l5 8 5-8", stroke: COL.two, "stroke-width": 2.2, fill: "none", "stroke-linejoin": "round" }, this.gOver);
    el("path", { d: "M" + xF + " " + yD + "H" + xG, stroke: "rgba(234,242,252,.55)", "stroke-width": 2, fill: "none" }, this.gOver);
    // dimension brackets: (h - hf) over hfg
    var b1 = yD + 32, b2 = yD + 58;
    var dim = function (xa, xb, y, text, cls, side) {
      el("path", { d: "M" + xa + " " + (y - 5) + "V" + (y + 5) + "M" + xa + " " + y + "H" + xb + "M" + xb + " " + (y - 5) + "V" + (y + 5), stroke: cls === "ice" ? COL.ice : "rgba(234,242,252,.5)", "stroke-width": 1.2, fill: "none" }, self.gAnnot);
      if (side) self.annot(xb + 8, y + 4, text, cls, "start");
      else self.annot((xa + xb) / 2, y - 7, text, cls);
    };
    if (r.x > 0) dim(xF, xA, b1, "h − hf = " + f1(r.hIn - r.hf), "ice", true);
    dim(xF, xG, b2, "hfg = " + f1(r.hfg) + " BTU/lb", "");
    this.annot(xA + 10, (yU + yD) / 2, "Valve: h stays " + f1(r.hIn), "", "start");
    if (r.Tliq < r.Tup - 0.05) {
      var satUp = R.sat(this.fluid, r.Tup);
      this.point(satUp.hf, r.Pup, "rgba(150,185,230,.7)", null, {
        aria: "Saturated liquid at " + C.fmt(r.Tup, 1) + " degrees F",
        html: stateHtml("Saturated liquid at the upstream pressure", r.Pup, r.Tup, satUp.hf)
      });
    }
    this.point(r.hIn, r.Pup, COL.liquid, "A", {
      aria: ariaOf("Point A, liquid before the valve", r.Pup, r.Tliq, r.hIn),
      html: stateHtml("A · Liquid before the valve" + (r.Tliq < r.Tup - 0.05 ? " (subcooled)" : ""), r.Pup, r.Tliq, r.hIn)
    }, [-12, -10]);
    this.point(r.hIn, r.Pdown, COL.two, "B", {
      aria: ariaOf("Point B, after the valve, " + C.fmt(r.x * 100, 1) + " percent vapor", r.Pdown, r.Tdown, r.hIn),
      html: stateHtml("B · After the valve", r.Pdown, r.Tdown, r.hIn, "Flash gas <b>" + C.fmt(r.x * 100, 1) + "%</b> by weight")
    }, [10, -12]);
    this.point(r.hf, r.Pdown, COL.liquid, "F", {
      aria: ariaOf("Point F, saturated liquid after the valve", r.Pdown, r.Tdown, r.hf),
      html: stateHtml("F · Saturated liquid (hf)", r.Pdown, r.Tdown, r.hf)
    }, [-12, -10]);
    this.point(r.hg, r.Pdown, COL.vapor, "G", {
      aria: ariaOf("Point G, saturated vapor after the valve", r.Pdown, r.Tdown, r.hg),
      html: stateHtml("G · Saturated vapor (hg)", r.Pdown, r.Tdown, r.hg)
    }, [10, -10]);
  };

  // ----------------------------------------------------------------- hover
  P.cross = function (x, y) {
    var m = this.m;
    this.hx.setAttribute("x1", m.l); this.hx.setAttribute("x2", m.l + this.pw); this.hx.setAttribute("y1", y); this.hx.setAttribute("y2", y);
    this.hy.setAttribute("y1", m.t); this.hy.setAttribute("y2", m.t + this.ph); this.hy.setAttribute("x1", x); this.hy.setAttribute("x2", x);
    this.hd.setAttribute("cx", x); this.hd.setAttribute("cy", y);
    this.gHover.setAttribute("opacity", 1);
  };
  P.showTip = function (x, y, html) {
    var r = this.svg.getBoundingClientRect(), rr = this.root.getBoundingClientRect(), k = r.width / this.W;
    this.tip.innerHTML = html;
    var tw = this.tip.offsetWidth || 200, th = this.tip.offsetHeight || 80;
    var left = (r.left - rr.left) + x * k + 16, top = (r.top - rr.top) + y * k - th - 12;
    if (left + tw > rr.width - 6) left = (r.left - rr.left) + x * k - tw - 16;
    if (left < 4) left = 4;
    if (top < 4) top = (r.top - rr.top) + y * k + 16;
    this.tip.style.left = left + "px"; this.tip.style.top = top + "px";
    this.tip.classList.add("on");
  };
  P.hover = function (e) {
    var r = this.svg.getBoundingClientRect(), k = this.W / r.width;
    var x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
    for (var i = 0; i < this.pts.length; i++) {
      var q = this.pts[i];
      if (Math.abs(q.x - x) < 14 && Math.abs(q.y - y) < 14) { this.cross(q.x, q.y); this.showTip(q.x, q.y, q.info.html); return; }
    }
    var h = this.ih(x), p = this.ip(y), t = R.tAtPH(this.fluid, p, h), html;
    if (!t) html = '<span class="r">Outside the data range</span>P <b>' + C.fmt(p, 1) + "</b> psia<br>h <b>" + C.fmt(h, 1) + "</b> BTU/lb";
    else {
      var title = t.region === "two-phase" ? "Liquid + vapor · x = " + C.fmt(t.x, 2) : t.region.charAt(0).toUpperCase() + t.region.slice(1);
      html = '<span class="r">' + title + "</span>P <b>" + C.fmt(p, 1) + "</b> psia &middot; <b>" + C.fmt(p - R.ATM, 1) +
        "</b> psig<br>T <b>" + (t.region === "two-phase" ? "" : "≈ ") + C.fmt(t.T, 1) + "</b>&deg;F<br>h <b>" + C.fmt(h, 1) + "</b> BTU/lb";
    }
    this.cross(x, y); this.showTip(x, y, html);
  };
  P.unhover = function () { this.gHover.setAttribute("opacity", 0); this.tip.classList.remove("on"); };

  // ---------------------------------------------------------------- public
  P.setCycle = function (p, animate) {
    this.mode = "cycle";
    var from = this.cyc, self = this;
    if (this.cancel) { this.cancel(); this.cancel = null; }
    if (!from || animate === false || C.Motion.reduced) { this.cyc = p; this.renderDyn(); return; }
    var a = { Te: from.Te, Tc: from.Tc, SC: from.SC };
    this.cancel = C.tween(620, function (k) {
      self.cyc = { Te: a.Te + (p.Te - a.Te) * k, Tc: a.Tc + (p.Tc - a.Tc) * k, SC: a.SC + (p.SC - a.SC) * k };
      self.renderDyn();
    });
  };
  P.setFlash = function (r, fluid) {
    var self = this;
    this.mode = "flash";
    if (fluid && fluid !== this.fluid) { this.setFluid(fluid, function () { self.fr = r; self.renderDyn(); }); return; }
    var from = this.fr;
    if (this.cancel) { this.cancel(); this.cancel = null; }
    if (!from || C.Motion.reduced) { this.fr = r; this.renderDyn(); return; }
    var keys = ["hIn", "hf", "hg", "hfg", "Pup", "Pdown", "Tup", "Tdown", "Tliq", "x"], a = {};
    keys.forEach(function (k) { a[k] = from[k]; });
    this.cancel = C.tween(520, function (k) {
      var o = {};
      keys.forEach(function (key) { o[key] = a[key] + (r[key] - a[key]) * k; });
      self.fr = o; self.renderDyn();
    }, { done: function () { self.fr = r; self.renderDyn(); } });
  };
  P.setFluid = function (k, then) {
    var self = this;
    if (k === this.fluid) { if (then) then(); return; }
    var swap = function () {
      self.fluid = k; self.ax = self.range(); self.cyc = null; self.fr = null;
      if (then) then();
      self.renderAll();
    };
    if (C.Motion.reduced) { swap(); return; }
    this.gContent.style.opacity = 0;
    setTimeout(function () { swap(); self.gContent.style.opacity = 1; }, 220);
  };
  P.setView = function (name) {
    if (name === this.view) return;
    this.view = name;
    var a = this.ax, b = this.range(), self = this;
    if (this.vcancel) this.vcancel();
    this.vcancel = C.tween(720, function (k) {
      self.ax = { h0: a.h0 + (b.h0 - a.h0) * k, h1: a.h1 + (b.h1 - a.h1) * k, l0: a.l0 + (b.l0 - a.l0) * k, l1: a.l1 + (b.l1 - a.l1) * k };
      self.renderAll();
    });
  };

  window.PHChart = PHChart;
})();
