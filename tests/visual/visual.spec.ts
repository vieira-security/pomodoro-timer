import { test, expect } from "../fixtures";

// Regressão visual: compara a tela com imagens de referência aprovadas.
// As referências são geradas no container oficial do Playwright (mesmas fontes do CI):
//   GitHub → Actions → "Update visual baselines" → Run workflow
// Rodar localmente: npm run test:visual (só compara de verdade dentro do container)

const HISTORY = {
  "2026-11-11": { count: 2, seconds: 3000 },
  "2026-11-12": { count: 6, seconds: 9000 },
  "2026-11-14": { count: 4, seconds: 6000 },
  "2026-11-15": { count: 3, seconds: 4500 },
  "2026-11-16": { count: 8, seconds: 12000 },
  "2026-11-17": { count: 3, seconds: 4500 },
};

const shot = { fullPage: true, animations: "disabled" as const, caret: "hide" as const, maxDiffPixelRatio: 0.002 };

for (const theme of ["dark", "light"] as const) {
  test.describe(`tema ${theme}`, () => {
    test.use({ colorScheme: theme });

    test("tela inicial", async ({ app, page }) => {
      await expect(page).toHaveScreenshot(`${theme}-inicial.png`, shot);
    });

    test("timer rodando com tarefa", async ({ app, page }) => {
      await app.task().fill("Escrever o TCC");
      await app.toggle().click();
      await app.wait(5 * 60_000);
      await page.locator("body").click({ position: { x: 5, y: 5 } }); // tira o foco do botão
      await expect(page).toHaveScreenshot(`${theme}-rodando.png`, shot);
    });

    test("pausa curta", async ({ app, page }) => {
      await app.tab("short").click();
      await expect(page).toHaveScreenshot(`${theme}-pausa-curta.png`, shot);
    });

    test("histórico e configurações abertos", async ({ app, page }) => {
      await page.evaluate((h) => localStorage.setItem("pomodoro-history", JSON.stringify(h)), HISTORY);
      await page.reload();
      await page.locator("#history-panel summary").click();
      await app.openSettings();
      await expect(page).toHaveScreenshot(`${theme}-paineis.png`, shot);
    });

    test("modo foco total", async ({ app, page }) => {
      await app.task().fill("Ler artigo");
      await app.toggle().click();
      await app.wait(60_000);
      await page.getByTestId("zen-toggle").click();
      await expect(page).toHaveScreenshot(`${theme}-foco-total.png`, { ...shot, fullPage: false });
    });
  });
}

test("em inglês", async ({ app, page }) => {
  await page.getByTestId("lang-en").click();
  await app.openSettings();
  await expect(page).toHaveScreenshot("en-configuracoes.png", shot);
});
