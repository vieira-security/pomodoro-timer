import { test, expect } from "./fixtures";

test.describe("Tarefa atual", () => {
  test("aparece no título da aba e fica salva", async ({ app, page }) => {
    await app.task().fill("Escrever o TCC");
    await app.toggle().click();
    await app.wait(1_000);
    await expect(page).toHaveTitle("24:59 · Escrever o TCC");

    await page.reload();
    await expect(app.task()).toHaveValue("Escrever o TCC");
  });
});

test.describe("Contador do dia", () => {
  test("zera quando muda o dia", async ({ page, app }) => {
    await page.evaluate(() =>
      localStorage.setItem("pomodoro-stats", JSON.stringify({ date: "2026-11-16", count: 7, seconds: 10500 }))
    );
    await page.reload();
    await expect(app.stats()).toHaveText("Hoje: 0 pomodoros · 0min de foco");
  });

  test("mantém o que foi feito hoje", async ({ page, app }) => {
    await page.evaluate(() =>
      localStorage.setItem("pomodoro-stats", JSON.stringify({ date: "2026-11-17", count: 3, seconds: 4500 }))
    );
    await page.reload();
    await expect(app.stats()).toHaveText("Hoje: 3 pomodoros · 1h 15min de foco");
  });
});

test.describe("Tema", () => {
  test("alterna automático → claro → escuro e lembra a escolha", async ({ app, page }) => {
    const html = page.locator("html");
    const btn = page.getByTestId("theme-toggle");
    await expect(html).not.toHaveAttribute("data-theme");
    await expect(btn).toHaveAttribute("aria-label", "Tema: automático");

    await btn.click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await btn.click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("o tema claro muda as cores de fundo", async ({ app, page }) => {
    await page.getByTestId("theme-toggle").click();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(246, 245, 242)");
  });
});

test.describe("Modo foco total", () => {
  test("esconde tudo menos o tempo e sai com Esc", async ({ app, page }) => {
    await app.task().fill("Ler artigo");
    await page.getByTestId("zen-toggle").click();
    await expect(page.locator("body")).toHaveClass(/zen/);
    await expect(app.tab("focus")).toBeHidden();
    await expect(app.toggle()).toBeHidden();
    await expect(app.clock()).toBeVisible();
    await expect(app.label()).toHaveText("Ler artigo");

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/zen/);
    await expect(app.toggle()).toBeVisible();
  });

  test("Espaço continua pausando dentro do modo foco total", async ({ app, page }) => {
    test.skip(!!(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)), "teclado físico");
    await page.keyboard.press("f");
    await page.keyboard.press("Space");
    await app.wait(2_000);
    await expect(app.clock()).toHaveText("24:58");
  });
});

test.describe("Layout", () => {
  test("botões do topo continuam clicáveis com a página rolada", async ({ app, page }) => {
    await app.openSettings();
    await page.mouse.wheel(0, 400);
    await page.getByTestId("lang-en").click();
    await expect(app.toggle()).toHaveText("Start");
    await page.getByTestId("zen-toggle").click();
    await expect(page.locator("body")).toHaveClass(/zen/);
  });
});
