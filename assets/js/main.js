/* R-717 Training — page orchestration. */
(function () {
  "use strict";
  var C = window.R717, R = window.R717Props, $ = C.$, $$ = C.$$, doc = document.documentElement;
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var KEY = "r717.progress.v2";

  // -------------------------------------------------------------- motion
  var motionBtn = $("#motionBtn");
  function syncMotionBtn() {
    var r = C.Motion.reduced;
    motionBtn.setAttribute("aria-pressed", String(r));
    motionBtn.title = r ? "Motion is reduced. Select to allow animation." : "Reduce motion";
    motionBtn.querySelector(".txt").textContent = r ? "Motion off" : "Reduce motion";
  }
  motionBtn.addEventListener("click", function () { C.Motion.set(!C.Motion.reduced); });
  C.bus.addEventListener("motion", function () {
    syncMotionBtn();
    if (C.Motion.reduced && gsap) {
      gsap.set("[data-reveal]", { autoAlpha: 1, y: 0, clearProps: "transform" });
      if (ST) ST.getAll().forEach(function (t) { if (t.vars && t.vars.scrub) t.disable(false); });
      gsap.set(".hero .wrap, .module-num", { clearProps: "all" });
    }
  });
  doc.classList.toggle("reduce-motion", C.Motion.reduced);
  syncMotionBtn();

  // ---------------------------------------------------- modules & progress
  var mods = $$("section.module");
  var done = {};
  (C.store.get(KEY, []) || []).forEach(function (id) { done[id] = true; });
  var rail = $("#railList"), menuList = $("#menuList");
  mods.forEach(function (m, i) {
    var n = String(i + 1).padStart(2, "0"), name = m.dataset.module, icon = m.dataset.icon;
    rail.insertAdjacentHTML("beforeend", '<li><a href="#' + m.id + '" data-mod="' + m.id + '"><span class="dot"><span class="n">' + n +
      '</span><svg aria-hidden="true"><use href="#i-check"/></svg></span><span class="lbl">' + C.esc(name) + "</span></a></li>");
    menuList.insertAdjacentHTML("beforeend", '<li><a href="#' + m.id + '" data-mod="' + m.id + '"><span class="num">' + n +
      '</span><svg class="ico" aria-hidden="true"><use href="#' + icon + '"/></svg><span class="t">' + C.esc(name) + '</span><span class="st"></span></a></li>');
  });
  function renderProgress() {
    var n = 0;
    mods.forEach(function (m) {
      var d = !!done[m.id];
      if (d) n++;
      $$('a[data-mod="' + m.id + '"]').forEach(function (a) { a.classList.toggle("done", d); var st = a.querySelector(".st"); if (st) st.textContent = d ? "Complete" : ""; });
    });
    $("#ringFg").setAttribute("stroke-dashoffset", (81.68 * (1 - n / mods.length)).toFixed(2));
    $("#progressLabel").textContent = n + "/" + mods.length;
    $("#menuProgress").textContent = n === mods.length ? "All modules complete. Nice work." :
      n + " of " + mods.length + " modules complete. Progress is saved in this browser.";
  }
  function complete(id) {
    if (done[id]) return;
    done[id] = true;
    C.store.set(KEY, Object.keys(done));
    renderProgress();
  }
  $("#resetProgress").addEventListener("click", function () { done = {}; C.store.del(KEY); renderProgress(); });
  if ("IntersectionObserver" in window) {
    // a module counts as complete when its end stays on screen for a moment,
    // so jumping past modules (menu links, fast scrolling) does not tick them off
    var timers = {};
    var endIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var id = e.target.parentNode.id;
        clearTimeout(timers[id]);
        if (e.isIntersecting) timers[id] = setTimeout(function () { complete(id); }, 600);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    mods.forEach(function (m) { var s = m.querySelector(".module-end"); if (s) endIO.observe(s); });
    var now = $("#topbarNow");
    var curIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id, i = mods.indexOf(e.target);
        $$("#railList a").forEach(function (a) { a.classList.toggle("current", a.dataset.mod === id); if (a.dataset.mod === id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
        now.innerHTML = "<b>" + String(i + 1).padStart(2, "0") + "</b>" + C.esc(e.target.dataset.module);
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    mods.forEach(function (m) { curIO.observe(m); });
  }
  renderProgress();

  // menu dialog
  var menu = $("#menu");
  function openMenu() { if (menu.showModal) menu.showModal(); else menu.setAttribute("open", ""); }
  function closeMenu() { if (menu.open) menu.close(); }
  $("#menuBtn").addEventListener("click", openMenu);
  $("#progressBtn").addEventListener("click", openMenu);
  $$("[data-close-menu]").forEach(function (b) { b.addEventListener("click", closeMenu); });
  menuList.addEventListener("click", function (e) { if (e.target.closest("a")) closeMenu(); });

  // scroll progress bar
  var bar = $("#scrollbar"), ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ")";
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ------------------------------------------------------- accordions
  $$("details.acc").forEach(function (d) {
    var s = d.querySelector("summary"), body = d.querySelector(".acc-body");
    s.addEventListener("click", function (e) {
      if (C.Motion.reduced || !body.animate) return;
      e.preventDefault();
      if (d.open) {
        var a = body.animate([{ height: body.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 260, easing: "cubic-bezier(.5,0,.75,0)" });
        a.onfinish = function () { d.open = false; };
      } else {
        d.open = true;
        var h = body.offsetHeight;
        body.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 380, easing: "cubic-bezier(.16,1,.3,1)" });
      }
    });
  });
  function filterList(input, list, empty, extra) {
    var q = input.value.trim().toLowerCase(), shown = 0;
    $$("details.acc", list).forEach(function (d) {
      var ok = (!q || d.textContent.toLowerCase().indexOf(q) > -1) && (!extra || extra(d));
      d.hidden = !ok; if (ok) shown++;
    });
    empty.hidden = shown > 0;
    return shown;
  }
  var tsTag = "all", tsSearch = $("#tsSearch");
  function tsRun() {
    var n = filterList(tsSearch, $("#tsList"), $("#tsEmpty"), function (d) { return tsTag === "all" || (" " + d.dataset.tags + " ").indexOf(" " + tsTag + " ") > -1; });
    $("#tsCount").textContent = n + " topics shown";
  }
  tsSearch.addEventListener("input", tsRun);
  $$("#tsChips button").forEach(function (b) {
    b.addEventListener("click", function () {
      tsTag = b.dataset.tag;
      $$("#tsChips button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      tsRun();
    });
  });
  $("#qaSearch").addEventListener("input", function () { filterList($("#qaSearch"), $("#qaList"), $("#qaEmpty")); });

  // system selection guide
  var REC = {
    small: ["Small, single load: direct expansion (DX)", "For a single small load, DX is often the simplest choice. It has the smallest charge and the lowest first cost, where top efficiency is not the main goal."],
    medium: ["Medium, one or a few loads: flooded", "For a single large freezer or a process chiller, a flooded evaporator with a surge drum gives better heat transfer than DX. It balances performance and complexity."],
    large: ["Large, many evaporators: liquid recirculation", "For big multi-room plants — food processing, cold storage warehouses — recirculation is the usual choice. One central vessel and pump set serves many evaporators with fully wetted coils, which justifies the higher first cost."]
  };
  $$("#sysGuide button").forEach(function (b) {
    b.addEventListener("click", function () {
      $$("#sysGuide button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      var r = REC[b.dataset.size];
      $("#sysRec").innerHTML = "<h4>" + r[0] + '</h4><p class="muted">' + r[1] + "</p>";
      if (!C.Motion.reduced && gsap) gsap.from("#sysRec", { autoAlpha: 0, y: 10, duration: .5, ease: "expo.out" });
    });
  });

  // ------------------------------------------------------------ hero intro
  var h1 = $("#heroTitle");
  $$(".w", h1).forEach(function (w) {
    var txt = w.textContent; w.textContent = "";
    for (var i = 0; i < txt.length; i++) { var s = document.createElement("span"); s.className = "ch"; s.textContent = txt[i]; w.appendChild(s); }
  });
  // gradient text across per-character spans: give each character its slice of one shared gradient
  function paintAccent() {
    var acc = $(".hero h1 .accent");
    if (!acc) return;
    var w = acc.offsetWidth;
    $$(".ch", acc).forEach(function (c) {
      c.style.backgroundSize = w + "px 100%";
      c.style.backgroundPosition = (-(c.offsetLeft - acc.offsetLeft)) + "px 0";
    });
  }
  paintAccent();
  window.addEventListener("resize", paintAccent);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintAccent);
  var intros = $$("[data-intro]");
  function heroIntro() {
    doc.classList.add("intro-run");
    if (!gsap || C.Motion.reduced) { intros.forEach(function (e) { e.style.opacity = 1; }); return; }
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(".hero .ch", { yPercent: 115, rotate: 5, duration: 1.3, stagger: 0.028 }, 0.1)
      .fromTo(intros, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1 }, 0.35);
  }
  heroIntro();

  // ------------------------------------------------------ scroll reveals
  function setupReveals() {
    doc.classList.remove("anim-pending");
    if (!gsap || !ST || C.Motion.reduced) return false;
    gsap.registerPlugin(ST);
    gsap.set("[data-reveal]", { autoAlpha: 0, y: 26 });
    ST.batch("[data-reveal]", {
      start: "top 90%", once: true,
      onEnter: function (b) { gsap.to(b, { autoAlpha: 1, y: 0, duration: 0.95, ease: "expo.out", stagger: 0.07, overwrite: true }); }
    });
    $$(".module-num").forEach(function (n) {
      gsap.fromTo(n, { yPercent: 22 }, { yPercent: -22, ease: "none", scrollTrigger: { trigger: n.closest(".module"), start: "top bottom", end: "bottom top", scrub: true } });
    });
    gsap.to(".hero .wrap", { yPercent: 12, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.fromTo("#ladderFill", { scaleY: 1 }, { scaleY: 0, ease: "none", scrollTrigger: { trigger: "#ladder", start: "top 80%", end: "bottom 65%", scrub: 0.6 } });
    return true;
  }
  var animated = setupReveals();
  if (!animated) { var lf = $("#ladderFill"); if (lf) lf.style.transform = "scaleY(0)"; }

  // ------------------------------------------------------- data binding
  function bind() {
    var F = C.fmt, D = R.data();
    $$("[data-p]").forEach(function (el) {
      var a = el.dataset.p.split("|"), s = R.sat(a[0], parseFloat(a[1]));
      if (s) el.textContent = F(s[a[2]], parseInt(a[3], 10));
    });
    $$("[data-tsat]").forEach(function (el) {
      var a = el.dataset.tsat.split("|"), t = R.tsat(a[0], parseFloat(a[1]));
      if (t !== null) el.textContent = F(t, parseInt(a[2], 10));
    });
    $$("[data-fl]").forEach(function (el) {
      var a = el.dataset.fl.split("|"), k = a[0];
      var r = R.flash(k, R.parseState(k, parseFloat(a[1]), "F"), R.parseState(k, parseFloat(a[2]), "F"), parseFloat(a[3]));
      var v = a[4] === "x" ? r.x * 100 : a[4] === "liq" ? (1 - r.x) * 100 : r.volFrac * 100;
      el.textContent = F(v, parseInt(a[5], 10));
    });
    $$("[data-env]").forEach(function (el) {
      var a = el.dataset.env.split("|"), e = D.env[a[0]];
      if (e) el.textContent = F(e[a[1]], a[1] === "odp" && e.odp % 1 ? 2 : 0);
    });
    $$("[data-m]").forEach(function (el) { var a = el.dataset.m.split("|"); el.textContent = F(R.fluid(a[0]).M, parseInt(a[1], 10)); });
    $$("[data-mair]").forEach(function (el) { el.textContent = F(D.meta.M_air, parseInt(el.dataset.mair, 10)); });
    $$("[data-wsat]").forEach(function (el) { var a = el.dataset.wsat.split("|"); el.textContent = F(D.water[a[0]].T, parseInt(a[1], 10)); });
    $("#propSource").textContent = D.meta.source;
    // latent heat bars
    var max = 0, vals = {};
    $$("[data-bar]").forEach(function (b) { vals[b.dataset.bar] = R.sat(b.dataset.bar, 5).hfg; max = Math.max(max, vals[b.dataset.bar]); });
    $$("[data-bar]").forEach(function (b) {
      var k = vals[b.dataset.bar] / max;
      if (animated) gsap.fromTo(b, { scaleX: 0 }, { scaleX: k, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: "#latentBars", start: "top 85%", once: true } });
      else b.style.transform = "scaleX(" + k + ")";
    });
  }
  function countUps() {
    if (C.Motion.reduced) return;
    $$("[data-count]").forEach(function (el, i) {
      var txt = el.textContent.replace("−", "-").replace(/,/g, ""), to = parseFloat(txt);
      if (!isFinite(to)) return;
      var dp = (txt.split(".")[1] || "").length, from = el.dataset.from ? parseFloat(el.dataset.from) : 0, plain = !!el.dataset.from;
      setTimeout(function () {
        C.tween(1600, function (k) { var v = from + (to - from) * k; el.textContent = plain ? Math.round(v).toString() : C.fmt(v, dp); }, { ease: C.ease.out });
      }, 700 + i * 90);
    });
  }

  // ------------------------------------------------ hero P-h line art
  function heroArt() {
    var host = $("#heroArt");
    if (!host) return;
    var f = R.fluid("R717"), W = 800, H = 640, h0 = -80, h1 = 780, l0 = Math.log10(6), l1 = Math.log10(2600);
    var X = function (h) { return 30 + (h - h0) / (h1 - h0) * (W - 60); };
    var Y = function (P) { return H - 30 - (Math.log10(P) - l0) / (l1 - l0) * (H - 60); };
    var path = function (pts) { return pts.map(function (q, i) { return (i ? "L" : "M") + X(q[0]).toFixed(1) + " " + Y(q[1]).toFixed(1); }).join(""); };
    var d = f.dome, liq = [], vap = [];
    for (var i = 0; i < d.P.length; i++) if (d.P[i] >= 6) { liq.push([d.hf[i], d.P[i]]); vap.push([d.hg[i], d.P[i]]); }
    var dome = liq.concat([[f.crit.h, f.crit.P]]).concat(vap.reverse());
    var c = R.cycle("R717", -5, 85, 0);
    var loop = c.path12.map(function (q) { return [q.h, q.P]; }).concat([[c.p2s.h, c.p2s.P], [c.p3.h, c.p3.P], [c.p4.h, c.p4.P], [c.p1.h, c.p1.P]]);
    var grid = "";
    [10, 100, 1000].forEach(function (P) { grid += '<line x1="30" x2="' + (W - 30) + '" y1="' + Y(P) + '" y2="' + Y(P) + '" stroke="rgba(150,185,230,.10)"/>'; });
    for (var h = 0; h <= 700; h += 100) grid += '<line y1="30" y2="' + (H - 30) + '" x1="' + X(h) + '" x2="' + X(h) + '" stroke="rgba(150,185,230,.07)"/>';
    var isos = f.isotherms.filter(function (t) { return t.T >= 0 && t.T <= 300; }).map(function (t) {
      return '<path class="ha-draw" d="' + path(t.pts.filter(function (q) { return q[1] >= 6; })) + '" fill="none" stroke="rgba(255,174,79,.16)" stroke-width="1"/>';
    }).join("");
    var F = C.fmt, pt = function (q, col) { return '<circle cx="' + X(q.h) + '" cy="' + Y(q.P) + '" r="4.5" fill="' + col + '" class="ha-pt"/>'; };
    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<defs><linearGradient id="haDome" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#5b95ff"/><stop offset=".5" stop-color="#9fd6ff"/><stop offset="1" stop-color="#eef6ff"/></linearGradient>' +
      '<linearGradient id="haFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fe3f0" stop-opacity=".10"/><stop offset="1" stop-color="#5b95ff" stop-opacity="0"/></linearGradient>' +
      '<filter id="haGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter></defs>' +
      grid + isos +
      '<path d="' + path(dome) + 'Z" fill="url(#haFill)" class="ha-fill"/>' +
      '<path class="ha-draw" d="' + path(dome) + '" fill="none" stroke="url(#haDome)" stroke-width="1.8"/>' +
      '<path class="ha-draw" d="' + path(loop) + 'Z" fill="none" stroke="#5fe3f0" stroke-width="7" opacity=".35" filter="url(#haGlow)"/>' +
      '<path class="ha-draw" d="' + path(loop) + 'Z" fill="none" stroke="#bff6ff" stroke-width="1.8"/>' +
      '<path d="' + path(loop) + 'Z" fill="none" stroke="#fff" stroke-width="2" class="ha-flow" stroke-dasharray="2 26"/>' +
      pt(c.p1, "#eef6ff") + pt(c.p2, "#ffae4f") + pt(c.p3, "#5b95ff") + pt(c.p4, "#45dbe8") +
      '<path d="M' + X(f.crit.h) + " " + (Y(f.crit.P) - 5) + 'l5 5-5 5-5-5z" fill="#04080f" stroke="#9fd6ff" class="ha-pt"/>' +
      '<text class="lbl ha-lbl" x="' + (X(f.crit.h) + 12) + '" y="' + (Y(f.crit.P) + 4) + '">CRITICAL POINT ' + F(f.crit.T, 0) + "°F</text>" +
      '<text class="lbl ha-lbl" text-anchor="middle" x="' + ((X(c.p3.h) + X(c.p2s.h)) / 2) + '" y="' + (Y(c.p2.P) - 12) + '">CONDENSING 85°F · ' + F(c.c.psig, 1) + " PSIG</text>" +
      '<text class="lbl ha-lbl" text-anchor="middle" x="' + ((X(c.p4.h) + X(c.p1.h)) / 2) + '" y="' + (Y(c.p1.P) + 22) + '">EVAPORATING ' + F(-5, 0) + "°F · " + F(c.e.psig, 1) + " PSIG</text></svg>";
    var flow = host.querySelector(".ha-flow");
    if (gsap && !C.Motion.reduced) {
      $$(".ha-draw", host).forEach(function (p, i) {
        var L = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 2.4, delay: 0.5 + i * 0.12, ease: "power2.inOut" });
      });
      gsap.from(".ha-fill", { autoAlpha: 0, duration: 2, delay: 1.2 });
      gsap.from(".ha-pt, .ha-lbl", { autoAlpha: 0, duration: 0.8, stagger: 0.08, delay: 2.2, ease: "power2.out" });
      gsap.to(flow, { strokeDashoffset: -280, duration: 6, ease: "none", repeat: -1 });
      if (ST) gsap.to(host, { yPercent: -14, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    } else if (flow) flow.style.display = "none";
    C.bus.addEventListener("motion", function () {
      if (C.Motion.reduced && flow) { if (gsap) gsap.killTweensOf(flow); flow.style.display = "none"; }
    });
  }

  // ----------------------------------------------------- P-h cycle module
  var PH_RANGE = {
    R717: { te: [-60, 60], tc: [40, 120], d: [-5, 85] },
    R134a: { te: [-40, 70], tc: [50, 150], d: [-5, 85] },
    R744: { te: [-60, 40], tc: [-20, 86], d: [-20, 20] }
  };
  function initPh() {
    var host = $("#phChart");
    if (!host) return;
    var chart = new window.PHChart(host, { label: "Interactive pressure-enthalpy diagram with the refrigeration cycle drawn on top" });
    var fluid = "R717", te = $("#phTe"), tc = $("#phTc"), sc = $("#phSc"), F = C.fmt;
    function fill(r) { var p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty("--p", p + "%"); }
    function readouts(c, p) {
      var x = [
        ["Suction", F(c.e.psig, 1), "psig", F(c.e.P, 1) + " psia at " + F(p.Te, 0) + "°F"],
        ["Discharge", F(c.c.psig, 1), "psig", F(c.c.P, 1) + " psia at " + F(p.Tc, 0) + "°F"],
        ["Compression ratio", F(c.CR, 2), ": 1", "absolute pressures"],
        ["Refrigeration effect", F(c.RE, 1), "BTU/lb", "h₁ − h₄"],
        ["Compressor work", F(c.W, 1), "BTU/lb", "ideal, h₂ − h₁"],
        ["Heat rejected", F(c.QR, 1), "BTU/lb", "h₂ − h₃"],
        ["COP (ideal)", F(c.COP, 2), "", "effect ÷ work"],
        ["Discharge temp.", F(c.T2, 0), "°F", "ideal, isentropic"],
        ["Flash gas", F(c.x4 * 100, 1), "%", "at the expansion valve"],
        ["Mass flow per ton", F(c.mPerTR, 3), "lb/min", "200 ÷ effect"]
      ];
      $("#phReadouts").innerHTML = x.map(function (r) { return '<div><div class="k">' + r[0] + '</div><div class="v">' + r[1] + "<small>" + r[2] + '</small></div><div class="s">' + r[3] + "</div></div>"; }).join("");
    }
    function update(animate, from) {
      var Te = parseFloat(te.value), Tc = parseFloat(tc.value), SC = parseFloat(sc.value);
      if (Tc - Te < 10) {
        if (from === "te") { Tc = Math.min(+tc.max, Te + 10); tc.value = Tc; Te = Math.min(Te, Tc - 10); te.value = Te; }
        else { Te = Math.max(+te.min, Tc - 10); te.value = Te; Tc = Math.max(Tc, Te + 10); tc.value = Tc; }
      }
      var f = R.fluid(fluid);
      if (Tc - SC < f.tmin) { SC = Tc - f.tmin; sc.value = SC; }
      $("#phTeOut").textContent = F(Te, 0) + "°F"; $("#phTcOut").textContent = F(Tc, 0) + "°F"; $("#phScOut").textContent = F(SC, 0) + "°F";
      [te, tc, sc].forEach(fill);
      var p = { Te: Te, Tc: Tc, SC: SC }, c = R.cycle(fluid, Te, Tc, SC);
      if (c) readouts(c, p);
      chart.setCycle(p, animate);
    }
    te.addEventListener("input", function () { update(true, "te"); });
    tc.addEventListener("input", function () { update(true, "tc"); });
    sc.addEventListener("input", function () { update(true, "sc"); });
    $$("#phFluid button").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.fluid;
        if (k === fluid) return;
        fluid = k;
        $$("#phFluid button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        var r = PH_RANGE[k];
        te.min = r.te[0]; te.max = r.te[1]; tc.min = r.tc[0]; tc.max = r.tc[1];
        te.value = r.d[0]; tc.value = r.d[1]; sc.value = 0;
        $("#phChartTitle").textContent = R.fluid(k).short + " · P-h diagram";
        chart.setFluid(k, function () { update(false); });
        if (C.Motion.reduced) update(false);
      });
    });
    $$("#phView button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#phView button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        chart.setView(b.dataset.view);
      });
    });
    update(false);
  }

  // ---------------------------------------------------------------- boot
  function initModules(names) {
    C.modules.forEach(function (m) {
      if (names && names.indexOf(m.name) < 0) return;
      if (!names && m.name === "hero") return;
      try { m.init(); } catch (e) { if (window.console) console.warn("[R717] module " + m.name + " failed:", e); }
    });
  }
  initModules(["hero"]);
  R.load("assets/props.json").then(function () {
    bind();
    try { heroArt(); } catch (e) { if (window.console) console.warn("[R717] hero art failed:", e); }
    initModules(null);
    initPh();
    countUps();
    if (ST) ST.refresh();
  }).catch(function (err) {
    if (window.console) console.warn("[R717] property data did not load:", err);
    var note = "Property data could not load. Open this page from a web server (for example GitHub Pages), not as a local file.";
    ["#fgMsg", "#szMsg"].forEach(function (s) { var m = $(s); if (m) { m.className = "msg err"; m.textContent = note; } });
    var ro = $("#phReadouts"); if (ro) ro.innerHTML = '<div><div class="s">' + note + "</div></div>";
  });
})();
