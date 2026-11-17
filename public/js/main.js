/* Pomodoro Timer — https://github.com/vieira-security/pomodoro-timer */
import {
  DEFAULTS, PRESETS, clampSetting, normalizeSettings, matchingPreset,
  formatClock, formatDuration, secondsLeft, nextMode,
  dateKey, parseKey, normalizeHistory, addFocus, dayStats, lastDays, totals, streak, historyToCsv,
  isValidState, isNewer,
} from "./core.js";
import { I18N, detectLang, translate } from "./i18n.js";
import { Noise, createAudio } from "./audio.js";
import { createFavicon, createWakeLock, createPip } from "./extras.js";

// ---------------------------------------------------------------- anti-clickjacking
// O GitHub Pages não permite o header X-Frame-Options / CSP frame-ancestors.
// Mitigação: dentro de um iframe de outro site, a interface some e só fica um link para abrir em aba própria.
function isFramed() {
  try { return window.self !== window.top; } catch (e) { return true; }
}
if (isFramed()) {
  document.body.classList.add("framed");
  const a = document.createElement("a");
  a.className = "framed-link";
  a.href = location.href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "Abrir o Pomodoro Timer / Open Pomodoro Timer ↗";
  a.dataset.testid = "framed-link";
  document.body.appendChild(a);
}

// ---------------------------------------------------------------- storage
const KEYS = {
  settings: "pomodoro-settings",
  lang: "pomodoro-lang",
  theme: "pomodoro-theme",
  history: "pomodoro-history",
  legacyStats: "pomodoro-stats",
  task: "pomodoro-task",
  claim: "pomodoro-claim",
};
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
};

let settings = normalizeSettings(load(KEYS.settings, {}));
let history = normalizeHistory(load(KEYS.history, {}), load(KEYS.legacyStats, null));
if (load(KEYS.legacyStats, null)) {
  save(KEYS.history, history);
  try { localStorage.removeItem(KEYS.legacyStats); } catch (e) {}
}

let lang = detectLang(load(KEYS.lang, null), navigator.language);
const t = (key, vars) => translate(lang, key, vars);
const plural = (n) => (n === 1 ? t("pomodoro") : t("pomodoros"));
const today = () => dateKey(new Date());

// ---------------------------------------------------------------- DOM
const $ = (id) => document.getElementById(id);
const clock = $("clock"), label = $("label"), toggleBtn = $("toggle"), taskInput = $("task");
const progress = document.querySelector(".progress");
const CIRC = 2 * Math.PI * 45;
progress.style.strokeDasharray = CIRC;

const emit = (name, detail) => document.dispatchEvent(new CustomEvent("pomodoro:" + name, { detail }));
const cssVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

// ---------------------------------------------------------------- estado
let mode = "focus";
let total = settings.focus * 60;
let remainingMs = total * 1000;
let remaining = total;
let running = false;
let endAt = 0;
let tickId = null, rafId = null, autoStartId = null;
let completedFocus = 0;
let zen = false;
let task = load(KEYS.task, "");
let theme = load(KEYS.theme, "auto");
let shownDay = today();

// sincronização entre abas
const tabId = Math.random().toString(36).slice(2);
let rev = 0;          // versão do estado; a maior vence
let owner = false;    // esta aba é a que o usuário está usando (toca o som ambiente)

const { Sound, Alarm, Ambient } = createAudio({ getSettings: () => settings, emit });
window.PomodoroNoise = Noise; // usado nos testes

const favicon = createFavicon(document.querySelector('link[rel="icon"][type="image/svg+xml"]'));
const wakeLock = createWakeLock(emit);
const pip = createPip({
  onToggle: () => toggle(),
  getView: () => ({
    mode, running,
    theme: document.documentElement.dataset.theme || "",
    clock: formatClock(running ? secondsLeft(endAt - Date.now()) : remaining),
    label: task || t(mode),
    button: toggleBtn.textContent,
    fraction: currentFraction(),
  }),
});

/** Só troca o texto se mudou (no WebKit, trocar o texto sob o cursor no meio do clique cancela o clique). */
const setText = (el, v) => { if (el.textContent !== v) el.textContent = v; };
const setRing = (fraction) => { progress.style.strokeDashoffset = CIRC * (1 - fraction); };
const currentFraction = () => (running ? Math.max(0, endAt - Date.now()) : remainingMs) / (total * 1000);

// ---------------------------------------------------------------- render
function render() {
  setText(clock, formatClock(remaining));
  setText(label, zen && task ? task : t(mode));
  document.body.classList.toggle("running", running);
  if (!running) {
    progress.classList.add("ease");
    setRing(remainingMs / (total * 1000));
  }
  setText(toggleBtn, running ? t("pause") : (remaining < total ? t("resume") : t("start")));

  const active = running || remaining < total;
  const what = task || (mode === "focus" ? t("titleFocus") : t("titleBreak"));
  document.title = active ? `${formatClock(remaining)} · ${what}` : "Pomodoro Timer";

  document.body.dataset.mode = mode;
  document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === mode));

  const dots = $("dots");
  const done = completedFocus % settings.interval;
  if (dots.children.length !== settings.interval) {
    dots.innerHTML = "";
    for (let i = 0; i < settings.interval; i++) dots.appendChild(document.createElement("i"));
  }
  [...dots.children].forEach((d, i) => d.classList.toggle("on", i < done));
  dots.setAttribute("aria-label", t("cycles", { n: done, t: settings.interval }));

  const s = dayStats(history, today());
  setText($("stats"), t("stats", { n: s.count, p: plural(s.count), time: formatDuration(s.seconds) }));

  favicon.update(active ? currentFraction() : null, cssVar("--accent"), cssVar("--track"));
  wakeLock.set(zen && running);
  pip.paint();
}

// ---------------------------------------------------------------- histórico
function renderHistory() {
  const day = today();
  const week = totals(history, day, 7), month = totals(history, day, 30);
  $("hist-week").textContent = `${formatDuration(week.seconds)} · ${week.count} ${plural(week.count)}`;
  $("hist-month").textContent = `${formatDuration(month.seconds)} · ${month.count} ${plural(month.count)}`;
  const st = streak(history, day);
  $("hist-streak").textContent = t(st === 1 ? "histDay" : "histDays", { n: st });

  const days = lastDays(history, day, 7);
  const max = Math.max(1, ...days.map((d) => d.seconds));
  const weekday = new Intl.DateTimeFormat(I18N[lang].locale, { weekday: "short" });
  const full = new Intl.DateTimeFormat(I18N[lang].locale, { weekday: "long", day: "numeric", month: "numeric" });
  const chart = $("hist-chart");
  chart.setAttribute("aria-label", t("histChart"));
  chart.replaceChildren(...days.map((d) => {
    const li = document.createElement("li");
    const date = parseKey(d.day);
    const desc = t("histBar", { day: full.format(date), time: formatDuration(d.seconds), n: d.count, p: plural(d.count) });
    li.title = desc;
    li.dataset.day = d.day;
    if (d.day === day) li.classList.add("today");
    if (!d.seconds) li.classList.add("empty");
    const bar = document.createElement("span");
    bar.className = "bar";
    bar.style.setProperty("--h", (d.seconds / max) * 100 + "%");
    const name = document.createElement("span");
    name.className = "day";
    name.setAttribute("aria-hidden", "true");
    name.textContent = weekday.format(date).replace(".", "");
    const sr = document.createElement("span");
    sr.className = "visually-hidden";
    sr.textContent = desc;
    li.append(bar, name, sr);
    return li;
  }));
}

function exportCsv() {
  const blob = new Blob([historyToCsv(history)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pomodoro-history-${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------- timer
function frame() {
  if (!running) return;
  setRing(currentFraction());
  rafId = requestAnimationFrame(frame);
}

function tick() {
  const ms = Math.max(0, endAt - Date.now());
  const left = secondsLeft(ms);
  if (left !== remaining) { remaining = left; render(); }
  if (ms <= 0) finish(true);
}

function setMode(next, { autoStart = false, local = true } = {}) {
  stop();
  clearTimeout(autoStartId);
  mode = next;
  total = settings[next] * 60;
  remainingMs = total * 1000;
  remaining = total;
  render();
  // só a aba "dona" avisa as outras; as demais iniciam localmente no mesmo instante
  if (autoStart) autoStartId = setTimeout(() => start({ local: owner }), 650);
  if (local) broadcast();
}

function start({ local = true } = {}) {
  if (running) return;
  clearTimeout(autoStartId);
  running = true;
  endAt = Date.now() + remainingMs;
  progress.classList.remove("ease");
  tickId = setInterval(tick, 200);
  rafId = requestAnimationFrame(frame);
  if (mode === "focus" && owner) Ambient.start();
  render();
  emit("start", { mode });
  if (local) broadcast();
}

function stop() {
  if (running) remainingMs = Math.max(0, endAt - Date.now());
  running = false;
  clearInterval(tickId);
  cancelAnimationFrame(rafId);
  tickId = rafId = null;
  Ambient.stop();
}

/** Garante que só UMA aba execute os efeitos de fim de ciclo (alarme, histórico...). */
function claimOnce(id, effects) {
  const run = () => {
    try { if (localStorage.getItem(KEYS.claim) === id) return; localStorage.setItem(KEYS.claim, id); } catch (e) {}
    effects();
  };
  if (navigator.locks && navigator.locks.request) navigator.locks.request(KEYS.claim, run).catch(run);
  else run();
}

function recordFocus(seconds, completed) {
  history = addFocus(normalizeHistory(load(KEYS.history, {})), today(), seconds, completed);
  save(KEYS.history, history);
  renderHistory();
  render();
}

function finish(natural) {
  const elapsed = total - Math.max(0, running ? endAt - Date.now() : remainingMs) / 1000;
  const finishedEndAt = endAt;
  stop();
  const ended = mode;
  if (ended === "focus" && natural) completedFocus++;
  const next = nextMode(ended, natural, completedFocus, settings.interval);
  const fullTotal = total;

  if (natural) {
    const effects = () => {
      if (ended === "focus") recordFocus(fullTotal, true);
      Alarm.play(ended);
      vibrate();
      notify(ended);
    };
    const id = `${ended}@${finishedEndAt}`;
    // a aba "dona" faz na hora; as outras só assumem se a dona não fizer (ex.: foi fechada)
    if (owner) claimOnce(id, effects);
    else setTimeout(() => claimOnce(id, effects), 400);
  } else if (ended === "focus") {
    recordFocus(elapsed, false);
  }
  emit("finish", { mode: ended, natural, next });
  setMode(next, { autoStart: settings.auto, local: !natural || owner });
}

function toggle() {
  if (running) { stop(); render(); emit("pause", { mode }); owner = true; broadcast(); return; }
  owner = true;
  Sound.unlock();
  // No Firefox, pedir permissão tira a página da tela cheia: no modo foco total, não pede
  try {
    if ("Notification" in window && Notification.permission === "default" && !document.fullscreenElement) {
      Notification.requestPermission();
    }
  } catch (e) {}
  start();
}

function reset() {
  clearTimeout(autoStartId);
  stop();
  remainingMs = total * 1000;
  remaining = total;
  render();
  broadcast();
}

// ---------------------------------------------------------------- sincronização entre abas
const channel = "BroadcastChannel" in window ? new BroadcastChannel("pomodoro-sync") : null;

function snapshot() {
  return {
    mode, total, running, completedFocus, rev, from: tabId,
    remainingMs: running ? Math.max(0, endAt - Date.now()) : remainingMs,
    endAt: running ? endAt : 0,
  };
}

function broadcast() {
  if (!channel) return;
  rev++;
  channel.postMessage({ type: "state", state: snapshot() });
}

function applyRemote(s) {
  if (!isValidState(s) || !isNewer(s, { rev, from: tabId })) return;
  rev = s.rev;
  owner = false;
  clearTimeout(autoStartId);
  stop();
  mode = s.mode;
  total = s.total;
  completedFocus = s.completedFocus;
  remainingMs = s.running ? Math.max(0, s.endAt - Date.now()) : s.remainingMs;
  remaining = secondsLeft(remainingMs);
  if (s.running) {
    running = true;
    endAt = s.endAt;
    progress.classList.remove("ease");
    tickId = setInterval(tick, 200);
    rafId = requestAnimationFrame(frame);
  }
  render();
  emit("sync", { from: s.from, running: s.running, mode: s.mode });
}

if (channel) {
  channel.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type === "state") applyRemote(msg.state);
    // aba nova pedindo o estado atual: responde sem aumentar a versão
    else if (msg.type === "hello" && rev > 0) channel.postMessage({ type: "state", state: snapshot() });
  };
}

// configurações, idioma, tema, tarefa e histórico mudados em outra aba
window.addEventListener("storage", (e) => {
  if (e.key === KEYS.settings) { settings = normalizeSettings(load(KEYS.settings, {})); fillSettings(); render(); }
  else if (e.key === KEYS.lang) { lang = detectLang(load(KEYS.lang, null), navigator.language); applyLang(); }
  else if (e.key === KEYS.theme) { theme = load(KEYS.theme, "auto"); applyTheme(); }
  else if (e.key === KEYS.task) { task = load(KEYS.task, ""); taskInput.value = task; render(); }
  else if (e.key === KEYS.history) { history = normalizeHistory(load(KEYS.history, {})); renderHistory(); render(); }
});

// ---------------------------------------------------------------- vibração / notificação
function vibrate() {
  if (!settings.vibrate) return;
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
}
function notify(ended) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      const body = ended === "focus" ? t("notifFocus") : t("notifBreak");
      const opts = { body, icon: "icons/icon-192.png", tag: "pomodoro" };
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => reg.showNotification("Pomodoro", opts));
      } else {
        new Notification("Pomodoro", opts);
      }
    }
  } catch (e) {}
}

// ---------------------------------------------------------------- modo foco total
let zenHintTimer = null;
function setZen(on) {
  zen = on;
  document.body.classList.toggle("zen", on);
  const hint = $("zen-hint");
  if (on) {
    hint.textContent = t("zenHint");
    hint.classList.add("show");
    clearTimeout(zenHintTimer);
    zenHintTimer = setTimeout(() => hint.classList.remove("show"), 2500);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  } else {
    hint.classList.remove("show");
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  }
  render();
}
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && zen) setZen(false); });

// ---------------------------------------------------------------- tema
const THEMES = ["auto", "light", "dark"];
const svg = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const THEME_ICON = {
  auto: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>'),
  light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  dark: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
};
const PIP_ICON = svg('<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="12" y="12" width="7" height="6" rx="1" fill="currentColor"/>');
if (!THEMES.includes(theme)) theme = "auto";
function applyTheme() {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const btn = $("theme-btn");
  btn.innerHTML = THEME_ICON[theme];
  btn.title = t("theme")[theme];
  btn.setAttribute("aria-label", t("theme")[theme]);
  render();
}

// ---------------------------------------------------------------- idioma
function applyLang() {
  document.documentElement.lang = I18N[lang].locale === "pt-BR" ? "pt-BR" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $("hint").innerHTML = t("hint");
  [["reset", "reset"], ["skip", "skip"], ["zen-btn", "zen"], ["pip-btn", "pip"]].forEach(([id, key]) => {
    $(id).title = t(key);
    $(id).setAttribute("aria-label", t(key));
  });
  taskInput.placeholder = t("taskPlaceholder");
  document.querySelector('meta[name="description"]').content = t("desc");
  document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  applyTheme();
  renderHistory();
}

// ---------------------------------------------------------------- configurações
const NUM_FIELDS = { focus: "cfg-focus", short: "cfg-short", long: "cfg-long", interval: "cfg-interval" };
const RANGES = [["volume", "cfg-volume"], ["ambientVolume", "cfg-ambient-volume"]];

function paintRange(el) {
  el.style.setProperty("--fill", el.value + "%");
  $(el.id + "-out").textContent = el.value + "%";
}

/** Copia `settings` para os campos da tela. */
function fillSettings() {
  Object.entries(NUM_FIELDS).forEach(([key, id]) => { $(id).value = settings[key]; });
  $("cfg-auto").checked = settings.auto;
  $("cfg-vibrate").checked = settings.vibrate;
  $("cfg-sound").value = settings.sound;
  $("cfg-ambient").value = settings.ambient;
  RANGES.forEach(([key, id]) => { $(id).value = settings[key]; paintRange($(id)); });
  const preset = matchingPreset(settings);
  document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", !!preset && b.dataset.preset === preset.id));
}

function saveSettings() {
  save(KEYS.settings, settings);
  fillSettings();
}

Object.entries(NUM_FIELDS).forEach(([key, id]) => {
  $(id).addEventListener("change", () => {
    settings[key] = clampSetting(key, $(id).value);
    saveSettings();
    if (!running && key === mode) setMode(mode); else render();
  });
});
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
  const p = PRESETS.find((x) => x.id === b.dataset.preset);
  settings = { ...settings, focus: p.focus, short: p.short, long: p.long };
  saveSettings();
  if (!running) setMode(mode); else render();
}));
["auto", "vibrate"].forEach((key) => {
  $("cfg-" + key).addEventListener("change", (e) => { settings[key] = e.target.checked; saveSettings(); });
});
[["sound", "cfg-sound"], ["ambient", "cfg-ambient"]].forEach(([key, id]) => {
  $(id).addEventListener("change", () => {
    settings[key] = $(id).value;
    saveSettings();
    if (key === "sound" && settings.sound !== "off") Alarm.play("focus");
    if (key === "ambient") { Ambient.stop(); if (running && mode === "focus" && owner) Ambient.start(); }
  });
});
RANGES.forEach(([key, id]) => {
  $(id).addEventListener("input", () => {
    paintRange($(id));
    settings[key] = +$(id).value;
    save(KEYS.settings, settings);
    if (key === "ambientVolume") Ambient.setVolume();
  });
});
$("test-sound").addEventListener("click", () => Alarm.play("focus", true));

// ---------------------------------------------------------------- eventos
toggleBtn.addEventListener("click", toggle);
$("reset").addEventListener("click", reset);
$("skip").addEventListener("click", () => { owner = true; finish(false); });
$("zen-btn").addEventListener("click", () => setZen(!zen));
$("theme-btn").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  save(KEYS.theme, theme);
  applyTheme();
});
const pipBtn = $("pip-btn");
pipBtn.innerHTML = PIP_ICON;
pipBtn.hidden = !pip.supported;
pipBtn.addEventListener("click", () => pip.toggle().catch(() => {}));
$("export-csv").addEventListener("click", exportCsv);
$("history-panel").addEventListener("toggle", renderHistory);

document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => { owner = true; setMode(b.dataset.mode); }));
document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
  lang = b.dataset.lang;
  save(KEYS.lang, lang);
  applyLang();
}));

taskInput.value = task;
taskInput.addEventListener("input", () => { task = taskInput.value.trim(); save(KEYS.task, task); render(); });
taskInput.addEventListener("keydown", (e) => { if (e.key === "Enter") taskInput.blur(); });

document.addEventListener("keydown", (e) => {
  if (e.target.closest && e.target.closest("input, select, textarea")) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (e.code === "Space") { e.preventDefault(); toggle(); }
  else if (k === "r") reset();
  else if (k === "s") { owner = true; finish(false); }
  else if (k === "f") setZen(!zen);
  else if (k === "escape" && zen) setZen(false);
});
document.addEventListener("click", (e) => {
  if (!zen) return;
  if (!e.target.closest("#zen-btn")) setZen(false);
});

// virada do dia com o site aberto
setInterval(() => {
  if (shownDay !== today()) { shownDay = today(); renderHistory(); render(); }
}, 60 * 1000);

// ---------------------------------------------------------------- PWA
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

fillSettings();
setMode("focus", { local: false });
applyLang();
if (channel) channel.postMessage({ type: "hello", from: tabId });
