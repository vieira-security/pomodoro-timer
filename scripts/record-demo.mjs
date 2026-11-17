// Grava docs/demo.webm (convertido para GIF com ffmpeg). Uso: node scripts/record-demo.mjs
import { chromium } from "@playwright/test";
import { rename, mkdir } from "node:fs/promises";

const base = process.env.BASE_URL || "http://localhost:4173/";
await mkdir("docs", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 760, height: 760 },
  colorScheme: "dark",
  locale: "en-US",
  recordVideo: { dir: "docs/.video", size: { width: 760, height: 760 } },
});
const page = await context.newPage();
await page.clock.install({ time: new Date("2026-11-17T10:00:00") });
await page.goto(base);
const pause = (ms) => page.waitForTimeout(ms);
const tickSeconds = async (n, realMs = 110) => {
  for (let i = 0; i < n; i++) { await page.clock.runFor(1000); await pause(realMs); }
};

await pause(700);
await page.getByTestId("task").click();
await page.keyboard.type("Write the README", { delay: 55 });
await pause(300);
await page.getByTestId("toggle").click();
await tickSeconds(12);

// adianta até perto do fim do foco
await page.clock.fastForward(24 * 60_000 + 38_000);
await tickSeconds(10, 160);
await pause(1200); // pausa curta com o anel enchendo

await page.getByTestId("lang-pt").click();
await pause(900);
await page.getByTestId("theme-toggle").click(); // claro
await pause(1200);
await page.getByTestId("theme-toggle").click(); // escuro
await pause(500);
await page.getByTestId("lang-en").click();
await pause(400);

await page.getByTestId("toggle").click();
await tickSeconds(4);
await page.getByTestId("zen-toggle").click();
await tickSeconds(8, 140);
await page.keyboard.press("Escape");
await pause(900);

const video = page.video();
await context.close();
await browser.close();
await rename(await video.path(), "docs/demo.webm");
console.log("✓ docs/demo.webm");
