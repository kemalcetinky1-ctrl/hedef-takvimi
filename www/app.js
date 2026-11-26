/* Hedef Takvimi — local-first goal & habit calendar. Data stays in localStorage on the device. */
(function () {
"use strict";
const KEY = "hedefTakvimi:v1";
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const key = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const mkey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const parse = k => new Date(k + (k.length === 7 ? "-01" : "") + "T00:00:00");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const XP = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 9 L31 31 M31 9 L9 31"/></svg>';
let today = new Date(); today.setHours(0, 0, 0, 0);

// ---------- store ----------
let S;
function load() {
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || typeof S !== "object") S = null;
  return S;
}
function fresh(lang, name) {
  const L = I18N[lang] || I18N.en;
  return { v: 1, settings: { lang, name: name || "", start: key(today), habits: L.defHabits.map(n => ({ id: uid(), name: n })) }, days: {}, months: {}, years: {} };
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("!"); } }, 150); }
function saveNow() { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
addEventListener("pagehide", saveNow);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveNow(); else { const n = new Date(); n.setHours(0,0,0,0); if (+n !== +today) { today = n; renderAll(); } } });

// ---------- i18n ----------
let L = I18N.tr;
function t(k, v) { let s = (L[k] !== undefined ? L[k] : (I18N.en[k] !== undefined ? I18N.en[k] : k)); if (v) for (const x in v) s = s.split("{" + x + "}").join(v[x]); return s; }
function applyLang(lang) {
  L = I18N[lang] || I18N.en;
  document.documentElement.lang = lang;
  document.title = L.appName;
  document.querySelectorAll("[data-t]").forEach(e => { e.textContent = t(e.dataset.t); });
  document.querySelectorAll("[data-tp]").forEach(e => { e.placeholder = t(e.dataset.tp); });
  document.querySelectorAll("[data-ta]").forEach(e => { e.setAttribute("aria-label", t(e.dataset.ta)); });
  $("privLink").href = lang === "tr" ? "privacy.html#tr" : "privacy.html#en";
}
const locale = () => (S && S.settings.lang) || "tr";
const monthName = (d, long = true) => d.toLocaleDateString(locale(), { month: long ? "long" : "short" });
const cap = s => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);

// ---------- day logic ----------
// habits keep a history: "since" = first day they count, "until" = first day they no longer count.
// Adding/removing a habit therefore never breaks past days or streaks.
const habitsOn = k => S.settings.habits.filter(h => (!h.since || h.since <= k) && (!h.until || k < h.until));
const habits = () => habitsOn(key(today));
const smokeIds = () => new Set(S.settings.habits.filter(h => h.kind === "smoke").map(h => h.id));
const start = () => parse(S.settings.start);
function day(k) { return S.days[k] || null; }
function ensureDay(k) { if (!S.days[k]) S.days[k] = { h: {}, tasks: [] }; const d = S.days[k]; d.h = d.h || {}; d.tasks = d.tasks || []; return d; }
function cleanDay(k) { const d = S.days[k]; if (!d) return; if (!Object.keys(d.h || {}).length && !(d.tasks || []).length && !d.wake && !d.sleep && !d.note && !d.seeded) delete S.days[k]; }
// add the daily routine to a day once (today or later only)
function seed(k) {
  const r = S.settings.routine || []; if (!r.length || parse(k) < today) return;
  const d = S.days[k]; if (d && d.seeded) return;
  const x = ensureDay(k); x.seeded = true;
  const have = new Set(x.tasks.map(y => y.t));
  r.slice().sort((a, b) => (a.time || "").localeCompare(b.time || "")).forEach(it => { if (!have.has(it.t)) x.tasks.push({ id: uid(), t: it.t, time: it.time || "", done: false }); });
  save();
}
// streak length ending on each complete day → used to make long-streak ✗ bigger
function runMap() { const m = {}; let run = 0, prev = null; Object.keys(S.days).filter(k => state(k) === 2).sort().forEach(k => { const d = parse(k); run = (prev && Math.round((d - prev) / 864e5) === 1) ? run + 1 : 1; m[k] = run; prev = d; }); return m; }
const tier = n => n >= 21 ? "s3" : n >= 7 ? "s2" : n >= 3 ? "s1" : "";
const MILES = [3, 7, 21, 30, 66, 100, 180, 365];
// 0 = nothing, 0..1 partial, 2 = complete
function state(k) {
  const d = day(k); if (!d) return 0;
  const hs = habitsOn(k); const tasks = d.tasks || [];
  const total = hs.length + tasks.length; if (!total) return 0;
  const done = hs.filter(h => d.h && d.h[h.id]).length + tasks.filter(x => x.done).length;
  if (!done) return 0; return done >= total ? 2 : done / total;
}
function lastYear() { return today.getFullYear() + (today.getMonth() >= 9 ? 1 : 0); } // from October, next year is ready to plan
function inRange(d) { return d >= start() && d.getFullYear() <= lastYear(); }
function monthList() { const a = []; const s = start(); const d = new Date(s.getFullYear(), s.getMonth(), 1); while (d.getFullYear() <= lastYear()) { a.push(mkey(d)); d.setMonth(d.getMonth() + 1); } return a; }
function daysIn(m, untilToday) { const s = parse(m); let n = 0; const d = new Date(s); while (d.getMonth() === s.getMonth()) { if (inRange(d) && (!untilToday || d <= today)) n++; d.setDate(d.getDate() + 1); } return n; }
function fullIn(m) { let n = 0; for (const k in S.days) if (k.startsWith(m) && state(k) === 2) n++; return n; }
function streaks() {
  const full = Object.keys(S.days).filter(k => state(k) === 2).sort(); const set = new Set(full);
  let best = 0, run = 0, prev = null;
  full.forEach(k => { const d = parse(k); run = (prev && Math.round((d - prev) / 864e5) === 1) ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  let cur = 0; const c = new Date(today); if (!set.has(key(c))) c.setDate(c.getDate() - 1); while (set.has(key(c))) { cur++; c.setDate(c.getDate() - 1); }
  return { cur, best };
}

// ---------- UI helpers ----------
let toastT;
function toast(m) { const e = $("toast"); e.textContent = m; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, 2200); }
function haptic() { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
function checkRow(label, on, onToggle, onRemove) {
  const row = document.createElement("div"); row.className = onRemove ? "ckrow" : "";
  const b = document.createElement("button"); b.className = "ck"; b.type = "button"; b.setAttribute("role", "checkbox"); b.setAttribute("aria-checked", on ? "true" : "false");
  const bx = document.createElement("span"); bx.className = "bx"; const tx = document.createElement("span"); tx.textContent = label; b.append(bx, tx);
  b.onclick = () => { haptic(); onToggle(); };
  if (!onRemove) return b;
  const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", t("remove") + ": " + label); x.onclick = onRemove;
  row.append(b, x); return row;
}

// ---------- smoke-free savings ----------
function money(n, cur) { const c = cur || (S.settings.smoke && S.settings.smoke.cur) || "₺"; const v = Math.round(n).toLocaleString(locale()); return /^[₺€]|TL/.test(c) || c.length > 1 ? v + " " + c : c + v; }
// exchange rates: fetched once a day (no personal data is sent), manual override in Settings
const CODE = { "₺": "TRY", "$": "USD", "€": "EUR", "£": "GBP" };
function rateKey(f, to) { return (CODE[f] || f) + "_" + (CODE[to] || to); }
function getRate(f, to) { if (f === to) return 1; S.rates = S.rates || {}; const r = S.rates[rateKey(f, to)]; if (!r || r.d !== key(today)) fetchRate(f, to); return r ? r.r : 0; }
const pending = {};
function fetchRate(f, to) {
  const k = rateKey(f, to), [b, s] = k.split("_"); if (pending[k] || !CODE[f] || !CODE[to]) return; const old = S.rates[k]; if (old && old.manual) return; pending[k] = 1;
  fetch("https://api.frankfurter.dev/v1/latest?base=" + b + "&symbols=" + s).then(r => r.json()).then(j => { const v = j && j.rates && j.rates[s]; if (v > 0) { S.rates[k] = { r: v, d: key(today) }; save(); renderInvest(); if (view === "set") renderSettings(); } }).catch(() => {}).finally(() => { delete pending[k]; });
}
function money2(n, c) { const v = n.toLocaleString(locale(), { maximumFractionDigits: n < 100 ? 2 : 0 }); return /^[₺€]|TL/.test(c) || c.length > 1 ? v + " " + c : c + v; }
function renderInvest() {
  const iv = S.settings.invest, box = $("invCard"); if (!iv || !(iv.amount > 0)) { box.hidden = true; return; } box.hidden = false;
  S.invest = S.invest || {}; const m = mkey(parse(sel)); const done = S.invest[m] || 0; let total = 0; for (const k in S.invest) total += S.invest[k];
  $("ivT").textContent = t("invTitle", { m: cap(monthName(parse(m))) });
  $("ivM").textContent = t("invOf", { a: money2(done, iv.cur), b: money2(iv.amount, iv.cur) });
  $("ivBar").style.width = Math.min(100, done / iv.amount * 100) + "%";
  $("ivH").textContent = (done >= iv.amount ? t("invDone") + " " : "") + t("invTotal", { t: money2(total, iv.cur) }) + " " + t("invYear", { y: money(iv.amount * 12, iv.cur) });
  // smoke-free money of this month that hasn't been moved into investing yet
  const sm = S.settings.smoke, sh = habits().find(x => x.kind === "smoke"); const btn = $("ivSmoke");
  let avail = 0, conv = 0;
  if (sm && sh) { const ids = smokeIds(); let n = 0; for (const k in S.days) { const dh = S.days[k].h || {}; if (k.startsWith(m) && [...ids].some(i => dh[i])) n++; } S.smokeMoved = S.smokeMoved || {}; avail = n * sm.packs * sm.price - (S.smokeMoved[m] || 0); conv = avail * getRate(sm.cur, iv.cur); }
  btn.hidden = !(avail > 0 && conv > 0);
  if (!btn.hidden) { const same = sm.cur === iv.cur; btn.textContent = t("invFromSmoke", { m: same ? money(conv, iv.cur) : money2(conv, iv.cur) + " (" + money(avail, sm.cur) + ")" }); btn.dataset.a = conv; btn.dataset.s = avail; }
}
function renderSmoke() {
  const sm = S.settings.smoke, h = habits().find(x => x.kind === "smoke"), ids = smokeIds(); const box = $("smokeCard");
  if (!sm || !h) { box.hidden = true; return; } box.hidden = false;
  const perDay = sm.packs * sm.price; let n = 0; for (const k in S.days) { const dh = S.days[k].h || {}; if ([...ids].some(i => dh[i])) n++; }
  $("smT").textContent = t("smokeTitle", { n }); $("smM").textContent = n ? t("smokeSaved", { m: money(n * perDay) }) : t("smokeZero", { m: money(perDay) });
  $("smH").textContent = t("smokeHint", { mo: money(perDay * 30), y: money(perDay * 365) }) + (S.settings.invest ? " " + t("smokeToInv") : "");
}

// ---------- TODAY ----------
let sel = key(today);
function renderToday() {
  const d = parse(sel); const isToday = sel === key(today);
  $("hello").textContent = S.settings.name ? t("hello", { n: S.settings.name }) : t("helloAnon");
  $("tToday").textContent = d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
  $("dToday").hidden = isToday;
  $("dPrev").disabled = parse(sel) <= start();
  seed(sel);
  const v = day(sel) || {};
  // habits
  const hc = $("hChecks"); hc.textContent = "";
  habitsOn(sel).forEach(h => hc.appendChild(checkRow(h.name, v.h && v.h[h.id], () => { const x = ensureDay(sel); if (x.h[h.id]) delete x.h[h.id]; else x.h[h.id] = true; cleanDay(sel); changed(); })));
  // tasks
  const tc = $("tChecks"); tc.textContent = "";
  (v.tasks || []).forEach(task => tc.appendChild(checkRow((task.time ? task.time + " · " : "") + task.t, task.done, () => { task.done = !task.done; changed(); }, () => { const x = ensureDay(sel); x.tasks = x.tasks.filter(y => y.id !== task.id); cleanDay(sel); changed(); })));
  $("planEmpty").hidden = !!(v.tasks && v.tasks.length);
  for (const f of ["wake", "sleep", "note"]) { const e = $(f); if (document.activeElement !== e) e.value = v[f] || ""; }
  // hero
  const s = state(sel); const total = habits().length + (v.tasks || []).length;
  const done = habits().filter(h => v.h && v.h[h.id]).length + (v.tasks || []).filter(x => x.done).length;
  const p = s === 2 ? 1 : (total ? done / total : 0);
  const C = 2 * Math.PI * 44; $("arc").style.strokeDasharray = (C * p).toFixed(1) + " " + C.toFixed(1);
  $("bigPct").textContent = Math.round(p * 100) + "%";
  const wasOn = $("bigCell").classList.contains("on");
  $("bigCell").classList.toggle("on", s === 2);
  $("hStat").textContent = s === 2 ? t("dayDone") : t("dayLeft", { n: total - done });
  renderSmoke(); renderInvest();
  const st = streaks(); $("sStreak").textContent = st.cur; $("sBest").textContent = st.best;
  const rm = runMap(); const tr = tier(rm[sel] || 0);
  $("bigCell").classList.remove("s1", "s2", "s3"); if (tr) $("bigCell").classList.add(tr);
  const mile = MILES.filter(n => st.cur >= n).pop();
  $("badge").hidden = !mile; if (mile) $("badge").textContent = t("badge", { n: st.cur });
  if (s === 2 && !wasOn && isToday && renderToday.armed) { burst(); if (MILES.includes(st.cur)) toast(t("milestone", { n: st.cur })); }
  renderToday.armed = true;
  const m = mkey(today), dn = daysIn(m, true); $("sMonth").textContent = dn ? Math.round(fullIn(m) / dn * 100) + "%" : "–";
}
function shiftDay(n) { const d = parse(sel); d.setDate(d.getDate() + n); if (d < start()) return; sel = key(d); renderToday(); }
$("dPrev").onclick = () => shiftDay(-1); $("dNext").onclick = () => shiftDay(1); $("dToday").onclick = () => { sel = key(today); renderToday(); };
$("invForm").onsubmit = e => { e.preventDefault(); const v = +$("ivIn").value; if (!v) return; S.invest = S.invest || {}; const m = mkey(parse(sel)); S.invest[m] = Math.max(0, (S.invest[m] || 0) + v); if (!S.invest[m]) delete S.invest[m]; $("ivIn").value = ""; save(); renderInvest(); haptic(); };
$("ivSmoke").onclick = () => { const v = +$("ivSmoke").dataset.a || 0, s = +$("ivSmoke").dataset.s || 0; if (!v) return; const m = mkey(parse(sel)); S.invest = S.invest || {}; S.smokeMoved = S.smokeMoved || {}; S.invest[m] = Math.round(((S.invest[m] || 0) + v) * 100) / 100; S.smokeMoved[m] = (S.smokeMoved[m] || 0) + s; save(); renderInvest(); haptic(); toast(t("invMoved", { m: money2(v, S.settings.invest.cur) })); };
$("taskForm").onsubmit = e => { e.preventDefault(); const v = $("taskIn").value.trim(); if (!v) return; ensureDay(sel).tasks.push({ id: uid(), t: v, done: false }); $("taskIn").value = ""; changed(); $("taskIn").focus(); };
let fT; ["wake", "sleep", "note"].forEach(f => $(f).addEventListener("input", () => { const k = sel; clearTimeout(fT); fT = setTimeout(() => { const x = ensureDay(k); x[f] = $(f).value; ["wake", "sleep", "note"].forEach(g => { if (!x[g]) delete x[g]; }); cleanDay(k); save(); }, 500); }));
function changed() { save(); renderToday(); if (!$("v-cal").hidden) renderCal(); }

// confetti of tiny gold ✗ when the day completes
function burst() {
  if (reduce) return; const host = $("bigCell").getBoundingClientRect();
  for (let i = 0; i < 18; i++) { const s = document.createElement("span"); s.textContent = "✗"; Object.assign(s.style, { position: "fixed", left: host.left + host.width / 2 + "px", top: host.top + host.height / 2 + "px", color: i % 2 ? "#F5C55A" : "#E39B2D", fontWeight: "800", fontSize: (12 + Math.random() * 14) + "px", pointerEvents: "none", zIndex: 800, transition: "transform 1s cubic-bezier(.2,.8,.2,1), opacity 1s" }); document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 90; requestAnimationFrame(() => { s.style.transform = `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) rotate(${Math.random() * 360}deg)`; s.style.opacity = "0"; }); setTimeout(() => s.remove(), 1100); }
}

// ---------- CALENDAR ----------
let MLIST = [], idx = 0, cur = mkey(today);
function ringSVG(p) { const r = 22, c = 2 * Math.PI * r; return '<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="' + r + '" stroke="rgba(255,255,255,.1)" stroke-width="5" fill="none"/><circle cx="28" cy="28" r="' + r + '" stroke="#F5C55A" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 28 28)"/></svg>'; }
function partSVG(p) { const r = 17, c = 2 * Math.PI * r; return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="' + r + '" stroke="#7AA2FF" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * p).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 20 20)"/></svg>'; }
function buildRing() {
  MLIST = monthList(); idx = Math.max(0, MLIST.indexOf(cur)); if (MLIST.indexOf(cur) < 0) { idx = MLIST.indexOf(mkey(today)); if (idx < 0) idx = 0; cur = MLIST[idx]; }
  const ring = $("ring"); ring.textContent = "";
  MLIST.forEach((m, i) => { const d = parse(m); const b = document.createElement("button"); b.className = "tile"; b.type = "button"; b.dataset.i = i; b.setAttribute("aria-label", monthName(d) + " " + d.getFullYear()); b.innerHTML = '<span class="rs"></span><span class="mn"></span><span class="y"></span><span class="pct"></span>'; b.querySelector(".mn").textContent = cap(monthName(d)); b.querySelector(".y").textContent = d.getFullYear(); b.onclick = () => go(i); ring.appendChild(b); });
}
function paintRing() {
  const sp = innerWidth < 560 ? 92 : 128;
  document.querySelectorAll(".tile").forEach(tl => { const i = +tl.dataset.i, o = i - idx, a = Math.abs(o);
    tl.style.transform = "translateX(" + (o * sp - Math.sign(o) * Math.max(0, a - 1) * sp * .35) + "px) translateZ(" + (-a * 90) + "px) rotateY(" + (-Math.sign(o) * Math.min(a, 1) * 42) + "deg)";
    tl.style.zIndex = String(100 - a); tl.style.opacity = a > 3 ? "0" : String(1 - a * .18); tl.style.pointerEvents = a > 3 ? "none" : "auto"; tl.tabIndex = a <= 1 ? 0 : -1;
    const m = MLIST[i], tot = daysIn(m, false), dn = fullIn(m); tl.querySelector(".rs").innerHTML = ringSVG(tot ? dn / tot : 0); tl.querySelector(".pct").textContent = dn + "/" + tot; tl.classList.toggle("sel", i === idx); });
  $("mPrev").disabled = idx === 0; $("mNext").disabled = idx === MLIST.length - 1;
}
function go(i) { idx = Math.max(0, Math.min(MLIST.length - 1, i)); cur = MLIST[idx]; renderCal(); }
function renderYears() {
  const y0 = start().getFullYear(), y1 = lastYear(), cy = +cur.slice(0, 4); const n = $("years"); n.textContent = "";
  for (let y = y0; y <= y1; y++) { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.textContent = y; b.setAttribute("aria-pressed", y === cy ? "true" : "false"); b.onclick = () => { const i = MLIST.findIndex(m => m.startsWith(y + "-")); go(i < 0 ? 0 : i); }; n.appendChild(b); }
}
function renderDow() { const n = $("dow"); n.textContent = ""; const base = new Date(2024, 0, 1); for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(1 + i); const s = document.createElement("span"); s.textContent = d.toLocaleDateString(locale(), { weekday: "short" }).replace(".", ""); n.appendChild(s); } }
function renderMonth() {
  const s = parse(cur); const box = $("days"); box.textContent = ""; const rm = runMap();
  for (let i = 0; i < (s.getDay() + 6) % 7; i++) { const p = document.createElement("span"); p.className = "cell pad"; box.appendChild(p); }
  const d = new Date(s);
  while (d.getMonth() === s.getMonth()) { const k = key(d), ok = inRange(d); const b = document.createElement("button"); b.type = "button"; b.className = "cell"; b.dataset.k = k;
    if (!ok) { b.classList.add("off"); b.disabled = true; } if (+d === +today) b.classList.add("today");
    const st = state(k); if (st === 2) { b.classList.add("on"); const tr = tier(rm[k] || 0); if (tr) b.classList.add(tr); }
    b.setAttribute("aria-label", d.toLocaleDateString(locale(), { day: "numeric", month: "long" }) + (st === 2 ? " ✗" : ""));
    b.innerHTML = '<span class="f">' + (st > 0 && st < 2 ? partSVG(st) : "") + d.getDate() + '</span><span class="b">' + XP + "<small>" + d.getDate() + "</small></span>";
    box.appendChild(b); d.setDate(d.getDate() + 1); }
  const tot = daysIn(cur, false), dn = fullIn(cur);
  $("mTitle").textContent = cap(monthName(s)) + " " + s.getFullYear(); $("mInfo").textContent = t("ofFull", { a: dn, b: tot }); $("mBar").style.width = (tot ? dn / tot * 100 : 0) + "%";
}
$("days").addEventListener("click", e => { const b = e.target.closest(".cell[data-k]"); if (b && !b.disabled) { sel = b.dataset.k; show("today"); } });
function renderBars() {
  const box = $("hbars"); box.textContent = ""; const el = daysIn(cur, false);
  const mEnd = key(new Date(parse(cur).getFullYear(), parse(cur).getMonth() + 1, 0));
  S.settings.habits.filter(h => (!h.since || h.since <= mEnd) && (!h.until || h.until > cur + "-01")).forEach(h => { let n = 0; for (const k in S.days) if (k.startsWith(cur) && S.days[k].h && S.days[k].h[h.id]) n++;
    const r = document.createElement("div"); r.className = "hrow"; const a = document.createElement("span"); a.textContent = h.name; const bar = document.createElement("span"); bar.className = "bar"; const i = document.createElement("i"); i.style.width = (el ? Math.min(100, n / el * 100) : 0) + "%"; bar.appendChild(i); const b = document.createElement("b"); b.textContent = t("habitsCount", { a: n, b: el }); r.append(a, bar, b); box.appendChild(r); });
}
function renderHeat() {
  const y = +cur.slice(0, 4); const h = $("heat"); h.textContent = "";
  const s = new Date(Math.max(+new Date(y, 0, 1), +start())); s.setDate(s.getDate() - (s.getDay() + 6) % 7); const e = new Date(y, 11, 31); e.setDate(e.getDate() + (6 - (e.getDay() + 6) % 7));
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) { const q = document.createElement("button"); q.type = "button"; q.className = "hq"; const k = key(d);
    if (d.getFullYear() !== y || !inRange(d)) { q.classList.add("off"); q.disabled = true; q.tabIndex = -1; }
    else { const st = state(k); if (st === 2) q.classList.add("on"); else if (st > 0) q.classList.add("p"); q.title = d.toLocaleDateString(locale(), { day: "numeric", month: "long" }); q.setAttribute("aria-label", q.title); q.onclick = () => { const i = MLIST.indexOf(k.slice(0, 7)); if (i >= 0) go(i); }; }
    if (+d === +today) q.classList.add("t"); h.appendChild(q); }
}
function renderCal() { if (!MLIST.length || MLIST.indexOf(cur) < 0) buildRing(); renderYears(); paintRing(); renderMonth(); renderBars(); renderHeat(); }
$("mPrev").onclick = () => go(idx - 1); $("mNext").onclick = () => go(idx + 1);
let sx = null; $("stage").addEventListener("pointerdown", e => { sx = e.clientX; }); $("stage").addEventListener("pointerup", e => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); });
addEventListener("resize", () => { if (!$("v-cal").hidden) paintRing(); });

// ---------- GOALS ----------
let gm = mkey(today);
const MF = ["goals", "good", "bad", "learned"], YF = { ygood: "good", ybad: "bad", ylearned: "learned", ynext: "next" };
function renderGoals() {
  const d = parse(gm), y = d.getFullYear(); const list = monthList();
  $("gTitle").textContent = cap(monthName(d)) + " " + y; $("gLabel").textContent = t("monthGoals", { m: cap(monthName(d)) });
  $("gPrev").disabled = list.indexOf(gm) <= 0; $("gNext").disabled = list.indexOf(gm) >= list.length - 1;
  const v = S.months[gm] || {}; MF.forEach(f => { const e = $(f); if (document.activeElement !== e) e.value = v[f] || ""; });
  const yv = S.years[y] || {}; for (const f in YF) { const e = $(f); if (document.activeElement !== e) e.value = yv[YF[f]] || ""; }
  $("yTitle").textContent = t("yearReview", { y }); $("gSaved").textContent = "";
}
function shiftMonth(n) { const l = monthList(); const i = l.indexOf(gm) + n; if (i < 0 || i >= l.length) return; gm = l[i]; renderGoals(); }
$("gPrev").onclick = () => shiftMonth(-1); $("gNext").onclick = () => shiftMonth(1);
let gT;
MF.forEach(f => $(f).addEventListener("input", () => { const m = gm; clearTimeout(gT); gT = setTimeout(() => { const v = {}; MF.forEach(x => { const val = $(x).value; if (val) v[x] = val; }); if (Object.keys(v).length) S.months[m] = v; else delete S.months[m]; save(); $("gSaved").textContent = t("saved"); }, 500); }));
for (const f in YF) $(f).addEventListener("input", () => { const y = parse(gm).getFullYear(); clearTimeout(gT); gT = setTimeout(() => { const v = {}; for (const x in YF) { const val = $(x).value; if (val) v[YF[x]] = val; } if (Object.keys(v).length) S.years[y] = v; else delete S.years[y]; save(); }, 500); });

// ---------- SETTINGS ----------
function langChips(host, onPick) { host.textContent = ""; LANGS.forEach(([c, n]) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.setAttribute("role", "radio"); b.textContent = n; b.setAttribute("aria-pressed", c === (S ? S.settings.lang : host.dataset.cur) ? "true" : "false"); b.setAttribute("aria-checked", b.getAttribute("aria-pressed")); b.onclick = () => onPick(c); host.appendChild(b); }); }
function renderSettings() {
  langChips($("sLangs"), c => { S.settings.lang = c; save(); applyLang(c); renderAll(); });
  const n = $("sName"); if (document.activeElement !== n) n.value = S.settings.name || "";
  const box = $("hed"); box.textContent = "";
  habits().forEach(h => { const r = document.createElement("div"); r.className = "row"; const inp = document.createElement("input"); inp.type = "text"; inp.value = h.name; inp.maxLength = 60; inp.setAttribute("aria-label", h.name);
    inp.addEventListener("change", () => { h.name = inp.value.trim() || h.name; save(); renderSettings(); });
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", t("remove") + ": " + h.name); x.disabled = habits().length <= 1;
    x.onclick = () => { retire(h); save(); renderSettings(); }; r.append(inp, x); box.appendChild(r); });
  $("remCard").hidden = !(NATIVE && PL.LocalNotifications); const rm = S.settings.remind || {}; $("remOn").setAttribute("aria-checked", rm.on ? "true" : "false"); $("remTime").value = rm.time || "21:00"; $("remTime").disabled = !rm.on;
  $("bMsg").textContent = ""; resetArm = false; $("resetBtn").textContent = t("reset");
  const iv = S.settings.invest; $("ivSet").hidden = !iv; if (iv) { $("ivAmt").value = iv.amount; $("ivCur").value = iv.cur; }
  const smx = S.settings.smoke, showRate = iv && smx && smx.cur !== iv.cur; $("rateRow").hidden = !showRate;
  if (showRate) { const r = getRate(smx.cur, iv.cur); $("rateLbl").textContent = t("rateLbl", { a: smx.cur, b: iv.cur }); if (document.activeElement !== $("rateIn")) $("rateIn").value = r ? +r.toPrecision(4) : ""; const rr = S.rates[rateKey(smx.cur, iv.cur)]; $("rateNote").textContent = rr ? (rr.manual ? t("rateManual") : t("rateAuto", { d: rr.d })) : t("rateNone"); }
  const sm = S.settings.smoke; $("smSet").hidden = !sm;
  if (sm) { $("smPacks").value = sm.packs; $("smPrice").value = sm.price; $("smCur").value = sm.cur; }
  const rb = $("rEd"); rb.textContent = ""; const R = S.settings.routine || (S.settings.routine = []);
  R.slice().sort((a, b) => (a.time || "").localeCompare(b.time || "")).forEach(it => { const r = document.createElement("div"); r.className = "row3";
    const tm = document.createElement("input"); tm.type = "time"; tm.value = it.time || ""; tm.setAttribute("aria-label", it.t); tm.addEventListener("change", () => { it.time = tm.value; save(); });
    const tx = document.createElement("input"); tx.type = "text"; tx.value = it.t; tx.maxLength = 100; tx.setAttribute("aria-label", it.t); tx.addEventListener("change", () => { it.t = tx.value.trim() || it.t; save(); });
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", t("remove") + ": " + it.t); x.onclick = () => { S.settings.routine = R.filter(y => y.id !== it.id); save(); renderSettings(); };
    r.append(tm, tx, x); rb.appendChild(r); });
}
$("routineForm").onsubmit = e => { e.preventDefault(); const v = $("rIn").value.trim(); if (!v) return; (S.settings.routine = S.settings.routine || []).push({ id: uid(), time: $("rTime").value, t: v }); $("rIn").value = ""; $("rTime").value = ""; save(); renderSettings(); };
$("redoBtn").onclick = () => wizard(true);
async function schedule() {
  const LN = PL.LocalNotifications; if (!LN) return; const rm = S.settings.remind || {};
  try { await LN.cancel({ notifications: [{ id: 1 }] }); } catch (e) {}
  if (!rm.on) return;
  const p = await LN.requestPermissions(); if (p.display !== "granted") { rm.on = false; save(); renderSettings(); toast(t("remDenied")); return; }
  const [hh, mm] = (rm.time || "21:00").split(":").map(Number);
  await LN.schedule({ notifications: [{ id: 1, title: t("notifTitle"), body: t("notifBody"), schedule: { on: { hour: hh, minute: mm }, allowWhileIdle: true } }] });
}
$("remOn").onclick = () => { const rm = S.settings.remind = S.settings.remind || { time: "21:00" }; rm.on = !rm.on; save(); renderSettings(); schedule(); };
$("remTime").addEventListener("change", () => { const rm = S.settings.remind = S.settings.remind || {}; rm.time = $("remTime").value || "21:00"; save(); schedule(); });
$("rateIn").addEventListener("change", () => { const iv = S.settings.invest, sm = S.settings.smoke; if (!iv || !sm) return; const v = +$("rateIn").value; S.rates = S.rates || {}; const k = rateKey(sm.cur, iv.cur); if (v > 0) S.rates[k] = { r: v, d: key(today), manual: true }; else delete S.rates[k]; save(); renderSettings(); });
["ivAmt", "ivCur"].forEach(id => $(id).addEventListener("change", () => { const iv = S.settings.invest; if (!iv) return; iv.amount = Math.max(0, +$("ivAmt").value || 0); iv.cur = $("ivCur").value.trim() || iv.cur; save(); }));
["smPacks", "smPrice", "smCur"].forEach(id => $(id).addEventListener("change", () => { const sm = S.settings.smoke; if (!sm) return; sm.packs = Math.max(0, +$("smPacks").value || 0); sm.price = Math.max(0, +$("smPrice").value || 0); sm.cur = $("smCur").value.trim() || sm.cur; save(); }));
$("sName").addEventListener("input", () => { S.settings.name = $("sName").value.trim(); save(); });
function retire(h) { const k = key(today); if (h.since === k) S.settings.habits = S.settings.habits.filter(y => y.id !== h.id); else h.until = k; }
$("habitForm").onsubmit = e => { e.preventDefault(); const v = $("habitIn").value.trim(); if (!v) return; S.settings.habits.push({ id: uid(), name: v, since: key(today) }); $("habitIn").value = ""; save(); renderSettings(); };
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const PL = (window.Capacitor && window.Capacitor.Plugins) || {};
$("exportBtn").onclick = async () => {
  saveNow(); const json = JSON.stringify(S, null, 1); const name = "hedef-takvimi-" + key(today) + ".json";
  if (NATIVE && PL.Filesystem && PL.Share) { try { const w = await PL.Filesystem.writeFile({ path: name, data: json, directory: "CACHE", encoding: "utf8" }); await PL.Share.share({ title: name, url: w.uri, dialogTitle: t("exportBtn") }); } catch (e) {} return; }
  const file = new File([json], name, { type: "application/json" });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
$("importIn").onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!d || !d.settings || !Array.isArray(d.settings.habits) || typeof d.days !== "object") throw 0; d.months = d.months || {}; d.years = d.years || {}; S = d; saveNow(); applyLang(S.settings.lang); renderAll(); $("bMsg").textContent = t("importOk"); }
  catch (err) { $("bMsg").textContent = t("importBad"); } };
let resetArm = false;
$("resetBtn").onclick = () => { if (!resetArm) { resetArm = true; $("resetBtn").textContent = t("resetConfirm"); return; } try { localStorage.removeItem(KEY); } catch (e) {} S = null; resetArm = false; showWelcome(); };

// ---------- navigation ----------
const VIEWS = { today: "v-today", cal: "v-cal", goals: "v-goals", set: "v-set" };
let view = "today";
function show(v) {
  view = v; for (const k in VIEWS) $(VIEWS[k]).hidden = k !== v;
  document.querySelectorAll(".tabs button").forEach(b => b.dataset.v === v ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  if (v === "today") renderToday(); if (v === "cal") renderCal(); if (v === "goals") renderGoals(); if (v === "set") renderSettings();
  scrollTo(0, 0); try { history.replaceState(null, "", "#" + v); } catch (e) {}
}
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => show(b.dataset.v));
function renderAll() { MLIST = []; renderDow(); show(view); }

// ---------- welcome + planning questions ----------
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function showWelcome() { wizard(false); }
function wizard(redo) {
  let lang = redo ? S.settings.lang : (navigator.language || "tr").slice(0, 2); if (!I18N[lang]) lang = "en";
  const prev = redo && S.settings.answers && S.settings.answers.yes ? S.settings.answers : null;
  const A = Object.assign({ name: redo ? S.settings.name : "", goal: "", wake: "07:00", sleep: "23:30", part: 0, yes: {}, no: {} }, prev || {});
  A.no = A.no || {}; if (A.price === undefined) A.price = ""; A.invWhere = A.invWhere || []; if (A.invAmt === undefined) A.invAmt = ""; if (!A.invCur) A.invCur = lang === "tr" ? "₺" : "$"; if (!A.cur) A.cur = lang === "tr" ? "₺" : "$";
  const STEPS = ["hi", "goal", "day"].concat(PLAN.ORDER, ["sum"]);
  let si = redo ? 1 : 0, P = null;
  $("welcome").hidden = false; $("app").hidden = true; $("tabs").hidden = true;
  const card = $("wcard");
  const close = () => { $("welcome").hidden = true; $("app").hidden = false; $("tabs").hidden = false; };
  const go = n => { si = n; draw(); };
  function opt(label, on, onClick, sub) { const b = el("button", "opt"); b.type = "button"; b.setAttribute("aria-pressed", on ? "true" : "false"); b.append(el("span", "", label)); if (sub) b.append(el("small", "", sub)); b.onclick = onClick; return b; }
  function nav(nextLabel, onNext, canNext) {
    const n = el("div", "wnav");
    const back = el("button", "btn", t("wzBack")); back.type = "button"; back.hidden = si === 0;
    back.onclick = () => { if (si === 1 && redo) { close(); show("set"); return; } go(si - 1); };
    if (si === 0) n.style.gridTemplateColumns = "1fr"; n.append(back);
    if (nextLabel) { const nx = el("button", "btn gold", nextLabel); nx.type = "button"; nx.onclick = onNext; if (canNext === false) { nx.disabled = true; nx.style.opacity = ".45"; } n.append(nx); }
    return n;
  }
  function draw() {
    applyLang(lang); card.textContent = ""; const step = STEPS[si];
    if (si > 0) { card.append(el("div", "wstep", t("wzStep", { a: si, b: STEPS.length - 1 }))); const bar = el("div", "wbar"); const i = el("i"); i.style.width = (si / (STEPS.length - 1) * 100) + "%"; bar.append(i); card.append(bar); }
    if (step === "hi") {
      const lg = el("div", "logo", "✗"); lg.setAttribute("aria-hidden", "true"); card.append(lg, el("h1", "", t("welcomeTitle")), el("p", "", t("welcomeText")));
      const ls = el("div", "langs"); ls.dataset.cur = lang; langChips(ls, c => { lang = c; draw(); }); card.append(ls);
      const f = el("label", "fld"); f.append(el("span", "", t("name"))); const inp = el("input"); inp.type = "text"; inp.value = A.name; inp.autocomplete = "given-name"; inp.oninput = () => A.name = inp.value.trim(); f.append(inp); card.append(f);
      card.append(nav(t("start"), () => go(1)));
    } else if (step === "goal") {
      card.append(el("h2", "wq", t("qGoal")), el("p", "hint c", t("qGoalH")));
      const ta = el("textarea"); ta.rows = 3; ta.id = "wGoal"; ta.placeholder = t("qGoalPh"); ta.value = A.goal; ta.maxLength = 160; card.append(ta);
      card.append(nav(A.goal.trim() ? t("wzNext") : t("wzSkip"), () => go(si + 1)));
      ta.oninput = () => { A.goal = ta.value; card.querySelector(".wnav .gold").textContent = ta.value.trim() ? t("wzNext") : t("wzSkip"); };
    } else if (step === "day") {
      card.append(el("h2", "wq", t("qDay")), el("p", "hint c", t("qDayWake")));
      const tm = el("div", "times");
      [["wake", "wake"], ["sleep", "sleep"]].forEach(([k, lb]) => { const f = el("label", "fld"); f.append(el("span", "", t(lb))); const i = el("input"); i.type = "time"; i.value = A[k]; i.onchange = () => A[k] = i.value || A[k]; f.append(i); tm.append(f); });
      card.append(tm, el("p", "hint c", t("qDayPart")));
      const o = el("div", "opts"); t("parts").forEach((x, i) => o.append(opt(x, A.part === i, () => { A.part = i; draw(); }))); card.append(o);
      card.append(nav(t("wzNext"), () => go(si + 1)));
    } else if (step !== "sum") {
      const q = t("QS")[step]; const isYes = step in A.yes;
      card.append(el("h2", "wq", q.q), el("p", "hint c", q.sub));
      const yn = el("div", "opts two");
      yn.append(opt(q.yesLabel || t("yes"), isYes, () => { if (!isYes) A.yes[step] = q.amts ? -1 : 0; delete A.no[step]; if (!q.amts && step !== "invest") go(si + 1); else draw(); }));
      yn.append(opt(q.noLabel || t("no"), !!A.no[step], () => { delete A.yes[step]; A.no[step] = true; go(si + 1); }));
      card.append(yn);
      if (isYes && q.amts) {
        card.append(el("p", "hint c", q.amtQ || t("howMuch")));
        const am = el("div", "opts two"); q.amts.forEach((x, i) => am.append(opt(x, A.yes[step] === i, () => { A.yes[step] = i; if (step === "smoke") draw(); else go(si + 1); }))); card.append(am);
      }
      if (step === "invest" && isYes) {
        card.append(el("p", "hint c", t("invWhere")));
        const ws = el("div", "opts two"); t("invWhereL").forEach((x, i) => ws.append(opt(x, A.invWhere.includes(i), () => { A.invWhere = A.invWhere.includes(i) ? A.invWhere.filter(y => y !== i) : A.invWhere.concat(i); draw(); }))); card.append(ws);
        card.append(el("p", "hint c", t("invAmtQ")));
        const cs = el("div", "langs"); ["₺", "$", "€", "£"].forEach(c => { const b = el("button", "chip", c); b.type = "button"; b.setAttribute("aria-pressed", A.invCur === c ? "true" : "false"); b.onclick = () => { A.invCur = c; draw(); }; cs.append(b); }); card.append(cs);
        const ia = el("input"); ia.type = "number"; ia.inputMode = "decimal"; ia.min = "0"; ia.step = "any"; ia.className = "bigin"; ia.placeholder = t("invHint"); ia.value = A.invAmt; ia.oninput = () => A.invAmt = ia.value; ia.setAttribute("aria-label", t("invAmtQ"));
        card.append(ia, nav(t("wzNext"), () => { if (!(+A.invAmt > 0)) { ia.focus(); return; } go(si + 1); }));
      } else if (step === "smoke" && isYes && A.yes.smoke >= 0) {
        card.append(el("p", "hint c", t("priceQ")));
        const cs = el("div", "langs"); ["₺", "$", "€", "£"].forEach(c => { const b = el("button", "chip", c); b.type = "button"; b.setAttribute("aria-pressed", A.cur === c ? "true" : "false"); b.onclick = () => { A.cur = c; if (!A.priceTyped) A.price = ""; draw(); }; cs.append(b); }); card.append(cs);
        const pr = el("input"); pr.type = "number"; pr.inputMode = "decimal"; pr.min = "0"; pr.step = "any"; pr.className = "bigin"; pr.placeholder = A.cur === "₺" ? "125" : "10"; pr.value = A.price; pr.setAttribute("aria-label", t("packPrice"));
        const per = el("p", "hint c"); const upd = () => { const v = +A.price || 0; per.textContent = v ? t("perDay", { d: (Math.round(v * [0.5, 1, 1.5, 2][A.yes.smoke] * 100) / 100).toLocaleString(lang) + " " + A.cur }) : t("priceHint"); };
        pr.oninput = () => { A.price = pr.value; A.priceTyped = true; upd(); }; upd();
        card.append(pr, per, nav(t("wzNext"), () => { if (!(+A.price > 0)) { pr.focus(); per.textContent = t("priceHint"); return; } go(si + 1); }));
      } else card.append(nav(null));
    } else {
      if (!P) P = PLAN.build(lang, A, uid);
      card.append(el("h2", "wq", t("q6")), el("p", "hint c", t("q6h")));
      const sec = (title, items, render) => { const s = el("div", "sum"); s.append(el("h2", "", title)); const box = el("div", "checks"); items.forEach((it, i) => { const r = el("div", "row"); const x = el("button", "x", "✕"); x.type = "button"; x.setAttribute("aria-label", t("remove")); x.onclick = () => { items.splice(i, 1); draw(); }; r.append(render(it), x); box.append(r); });
        const add = el("button", "btn", "+ " + t("add")); add.type = "button"; add.onclick = () => { items.push(title === t("habits") ? { id: uid(), name: "" } : { id: uid(), time: "", t: "" }); draw(); const ins = box.parentNode.querySelectorAll("input[type=text]"); }; s.append(box, add); card.append(s); };
      sec(t("habits"), P.habits, it => { const i = el("input"); i.type = "text"; i.value = it.name; i.oninput = () => it.name = i.value; return i; });
      sec(t("routine"), P.routine, it => { const w = el("div", "row3"); w.style.gridTemplateColumns = "124px minmax(0,1fr)"; const tm = el("input"); tm.type = "time"; tm.value = it.time; tm.onchange = () => it.time = tm.value; const i = el("input"); i.type = "text"; i.value = it.t; i.oninput = () => it.t = i.value; w.append(tm, i); return w; });
      const g = el("div", "sum"); g.append(el("h2", "", t("monthGoals", { m: cap(today.toLocaleDateString(lang, { month: "long" })) }))); const ta = el("textarea"); ta.rows = 7; ta.value = P.goals; ta.oninput = () => P.goals = ta.value; g.append(ta); card.append(g);
      card.append(nav(t("startPlan"), () => {
        const habitsF = P.habits.filter(h => h.name.trim()); const routineF = P.routine.filter(r => r.t.trim());
        if (!redo) S = fresh(lang, A.name);
        S.settings.lang = lang; S.settings.name = A.name; S.settings.answers = A;
        if (habitsF.length) {
          if (!redo) S.settings.habits = habitsF;
          else { const k = key(today), act = habits(), used = new Set();
            habitsF.forEach(n => { const m = act.find(o => !used.has(o.id) && o.name.trim() === n.name.trim()); if (m) { used.add(m.id); if (n.kind) m.kind = n.kind; } else { n.since = k; S.settings.habits.push(n); } });
            act.forEach(o => { if (!used.has(o.id)) retire(o); }); }
        }
        S.settings.routine = routineF; S.settings.smoke = P.smoke; S.settings.invest = P.invest;
        const m = mkey(today); if (P.goals.trim()) S.months[m] = Object.assign({}, S.months[m] || {}, { goals: P.goals });
        const td = S.days[key(today)]; if (td) td.seeded = false;
        saveNow(); close(); sel = key(today); cur = mkey(today); gm = cur; view = "today"; renderAll();
      }));
    }
    if (step !== "sum") P = null;
    card.scrollTop = 0;
  }
  draw();
}

// ---------- sky ----------
(function () { const c = $("sky"); if (reduce || !c.getContext) return; const x = c.getContext("2d"); let W, H, st = [];
  function sz() { W = c.width = innerWidth; H = c.height = innerHeight; st = Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + .2, p: Math.random() * 6 })); }
  sz(); addEventListener("resize", sz);
  (function f(tm) { x.clearRect(0, 0, W, H); st.forEach(s => { x.globalAlpha = .25 + .35 * Math.sin(tm / 900 + s.p) ** 2; x.fillStyle = "#C9D6FF"; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 6.3); x.fill(); }); requestAnimationFrame(f); })(0); })();

// ---------- boot ----------
if (load()) { applyLang(S.settings.lang); const h = (location.hash || "").slice(1); if (VIEWS[h]) view = h; renderAll(); }
else showWelcome();
if (!NATIVE && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
if (NATIVE && PL.App) PL.App.addListener("backButton", () => { if (!$("welcome").hidden || view === "today") PL.App.exitApp(); else show("today"); });
})();
