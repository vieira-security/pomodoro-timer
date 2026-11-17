// Textos da interface em português e inglês.
export const I18N = {
  pt: {
    locale: "pt-BR",
    tabFocus: "Foco", tabShort: "Pausa curta", tabLong: "Pausa longa",
    focus: "Hora de focar", short: "Pausa curta", long: "Pausa longa",
    start: "Iniciar", pause: "Pausar", resume: "Continuar",
    reset: "Reiniciar (R)", skip: "Pular (S)", cycles: "Ciclos concluídos: {n} de {t}",
    titleFocus: "Foco", titleBreak: "Pausa",
    taskLabel: "No que você está focando?", taskPlaceholder: "No que você está focando?",
    stats: "Hoje: {n} {p} · {time} de foco",
    pomodoro: "pomodoro", pomodoros: "pomodoros",
    settings: "Configurações",
    presets: "Atalhos de tempo",
    cfgFocus: "Foco (min)", cfgShort: "Pausa curta (min)", cfgLong: "Pausa longa (min)",
    cfgInterval: "Pausa longa a cada (ciclos)",
    cfgAuto: "Iniciar próxima etapa automaticamente",
    cfgSound: "Alarme", soundBell: "Sino", soundDigital: "Digital", soundSoft: "Suave", soundOff: "Desligado",
    cfgVolume: "Volume do alarme", testSound: "Testar",
    cfgVibrate: "Vibrar ao terminar (celular)",
    cfgAmbient: "Som ambiente durante o foco",
    ambOff: "Desligado", ambWhite: "Ruído branco", ambBrown: "Ruído marrom", ambRain: "Chuva",
    cfgAmbientVolume: "Volume do ambiente",
    history: "Histórico",
    histWeek: "Últimos 7 dias", histMonth: "Últimos 30 dias", histStreak: "Sequência",
    histDays: "{n} dias", histDay: "{n} dia",
    histBar: "{day}: {time} de foco, {n} {p}",
    histChart: "Minutos de foco por dia nos últimos 7 dias",
    exportCsv: "Exportar CSV",
    hint: "<kbd>Espaço</kbd> iniciar/pausar · <kbd>R</kbd> reiniciar · <kbd>S</kbd> pular · <kbd>F</kbd> foco total",
    zen: "Modo foco total", zenHint: "Esc ou F para sair · Espaço para pausar",
    pip: "Mini timer flutuante",
    theme: { auto: "Tema: automático", light: "Tema: claro", dark: "Tema: escuro" },
    notifFocus: "Foco concluído! Hora da pausa.",
    notifBreak: "Pausa encerrada! Hora de focar.",
    desc: "Timer Pomodoro simples, sem distrações e instalável. Funciona offline.",
  },
  en: {
    locale: "en-US",
    tabFocus: "Focus", tabShort: "Short break", tabLong: "Long break",
    focus: "Time to focus", short: "Short break", long: "Long break",
    start: "Start", pause: "Pause", resume: "Resume",
    reset: "Reset (R)", skip: "Skip (S)", cycles: "Completed cycles: {n} of {t}",
    titleFocus: "Focus", titleBreak: "Break",
    taskLabel: "What are you focusing on?", taskPlaceholder: "What are you focusing on?",
    stats: "Today: {n} {p} · {time} focused",
    pomodoro: "pomodoro", pomodoros: "pomodoros",
    settings: "Settings",
    presets: "Quick presets",
    cfgFocus: "Focus (min)", cfgShort: "Short break (min)", cfgLong: "Long break (min)",
    cfgInterval: "Long break every (cycles)",
    cfgAuto: "Auto-start next session",
    cfgSound: "Alarm", soundBell: "Bell", soundDigital: "Digital", soundSoft: "Soft", soundOff: "Off",
    cfgVolume: "Alarm volume", testSound: "Test",
    cfgVibrate: "Vibrate when finished (mobile)",
    cfgAmbient: "Ambient sound while focusing",
    ambOff: "Off", ambWhite: "White noise", ambBrown: "Brown noise", ambRain: "Rain",
    cfgAmbientVolume: "Ambient volume",
    history: "History",
    histWeek: "Last 7 days", histMonth: "Last 30 days", histStreak: "Streak",
    histDays: "{n} days", histDay: "{n} day",
    histBar: "{day}: {time} focused, {n} {p}",
    histChart: "Focus minutes per day over the last 7 days",
    exportCsv: "Export CSV",
    hint: "<kbd>Space</kbd> start/pause · <kbd>R</kbd> reset · <kbd>S</kbd> skip · <kbd>F</kbd> zen mode",
    zen: "Zen mode", zenHint: "Esc or F to exit · Space to pause",
    pip: "Floating mini timer",
    theme: { auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" },
    notifFocus: "Focus done! Time for a break.",
    notifBreak: "Break's over! Time to focus.",
    desc: "A simple, distraction-free, installable Pomodoro timer. Works offline.",
  },
};

export function detectLang(saved, browserLang) {
  if (I18N[saved]) return saved;
  return (browserLang || "").toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function translate(lang, key, vars) {
  let s = I18N[lang][key];
  if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
  return s;
}
