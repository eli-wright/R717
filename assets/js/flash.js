/* R-717 Training — flash gas calculator, P-h state points and valve animation. */
(function () {
  "use strict";
  var C = window.R717, R = window.R717Props;
  var DEF = {
    R717: { up: 85, uu: "F", dn: -5, du: "F" },
    R134a: { up: 85, uu: "F", dn: -5, du: "F" },
    R744: { up: 20, uu: "F", dn: -20, du: "F" }
  };

  // ---------------------------------------------------------- valve scene
  function Valve(stage) {
    var self = this;
    // two stacked canvases: a static layer (pipe, valve, labels) and a light dynamic layer (dots)
    this.stage = stage; this.layer = document.createElement("canvas"); stage.appendChild(this.layer);
    this.canvas = document.createElement("canvas"); stage.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d"); this.lctx = this.layer.getContext("2d");
    this.x = 0.175; this.parts = []; this.emit = 0; this.acc = 0; this.labels = ["", ""];
    this.loop = new C.Loop(stage, function (dt) { self.step(dt); self.draw(); });
    if (window.ResizeObserver) new ResizeObserver(function () { self.layout(); self.draw(); }).observe(stage);
    C.bus.addEventListener("motion", function () { if (!self.loop.id) self.draw(); });
    this.layout();
  }
  Valve.prototype.layout = function () {
    var narrow = this.stage.clientWidth < 600;
    this.L = narrow ? { W: 600, H: 300, cy: 160, hh: 40, vx: 300, short: true } : { W: 900, H: 260, cy: 140, hh: 34, vx: 450 };
    this.stage.style.aspectRatio = this.L.W + " / " + this.L.H;
    this.fit = C.fitCanvas(this.canvas, 2);
    this.layer.width = this.canvas.width; this.layer.height = this.canvas.height;
    this.drawStatic();
  };
  Valve.prototype.s = function () { return this.fit.w / this.L.W; };
  Valve.prototype.setT = function (c) { var s = this.s(); c.setTransform(this.fit.dpr * s, 0, 0, this.fit.dpr * s, 0, 0); };
  Valve.prototype.drawStatic = function () {
    var c = this.lctx, L = this.L, s = this.s();
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.layer.width, this.layer.height); this.setT(c);
    var top = L.cy - L.hh, bot = L.cy + L.hh;
    // pipe walls
    var g = c.createLinearGradient(0, top - 10, 0, bot + 10);
    g.addColorStop(0, "#3a4f6b"); g.addColorStop(.5, "#1c2b40"); g.addColorStop(1, "#101b2b");
    c.fillStyle = g; c.fillRect(0, top - 10, L.W, L.hh * 2 + 20);
    c.fillStyle = "#040a14"; c.fillRect(0, top, L.W, L.hh * 2);
    // tint: high pressure left, low pressure right
    var t = c.createLinearGradient(L.vx - 80, 0, L.vx + 80, 0);
    t.addColorStop(0, "rgba(91,149,255,.10)"); t.addColorStop(1, "rgba(69,219,232,.06)");
    c.fillStyle = t; c.fillRect(0, top, L.W, L.hh * 2);
    // valve body and throat
    c.fillStyle = "#22344f"; c.strokeStyle = "rgba(220,235,250,.6)"; c.lineWidth = 1.4;
    c.beginPath(); c.roundRect ? c.roundRect(L.vx - 34, top - 22, 68, L.hh * 2 + 44, 12) : c.rect(L.vx - 34, top - 22, 68, L.hh * 2 + 44); c.fill(); c.stroke();
    c.fillStyle = "#040a14";
    c.beginPath(); c.moveTo(L.vx - 34, top); c.lineTo(L.vx - 6, L.cy - 6); c.lineTo(L.vx + 6, L.cy - 6); c.lineTo(L.vx + 34, top);
    c.lineTo(L.vx + 34, bot); c.lineTo(L.vx + 6, L.cy + 6); c.lineTo(L.vx - 6, L.cy + 6); c.lineTo(L.vx - 34, bot); c.closePath(); c.fill();
    // stem and handwheel
    c.strokeStyle = "rgba(220,235,250,.7)"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(L.vx, top - 22); c.lineTo(L.vx, top - 46); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.ellipse(L.vx, top - 50, 22, 5, 0, 0, Math.PI * 2); c.stroke();
    // labels
    var fpx = function (px) { return (px / s).toFixed(1) + "px"; };
    c.fillStyle = "rgba(180,195,215,.9)"; c.font = "600 " + fpx(12) + " 'JetBrains Mono', monospace";
    c.textAlign = "left"; c.fillText(L.short ? "LIQUID" : "HIGH-PRESSURE LIQUID", 14, top - 34);
    c.textAlign = "right"; c.fillText(L.short ? "LIQUID + VAPOR" : "LIQUID + FLASH VAPOR", L.W - 14, top - 34);
    c.font = "500 " + fpx(12) + " 'JetBrains Mono', monospace"; c.fillStyle = "rgba(160,178,200,.85)";
    c.textAlign = "left"; c.fillText(this.labels[0], 14, bot + 30);
    c.textAlign = "right"; c.fillText(this.labels[1], L.W - 14, bot + 30);
  };
  Valve.prototype.set = function (x, labels) {
    this.x = Math.max(0, Math.min(1, x)); this.labels = labels; this.drawStatic();
    if (!this.loop.id) { this.parts = []; for (var i = 0; i < 360; i++) this.step(1 / 40); this.draw(); }
  };
  Valve.prototype.step = function (dt) {
    var L = this.L;
    this.emit += dt * 30;
    while (this.emit >= 1) {
      this.emit -= 1;
      var y0 = L.cy + (Math.random() * 2 - 1) * (L.hh - 6);
      this.parts.push({ x: -4, y: y0, y0: y0, vap: false, age: 0, checked: false });
    }
    for (var i = this.parts.length - 1; i >= 0; i--) {
      var p = this.parts[i];
      if (!p.checked && p.x >= L.vx) {
        p.checked = true;
        this.acc += this.x;
        if (this.acc >= 1 - 1e-9) { this.acc -= 1; p.vap = true; p.age = 0; }
      }
      var v = p.x < L.vx - 34 ? 70 : p.x < L.vx + 34 ? 120 : (p.vap ? 250 : 92);
      if (p.x > L.vx - 34 && p.x < L.vx + 34) p.y += (L.cy - p.y) * Math.min(1, dt * 9);   // squeeze through the throat
      else if (p.x >= L.vx + 34) { p.y += (p.y0 - p.y) * Math.min(1, dt * 2.2); if (p.vap) p.y += Math.sin(p.x * 0.05 + i) * dt * 30; }
      p.x += v * dt; p.age += dt;
      if (p.x > L.W + 10) this.parts.splice(i, 1);
    }
  };
  Valve.prototype.draw = function () {
    var c = this.ctx, L = this.L;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.setT(c);
    c.save(); c.beginPath(); c.rect(0, L.cy - L.hh, L.W, L.hh * 2); c.clip();
    c.globalCompositeOperation = "lighter";
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      if (p.vap) {
        var g = Math.min(1, p.age / 0.3), r = 2.6 + g * 3.4;
        if (p.age < 0.25) { c.strokeStyle = "rgba(220,250,255," + (0.6 * (1 - p.age / 0.25)) + ")"; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, 4 + p.age * 40, 0, 6.2832); c.stroke(); }
        c.fillStyle = "rgba(238,246,255,0.16)"; c.beginPath(); c.arc(p.x, p.y, r * 2.4, 0, 6.2832); c.fill();
        c.fillStyle = "rgba(238,246,255,0.92)"; c.beginPath(); c.arc(p.x, p.y, r, 0, 6.2832); c.fill();
      } else {
        c.fillStyle = p.x < L.vx ? "rgba(91,149,255,0.95)" : "rgba(105,175,255,0.95)";
        c.beginPath(); c.arc(p.x, p.y, 3, 0, 6.2832); c.fill();
      }
    }
    c.restore();
  };

  // --------------------------------------------------------------- module
  C.register("flash", function () {
    var $ = function (id) { return document.getElementById(id); };
    var fluid = $("fgFluid"), up = $("fgUp"), uu = $("fgUpUnit"), dn = $("fgDn"), du = $("fgDnUnit"), sub = $("fgSub"), subAmt = $("fgSubAmt");
    var msg = $("fgMsg"), pct = $("fgPct"), bar = $("fgBarA"), barWrap = $("fgBar");
    var chart = new window.PHChart($("fgChart"), { mode: "flash", ratio: 0.74, maxH: 470, label: "P-h diagram showing the state before and after the expansion valve" });
    var valve = new Valve($("valveStage"));
    var shown = 17.5, cancelPct = null;

    function setDefaults(k) {
      var d = DEF[k];
      up.value = d.up; uu.value = d.uu; dn.value = d.dn; du.value = d.du;
      sub.checked = false; $("fgSubAmtF").hidden = true; subAmt.value = 3.6;
      if (typeof prevUnit !== "undefined") { prevUnit.up = d.uu; prevUnit.dn = d.du; }
    }
    function invalid(ctl, on) { $(ctl).classList.toggle("invalid", on); $(ctl).querySelector("input").setAttribute("aria-invalid", String(on)); }
    function analysis(x) {
      var p = x * 100;
      if (p > 35) return "Very high. More than a third of the liquid is lost to flash gas before it cools anything. This happens with a very large lift or a refrigerant close to its critical point. Two-stage compression, an economizer or subcooling would cut this down.";
      if (p > 20) return "High. A fifth or more of the mass flashes off at the valve. Subcooling the liquid, or flashing part of it at an intermediate pressure (economizer or intercooler), would cut this.";
      if (p > 10) return "Typical for a single-stage system. Keep the liquid line free of restrictions and heat gain so it does not flash before the valve.";
      if (p > 0) return "Low. The lift between condensing and evaporating is small, or the liquid is well subcooled.";
      return "No flash gas: the liquid is already at or below the evaporator temperature.";
    }
    function run() {
      var k = fluid.value, F = C.fmt;
      var a = R.parseState(k, parseFloat(up.value), uu.value), b = R.parseState(k, parseFloat(dn.value), du.value);
      invalid("fgUpCtl", !a.ok); invalid("fgDnCtl", !b.ok);
      msg.className = "msg";
      if (!a.ok || !b.ok) {
        msg.classList.add("err");
        msg.textContent = (!a.ok ? "Before the valve: " + a.msg : "") + (!a.ok && !b.ok ? " " : "") + (!b.ok ? "After the valve: " + b.msg : "");
        return;
      }
      var sc = 0;
      if (sub.checked) {
        sc = parseFloat(subAmt.value);
        if (!isFinite(sc) || sc < 0) { msg.classList.add("err"); msg.textContent = "Enter a subcooling amount of 0°F or more."; return; }
      }
      var r = R.flash(k, a, b, sc);
      if (!r.ok) { invalid("fgUpCtl", true); invalid("fgDnCtl", true); msg.classList.add("err"); msg.textContent = r.msg; return; }
      msg.textContent = "";
      if (r.note) { msg.classList.add("info"); msg.textContent = r.note; }
      $("fgUpHint").textContent = "= " + F(r.Tup, 1) + "°F · " + F(r.Pup - R.ATM, 1) + " psig";
      $("fgDnHint").textContent = "= " + F(r.Tdown, 1) + "°F · " + F(r.Pdown - R.ATM, 1) + " psig";
      var target = r.x * 100, from = shown;
      if (cancelPct) cancelPct();
      cancelPct = C.tween(650, function (q) { shown = from + (target - from) * q; pct.textContent = F(shown, 1) + "%"; }, { ease: C.ease.out });
      bar.style.width = Math.max(0, Math.min(100, target)) + "%";
      barWrap.setAttribute("aria-label", F(target, 1) + " percent flash gas, " + F(100 - target, 1) + " percent liquid");
      $("fgAnalysis").textContent = analysis(r.x);
      $("fgFormula").innerHTML = "(" + F(r.hIn, 1) + " − " + F(r.hf, 1) + ") ÷ " + F(r.hfg, 1) + " = " + F(r.x, 3) +
        ' <span class="lbl">→ ' + F(target, 1) + "%</span>";
      var kv = [
        ["Liquid before valve", F(r.Pup - R.ATM, 1) + " psig · " + F(r.Tliq, 1) + "°F"],
        ["h before valve", F(r.hIn, 1) + " BTU/lb"],
        ["After valve", F(r.Pdown - R.ATM, 1) + " psig · " + F(r.Tdown, 1) + "°F"],
        ["hf · hg after", F(r.hf, 1) + " · " + F(r.hg, 1)],
        ["Liquid left", F(100 - target, 1) + "%"],
        ["Vapor by volume", F(r.volFrac * 100, 1) + "%"]
      ];
      $("fgStates").innerHTML = kv.map(function (x) { return '<div><div class="k">' + x[0] + '</div><div class="v">' + x[1] + "</div></div>"; }).join("");
      chart.setFlash(r, k);
      $("valvePill").textContent = F(target, 1) + "% flashes";
      valve.set(r.x, [F(r.Pup - R.ATM, 1) + " psig · " + F(r.Tliq, 1) + "°F", F(r.Pdown - R.ATM, 1) + " psig · " + F(r.Tdown, 1) + "°F"]);
    }
    var tId = 0;
    function soon() { clearTimeout(tId); tId = setTimeout(run, 120); }
    [up, dn, subAmt].forEach(function (i) { i.addEventListener("input", soon); });
    var prevUnit = { up: uu.value, dn: du.value };
    [[uu, up, "up"], [du, dn, "dn"]].forEach(function (z) {
      var sel = z[0], input = z[1], key = z[2];
      sel.addEventListener("change", function () {
        // convert the number to the new unit so the state does not jump
        var st = R.parseState(fluid.value, parseFloat(input.value), prevUnit[key]);
        if (st.ok) input.value = sel.value === "F" ? st.T.toFixed(1) : sel.value === "PSIG" ? (st.P - R.ATM).toFixed(1) : st.P.toFixed(1);
        prevUnit[key] = sel.value;
        run();
      });
    });
    sub.addEventListener("change", function () { $("fgSubAmtF").hidden = !sub.checked; run(); });
    fluid.addEventListener("change", function () { setDefaults(fluid.value); run(); });
    $("fgReset").addEventListener("click", function () { fluid.value = "R717"; setDefaults("R717"); run(); });
    run();
  });
})();
