import AxeBuilder from "@axe-core/playwright";
import { test, expect, AppPage } from "./fixtures";
import type { Page } from "@playwright/test";

// WCAG 2.1 níveis A e AA + boas práticas do axe
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  // mensagem legível no relatório quando falhar
  return violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const HISTORY = {
  "2026-11-12": { count: 6, seconds: 9000 },
  "2026-11-16": { count: 8, seconds: 12000 },
  "2026-11-17": { count: 2, seconds: 3000 },
};

const STATES: Record<string, (app: AppPage, page: Page) => Promise<void>> = {
  "tela inicial": async () => {},
  "timer rodando": async (app) => { await app.toggle().click(); await app.wait(2_000); },
  "pausa curta": async (app) => { await app.tab("short").click(); },
  "pausa longa": async (app) => { await app.tab("long").click(); },
  "configurações abertas": async (app) => { await app.openSettings(); },
  "histórico com dados": async (_, page) => {
    await page.evaluate((h) => localStorage.setItem("pomodoro-history", JSON.stringify(h)), HISTORY);
    await page.reload();
    await page.locator("#history-panel summary").click();
  },
  "em inglês": async (_, page) => { await page.getByTestId("lang-en").click(); },
  "modo foco total": async (app, page) => { await app.task().fill("Estudar"); await page.getByTestId("zen-toggle").click(); },
};

for (const theme of ["dark", "light"] as const) {
  test.describe(`Acessibilidade (tema ${theme === "dark" ? "escuro" : "claro"})`, () => {
    test.use({ colorScheme: theme });

    for (const [name, setup] of Object.entries(STATES)) {
      test(`sem violações WCAG: ${name}`, async ({ app, page }) => {
        await setup(app, page);
        await page.waitForTimeout(700); // deixa as transições de cor terminarem
        expect(await audit(page)).toEqual([]);
      });
    }
  });
}

test.describe("Navegação por teclado", () => {
  test.skip(({ isMobile }) => isMobile, "teclado físico");

  test("todos os controles principais são alcançáveis com Tab, na ordem visual", async ({ app, page, browserName }) => {
    test.skip(browserName === "webkit", "Safari só tabula por links/campos sem a opção 'Tab highlights each item'");
    const order: string[] = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      order.push(await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return el.dataset.testid || el.id || el.tagName;
      }));
    }
    const visible = order.filter((x) => x !== "pip-toggle"); // o mini timer só existe no Chrome
    expect(visible.slice(0, 8)).toEqual([
      "zen-toggle", "theme-toggle", "lang-pt", "lang-en", "tab-focus", "tab-short", "tab-long", "task",
    ]);
  });

  test("o foco do teclado fica visível", async ({ app, page, browserName }) => {
    test.skip(browserName === "webkit", "Safari não tabula botões por padrão");
    await app.task().focus();
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).not.toBe("none");
  });
});

test("controle: o auditor realmente detecta problemas (o teste sabe falhar)", async ({ app, page }) => {
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.textContent = "texto quase invisível";
    p.style.color = "#8a8a8a";
    p.style.background = "#999999";
    document.querySelector("main")!.appendChild(p);
    const b = document.createElement("button"); // botão sem nome acessível
    document.querySelector("main")!.appendChild(b);
  });
  const ids = (await audit(page)).map((v) => v.split(" ")[0]);
  expect(ids).toEqual(expect.arrayContaining(["color-contrast", "button-name"]));
});
