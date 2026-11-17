import { describe, it, expect } from "vitest";
import {
  DEFAULTS, LIMITS, PRESETS, MODES, clampSetting, normalizeSettings, matchingPreset,
  formatClock, formatDuration, secondsLeft, nextMode,
  dateKey, parseKey, addDays,
  normalizeHistory, addFocus, dayStats, lastDays, totals, streak, historyToCsv,
  isValidState, isNewer,
} from "../../public/js/core.js";

describe("clampSetting", () => {
  it.each([
    ["focus", 25, 25], ["focus", 1, 1], ["focus", 0, 1], ["focus", -5, 1], ["focus", 120, 120], ["focus", 121, 120],
    ["short", 61, 60], ["long", 0, 1], ["interval", 1, 2], ["interval", 11, 10], ["interval", 2, 2],
    ["volume", -1, 0], ["volume", 101, 100], ["ambientVolume", 0, 0],
  ])("%s = %s → %s", (key, value, expected) => {
    expect(clampSetting(key, value)).toBe(expected);
  });

  it("número muito pequeno não vira 1 (parseInt de 1e-7 daria 1)", () => {
    expect(clampSetting("volume", 1e-7)).toBe(0);
    expect(clampSetting("volume", 99.99)).toBe(99);
  });

  it("aceita texto digitado e descarta a parte decimal", () => {
    expect(clampSetting("focus", "45")).toBe(45);
    expect(clampSetting("focus", "45.9")).toBe(45);
    expect(clampSetting("focus", 45.9)).toBe(45);
  });

  it("valor inválido volta ao padrão (e não ao mínimo)", () => {
    expect(clampSetting("focus", "abc")).toBe(25);
    expect(clampSetting("short", "")).toBe(5);
    expect(clampSetting("volume", undefined)).toBe(70);
  });
});

describe("normalizeSettings", () => {
  it("os padrões são os do método Pomodoro clássico", () => {
    expect(DEFAULTS).toEqual({
      focus: 25, short: 5, long: 15, interval: 4, auto: false,
      sound: "bell", volume: 70, vibrate: true, ambient: "off", ambientVolume: 40,
    });
  });

  it.each(["bell", "digital", "soft", "off"])("aceita o alarme %s", (sound) => {
    expect(normalizeSettings({ sound }).sound).toBe(sound);
  });

  it.each(["off", "white", "brown", "rain"])("aceita o som ambiente %s", (ambient) => {
    expect(normalizeSettings({ ambient }).ambient).toBe(ambient);
  });

  it("sem nada salvo usa os padrões", () => {
    expect(normalizeSettings(null)).toEqual({ ...DEFAULTS });
    expect(normalizeSettings("lixo")).toEqual({ ...DEFAULTS });
  });

  it("migra o formato antigo do som (booleano)", () => {
    expect(normalizeSettings({ sound: true }).sound).toBe("bell");
    expect(normalizeSettings({ sound: false }).sound).toBe("off");
  });

  it("corrige valores fora do limite e opções desconhecidas", () => {
    const s = normalizeSettings({ focus: 999, interval: 0, sound: "trombone", ambient: "jazz", auto: "sim", vibrate: 0 });
    expect(s).toMatchObject({ focus: 120, interval: 2, sound: "bell", ambient: "off", auto: false, vibrate: true });
  });

  it("mantém valores válidos", () => {
    const s = normalizeSettings({ focus: 50, sound: "soft", ambient: "rain", auto: true, vibrate: false, volume: 0 });
    expect(s).toMatchObject({ focus: 50, sound: "soft", ambient: "rain", auto: true, vibrate: false, volume: 0 });
  });

  it("todo padrão está dentro do próprio limite", () => {
    for (const [key, [min, max]] of Object.entries(LIMITS)) {
      expect(DEFAULTS[key]).toBeGreaterThanOrEqual(min);
      expect(DEFAULTS[key]).toBeLessThanOrEqual(max);
    }
  });
});

describe("presets", () => {
  it("reconhece o preset pelas três durações", () => {
    expect(matchingPreset({ focus: 25, short: 5, long: 15 })?.id).toBe("classic");
    expect(matchingPreset({ focus: 50, short: 10, long: 30 })?.id).toBe("extended");
    expect(matchingPreset({ focus: 90, short: 20, long: 30 })?.id).toBe("deep");
  });
  it("basta uma duração diferente para não ser preset", () => {
    expect(matchingPreset({ focus: 25, short: 5, long: 20 })).toBeNull();
    expect(matchingPreset({ focus: 25, short: 6, long: 15 })).toBeNull();
    expect(matchingPreset({ focus: 26, short: 5, long: 15 })).toBeNull();
  });
  it("todo preset respeita os limites", () => {
    for (const p of PRESETS) for (const k of ["focus", "short", "long"]) expect(clampSetting(k, p[k])).toBe(p[k]);
  });
});

describe("formatação", () => {
  it.each([[0, "00:00"], [59, "00:59"], [60, "01:00"], [1500, "25:00"], [7200, "120:00"], [-3, "00:00"], [61.9, "01:01"]])(
    "formatClock(%s) = %s", (s, out) => expect(formatClock(s)).toBe(out)
  );
  it.each([[0, "0min"], [59, "0min"], [60, "1min"], [3599, "59min"], [3600, "1h 00min"], [4500, "1h 15min"], [36660, "10h 11min"], [-10, "0min"]])(
    "formatDuration(%s) = %s", (s, out) => expect(formatDuration(s)).toBe(out)
  );
  it.each([[0, 0], [1, 1], [999, 1], [1000, 1], [1001, 2], [-500, 0], [1500000, 1500]])(
    "secondsLeft(%s ms) = %s", (ms, s) => expect(secondsLeft(ms)).toBe(s)
  );
});

describe("nextMode", () => {
  it("depois de qualquer pausa vem foco", () => {
    expect(nextMode("short", true, 1, 4)).toBe("focus");
    expect(nextMode("long", false, 4, 4)).toBe("focus");
  });
  it("foco completo vira pausa curta, e a cada N focos, pausa longa", () => {
    expect(nextMode("focus", true, 1, 4)).toBe("short");
    expect(nextMode("focus", true, 3, 4)).toBe("short");
    expect(nextMode("focus", true, 4, 4)).toBe("long");
    expect(nextMode("focus", true, 8, 4)).toBe("long");
    expect(nextMode("focus", true, 6, 3)).toBe("long");
  });
  it("foco pulado nunca dá pausa longa", () => {
    expect(nextMode("focus", false, 4, 4)).toBe("short");
  });
  it("sem nenhum foco completo não há pausa longa", () => {
    expect(nextMode("focus", true, 0, 4)).toBe("short");
  });
});

describe("datas", () => {
  it("dateKey usa o fuso local com zeros à esquerda", () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(dateKey(new Date(2026, 10, 17, 0, 0))).toBe("2026-11-17");
  });
  it("parseKey é o inverso de dateKey", () => {
    const d = parseKey("2026-03-09");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 9, 0]);
  });
  it("addDays atravessa mês, ano e ano bissexto", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-17", 0)).toBe("2026-11-17");
  });
});

describe("histórico", () => {
  const H = {
    "2026-11-11": { count: 2, seconds: 3000 },
    "2026-11-12": { count: 6, seconds: 9000 },
    "2026-11-14": { count: 4, seconds: 6000 },
    "2026-11-15": { count: 3, seconds: 4500 },
    "2026-11-16": { count: 8, seconds: 12000 },
    "2026-10-30": { count: 5, seconds: 7500 },
  };

  describe("normalizeHistory", () => {
    it("descarta chaves e valores inválidos", () => {
      expect(normalizeHistory({
        lixo: { count: 1, seconds: 1 },
        "2026-1-1": { count: 1, seconds: 1 },
        "2026-11-01": null,
        "2026-11-02": 5,
        "2026-11-03": { count: "abc", seconds: "x" },
        "2026-11-04": { count: -3, seconds: -10 },
        "2026-11-05": { count: 2.7, seconds: 59.6 },
        "2026-11-06": { count: 0, seconds: 30 },
        "x2026-11-07": { count: 1, seconds: 1 },
        "2026-11-08x": { count: 1, seconds: 1 },
      })).toEqual({ "2026-11-05": { count: 2, seconds: 60 }, "2026-11-06": { count: 0, seconds: 30 } });
    });
    it("aceita entrada vazia ou de tipo errado", () => {
      expect(normalizeHistory(null)).toEqual({});
      expect(normalizeHistory("x")).toEqual({});
      expect(normalizeHistory(undefined, undefined)).toEqual({});
    });
    it("migra o contador antigo sem sobrescrever o que já existe", () => {
      expect(normalizeHistory({}, { date: "2026-11-17", count: 2, seconds: 3000 })).toEqual({ "2026-11-17": { count: 2, seconds: 3000 } });
      expect(normalizeHistory({ "2026-11-17": { count: 9, seconds: 1 } }, { date: "2026-11-17", count: 2, seconds: 3000 }))
        .toEqual({ "2026-11-17": { count: 9, seconds: 1 } });
      expect(normalizeHistory({}, { date: "ontem", count: 2, seconds: 3000 })).toEqual({});
      expect(normalizeHistory({}, { date: "2026-11-17", count: 0, seconds: 0 })).toEqual({});
      expect(normalizeHistory({}, { date: "2026-11-17", count: "2", seconds: "60" })).toEqual({ "2026-11-17": { count: 2, seconds: 60 } });
      expect(normalizeHistory({}, { date: "2026-11-17", count: 0, seconds: 120 })).toEqual({ "2026-11-17": { count: 0, seconds: 120 } });
      expect(normalizeHistory({}, { date: "2026-11-17", count: 1, seconds: 0 })).toEqual({ "2026-11-17": { count: 1, seconds: 0 } });
      expect(normalizeHistory({}, { count: 3, seconds: 60 })).toEqual({});
    });
  });

  describe("addFocus", () => {
    it("soma ao dia sem modificar o original", () => {
      const before = { "2026-11-17": { count: 1, seconds: 1500 } };
      const after = addFocus(before, "2026-11-17", 1500, true);
      expect(after["2026-11-17"]).toEqual({ count: 2, seconds: 3000 });
      expect(before["2026-11-17"]).toEqual({ count: 1, seconds: 1500 });
    });
    it("foco pulado soma tempo mas não conta pomodoro", () => {
      expect(addFocus({}, "2026-11-17", 120.4, false)).toEqual({ "2026-11-17": { count: 0, seconds: 120 } });
    });
    it("tempo negativo vira zero", () => {
      expect(addFocus({}, "2026-11-17", -50, true)).toEqual({ "2026-11-17": { count: 1, seconds: 0 } });
    });
  });

  it("dayStats devolve zeros para dia sem registro", () => {
    expect(dayStats(H, "2026-11-13")).toEqual({ count: 0, seconds: 0 });
    expect(dayStats(H, "2026-11-16")).toEqual({ count: 8, seconds: 12000 });
  });

  it("lastDays lista N dias em ordem, incluindo os vazios", () => {
    const days = lastDays(H, "2026-11-17", 7);
    expect(days.map((d) => d.day)).toEqual(["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"]);
    expect(days[2]).toEqual({ day: "2026-11-13", count: 0, seconds: 0 });
    expect(lastDays(H, "2026-11-17", 1)).toEqual([{ day: "2026-11-17", count: 0, seconds: 0 }]);
  });

  it("totals soma a janela e conta dias ativos", () => {
    expect(totals(H, "2026-11-17", 7)).toEqual({ count: 23, seconds: 34500, activeDays: 5 });
    expect(totals(H, "2026-11-17", 30)).toEqual({ count: 28, seconds: 42000, activeDays: 6 });
    expect(totals(H, "2026-11-12", 1)).toEqual({ count: 6, seconds: 9000, activeDays: 1 });
    expect(totals({ "2026-11-17": { count: 0, seconds: 60 } }, "2026-11-17", 1)).toEqual({ count: 0, seconds: 60, activeDays: 0 });
  });

  describe("streak", () => {
    it("conta a partir de ontem se hoje ainda não teve pomodoro", () => {
      expect(streak(H, "2026-11-17")).toBe(3); // 16, 15, 14
    });
    it("inclui hoje quando hoje já teve pomodoro", () => {
      expect(streak({ ...H, "2026-11-17": { count: 1, seconds: 1500 } }, "2026-11-17")).toBe(4);
    });
    it("dia só com tempo (sem pomodoro completo) quebra a sequência", () => {
      expect(streak({ ...H, "2026-11-15": { count: 0, seconds: 900 } }, "2026-11-17")).toBe(1);
    });
    it("sem ontem nem hoje, sequência zero", () => {
      expect(streak(H, "2026-11-19")).toBe(0);
      expect(streak({}, "2026-11-17")).toBe(0);
    });
    it("atravessa a virada do mês", () => {
      const h = { "2026-10-31": { count: 1, seconds: 1 }, "2026-11-01": { count: 1, seconds: 1 }, "2026-11-02": { count: 1, seconds: 1 } };
      expect(streak(h, "2026-11-02")).toBe(3);
    });
  });

  it("historyToCsv ordena por data e converte para minutos", () => {
    expect(historyToCsv({ "2026-11-16": { count: 8, seconds: 12000 }, "2026-10-30": { count: 5, seconds: 7529 }, lixo: { count: 1, seconds: 60 } }))
      .toBe("date,pomodoros,focus_minutes\n2026-10-30,5,125\n2026-11-16,8,200\n");
    expect(historyToCsv({})).toBe("date,pomodoros,focus_minutes\n");
    expect(historyToCsv({ "2026-11-16": { count: 1, seconds: 89 } })).toBe("date,pomodoros,focus_minutes\n2026-11-16,1,1\n");
    expect(historyToCsv({ "2026-11-16": { count: 1, seconds: 90 } })).toBe("date,pomodoros,focus_minutes\n2026-11-16,1,2\n");
  });
});

describe("sincronização entre abas", () => {
  const ok = { mode: "focus", total: 1500, remainingMs: 1500000, endAt: 0, running: false, completedFocus: 0, rev: 1, from: "a" };

  it("aceita um estado válido", () => {
    expect(isValidState(ok)).toBe(true);
    expect(isValidState({ ...ok, mode: "long", running: true, endAt: 123, remainingMs: 0, completedFocus: 3 })).toBe(true);
  });

  it.each([
    ["nulo", null], ["texto", "x"], ["modo inválido", { ...ok, mode: "hack" }],
    ["sem campo", (({ rev, ...rest }) => rest)(ok)],
    ["total zero", { ...ok, total: 0 }], ["total negativo", { ...ok, total: -1 }], ["total NaN", { ...ok, total: NaN }],
    ["restante negativo", { ...ok, remainingMs: -1 }], ["restante infinito", { ...ok, remainingMs: Infinity }],
    ["endAt texto", { ...ok, endAt: "1" }], ["running texto", { ...ok, running: "true" }],
    ["ciclos fracionados", { ...ok, completedFocus: 1.5 }], ["ciclos negativos", { ...ok, completedFocus: -1 }],
    ["rev texto", { ...ok, rev: "2" }],
  ])("rejeita estado com %s", (_, s) => {
    expect(isValidState(s)).toBe(false);
  });

  it("isNewer: maior versão vence; empate decide pelo id da aba", () => {
    expect(isNewer({ rev: 3, from: "a" }, { rev: 2, from: "z" })).toBe(true);
    expect(isNewer({ rev: 2, from: "z" }, { rev: 3, from: "a" })).toBe(false);
    expect(isNewer({ rev: 2, from: "b" }, { rev: 2, from: "a" })).toBe(true);
    expect(isNewer({ rev: 2, from: "a" }, { rev: 2, from: "b" })).toBe(false);
    expect(isNewer({ rev: 2, from: "a" }, { rev: 2, from: "a" })).toBe(false);
  });

  it("os modos são exatamente foco, pausa curta e pausa longa", () => {
    expect(MODES).toEqual(["focus", "short", "long"]);
  });
});
