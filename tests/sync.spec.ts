import { test as base, expect, BrowserContext, Page } from "@playwright/test";

// Duas abas do mesmo navegador (mesmo contexto = mesmo localStorage e BroadcastChannel)
const test = base.extend<{ tabs: (n: number) => Promise<Page[]> }>({
  tabs: async ({ context }, use) => {
    await context.clock.install({ time: new Date("2026-11-17T10:00:00") });
    await context.addInitScript(() => {
      const w = window as any;
      w.__events = [];
      for (const n of ["alarm", "finish", "sync", "ambient"]) {
        document.addEventListener("pomodoro:" + n, (e: any) => w.__events.push({ name: n, detail: e.detail }));
      }
    });
    await use(async (n) => {
      const pages: Page[] = [];
      for (let i = 0; i < n; i++) {
        const p = await context.newPage();
        await p.goto("/");
        await expect(p.getByTestId("clock")).toBeVisible();
        pages.push(p);
      }
      return pages;
    });
  },
});

const events = (p: Page, name: string) =>
  p.evaluate((n) => (window as any).__events.filter((e: any) => e.name === n), name);

test.describe("Sincronização entre abas", () => {
  test("iniciar e pausar numa aba reflete na outra", async ({ tabs, context }) => {
    const [a, b] = await tabs(2);
    await a.getByTestId("toggle").click();
    await context.clock.runFor(3_000);
    await expect(b.getByTestId("toggle")).toHaveText("Pausar");
    await expect(b.getByTestId("clock")).toHaveText("24:57");

    await b.getByTestId("toggle").click();
    await expect(a.getByTestId("toggle")).toHaveText("Continuar");
    await context.clock.runFor(5_000);
    await expect(a.getByTestId("clock")).toHaveText("24:57");
  });

  test("aba aberta depois pega o estado da que já está rodando", async ({ tabs, context }) => {
    const [a] = await tabs(1);
    await a.getByTestId("tab-short").click();
    await a.getByTestId("toggle").click();
    await context.clock.runFor(10_000);

    const [b] = await tabs(1);
    await expect(b.getByTestId("tab-short")).toHaveAttribute("aria-pressed", "true");
    await expect(b.getByTestId("toggle")).toHaveText("Pausar");
    // o relógio falso continua andando enquanto a aba nova carrega: compara as duas abas
    await context.clock.pauseAt((await a.evaluate(() => Date.now())) + 500);
    await expect(b.getByTestId("clock")).toHaveText(/^04:[0-5]\d$/);
    await expect(b.getByTestId("clock")).toHaveText((await a.getByTestId("clock").textContent())!);
  });

  test("no fim do ciclo o alarme toca e o pomodoro conta UMA vez só", async ({ tabs, context }) => {
    const [a, b] = await tabs(2);
    await a.getByTestId("toggle").click();
    await context.clock.fastForward(25 * 60_000);
    await context.clock.runFor(1_000);

    await expect(a.getByTestId("tab-short")).toHaveAttribute("aria-pressed", "true");
    await expect(b.getByTestId("tab-short")).toHaveAttribute("aria-pressed", "true");
    const alarms = (await events(a, "alarm")).length + (await events(b, "alarm")).length;
    expect(alarms).toBe(1);
    await expect(a.getByTestId("stats")).toHaveText("Hoje: 1 pomodoro · 25min de foco");
    await expect(b.getByTestId("stats")).toHaveText("Hoje: 1 pomodoro · 25min de foco");
  });

  test("som ambiente toca só na aba que o usuário está usando", async ({ tabs, context }) => {
    const [a, b] = await tabs(2);
    await a.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("pomodoro-settings") || "{}");
      localStorage.setItem("pomodoro-settings", JSON.stringify({ ...s, ambient: "brown" }));
    });
    await a.reload();
    await a.getByTestId("toggle").click();
    await context.clock.runFor(1_000);
    expect(await events(a, "ambient")).toEqual([{ name: "ambient", detail: { playing: true, kind: "brown" } }]);
    expect(await events(b, "ambient")).toEqual([]);
  });

  test("idioma, tema e configurações mudados numa aba aparecem na outra", async ({ tabs }) => {
    const [a, b] = await tabs(2);
    await a.getByTestId("lang-en").click();
    await expect(b.getByTestId("toggle")).toHaveText("Start");

    await a.getByTestId("theme-toggle").click();
    await expect(b.locator("html")).toHaveAttribute("data-theme", "light");

    await a.locator("#settings-panel summary").click();
    await a.getByTestId("preset-extended").click();
    await expect(b.getByTestId("clock")).toHaveText("50:00");
  });

  test("mensagens inválidas de outra aba são ignoradas", async ({ tabs }) => {
    const [a] = await tabs(1);
    await a.evaluate(() => {
      const ch = new BroadcastChannel("pomodoro-sync");
      ch.postMessage({ type: "state", state: { mode: "hack", rev: 999 } });
      ch.postMessage({ type: "state", state: { mode: "focus", total: -5, remainingMs: 0, endAt: 0, running: true, completedFocus: 0, rev: 999, from: "x" } });
      ch.postMessage("lixo");
    });
    await expect(a.getByTestId("clock")).toHaveText("25:00");
    await expect(a.getByTestId("toggle")).toHaveText("Iniciar");
  });
});
