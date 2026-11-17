import { test, expect } from "./fixtures";

const MIN = 60_000;

test.describe("Timer", () => {
  test("começa em 25:00 no modo foco", async ({ app, page }) => {
    await expect(app.clock()).toHaveText("25:00");
    await expect(app.label()).toHaveText("Hora de focar");
    await expect(app.toggle()).toHaveText("Iniciar");
    await expect(app.tab("focus")).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveTitle("Pomodoro Timer");
  });

  test("conta o tempo e mostra no título da aba", async ({ app, page }) => {
    await app.toggle().click();
    await app.wait(5_000);
    await expect(app.clock()).toHaveText("24:55");
    await expect(app.toggle()).toHaveText("Pausar");
    await expect(page).toHaveTitle("24:55 · Foco");
  });

  test("pausar congela o tempo e continuar retoma", async ({ app }) => {
    await app.toggle().click();
    await app.wait(3_000);
    await app.toggle().click();
    await app.wait(10_000);
    await expect(app.clock()).toHaveText("24:57");
    await expect(app.toggle()).toHaveText("Continuar");

    await app.toggle().click();
    await app.wait(2_000);
    await expect(app.clock()).toHaveText("24:55");
  });

  test("reiniciar volta ao tempo cheio", async ({ app }) => {
    await app.toggle().click();
    await app.wait(4_000);
    await app.reset().click();
    await expect(app.clock()).toHaveText("25:00");
    await expect(app.toggle()).toHaveText("Iniciar");
  });

  test("terminar o foco toca o alarme, vibra, conta no dia e vai para a pausa curta", async ({ app }) => {
    await app.toggle().click();
    await app.jump(25 * MIN);

    await expect(app.tab("short")).toHaveAttribute("aria-pressed", "true");
    await expect(app.clock()).toHaveText("05:00");
    await expect(app.stats()).toHaveText("Hoje: 1 pomodoro · 25min de foco");
    await expect(app.page.locator("#dots i.on")).toHaveCount(1);

    expect(await app.events("alarm")).toEqual([{ name: "alarm", detail: { kind: "bell", mode: "focus" } }]);
    expect(await app.vibrations()).toHaveLength(1);
  });

  test("a cada 4 focos vem a pausa longa", async ({ app }) => {
    for (let i = 0; i < 4; i++) {
      await app.tab("focus").click();
      await app.toggle().click();
      await app.jump(25 * MIN);
    }
    await expect(app.tab("long")).toHaveAttribute("aria-pressed", "true");
    await expect(app.clock()).toHaveText("15:00");
    await expect(app.stats()).toHaveText("Hoje: 4 pomodoros · 1h 40min de foco");
  });

  test("pular o foco não conta pomodoro, mas soma o tempo focado", async ({ app }) => {
    await app.toggle().click();
    await app.wait(2 * MIN);
    await app.skip().click();

    await expect(app.tab("short")).toHaveAttribute("aria-pressed", "true");
    await expect(app.stats()).toHaveText("Hoje: 0 pomodoros · 2min de foco");
    expect(await app.events("alarm")).toHaveLength(0);
  });

  test("terminar a pausa volta para o foco", async ({ app }) => {
    await app.tab("short").click();
    await app.toggle().click();
    await app.jump(5 * MIN);
    await expect(app.tab("focus")).toHaveAttribute("aria-pressed", "true");
    await expect(app.clock()).toHaveText("25:00");
    const [alarm] = await app.events("alarm");
    expect(alarm.detail).toEqual({ kind: "bell", mode: "short" });
  });

  test("trocar de aba muda o tempo e para o timer", async ({ app }) => {
    await app.toggle().click();
    await app.wait(1_000);
    await app.tab("long").click();
    await expect(app.clock()).toHaveText("15:00");
    await expect(app.toggle()).toHaveText("Iniciar");
    await expect(app.page.locator("body")).toHaveAttribute("data-mode", "long");
  });

  test("o tempo continua certo mesmo se os timers atrasarem (aba em segundo plano)", async ({ app }) => {
    await app.toggle().click();
    // fastForward simula o navegador "congelando" a aba e acordando depois
    await app.page.clock.fastForward(7 * MIN);
    await app.wait(300);
    await expect(app.clock()).toHaveText("18:00");
  });
});

test.describe("Atalhos de teclado", () => {
  test.skip(({ isMobile }) => isMobile, "atalhos são para teclado físico");

  test("Espaço inicia/pausa, R reinicia e S pula", async ({ app, page }) => {
    await page.keyboard.press("Space");
    await app.wait(3_000);
    await expect(app.clock()).toHaveText("24:57");

    await page.keyboard.press("Space");
    await expect(app.toggle()).toHaveText("Continuar");

    await page.keyboard.press("r");
    await expect(app.clock()).toHaveText("25:00");

    await page.keyboard.press("s");
    await expect(app.tab("short")).toHaveAttribute("aria-pressed", "true");
  });

  test("atalhos não disparam enquanto digita a tarefa", async ({ app, page }) => {
    await app.task().click();
    await page.keyboard.type("Estudar redes");
    await expect(app.task()).toHaveValue("Estudar redes");
    await expect(app.toggle()).toHaveText("Iniciar");
    await expect(app.tab("focus")).toHaveAttribute("aria-pressed", "true");
  });
});
