import { describe, it, expect } from "vitest";
import { I18N, detectLang, translate } from "../../public/js/i18n.js";

describe("i18n", () => {
  it("português e inglês têm exatamente as mesmas chaves", () => {
    const keys = (o) => Object.keys(o).sort();
    expect(keys(I18N.en)).toEqual(keys(I18N.pt));
    expect(keys(I18N.en.theme)).toEqual(keys(I18N.pt.theme));
  });

  it("nenhum texto está vazio (inclusive os aninhados)", () => {
    const walk = (obj, path) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "object") walk(v, `${path}.${k}`);
        else expect(v.trim(), `${path}.${k}`).not.toBe("");
      }
    };
    walk(I18N.pt, "pt");
    walk(I18N.en, "en");
  });

  it("rótulos do tema", () => {
    expect(I18N.pt.theme).toEqual({ auto: "Tema: automático", light: "Tema: claro", dark: "Tema: escuro" });
    expect(I18N.en.theme).toEqual({ auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" });
  });

  it("os placeholders {x} são os mesmos nos dois idiomas", () => {
    const ph = (s) => (typeof s === "string" ? (s.match(/\{\w+\}/g) || []).sort() : []);
    for (const k of Object.keys(I18N.pt)) expect(ph(I18N.en[k]), k).toEqual(ph(I18N.pt[k]));
  });

  it("detectLang: escolha salva > idioma do navegador > inglês", () => {
    expect(detectLang("en", "pt-BR")).toBe("en");
    expect(detectLang("pt", "en-US")).toBe("pt");
    expect(detectLang(null, "pt-BR")).toBe("pt");
    expect(detectLang(null, "PT-pt")).toBe("pt");
    expect(detectLang("fr", "es-ES")).toBe("en");
    expect(detectLang(null, "en-PT")).toBe("en"); // inglês em Portugal continua inglês
    expect(detectLang(undefined, undefined)).toBe("en");
  });

  it("translate substitui as variáveis", () => {
    expect(translate("pt", "stats", { n: 3, p: "pomodoros", time: "1h 15min" })).toBe("Hoje: 3 pomodoros · 1h 15min de foco");
    expect(translate("en", "cycles", { n: 1, t: 4 })).toBe("Completed cycles: 1 of 4");
    expect(translate("en", "start")).toBe("Start");
  });
});
