/* Pomodoro Timer — https://github.com/vieira-security/pomodoro-timer */
(() => {
  "use strict";

  // ---------------------------------------------------------------- storage
  const KEYS = {
    settings: "pomodoro-settings",
    lang: "pomodoro-lang",
    theme: "pomodoro-theme",
    stats: "pomodoro-stats",
    task: "pomodoro-task",
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

  const DEFAULTS = {
    focus: 25, short: 5, long: 15, interval: 4, auto: false,
    sound: "bell", volume: 70, vibrate: true,
    ambient: "off", ambientVolume: 40,
  };
  const settings = { ...DEFAULTS, ...load(KEYS.settings, {}) };
  // migração da versão antiga (sound: true/false)
  if (settings.sound === true) settings.sound = "bell";
  if (settings.sound === false) settings.sound = "off";

  // ---------------------------------------------------------------- i18n
  const I18N = {
    pt: {
      tabFocus: "Foco", tabShort: "Pausa curta", tabLong: "Pausa longa",
      focus: "Hora de focar", short: "Pausa curta", long: "Pausa longa",
      start: "Iniciar", pause: "Pausar", resume: "Continuar",
      reset: "Reiniciar (R)", skip: "Pular (S)", cycles: "Ciclos concluídos: {n} de {t}",
      titleFocus: "Foco", titleBreak: "Pausa",
      taskLabel: "No que você está focando?", taskPlaceholder: "No que você está focando?",
      stats: "Hoje: {n} {p} · {time} de foco",
      pomodoro: "pomodoro", pomodoros: "pomodoros",
      settings: "Configurações",
      cfgFocus: "Foco (min)", cfgShort: "Pausa curta (min)", cfgLong: "Pausa longa (min)",
      cfgInterval: "Pausa longa a cada (ciclos)",
      cfgAuto: "Iniciar próxima etapa automaticamente",
      cfgSound: "Alarme", soundBell: "Sino", soundDigital: "Digital", soundSoft: "Suave", soundOff: "Desligado",
      cfgVolume: "Volume do alarme", testSound: "Testar",
      cfgVibrate: "Vibrar ao terminar (celular)",
      cfgAmbient: "Som ambiente durante o foco",
      ambOff: "Desligado", ambWhite: "Ruído branco", ambBrown: "Ruído marrom", ambRain: "Chuva",
      cfgAmbientVolume: "Volume do ambiente",
      hint: "<kbd>Espaço</kbd> iniciar/pausar · <kbd>R</kbd> reiniciar · <kbd>S</kbd> pular · <kbd>F</kbd> foco total",
      zen: "Modo foco total", zenHint: "Esc ou F para sair · Espaço para pausar",
      theme: { auto: "Tema: automático", light: "Tema: claro", dark: "Tema: escuro" },
      notifFocus: "Foco concluído! Hora da pausa.",
      notifBreak: "Pausa encerrada! Hora de focar.",
      desc: "Timer Pomodoro simples, sem distrações e instalável. Funciona offline.",
    },
    en: {
      tabFocus: "Focus", tabShort: "Short break", tabLong: "Long break",
      focus: "Time to focus", short: "Short break", long: "Long break",
      start: "Start", pause: "Pause", resume: "Resume",
      reset: "Reset (R)", skip: "Skip (S)", cycles: "Completed cycles: {n} of {t}",
      titleFocus: "Focus", titleBreak: "Break",
      taskLabel: "What are you focusing on?", taskPlaceholder: "What are you focusing on?",
      stats: "Today: {n} {p} · {time} focused",
      pomodoro: "pomodoro", pomodoros: "pomodoros",
      settings: "Settings",
      cfgFocus: "Focus (min)", cfgShort: "Short break (min)", cfgLong: "Long break (min)",
      cfgInterval: "Long break every (cycles)",
      cfgAuto: "Auto-start next session",
      cfgSound: "Alarm", soundBell: "Bell", soundDigital: "Digital", soundSoft: "Soft", soundOff: "Off",
      cfgVolume: "Alarm volume", testSound: "Test",
      cfgVibrate: "Vibrate when finished (mobile)",
      cfgAmbient: "Ambient sound while focusing",
      ambOff: "Off", ambWhite: "White noise", ambBrown: "Brown noise", ambRain: "Rain",
      cfgAmbientVolume: "Ambient volume",
      hint: "<kbd>Space</kbd> start/pause · <kbd>R</kbd> reset · <kbd>S</kbd> skip · <kbd>F</kbd> zen mode",
      zen: "Zen mode", zenHint: "Esc or F to exit · Space to pause",
      theme: { auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" },
      notifFocus: "Focus done! Time for a break.",
      notifBreak: "Break's over! Time to focus.",
      desc: "A simple, distraction-free, installable Pomodoro timer. Works offline.",
    },
  };
  let lang = load(KEYS.lang, null);
  if (!I18N[lang]) lang = (navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en";
  const t = (key, vars) => {
    let s = I18N[lang][key];
    if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
    return s;
  };

  // ---------------------------------------------------------------- DOM
  const $ = (id) => document.getElementById(id);
  const clock = $("clock"), label = $("label"), toggleBtn = $("toggle"), taskInput = $("task");
  const progress = document.querySelector(".progress");
  const CIRC = 2 * Math.PI * 45;
  progress.style.strokeDasharray = CIRC;

  const emit = (name, detail) => document.dispatchEvent(new CustomEvent("pomodoro:" + name, { detail }));

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

  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  const setRing = (fraction) => { progress.style.strokeDashoffset = CIRC * (1 - fraction); };

  // ---------------------------------------------------------------- estatísticas do dia
  const today = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  let stats = load(KEYS.stats, { date: today(), count: 0, seconds: 0 });
  function currentStats() {
    if (stats.date !== today()) stats = { date: today(), count: 0, seconds: 0 };
    return stats;
  }
  function addFocus(seconds, completed) {
    const s = currentStats();
    s.seconds += Math.max(0, Math.round(seconds));
    if (completed) s.count += 1;
    save(KEYS.stats, s);
  }
  function fmtDuration(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
  }

  // ---------------------------------------------------------------- render
  function render() {
    clock.textContent = fmt(remaining);
    label.textContent = zen && task ? task : t(mode);
    document.body.classList.toggle("running", running);
    if (!running) {
      progress.classList.add("ease");
      setRing(remainingMs / (total * 1000));
    }
    toggleBtn.textContent = running ? t("pause") : (remaining < total ? t("resume") : t("start"));

    const active = running || remaining < total;
    const what = task || (mode === "focus" ? t("titleFocus") : t("titleBreak"));
    document.title = active ? `${fmt(remaining)} · ${what}` : "Pomodoro Timer";

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

    const s = currentStats();
    $("stats").textContent = t("stats", {
      n: s.count,
      p: s.count === 1 ? t("pomodoro") : t("pomodoros"),
      time: fmtDuration(s.seconds),
    });
  }

  // ---------------------------------------------------------------- timer
  function frame() {
    if (!running) return;
    setRing(Math.max(0, endAt - Date.now()) / (total * 1000));
    rafId = requestAnimationFrame(frame);
  }

  function tick() {
    const ms = Math.max(0, endAt - Date.now());
    const left = Math.ceil(ms / 1000);
    if (left !== remaining) { remaining = left; render(); }
    if (ms <= 0) finish(true);
  }

  function setMode(next, autoStart = false) {
    stop();
    clearTimeout(autoStartId);
    mode = next;
    total = settings[next] * 60;
    remainingMs = total * 1000;
    remaining = total;
    render();
    if (autoStart) autoStartId = setTimeout(start, 650);
  }

  function start() {
    if (running) return;
    clearTimeout(autoStartId);
    running = true;
    endAt = Date.now() + remainingMs;
    progress.classList.remove("ease");
    tickId = setInterval(tick, 200);
    rafId = requestAnimationFrame(frame);
    if (mode === "focus") Ambient.start();
    render();
    emit("start", { mode });
  }

  function stop() {
    if (running) remainingMs = Math.max(0, endAt - Date.now());
    running = false;
    clearInterval(tickId);
    cancelAnimationFrame(rafId);
    tickId = rafId = null;
    Ambient.stop();
  }

  function finish(natural) {
    const elapsed = total - Math.max(0, (running ? endAt - Date.now() : remainingMs)) / 1000;
    stop();
    const ended = mode;
    let next;
    if (ended === "focus") {
      addFocus(natural ? total : elapsed, natural);
      if (natural) completedFocus++;
      next = natural && completedFocus % settings.interval === 0 ? "long" : "short";
    } else {
      next = "focus";
    }
    if (natural) {
      Alarm.play(ended);
      vibrate();
      notify(ended);
    }
    emit("finish", { mode: ended, natural, next });
    setMode(next, settings.auto);
  }

  function toggle() {
    if (running) { stop(); render(); emit("pause", { mode }); return; }
    Sound.unlock();
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch (e) {}
    start();
  }

  function reset() {
    clearTimeout(autoStartId);
    stop();
    remainingMs = total * 1000;
    remaining = total;
    render();
  }

  // ---------------------------------------------------------------- áudio
  const Sound = {
    ctx: null,
    unlock() {
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") this.ctx.resume();
      } catch (e) {}
      return this.ctx;
    },
  };

  const Alarm = {
    // nota com envelope (ataque rápido, decaimento exponencial)
    note(ctx, out, { freq, at, dur, type = "sine", vol = 0.35 }) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.05);
    },
    patterns: {
      // Dó-Mi-Sol-Dó: sobe no fim do foco, desce no fim da pausa
      bell(ctx, out, now, ended) {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        if (ended !== "focus") notes.reverse();
        const reps = ended === "focus" ? 3 : 2;
        for (let r = 0; r < reps; r++) notes.forEach((f, i) => {
          const at = now + r * 1.6 + i * 0.18;
          Alarm.note(ctx, out, { freq: f, at, dur: 1.2, type: "triangle" });
          Alarm.note(ctx, out, { freq: f * 2.01, at, dur: 0.8, vol: 0.08 });
        });
      },
      // bip-bip-bip de relógio digital
      digital(ctx, out, now, ended) {
        const freq = ended === "focus" ? 1760 : 1320;
        for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) {
          Alarm.note(ctx, out, { freq, at: now + r * 1.0 + i * 0.12, dur: 0.08, type: "square", vol: 0.12 });
        }
      },
      // acorde grave e macio, tipo marimba
      soft(ctx, out, now, ended) {
        const chord = ended === "focus" ? [261.63, 329.63, 392.0] : [392.0, 329.63, 261.63];
        for (let r = 0; r < 2; r++) chord.forEach((f, i) => {
          Alarm.note(ctx, out, { freq: f, at: now + r * 1.8 + i * 0.25, dur: 1.6, vol: 0.3 });
        });
      },
    },
    play(ended, force) {
      const kind = settings.sound;
      if (kind === "off" && !force) return;
      emit("alarm", { kind, mode: ended });
      const ctx = Sound.unlock();
      if (!ctx) return;
      const out = ctx.createGain();
      out.gain.value = Math.pow(settings.volume / 100, 2) * 1.5;
      out.connect(ctx.destination);
      (this.patterns[kind] || this.patterns.bell)(ctx, out, ctx.currentTime + 0.05, ended);
    },
  };

  // Som ambiente gerado na hora (sem arquivos de áudio)
  const Ambient = {
    nodes: null,
    buffer(ctx, kind) {
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.5;
        else if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else { // rosa (Paul Kellet) — base da chuva
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;    b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;    b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      }
      // suaviza a emenda do loop
      const fade = 2000;
      for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[len - 1 - i] *= k; }
      return buf;
    },
    start() {
      if (settings.ambient === "off" || this.nodes) return;
      const ctx = Sound.unlock();
      if (!ctx) return;
      const src = ctx.createBufferSource();
      src.buffer = this.buffer(ctx, settings.ambient);
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(this.level(), ctx.currentTime + 1.5);
      let chain = src;
      if (settings.ambient === "rain") {
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 400;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000;
        // leve oscilação de intensidade, como chuva real
        const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
        lfo.frequency.value = 0.15; lfoGain.gain.value = 1500;
        lfo.connect(lfoGain).connect(lp.frequency); lfo.start();
        src.connect(hp).connect(lp);
        chain = lp;
        this.lfo = lfo;
      }
      chain.connect(gain).connect(ctx.destination);
      src.start();
      this.nodes = { src, gain, ctx };
      emit("ambient", { playing: true, kind: settings.ambient });
    },
    level() { return Math.max(0.0001, Math.pow(settings.ambientVolume / 100, 2) * 0.8); },
    setVolume() {
      if (this.nodes) this.nodes.gain.gain.setTargetAtTime(this.level(), this.nodes.ctx.currentTime, 0.1);
    },
    stop() {
      if (!this.nodes) return;
      const { src, gain, ctx } = this.nodes;
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      src.stop(now + 0.65);
      if (this.lfo) { this.lfo.stop(now + 0.65); this.lfo = null; }
      this.nodes = null;
      emit("ambient", { playing: false });
    },
  };

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
  let theme = load(KEYS.theme, "auto");
  if (!THEMES.includes(theme)) theme = "auto";
  function applyTheme() {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    const btn = $("theme-btn");
    btn.innerHTML = THEME_ICON[theme];
    btn.title = t("theme")[theme];
    btn.setAttribute("aria-label", t("theme")[theme]);
  }

  // ---------------------------------------------------------------- idioma
  function applyLang() {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $("hint").innerHTML = t("hint");
    [["reset", "reset"], ["skip", "skip"], ["zen-btn", "zen"]].forEach(([id, key]) => {
      $(id).title = t(key);
      $(id).setAttribute("aria-label", t(key));
    });
    taskInput.placeholder = t("taskPlaceholder");
    document.querySelector('meta[name="description"]').content = t("desc");
    document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
    applyTheme();
    render();
  }

  // ---------------------------------------------------------------- eventos
  toggleBtn.addEventListener("click", toggle);
  $("reset").addEventListener("click", reset);
  $("skip").addEventListener("click", () => finish(false));
  $("zen-btn").addEventListener("click", () => setZen(!zen));
  $("theme-btn").addEventListener("click", () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    save(KEYS.theme, theme);
    applyTheme();
  });
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
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
    else if (k === "s") finish(false);
    else if (k === "f") setZen(!zen);
    else if (k === "escape" && zen) setZen(false);
  });
  document.addEventListener("click", (e) => {
    if (!zen) return;
    if (!e.target.closest("#zen-btn")) setZen(false);
  });

  // configurações
  const numFields = { focus: "cfg-focus", short: "cfg-short", long: "cfg-long", interval: "cfg-interval" };
  Object.entries(numFields).forEach(([key, id]) => {
    const el = $(id);
    el.value = settings[key];
    el.addEventListener("change", () => {
      const n = parseInt(el.value, 10);
      const v = Number.isNaN(n) ? DEFAULTS[key] : Math.min(+el.max, Math.max(+el.min, n));
      el.value = v;
      settings[key] = v;
      save(KEYS.settings, settings);
      if (!running && key === mode) setMode(mode); else render();
    });
  });
  ["auto", "vibrate"].forEach((key) => {
    const el = $("cfg-" + key);
    el.checked = settings[key];
    el.addEventListener("change", () => { settings[key] = el.checked; save(KEYS.settings, settings); });
  });
  [["sound", "cfg-sound"], ["ambient", "cfg-ambient"]].forEach(([key, id]) => {
    const el = $(id);
    el.value = settings[key];
    el.addEventListener("change", () => {
      settings[key] = el.value;
      save(KEYS.settings, settings);
      if (key === "sound" && el.value !== "off") Alarm.play("focus");
      if (key === "ambient") { Ambient.stop(); if (running && mode === "focus") Ambient.start(); }
    });
  });
  [["volume", "cfg-volume"], ["ambientVolume", "cfg-ambient-volume"]].forEach(([key, id]) => {
    const el = $(id);
    el.value = settings[key];
    el.addEventListener("input", () => {
      settings[key] = +el.value;
      save(KEYS.settings, settings);
      if (key === "ambientVolume") Ambient.setVolume();
    });
  });
  $("test-sound").addEventListener("click", () => Alarm.play("focus", true));

  // virada do dia com o site aberto
  setInterval(() => { if (stats.date !== today()) render(); }, 60 * 1000);

  // ---------------------------------------------------------------- PWA
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  setMode("focus");
  applyLang();
})();
