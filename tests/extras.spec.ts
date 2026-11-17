import { test, expect } from "./fixtures";

/** Simula a API de Picture-in-Picture abrindo a "janelinha" num iframe da própria página. */
const fakePip = () => {
  Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: {
    requestWindow: async () => {
      const f = document.createElement("iframe");
      f.id = "pip-frame";
      f.style.cssText = "position:fixed;bottom:0;left:0;width:240px;height:290px;border:0;z-index:99";
      document.documentElement.appendChild(f);
      return f.contentWindow;
    },
  } });
};

test.describe("Mini timer flutuante (Picture-in-Picture)", () => {
  test("abre, mostra o tempo e controla o timer principal", async ({ app, page }) => {
    await page.addInitScript(fakePip);
    await page.reload();
    await page.getByTestId("pip-toggle").click();

    const pip = page.frameLocator("#pip-frame");
    await expect(pip.getByTestId("pip-clock")).toHaveText("25:00");
    await expect(pip.getByTestId("pip-toggle")).toHaveText("Iniciar");

    await pip.getByTestId("pip-toggle").click();
    await expect(app.toggle()).toHaveText("Pausar");
    await app.wait(3_000);
    await expect(pip.getByTestId("pip-clock")).toHaveText("24:57");
    await expect(pip.getByTestId("pip-label")).toHaveText("Hora de focar");

    await app.task().fill("Revisar PR");
    await expect(pip.getByTestId("pip-label")).toHaveText("Revisar PR");
  });

  test("o botão some em navegadores sem suporte", async ({ app, page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: undefined }));
    await page.reload();
    await expect(page.getByTestId("pip-toggle")).toBeHidden();
  });
});

test.describe("Tela acesa (Wake Lock)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.__wake = [];
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          request: async (type: string) => {
            w.__wake.push("request:" + type);
            const listeners: Function[] = [];
            return {
              addEventListener: (_: string, fn: Function) => listeners.push(fn),
              release: async () => { w.__wake.push("release"); listeners.forEach((fn) => fn()); },
            };
          },
        },
      });
    });
    await page.reload();
  });

  test("pede para manter a tela acesa só no foco total com o timer rodando", async ({ app, page }) => {
    const wake = () => page.evaluate(() => (window as any).__wake);
    await page.keyboard.press("f");
    expect(await wake()).toEqual([]); // parado: não segura a tela

    await page.keyboard.press("Space");
    await expect.poll(wake).toEqual(["request:screen"]);

    await page.keyboard.press("Space"); // pausou
    await expect.poll(wake).toEqual(["request:screen", "release"]);
  });
});

test.describe("Ícone da aba com o progresso", () => {
  test("vira um anel de progresso enquanto roda e volta ao normal ao reiniciar", async ({ app, page }) => {
    const icon = page.locator('link[rel="icon"]').first();
    await expect(icon).toHaveAttribute("href", "icons/icon.svg");

    await app.toggle().click();
    await app.wait(2_000);
    await expect(icon).toHaveAttribute("href", /^data:image\/png;base64,/);
    await expect(icon).toHaveAttribute("type", "image/png");
    const first = await icon.getAttribute("href");

    await app.wait(5 * 60_000); // 20% do tempo depois o desenho muda
    expect(await icon.getAttribute("href")).not.toBe(first);

    await app.reset().click();
    await expect(icon).toHaveAttribute("href", "icons/icon.svg");
    await expect(icon).toHaveAttribute("type", "image/svg+xml");
  });
});
