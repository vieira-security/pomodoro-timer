import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // referências da regressão visual: sem sufixo de sistema (são geradas sempre no mesmo container Linux)
  snapshotPathTemplate: "{testDir}/visual/__screenshots__/{projectName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // O service worker só é liberado no teste de PWA (ver pwa.spec.ts)
    serviceWorkers: "block",
  },
  projects: [
    // E2E funcional em 3 motores de navegador
    { name: "desktop-chromium", testIgnore: [/visual/, /smoke/, /unit/], use: { ...devices["Desktop Chrome"], locale: "pt-BR" } },
    { name: "mobile-chromium", testIgnore: [/visual/, /smoke/, /unit/], use: { ...devices["Pixel 7"], locale: "pt-BR" } },
    { name: "desktop-firefox", testIgnore: [/visual/, /smoke/, /unit/], use: { ...devices["Desktop Firefox"], locale: "pt-BR" } },
    { name: "desktop-webkit", testIgnore: [/visual/, /smoke/, /unit/], use: { ...devices["Desktop Safari"], locale: "pt-BR" } },
    { name: "mobile-webkit", testIgnore: [/visual/, /smoke/, /unit/], use: { ...devices["iPhone 15"], locale: "pt-BR" } },
    // regressão visual (rodam no container do Playwright, ver .github/workflows/ci.yml)
    { name: "visual-desktop", testMatch: /visual\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, locale: "pt-BR" } },
    { name: "visual-mobile", testMatch: /visual\/.*\.spec\.ts/, use: { ...devices["Pixel 7"], locale: "pt-BR" } },
    // monitoramento sintético do site publicado (relógio real, sem mocks)
    {
      name: "production",
      testMatch: /smoke\/.*\.spec\.ts/,
      timeout: 15 * 60_000,
      retries: 1,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.PROD_URL || "https://vieira-security.github.io/pomodoro-timer/",
        serviceWorkers: "allow",
        locale: "pt-BR",
      },
    },
  ],
  // o servidor local não é necessário quando só o monitor de produção roda
  webServer: process.env.PROD_MONITOR ? undefined : {
    command: "npx http-server public -p 4173 -c-1 --silent",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
