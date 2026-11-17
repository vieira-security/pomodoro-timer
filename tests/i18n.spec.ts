import { test, expect } from "./fixtures";

test.describe("Idioma", () => {
  test("troca para inglês e lembra a escolha", async ({ app, page }) => {
    await page.getByTestId("lang-en").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(app.toggle()).toHaveText("Start");
    await expect(app.tab("short")).toHaveText("Short break");
    await expect(app.label()).toHaveText("Time to focus");
    await expect(app.task()).toHaveAttribute("placeholder", "What are you focusing on?");

    await page.reload();
    await expect(app.toggle()).toHaveText("Start");
  });

  test("textos dinâmicos também são traduzidos", async ({ app, page }) => {
    await page.getByTestId("lang-en").click();
    await app.toggle().click();
    await app.wait(1_000);
    await expect(app.toggle()).toHaveText("Pause");
    await expect(page).toHaveTitle("24:59 · Focus");
    await expect(app.stats()).toHaveText("Today: 0 pomodoros · 0min focused");
  });
});

test.describe("Idioma do navegador", () => {
  test.use({ locale: "en-US" });
  test("abre em inglês para quem usa o navegador em inglês", async ({ app }) => {
    await expect(app.toggle()).toHaveText("Start");
  });
});
