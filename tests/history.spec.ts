import { test, expect } from "./fixtures";
import { readFile } from "node:fs/promises";

// relógio da fixture: terça, 17/11/2026 10:00
const SEED = {
  "2026-11-11": { count: 2, seconds: 3000 },
  "2026-11-12": { count: 6, seconds: 9000 },
  "2026-11-14": { count: 4, seconds: 6000 },
  "2026-11-15": { count: 3, seconds: 4500 },
  "2026-11-16": { count: 8, seconds: 12000 },
  "2026-10-30": { count: 5, seconds: 7500 }, // fora dos 7 dias, dentro dos 30
};

test.describe("Histórico", () => {
  test.beforeEach(async ({ page, app }) => {
    await page.evaluate((h) => localStorage.setItem("pomodoro-history", JSON.stringify(h)), SEED);
    await page.reload();
    await page.locator("#history-panel summary").click();
  });

  test("mostra totais da semana, do mês e a sequência de dias", async ({ page }) => {
    await expect(page.getByTestId("hist-week")).toHaveText("9h 35min · 23 pomodoros");
    await expect(page.getByTestId("hist-month")).toHaveText("11h 40min · 28 pomodoros");
    // hoje ainda sem pomodoro: a sequência conta a partir de ontem (16, 15, 14)
    await expect(page.getByTestId("hist-streak")).toHaveText("3 dias");
  });

  test("gráfico tem os últimos 7 dias, com hoje destacado e dia vazio marcado", async ({ page }) => {
    const bars = page.getByTestId("hist-chart").locator("li");
    await expect(bars).toHaveCount(7);
    await expect(bars.first()).toHaveAttribute("data-day", "2026-11-11");
    await expect(bars.last()).toHaveAttribute("data-day", "2026-11-17");
    await expect(bars.last()).toHaveClass(/today/);
    await expect(page.locator('li[data-day="2026-11-13"]')).toHaveClass(/empty/);
    // a maior barra (16/11) ocupa 100%
    await expect(page.locator('li[data-day="2026-11-16"] .bar')).toHaveCSS("--h", "100%");
    await expect(page.locator('li[data-day="2026-11-16"]')).toHaveAttribute("title", /3h 20min de foco, 8 pomodoros/);
  });

  test("completar um pomodoro atualiza o gráfico e aumenta a sequência", async ({ app, page }) => {
    await app.toggle().click();
    await app.jump(25 * 60_000);
    await expect(page.getByTestId("hist-streak")).toHaveText("4 dias");
    await expect(page.getByTestId("hist-week")).toHaveText("10h 00min · 24 pomodoros");
    await expect(page.locator('li[data-day="2026-11-17"]')).not.toHaveClass(/empty/);
  });

  test("exporta o histórico em CSV", async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
    expect(download.suggestedFilename()).toBe("pomodoro-history-2026-11-17.csv");
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv.split("\n")).toEqual([
      "date,pomodoros,focus_minutes",
      "2026-10-30,5,125",
      "2026-11-11,2,50",
      "2026-11-12,6,150",
      "2026-11-14,4,100",
      "2026-11-15,3,75",
      "2026-11-16,8,200",
      "",
    ]);
  });

  test("dados corrompidos no storage não quebram a página", async ({ page, app }) => {
    await page.evaluate(() => localStorage.setItem("pomodoro-history", '{"lixo": 1, "2026-11-16": {"count": "abc"}, "2026-11-15": {"count": 2, "seconds": 600}}'));
    await page.reload();
    await page.locator("#history-panel summary").click();
    await expect(page.getByTestId("hist-week")).toHaveText("10min · 2 pomodoros");
  });

  test("migra o contador diário da versão anterior", async ({ page, app }) => {
    await page.evaluate(() => {
      localStorage.removeItem("pomodoro-history");
      localStorage.setItem("pomodoro-stats", JSON.stringify({ date: "2026-11-17", count: 2, seconds: 3000 }));
    });
    await page.reload();
    await expect(app.stats()).toHaveText("Hoje: 2 pomodoros · 50min de foco");
    expect(await page.evaluate(() => localStorage.getItem("pomodoro-stats"))).toBeNull();
  });
});

test.describe("Atalhos de tempo", () => {
  test("aplicam as três durações de uma vez e ficam salvos", async ({ app, page }) => {
    await app.openSettings();
    await expect(page.getByTestId("preset-classic")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("preset-extended").click();
    await expect(app.clock()).toHaveText("50:00");
    await expect(page.getByTestId("cfg-short")).toHaveValue("10");
    await expect(page.getByTestId("cfg-long")).toHaveValue("30");
    await expect(page.getByTestId("preset-extended")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("preset-classic")).toHaveAttribute("aria-pressed", "false");

    await page.reload();
    await expect(app.clock()).toHaveText("50:00");
  });

  test("ajuste manual desmarca o atalho", async ({ app, page }) => {
    await app.setNumber("cfg-focus", 30);
    for (const id of ["classic", "extended", "deep"]) {
      await expect(page.getByTestId(`preset-${id}`)).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("com o timer rodando, o atalho não interrompe a sessão atual", async ({ app, page }) => {
    await app.toggle().click();
    await app.wait(1_000);
    await app.openSettings();
    await page.getByTestId("preset-deep").click();
    await expect(app.toggle()).toHaveText("Pausar");
    await expect(app.clock()).toHaveText("24:59");
  });
});
