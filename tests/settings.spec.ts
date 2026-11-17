import { test, expect } from "./fixtures";

test.describe("Configurações", () => {
  test("alterar a duração do foco atualiza o timer e fica salvo", async ({ app, page }) => {
    await app.setNumber("cfg-focus", 50);
    await expect(app.clock()).toHaveText("50:00");

    await page.reload();
    await expect(app.clock()).toHaveText("50:00");
    await app.openSettings();
    await expect(page.getByTestId("cfg-focus")).toHaveValue("50");
  });

  test("valores fora do limite são corrigidos", async ({ app, page }) => {
    await app.setNumber("cfg-focus", 0);
    await expect(page.getByTestId("cfg-focus")).toHaveValue("1");
    await app.setNumber("cfg-focus", 999);
    await expect(page.getByTestId("cfg-focus")).toHaveValue("120");
    await expect(app.clock()).toHaveText("120:00");
  });

  test("intervalo da pausa longa muda a quantidade de bolinhas", async ({ app, page }) => {
    await app.setNumber("cfg-interval", 6);
    await expect(page.locator("#dots i")).toHaveCount(6);
  });

  test("iniciar automaticamente emenda a próxima etapa", async ({ app, page }) => {
    await app.setNumber("cfg-focus", 1);
    await page.getByTestId("cfg-auto").check();
    await app.toggle().click();
    await app.jump(60_000);
    await app.wait(1_000);
    await expect(app.tab("short")).toHaveAttribute("aria-pressed", "true");
    await expect(app.toggle()).toHaveText("Pausar");
  });

  test("escolher o som e testar dispara o alarme escolhido", async ({ app, page }) => {
    await app.openSettings();
    await page.getByTestId("cfg-sound").selectOption("digital");
    await page.getByTestId("test-sound").click();
    const alarms = await app.events("alarm");
    expect(alarms.at(-1)!.detail.kind).toBe("digital");

    await page.reload();
    await app.openSettings();
    await expect(page.getByTestId("cfg-sound")).toHaveValue("digital");
  });

  test("alarme desligado não toca ao terminar", async ({ app, page }) => {
    await app.setNumber("cfg-focus", 1);
    await page.getByTestId("cfg-sound").selectOption("off");
    await app.toggle().click();
    await app.jump(60_000);
    expect(await app.events("alarm")).toHaveLength(0);
    expect(await app.events("finish")).toHaveLength(1);
  });

  test("vibração desligada não vibra", async ({ app, page }) => {
    await app.setNumber("cfg-focus", 1);
    await page.getByTestId("cfg-vibrate").uncheck();
    await app.toggle().click();
    await app.jump(60_000);
    expect(await app.vibrations()).toHaveLength(0);
  });

  test("volume fica salvo", async ({ app, page }) => {
    await app.openSettings();
    await page.getByTestId("cfg-volume").fill("30");
    await page.reload();
    await app.openSettings();
    await expect(page.getByTestId("cfg-volume")).toHaveValue("30");
  });

  test("som ambiente toca só durante o foco", async ({ app, page }) => {
    await app.openSettings();
    await page.getByTestId("cfg-ambient").selectOption("rain");
    await app.toggle().click();
    await app.toggle().click();
    await app.tab("short").click();
    await app.toggle().click();

    const ambient = (await app.events("ambient")).map((e) => e.detail.playing);
    expect(ambient).toEqual([true, false]);
  });
});
