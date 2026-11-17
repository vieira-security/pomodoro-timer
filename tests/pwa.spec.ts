import { test, expect } from "@playwright/test";

test.describe("PWA", () => {
  test("manifest é válido e os ícones existem", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const res = await request.get("/" + href);
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest).toMatchObject({ name: "Pomodoro Timer", display: "standalone", start_url: "./" });
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBeTruthy();
    for (const icon of manifest.icons) {
      expect((await request.get("/" + icon.src)).ok(), icon.src).toBeTruthy();
    }
  });

  test("tem as tags de compartilhamento (Open Graph)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Pomodoro Timer");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og-image\.png$/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  });

  test.describe("offline", () => {
    test.use({ serviceWorkers: "allow" });

    test("funciona sem internet depois da primeira visita", async ({ page, context }) => {
      await page.goto("/");
      await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        return reg.active?.state;
      });
      // espera o SW assumir a página e terminar de cachear
      await page.reload();
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

      await context.setOffline(true);
      await page.reload();
      await expect(page.getByTestId("clock")).toHaveText("25:00");
      await page.getByTestId("toggle").click();
      await expect(page.getByTestId("toggle")).toHaveText("Pausar");
    });
  });
});
