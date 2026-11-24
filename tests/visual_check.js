#!/usr/bin/env node
/*
 * Headless check of the site (Playwright + Chromium).
 *   node tests/visual_check.js [outDir]
 * - serves the repo on a local port
 * - desktop (1440x900) and phone (iPhone 13) passes
 * - fails on console errors / page errors
 * - checks the HTML fallback numbers match the values computed from props.json
 * - checks there is no horizontal page scroll
 * - screenshots every section and a few interactive states
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

const root = path.join(__dirname, "..");
const out = path.resolve(process.argv[2] || path.join(root, "tests", "screens"));
fs.mkdirSync(out, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
// 1x1 transparent PNG used in place of the external logo (that host is not reachable from CI sandboxes)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

// fallback text in the raw HTML for every bound number, in document order
function fallbacks() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const re = /<span[^>]*\sdata-(p|tsat|fl|env|m|mair|wsat)="[^"]*"[^>]*>([^<]*)<\/span>/g;
  const list = []; let m;
  while ((m = re.exec(html))) list.push(m[2].replace(/&minus;/g, "−").trim());
  return list;
}

async function pass(browser, name, ctxOpts, base) {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route(/jwtank\.net/, (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errors.push("requestfailed: " + r.url()); });
  await page.goto(base + "/index.html", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#phReadouts .v"), null, { timeout: 15000 });
  await page.waitForTimeout(2600);

  const problems = [];
  // fallback numbers
  const live = await page.$$eval("span[data-p],span[data-tsat],span[data-fl],span[data-env],span[data-m],span[data-mair],span[data-wsat]", (els) => els.map((e) => e.textContent.trim()));
  const fb = fallbacks();
  if (live.length !== fb.length) problems.push(`bound span count ${live.length} != html ${fb.length}`);
  live.forEach((v, i) => { if (v !== fb[i]) problems.push(`bound number #${i}: html says "${fb[i]}", props.json gives "${v}"`); });

  // walk the page so every scroll reveal fires, screenshot each section
  const ids = await page.$$eval("main > section", (s) => s.map((x) => x.id));
  for (const id of ids) {
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: "start", behavior: "instant" }), id);
    await page.waitForTimeout(700);
    const h = await page.evaluate((i) => document.getElementById(i).offsetHeight, id);
    const vp = page.viewportSize();
    // capture the section in viewport-sized slices (keeps files small and shows reveals)
    const slices = Math.min(8, Math.ceil(h / vp.height));
    for (let k = 0; k < slices; k++) {
      await page.evaluate(([i, k, vh]) => { const el = document.getElementById(i); window.scrollTo({ top: el.offsetTop + k * vh, behavior: "instant" }); }, [id, k, vp.height]);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, `${name}-${id}-${k}.png`) });
    }
  }
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(1200);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) problems.push(`horizontal overflow ${overflow}px`);
  const wide = await page.evaluate(() => {
    const W = window.innerWidth, bad = [];
    document.querySelectorAll("main *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > W + 1 || r.left < -1) && !el.closest(".table-wrap,.formula,.module-num,.hero canvas,.hero-art,dialog,.stage")) bad.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + el.className).slice(0, 60) + " " + Math.round(r.left) + ".." + Math.round(r.right));
    });
    return bad.slice(0, 10);
  });
  if (wide.length) problems.push("elements past the viewport edge: " + wide.join(", "));

  // interactions
  await page.evaluate(() => document.getElementById("cycle").scrollIntoView());
  await page.click('#cycleSteps button[data-step="exv"]');
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(out, `${name}-x-cycle-zoom.png`) });
  const detail = await page.textContent("#cycleDetail");
  if (!/Expansion valve/.test(detail)) problems.push("cycle step detail did not update");

  await page.evaluate(() => document.getElementById("ph").scrollIntoView());
  await page.$eval("#phTe", (r) => { r.value = -30; r.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.click('#phView button[data-view="full"]');
  await page.$eval("#phChart", (e) => e.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(1000);
  const box = await page.$eval("#phChart svg", (s) => { const r = s.getBoundingClientRect(); return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.6 }; });
  await page.mouse.move(box.x, box.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${name}-x-ph-full-hover.png`) });
  const tip = await page.$eval("#phChart .ph-tip", (t) => t.classList.contains("on") ? t.textContent : "");
  if (!/psia/.test(tip)) problems.push("P-h hover tooltip did not show");
  await page.click('#phFluid button[data-fluid="R744"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${name}-x-ph-co2.png`) });

  await page.evaluate(() => document.getElementById("fgForm").scrollIntoView());
  const pct = await page.textContent("#fgPct");
  if (pct.trim() !== "17.5%") problems.push("flash calculator default shows " + pct + " (expected 17.5%)");
  await page.selectOption("#fgFluid", "R744");
  await page.selectOption("#fgUpUnit", "F");
  await page.fill("#fgUp", "95");
  await page.waitForTimeout(500);
  const co2msg = await page.textContent("#fgMsg");
  if (!/critical point/.test(co2msg)) problems.push("CO2 above critical was not blocked: " + co2msg);
  await page.screenshot({ path: path.join(out, `${name}-x-flash-co2-blocked.png`) });
  await page.click("#fgReset");
  await page.fill("#fgDn", "100");
  await page.waitForTimeout(400);
  const evmsg = await page.textContent("#fgMsg");
  if (!/colder/.test(evmsg)) problems.push("evap above cond was not rejected: " + evmsg);
  await page.click("#fgReset");
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById("fgChart").scrollIntoView());
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `${name}-x-flash-chart.png`) });

  await page.evaluate(() => document.getElementById("compGrid").scrollIntoView());
  await page.click('#compGrid [data-comp="recirculator"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${name}-x-dialog.png`) });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  await page.evaluate(() => document.getElementById("calc").scrollIntoView());
  await page.waitForTimeout(500);
  const gpm = await page.$$eval("#szOut .cr .v", (v) => v.map((x) => x.textContent));
  if (!gpm.some((t) => /GPM/.test(t))) problems.push("sizing calculator did not render");

  // keyboard: tab into the cycle diagram and activate a component
  await page.evaluate(() => document.getElementById("cycle").scrollIntoView());
  await page.focus('#cycleStage .comp-node');
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  const kd = await page.textContent("#cycleDetail");
  if (!/Step 0/.test(kd)) problems.push("keyboard activation of a cycle component failed");

  const progress = await page.textContent("#progressLabel");
  const stored = await page.evaluate(() => { try { return localStorage.getItem("r717.progress.v2"); } catch (e) { return "ERR"; } });
  await ctx.close();
  return { name, errors, problems, progress, stored };
}

(async () => {
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port;
  const browser = await chromium.launch();
  const results = [];
  results.push(await pass(browser, "desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, base));
  results.push(await pass(browser, "phone", { ...devices["iPhone 13"], deviceScaleFactor: 1 }, base));
  results.push(await pass(browser, "reduced", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: "reduce" }, base));
  await browser.close();
  srv.close();
  let bad = 0;
  for (const r of results) {
    console.log(`\n[${r.name}] progress ${r.progress}, stored ${r.stored}`);
    r.errors.forEach((e) => { bad++; console.log("  console error: " + e); });
    r.problems.forEach((p) => { bad++; console.log("  problem: " + p); });
    if (!r.errors.length && !r.problems.length) console.log("  ok");
  }
  console.log(`\nscreenshots in ${out}`);
  process.exit(bad ? 1 : 0);
})();
