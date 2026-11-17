import { test, expect } from "./fixtures";

test.describe("Sons", () => {
  test("a gravação de chuva só é baixada quando escolhida e iniciada", async ({ app, page }) => {
    const requests: string[] = [];
    page.on("request", (r) => r.url().endsWith("/sounds/rain.mp3") && requests.push(r.url()));

    await app.toggle().click();
    await app.toggle().click();
    expect(requests).toHaveLength(0);

    await app.openSettings();
    await page.getByTestId("cfg-ambient").selectOption("rain");
    const response = page.waitForResponse((r) => r.url().endsWith("/sounds/rain.mp3"));
    await app.toggle().click();
    expect((await response).status()).toBe(200);
  });

  test("a gravação de chuva decodifica e tem um loop longo", async ({ page, app }) => {
    const info = await page.evaluate(async () => {
      const ctx = new OfflineAudioContext(2, 44100, 44100);
      const buf = await ctx.decodeAudioData(await (await fetch("sounds/rain.mp3")).arrayBuffer());
      return { duration: buf.duration, channels: buf.numberOfChannels };
    });
    expect(info.duration).toBeGreaterThan(120);
    expect(info.channels).toBe(2);
  });

  for (const kind of ["white", "brown"] as const) {
    test(`ruído ${kind}: o fim do loop encaixa no começo (sem clique)`, async ({ page, app }) => {
      const r = await page.evaluate((k) => {
        const d: Float32Array = (window as any).PomodoroNoise.generate(k, 8000);
        let avg = 0;
        for (let i = 1; i < d.length; i++) avg += Math.abs(d[i] - d[i - 1]);
        avg /= d.length - 1;
        return { seam: Math.abs(d[0] - d[d.length - 1]), avg, seconds: d.length / 8000 };
      }, kind);
      expect(r.seconds).toBe(10);
      // o salto na emenda não pode ser maior que um salto "normal" entre amostras
      expect(r.seam).toBeLessThanOrEqual(r.avg * 4);
    });
  }

  test("a barra de volume mostra a porcentagem e o preenchimento", async ({ app, page }) => {
    await app.openSettings();
    const slider = page.getByTestId("cfg-volume");
    await slider.fill("35");
    await expect(page.locator("#cfg-volume-out")).toHaveText("35%");
    await expect(slider).toHaveCSS("--fill", "35%");
  });
});
