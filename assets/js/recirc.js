/* R-717 Training — recirculator cutaway with overfeed flow animation (canvas). */
(function () {
  "use strict";
  var C = window.R717, R = window.R717Props;

  var LAY = {
    wide: {
      W: 900, H: 470,
      ves: { x: 300, y: 120, w: 420, h: 180 }, level: 0.42,
      coil: { x: 50, y: 140, w: 140, h: 200 },
      pump: { x: 510, y: 395, r: 30 },
      valve: { x: 790, y: 250 },
      inlet: [380, 122], outlet: [640, 122],
      paths: {
        pumped: [[510, 300], [510, 365], [480, 395], [120, 395], [120, 352], [120, 330], [70, 330], [70, 300], [170, 300], [170, 270], [70, 270], [70, 240], [170, 240], [170, 210], [70, 210], [70, 180], [170, 180], [170, 152], [120, 152], [120, 132], [120, 70], [380, 70], [380, 122]],
        coilFrom: 4, coilTo: 18,
        dry: [[640, 122], [640, 60], [905, 60]],
        makeup: [[905, 250], [722, 250]]
      },
      labels: [
        [250, 54, "Wet return: liquid + vapor", "center"],
        [892, 44, "Dry vapor to compressors", "right"],
        [892, 234, "Liquid make-up", "right"],
        [204, 246, "Evaporator", "left"],
        [548, 400, "Pump", "left"],
      ],
      pool: [520, 284],
      heat: [[12, 200], [12, 240], [12, 280]]
    },
    tall: {
      W: 520, H: 590,
      ves: { x: 110, y: 250, w: 330, h: 150 }, level: 0.42,
      coil: { x: 40, y: 50, w: 160, h: 150 },
      pump: { x: 280, y: 500, r: 28 },
      valve: { x: 484, y: 330 },
      inlet: [232, 252], outlet: [380, 252],
      paths: {
        pumped: [[280, 400], [280, 472], [252, 500], [60, 500], [60, 205], [60, 182], [185, 182], [185, 156], [55, 156], [55, 130], [185, 130], [185, 104], [55, 104], [55, 78], [185, 78], [185, 56], [120, 56], [120, 40], [120, 24], [232, 24], [232, 252]],
        coilFrom: 4, coilTo: 16,
        dry: [[380, 252], [380, 170], [525, 170]],
        makeup: [[525, 330], [442, 330]]
      },
      labels: [
        [242, 112, "Wet return", "left"],
        [512, 156, "Dry vapor out", "right"],
        [512, 316, "Make-up", "right"],
        [70, 226, "Evaporator", "left"],
        [318, 506, "Pump", "left"],
      ],
      pool: [275, 384],
      heat: [[8, 90], [8, 125], [8, 160]]
    }
  };

  function Path(pts) {
    this.pts = pts; this.cum = [0];
    for (var i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
  }
  Path.prototype.at = function (s) {
    var c = this.cum, i = 1;
    if (s <= 0) return this.pts[0];
    while (i < c.length - 1 && c[i] < s) i++;
    var u = (s - c[i - 1]) / (c[i] - c[i - 1] || 1), a = this.pts[i - 1], b = this.pts[i];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };

  C.register("recirc", function () {
    var stage = document.getElementById("recircStage");
    if (!stage) return;
    var canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    stage.appendChild(canvas);
    var slider = document.getElementById("overfeed");
    var N = parseFloat(slider.value), L, name = "", paths, staticLayer = document.createElement("canvas"), sctx = staticLayer.getContext("2d");
    var P = [], free = [], dry = [], mk = [], ripples = [], acc = 0, accF = 0, emitP = 0, emitM = 0, angle = 0, t = 0, fit;

    // conditions for the example: -20 F vessel, 85 F make-up liquid (from props.json)
    var Te = -20, Tl = 85, e = R.sat("R717", Te), l = R.sat("R717", Tl);
    var makeupRatio = e.hfg / (e.hg - l.hf);                  // make-up lb per lb boiled in coils
    var flashMk = (l.hf - e.hf) / e.hfg;                       // make-up that flashes on entry
    var RATE = 2.4;                                            // lb boiled per second, in dots

    function layout() {
      var n = stage.clientWidth < 700 ? "tall" : "wide";
      if (n !== name) {
        name = n; L = LAY[n];
        stage.style.aspectRatio = L.W + " / " + L.H;
        paths = { pumped: new Path(L.paths.pumped), dry: new Path(L.paths.dry), makeup: new Path(L.paths.makeup) };
        paths.coilStart = paths.pumped.cum[L.paths.coilFrom];
        paths.coilEnd = paths.pumped.cum[L.paths.coilTo];
        P = []; free = []; dry = []; mk = []; ripples = [];
        warm();
      }
      fit = C.fitCanvas(canvas, 2);
      staticLayer.width = canvas.width; staticLayer.height = canvas.height;
      drawStatic();
    }
    function surfaceY() { return L.ves.y + L.ves.h * (1 - L.level); }
    function capsule(c, b, d) {
      var x = b.x + d, y = b.y + d, w = b.w - 2 * d, h = b.h - 2 * d, r = h / 2;
      c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      c.lineTo(x + r, y + h); c.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); c.closePath();
    }
    function line(c, pts, w, col) {
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.lineWidth = w; c.strokeStyle = col; c.lineJoin = "round"; c.lineCap = "round"; c.stroke();
    }
    function sc() { return fit.w / L.W; }
    function setT(c) { var s = sc(); c.setTransform(fit.dpr * s, 0, 0, fit.dpr * s, 0, 0); }
    function text(c, x, y, str, align, px, col) {
      var s = sc();
      c.font = "500 " + (px / s).toFixed(1) + "px 'JetBrains Mono', ui-monospace, monospace";
      c.fillStyle = col || "rgba(180,195,215,.85)";
      c.textAlign = align === "right" ? "right" : align === "center" ? "center" : "left";
      c.fillText(str, x, y);
    }

    function drawStatic() {
      var c = sctx;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, staticLayer.width, staticLayer.height);
      setT(c);
      var p = L.paths;
      // pipes
      [p.pumped, p.dry, p.makeup].forEach(function (pts) { line(c, pts, 12, "#1c2f4a"); line(c, pts, 7.5, "#081322"); });
      line(c, p.pumped.slice(0, p.coilFrom + 1), 2, "rgba(91,149,255,.3)");
      line(c, p.pumped.slice(p.coilTo), 2, "rgba(69,219,232,.3)");
      line(c, p.dry, 2, "rgba(238,246,255,.3)");
      line(c, p.makeup, 2, "rgba(91,149,255,.3)");
      // coil box
      var cb = L.coil;
      c.fillStyle = "#0d1c30"; c.strokeStyle = "rgba(200,220,245,.35)"; c.lineWidth = 1.2;
      roundRect(c, cb.x, cb.y, cb.w, cb.h, 10); c.fill(); c.stroke();
      c.fillStyle = "#06101e"; roundRect(c, cb.x + 6, cb.y + 6, cb.w - 12, cb.h - 12, 6); c.fill();
      c.strokeStyle = "rgba(150,185,230,.08)"; c.lineWidth = 1;
      for (var x = cb.x + 12; x < cb.x + cb.w - 6; x += 7) { c.beginPath(); c.moveTo(x, cb.y + 8); c.lineTo(x, cb.y + cb.h - 8); c.stroke(); }
      var coilPts = p.pumped.slice(p.coilFrom, p.coilTo + 1);
      line(c, coilPts, 7, "#22395a"); line(c, coilPts, 3.5, "#0a1729");
      // heat arrows into the coil
      c.strokeStyle = "rgba(255,174,79,.55)"; c.lineWidth = 1.6;
      L.heat.forEach(function (h) { c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(h[0] + 24, h[1]); c.lineTo(h[0] + 18, h[1] - 5); c.moveTo(h[0] + 24, h[1]); c.lineTo(h[0] + 18, h[1] + 5); c.stroke(); });
      // vessel shell
      var v = L.ves, g = c.createLinearGradient(0, v.y, 0, v.y + v.h);
      g.addColorStop(0, "#3a4f6b"); g.addColorStop(0.45, "#1c2b40"); g.addColorStop(1, "#101b2b");
      capsule(c, v, 0); c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(200,220,245,.55)"; c.lineWidth = 1.4; c.stroke();
      capsule(c, v, 7); c.fillStyle = "#040a14"; c.fill();
      // cutaway edge highlight
      c.strokeStyle = "rgba(95,227,240,.18)"; c.setLineDash([5, 6]); capsule(c, v, 7); c.stroke(); c.setLineDash([]);
      // nozzles
      [L.inlet, L.outlet].forEach(function (n) { c.fillStyle = "#24385a"; c.fillRect(n[0] - 9, n[1] - 10, 18, 12); });
      // pump casing
      var pu = L.pump;
      c.beginPath(); c.arc(pu.x, pu.y, pu.r, 0, Math.PI * 2); c.fillStyle = "#16253b"; c.fill(); c.strokeStyle = "rgba(200,220,245,.55)"; c.stroke();
      c.beginPath(); c.arc(pu.x, pu.y, pu.r - 6, 0, Math.PI * 2); c.fillStyle = "#050c17"; c.fill();
      // make-up valve
      var va = L.valve;
      c.beginPath(); c.moveTo(va.x - 12, va.y - 9); c.lineTo(va.x, va.y); c.lineTo(va.x - 12, va.y + 9); c.closePath();
      c.moveTo(va.x + 12, va.y - 9); c.lineTo(va.x, va.y); c.lineTo(va.x + 12, va.y + 9); c.closePath();
      c.fillStyle = "#2a3f5e"; c.fill(); c.strokeStyle = "rgba(220,235,250,.7)"; c.stroke();
      // labels
      L.labels.forEach(function (lb) { text(c, lb[0], lb[1], lb[2], lb[3], 12.5); });
    }
    function roundRect(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }

    // --------------------------------------------------------- simulation
    function step(dt) {
      t += dt;
      var pumpRate = N * RATE, mkRate = makeupRatio * RATE;
      emitP += dt * pumpRate; emitM += dt * mkRate;
      while (emitP >= 1) {
        emitP -= 1; acc += 1 / N;
        var boil = acc >= 1 - 1e-9;
        if (boil) acc -= 1;
        P.push({ s: Math.random() * 4, vap: false, boilAt: boil ? paths.coilStart + (0.2 + Math.random() * 0.75) * (paths.coilEnd - paths.coilStart) : Infinity, j: (Math.random() - .5) * 4 });
      }
      while (emitM >= 1) { emitM -= 1; mk.push({ s: Math.random() * 4 }); }
      var pl = paths.pumped.len;
      for (var i = P.length - 1; i >= 0; i--) {
        var q = P[i];
        if (!q.vap && q.s >= q.boilAt) q.vap = true;
        var inCoil = q.s > paths.coilStart && q.s < paths.coilEnd;
        q.s += dt * (q.vap ? 150 : inCoil ? 60 : 78);
        if (q.s >= pl) {
          P.splice(i, 1);
          var ent = L.inlet;
          free.push({ x: ent[0] + q.j, y: ent[1] + 4, vx: q.vap ? 30 : (Math.random() - .3) * 24, vy: q.vap ? 30 : 40, vap: q.vap });
        }
      }
      for (var k = mk.length - 1; k >= 0; k--) {
        var m = mk[k];
        m.s += dt * 46;
        if (m.s >= paths.makeup.len) {
          mk.splice(k, 1);
          accF += flashMk;
          if (accF >= 1) { accF -= 1; var end = paths.makeup.at(paths.makeup.len); free.push({ x: end[0] - 8, y: end[1], vx: -20, vy: -40, vap: true }); }
        }
      }
      var sy = surfaceY(), out = L.outlet;
      for (var f = free.length - 1; f >= 0; f--) {
        var p = free[f];
        if (p.vap) {
          var dx = out[0] - p.x, dy = (out[1] + 6) - p.y, d = Math.hypot(dx, dy) || 1;
          p.vx += (dx / d * 150 - p.vx) * Math.min(1, dt * 2.5) + (Math.random() - .5) * 30 * dt;
          p.vy += (dy / d * 150 - p.vy) * Math.min(1, dt * 2.5);
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (d < 12) { free.splice(f, 1); dry.push({ s: 0 }); }
        } else {
          p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y >= sy) { free.splice(f, 1); ripples.push({ x: p.x, t: 0 }); }
        }
      }
      for (var d2 = dry.length - 1; d2 >= 0; d2--) { dry[d2].s += dt * 170; if (dry[d2].s >= paths.dry.len) dry.splice(d2, 1); }
      for (var r2 = ripples.length - 1; r2 >= 0; r2--) { ripples[r2].t += dt; if (ripples[r2].t > 0.7) ripples.splice(r2, 1); }
      angle += dt * (4 + N * 2.2);
    }
    function warm() { for (var i = 0; i < 240; i++) step(1 / 40); }

    function dot(x, y, r, col, a, glow) {
      if (glow) { ctx.fillStyle = "rgba(" + col + "," + (a * 0.18) + ")"; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.2832); ctx.fill(); }
      ctx.fillStyle = "rgba(" + col + "," + a + ")"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(staticLayer, 0, 0);
      setT(ctx);
      var v = L.ves, sy = surfaceY();
      // liquid pool with a moving surface
      ctx.save(); capsule(ctx, v, 7); ctx.clip();
      ctx.beginPath(); ctx.moveTo(v.x, sy);
      for (var x = v.x; x <= v.x + v.w; x += 8) ctx.lineTo(x, sy + Math.sin(x * 0.05 + t * 2.2) * 2 + Math.sin(x * 0.11 - t * 1.4) * 1.2);
      ctx.lineTo(v.x + v.w, v.y + v.h); ctx.lineTo(v.x, v.y + v.h); ctx.closePath();
      var lg = ctx.createLinearGradient(0, sy, 0, v.y + v.h); lg.addColorStop(0, "rgba(106,168,255,.85)"); lg.addColorStop(1, "rgba(29,79,184,.9)");
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = "rgba(200,230,255,.6)"; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (var x2 = v.x; x2 <= v.x + v.w; x2 += 8) { var yy = sy + Math.sin(x2 * 0.05 + t * 2.2) * 2 + Math.sin(x2 * 0.11 - t * 1.4) * 1.2; if (x2 === v.x) ctx.moveTo(x2, yy); else ctx.lineTo(x2, yy); }
      ctx.stroke();
      text(ctx, L.pool[0], L.pool[1], "Liquid pool", "center", 12.5, "rgba(230,242,255,.85)");
      ripples.forEach(function (rp) { ctx.strokeStyle = "rgba(220,240,255," + (0.6 * (1 - rp.t / 0.7)) + ")"; ctx.beginPath(); ctx.ellipse(rp.x, sy, 3 + rp.t * 26, 1 + rp.t * 4, 0, 0, Math.PI * 2); ctx.stroke(); });
      ctx.restore();
      // particles
      ctx.globalCompositeOperation = "lighter";
      var sDot = 2.3;
      P.forEach(function (q) { var a = paths.pumped.at(q.s); if (q.vap) dot(a[0] + q.j, a[1], sDot * 1.6, "238,246,255", 0.9, true); else dot(a[0], a[1], sDot, "91,149,255", 0.95, true); });
      mk.forEach(function (m) { var a = paths.makeup.at(m.s); dot(a[0], a[1], sDot, "91,149,255", 0.9, true); });
      free.forEach(function (p) { if (p.vap) dot(p.x, p.y, sDot * 1.6, "238,246,255", 0.85, true); else dot(p.x, p.y, sDot, "120,170,255", 0.95, true); });
      dry.forEach(function (d) { var a = paths.dry.at(d.s); dot(a[0], a[1], sDot * 1.6, "238,246,255", 0.85, true); });
      ctx.globalCompositeOperation = "source-over";
      // impeller
      var pu = L.pump;
      ctx.strokeStyle = "#9fd6ff"; ctx.lineWidth = 1.8;
      for (var b = 0; b < 6; b++) {
        var an = angle + b * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(pu.x, pu.y);
        ctx.quadraticCurveTo(pu.x + Math.cos(an + .8) * (pu.r - 10) * .7, pu.y + Math.sin(an + .8) * (pu.r - 10) * .7, pu.x + Math.cos(an) * (pu.r - 9), pu.y + Math.sin(an) * (pu.r - 9));
        ctx.stroke();
      }
      ctx.fillStyle = "#cfe8ff"; ctx.beginPath(); ctx.arc(pu.x, pu.y, 3, 0, 6.2832); ctx.fill();
    }

    var loop = new C.Loop(stage, function (dt) { step(dt); draw(); });
    function readouts() {
      var out = document.getElementById("overfeedOut");
      out.textContent = N.toFixed(1) + " : 1";
      slider.style.setProperty("--p", ((N - 1) / 5 * 100) + "%");
      document.getElementById("ofPump").textContent = N.toFixed(1) + " lb";
      document.getElementById("ofRet").textContent = (N - 1).toFixed(1) + " lb";
      var volV = e.vg / (e.vg + (N - 1) * e.vf);
      document.getElementById("ofVol").textContent = N <= 1
        ? "Per pound boiled. At 1:1 every drop boils in the coil, like a DX coil — no wet return and no wetting margin."
        : "Per pound boiled. At " + C.fmt(Te, 0) + "°F the wet return is about " + C.fmt(volV * 100, 1) + "% vapor by volume but " +
          C.fmt((N - 1) / N * 100, 1) + "% liquid by weight. Make-up liquid at " + C.fmt(Tl, 0) + "°F flashes about " + C.fmt(flashMk * 100, 0) + "% as it enters.";
      document.getElementById("overfeedHint").textContent = N < 2 ? "Below 2:1 the coil starts to run dry near the outlet." : N > 4 ? "Above 4:1 the pumps and wet return lines get bigger for little gain." : "Common systems run about 2:1 to 4:1.";
    }
    slider.addEventListener("input", function () {
      N = parseFloat(slider.value); readouts();
      if (!loop.id) { warm(); draw(); }
    });
    C.bus.addEventListener("motion", function () { if (!loop.id) draw(); });
    layout(); readouts(); draw();
    if (window.ResizeObserver) new ResizeObserver(function () { layout(); draw(); }).observe(stage);
  });
})();
