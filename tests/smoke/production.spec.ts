import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Monitoramento sintético: roda contra o site PUBLICADO (relógio real, sem mocks).
// Agendado todo dia e depois de cada deploy — ver .github/workflows/monitor.yml
// Local: PROD_MONITOR=1 npx playwright test --project=production

test.describe("Produção", () => {
  test("a página abre sem erros e o timer funciona", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (e) => console.error("CSP: " + e.violatedDirective))
    );

    const res = await page.goto("./");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle("Pomodoro Timer");
    await expect(page.getByTestId("clock")).toHaveText(/^\d{2}:00$/);

    await page.getByTestId("toggle").click();
    await expect(page.getByTestId("clock")).not.toHaveText(/^\d{2}:00$/, { timeout: 4_000 });
    await page.getByTestId("toggle").click();
    await expect(page.getByTestId("toggle")).toHaveText(/Continuar|Resume/);
    expect(errors).toEqual([]);
  });

  test("todos os arquivos essenciais respondem", async ({ request }) => {
    const files: [string, RegExp][] = [
      ["index.html", /text\/html/],
      ["styles.css", /text\/css/],
      ["js/main.js", /javascript/],
      ["js/core.js", /javascript/],
      ["sw.js", /javascript/],
      ["manifest.webmanifest", /manifest\+json|json/],
      ["icons/icon-192.png", /image\/png/],
      ["icons/icon-512.png", /image\/png/],
      ["og-image.png", /image\/png/],
      ["sounds/rain.mp3", /audio\/mpeg/],
    ];
    for (const [path, type] of files) {
      const r = await request.get(path);
      expect.soft(r.status(), path).toBe(200);
      expect.soft(r.headers()["content-type"], path).toMatch(type);
    }
  });

  test("HTTPS, HSTS e CSP estão ativos", async ({ page, request, baseURL }) => {
    expect(baseURL).toMatch(/^https:\/\//);
    const r = await request.get("./");
    expect(r.headers()["strict-transport-security"]).toMatch(/max-age=\d+/);
    await page.goto("./");
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute("content", /default-src 'self'/);
  });

  test("o service worker registra (app instalável e offline)", async ({ page }) => {
    await page.goto("./");
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), { timeout: 15_000 }).toBe(true);
  });

  test("a versão publicada é a mesma do repositório", async ({ request }) => {
    // compara o service worker publicado com o do commit atual (o CDN pode levar alguns minutos)
    const local = await readFile("public/sw.js", "utf8");
    const version = local.match(/const VERSION = "([^"]+)"/)![1];
    await expect
      .poll(async () => {
        const r = await request.get(`sw.js?nocache=${Date.now()}`);
        return (await r.text()).match(/const VERSION = "([^"]+)"/)?.[1];
      }, { timeout: 12 * 60_000, intervals: [15_000] })
      .toBe(version);
  });
});
