import { test as base, expect, Page } from "@playwright/test";

/** Evento disparado pelo app (pomodoro:start, pomodoro:finish, pomodoro:alarm...). */
export type AppEvent = { name: string; detail: Record<string, unknown> };

/**
 * Fixture `app`:
 *  - instala o relógio falso do Playwright ANTES de carregar a página,
 *    para conseguirmos "avançar" 25 minutos em milissegundos;
 *  - registra os eventos customizados do app em window.__events;
 *  - troca navigator.vibrate por um espião.
 */
export const test = base.extend<{ app: AppPage }>({
  app: async ({ page }, use) => {
    await page.clock.install({ time: new Date("2026-11-17T10:00:00") });
    await page.addInitScript(() => {
      const w = window as any;
      w.__events = [];
      w.__vibrations = [];
      for (const n of ["start", "pause", "finish", "alarm", "ambient"]) {
        document.addEventListener("pomodoro:" + n, (e: any) => w.__events.push({ name: n, detail: e.detail }));
      }
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: (p: unknown) => { w.__vibrations.push(p); return true; },
      });
    });
    const app = new AppPage(page);
    await app.goto();
    await use(app);
  },
});

/** Page Object do timer. */
export class AppPage {
  constructor(readonly page: Page) {}

  clock = () => this.page.getByTestId("clock");
  label = () => this.page.getByTestId("label");
  toggle = () => this.page.getByTestId("toggle");
  reset = () => this.page.getByTestId("reset");
  skip = () => this.page.getByTestId("skip");
  stats = () => this.page.getByTestId("stats");
  task = () => this.page.getByTestId("task");
  tab = (mode: "focus" | "short" | "long") => this.page.getByTestId(`tab-${mode}`);

  async goto() {
    await this.page.goto("/");
    await expect(this.clock()).toBeVisible();
  }

  /** Avança o relógio de forma "realista", disparando timers e frames no caminho. */
  async wait(ms: number) {
    await this.page.clock.runFor(ms);
  }

  /** Pula direto para o fim de um ciclo (sem simular cada frame). */
  async jump(ms: number) {
    await this.page.clock.fastForward(ms);
    await this.page.clock.runFor(300);
  }

  async openSettings() {
    const details = this.page.locator("details.panel");
    if (!(await details.evaluate((d: HTMLDetailsElement) => d.open))) await details.locator("summary").click();
  }

  async setNumber(testId: string, value: number | string) {
    await this.openSettings();
    const input = this.page.getByTestId(testId);
    await input.fill(String(value));
    await input.press("Tab");
  }

  events = (name?: string) =>
    this.page.evaluate((n) => (window as any).__events.filter((e: AppEvent) => !n || e.name === n), name) as Promise<AppEvent[]>;

  vibrations = () => this.page.evaluate(() => (window as any).__vibrations) as Promise<unknown[]>;
}

export { expect };
