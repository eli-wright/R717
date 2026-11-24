/* R-717 Training — shared core: storage, motion preference, tweening, helpers. */
(function () {
  "use strict";
  var doc = document.documentElement;

  var store = {
    get: function (k, d) {
      try { var v = window.localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  var bus = document.createElement("span");
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var Motion = {
    get reduced() {
      var o = store.get("r717.motion", null);
      return o === null ? !!mq.matches : o === "reduced";
    },
    set: function (reduced) {
      store.set("r717.motion", reduced ? "reduced" : "full");
      Motion.apply();
    },
    apply: function () {
      var r = Motion.reduced;
      doc.classList.toggle("reduce-motion", r);
      doc.classList.toggle("smooth", !r);
      bus.dispatchEvent(new CustomEvent("motion", { detail: { reduced: r } }));
    }
  };
  if (mq.addEventListener) mq.addEventListener("change", function () { if (store.get("r717.motion", null) === null) Motion.apply(); });

  var ease = {
    inOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    out: function (t) { return 1 - Math.pow(1 - t, 4); },
    expoOut: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  };

  // tween(dur ms, onUpdate(k 0..1), {ease, done}) -> cancel()
  function tween(dur, onUpdate, o) {
    o = o || {};
    var e = o.ease || ease.inOut, t0 = performance.now(), id = 0, live = true;
    if (Motion.reduced || dur <= 0) { onUpdate(1); if (o.done) o.done(); return function () {}; }
    function step(now) {
      if (!live) return;
      var k = Math.min(1, (now - t0) / dur);
      onUpdate(e(k));
      if (k < 1) id = requestAnimationFrame(step); else if (o.done) o.done();
    }
    id = requestAnimationFrame(step);
    return function () { live = false; cancelAnimationFrame(id); };
  }

  // visible(el, cb) — cb(true/false) when the element enters / leaves the viewport
  function visible(el, cb, margin) {
    if (!("IntersectionObserver" in window)) { cb(true); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { cb(e.isIntersecting); }); },
      { rootMargin: margin || "120px 0px" });
    io.observe(el);
    return io;
  }

  // number formatting: thousands separators and a true minus sign
  function fmt(x, dp) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    dp = dp || 0;
    var r = Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp);
    if (r === 0) r = 0; // drop -0
    var s = Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return (r < 0 ? "−" : "") + s;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // An animation loop that only runs while its element is on screen, the tab is
  // visible, and motion is allowed (or the caller forces it).
  function Loop(el, frame) {
    var self = this;
    this.onScreen = false; this.playing = true; this.force = false; this.id = 0; this.last = 0;
    this.frame = frame;
    visible(el, function (v) { self.onScreen = v; self.sync(); });
    document.addEventListener("visibilitychange", function () { self.sync(); });
    bus.addEventListener("motion", function () { self.sync(); });
  }
  Loop.prototype.allowed = function () {
    return this.onScreen && !document.hidden && this.playing && (!Motion.reduced || this.force);
  };
  Loop.prototype.sync = function () {
    var self = this;
    if (this.allowed()) {
      if (!this.id) {
        this.last = performance.now();
        var tick = function (now) {
          var dt = Math.min(0.05, (now - self.last) / 1000);
          self.last = now;
          self.frame(dt, now / 1000);
          self.id = self.allowed() ? requestAnimationFrame(tick) : 0;
        };
        this.id = requestAnimationFrame(tick);
      }
    } else if (this.id) { cancelAnimationFrame(this.id); this.id = 0; }
  };

  // Canvas sized to its parent at device pixel ratio
  function fitCanvas(canvas, maxDpr) {
    var r = canvas.parentNode.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w: r.width, h: r.height, dpr: dpr };
  }

  var mods = [];
  window.R717 = {
    store: store, Motion: Motion, bus: bus, ease: ease, tween: tween, visible: visible, fmt: fmt, esc: esc,
    Loop: Loop, fitCanvas: fitCanvas,
    register: function (name, init) { mods.push({ name: name, init: init }); },
    modules: mods,
    $: function (s, r) { return (r || document).querySelector(s); },
    $$: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },
    deg: "°", minus: "−"
  };
})();
