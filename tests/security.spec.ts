import { test, expect } from "./fixtures";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test.describe("Segurança", () => {
  test("a página declara uma Content Security Policy restritiva", async ({ page, app }) => {
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  test("o hash da CSP corresponde ao script inline (rode `npm run csp` se falhar)", async () => {
    const html = await readFile("public/index.html", "utf8");
    const inline = html.match(/<script>([\s\S]*?)<\/script>/)![1];
    const hash = createHash("sha256").update(inline).digest("base64");
    expect(html).toContain(`'sha256-${hash}'`);
  });

  test("usar o app inteiro não gera nenhuma violação de CSP nem erro de JS", async ({ page, app }) => {
    const violations: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.exposeFunction("__cspViolation", (v: string) => violations.push(v));
    await page.evaluate(() =>
      document.addEventListener("securitypolicyviolation", (e) =>
        (window as any).__cspViolation(`${e.violatedDirective} ← ${e.blockedURI}`)
      )
    );

    await page.reload(); // o listener precisa estar ativo antes do carregamento
    await page.evaluate(() =>
      document.addEventListener("securitypolicyviolation", (e) =>
        (window as any).__cspViolation(`${e.violatedDirective} ← ${e.blockedURI}`)
      )
    );
    await page.getByTestId("theme-toggle").click();
    await page.getByTestId("lang-en").click();
    await app.task().fill("<img src=x onerror=alert(1)>");
    await app.openSettings();
    await page.getByTestId("cfg-ambient").selectOption("rain");
    await page.getByTestId("cfg-volume").fill("40");
    await page.getByTestId("test-sound").click();
    await app.toggle().click();
    await app.wait(2_000);
    await page.getByTestId("zen-toggle").click();
    await page.keyboard.press("Escape");

    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("texto digitado na tarefa é exibido como texto, nunca como HTML", async ({ page, app }) => {
    const payload = "<img src=x onerror=\"document.body.dataset.pwned='1'\">";
    await app.task().fill(payload);
    await app.toggle().click();
    await app.wait(1_000);
    await page.getByTestId("zen-toggle").click();
    await expect(app.label()).toHaveText(payload);
    await expect(page.locator("#label img")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveAttribute("data-pwned");
    expect(await page.title()).toContain(payload);
  });

  test("bloqueia script injetado de outra origem", async ({ page, app }) => {
    const blocked = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          document.addEventListener("securitypolicyviolation", (e) => resolve(e.violatedDirective), { once: true });
          const s = document.createElement("script");
          s.src = "https://example.com/evil.js";
          document.head.appendChild(s);
        })
    );
    expect(blocked).toMatch(/script-src/);
  });
});
