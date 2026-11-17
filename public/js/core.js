// Lógica pura do Pomodoro: sem DOM, sem relógio, sem storage.
// Tudo aqui é determinístico e coberto por testes unitários (Vitest + Stryker).

export const MODES = ["focus", "short", "long"];

export const DEFAULTS = Object.freeze({
  focus: 25, short: 5, long: 15, interval: 4, auto: false,
  sound: "bell", volume: 70, vibrate: true,
  ambient: "off", ambientVolume: 40,
});

export const LIMITS = Object.freeze({
  focus: [1, 120], short: [1, 60], long: [1, 60], interval: [2, 10],
  volume: [0, 100], ambientVolume: [0, 100],
});

export const SOUNDS = ["bell", "digital", "soft", "off"];
export const AMBIENTS = ["off", "white", "brown", "rain"];

export const PRESETS = Object.freeze([
  { id: "classic", focus: 25, short: 5, long: 15 },
  { id: "extended", focus: 50, short: 10, long: 30 },
  { id: "deep", focus: 90, short: 20, long: 30 },
]);

/** Converte o valor digitado para inteiro dentro do limite; inválido → padrão. */
export function clampSetting(key, value) {
  const [min, max] = LIMITS[key];
  const n = typeof value === "number" ? Math.trunc(value) : parseInt(value, 10);
  if (Number.isNaN(n)) return DEFAULTS[key];
  return Math.min(max, Math.max(min, n));
}

/** Junta o que veio do storage com os padrões, corrigindo valores inválidos. */
export function normalizeSettings(raw) {
  const s = { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  if (s.sound === false) s.sound = "off"; // versão antiga: sound era booleano (true cai no padrão "bell")
  for (const key of Object.keys(LIMITS)) s[key] = clampSetting(key, s[key]);
  if (!SOUNDS.includes(s.sound)) s.sound = DEFAULTS.sound;
  if (!AMBIENTS.includes(s.ambient)) s.ambient = DEFAULTS.ambient;
  s.auto = s.auto === true;
  s.vibrate = s.vibrate !== false;
  return s;
}

/** Preset que bate exatamente com as durações atuais (ou null). */
export function matchingPreset(settings) {
  return PRESETS.find((p) => p.focus === settings.focus && p.short === settings.short && p.long === settings.long) || null;
}

/** 90 → "01:30" ; 7200 → "120:00" */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/** 4500 → "1h 15min" ; 300 → "5min" */
export function formatDuration(seconds) {
  const sec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
}

/** Segundos restantes exibidos (arredonda para cima: 24:59.2 mostra 25:00 → 24:59 só depois) */
export function secondsLeft(ms) {
  return Math.ceil(Math.max(0, ms) / 1000);
}

/** Próxima etapa depois que uma termina. */
export function nextMode(ended, natural, completedFocus, interval) {
  if (ended !== "focus") return "focus";
  return natural && completedFocus > 0 && completedFocus % interval === 0 ? "long" : "short";
}

// ------------------------------------------------------------------ datas
/** Date → "2026-11-17" no fuso local. */
export function dateKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** "2026-11-17" → Date local à meia-noite. */
export function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, days) {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

// ------------------------------------------------------------------ histórico
// history = { "2026-11-17": { count: 3, seconds: 4500 }, ... }

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Limpa dados corrompidos ou de versões antigas. */
export function normalizeHistory(raw, legacyStats) {
  const h = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (!KEY_RE.test(k) || !v || typeof v !== "object") continue;
      const count = Math.max(0, Math.trunc(Number(v.count) || 0));
      const seconds = Math.max(0, Math.round(Number(v.seconds) || 0));
      if (count || seconds) h[k] = { count, seconds };
    }
  }
  // migra o contador diário da versão anterior ({ date, count, seconds })
  if (legacyStats && KEY_RE.test(legacyStats.date) && !h[legacyStats.date]) {
    const count = Math.max(0, Math.trunc(Number(legacyStats.count) || 0));
    const seconds = Math.max(0, Math.round(Number(legacyStats.seconds) || 0));
    if (count || seconds) h[legacyStats.date] = { count, seconds };
  }
  return h;
}

/** Devolve um NOVO histórico com o foco somado ao dia. */
export function addFocus(history, day, seconds, completed) {
  const prev = history[day] || { count: 0, seconds: 0 };
  return {
    ...history,
    [day]: {
      count: prev.count + (completed ? 1 : 0),
      seconds: prev.seconds + Math.max(0, Math.round(seconds)),
    },
  };
}

export function dayStats(history, day) {
  return history[day] || { count: 0, seconds: 0 };
}

/** Últimos `n` dias terminando em `today` (mais antigo primeiro). */
export function lastDays(history, today, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, ...dayStats(history, day) });
  }
  return out;
}

export function totals(history, today, n) {
  return lastDays(history, today, n).reduce(
    (acc, d) => ({ count: acc.count + d.count, seconds: acc.seconds + d.seconds, activeDays: acc.activeDays + (d.count > 0 ? 1 : 0) }),
    { count: 0, seconds: 0, activeDays: 0 }
  );
}

/**
 * Dias seguidos com pelo menos 1 pomodoro completo.
 * Se hoje ainda não tem, a sequência continua contando a partir de ontem
 * (você não "perde" a sequência às 8h da manhã).
 */
export function streak(history, today) {
  let day = dayStats(history, today).count > 0 ? today : addDays(today, -1);
  let n = 0;
  while (dayStats(history, day).count > 0) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** CSV ordenado por data: date,pomodoros,focus_minutes */
export function historyToCsv(history) {
  const rows = Object.keys(history)
    .filter((k) => KEY_RE.test(k))
    .sort()
    .map((k) => `${k},${history[k].count},${Math.round(history[k].seconds / 60)}`);
  return ["date,pomodoros,focus_minutes", ...rows].join("\n") + "\n";
}

// ------------------------------------------------------------------ sincronização entre abas
/** Valida uma mensagem de estado vinda de outra aba. */
export function isValidState(s) {
  if (!s || typeof s !== "object") return false;
  if (!MODES.includes(s.mode)) return false;
  // campo ausente vira undefined e já é reprovado pelas checagens de tipo abaixo
  return Number.isFinite(s.total) && s.total > 0 && Number.isFinite(s.remainingMs) && s.remainingMs >= 0
    && Number.isFinite(s.endAt) && typeof s.running === "boolean"
    && Number.isInteger(s.completedFocus) && s.completedFocus >= 0 && Number.isFinite(s.rev);
}

/** Aplica o estado remoto só se ele for mais novo (rev maior; empate decide pelo id da aba). */
export function isNewer(remote, local) {
  if (remote.rev !== local.rev) return remote.rev > local.rev;
  return String(remote.from) > String(local.from);
}
