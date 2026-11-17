import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
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
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], locale: "pt-BR" } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], locale: "pt-BR" } },
  ],
  webServer: {
    command: "npx http-server public -p 4173 -c-1 --silent",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
