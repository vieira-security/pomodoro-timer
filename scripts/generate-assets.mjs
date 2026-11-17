// Gera os ícones PNG e a imagem de compartilhamento (Open Graph) a partir de SVG.
// Uso: npm run assets
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";

const OUT = new URL("../public/", import.meta.url);

// Ícone: anel de progresso vermelho com uma folhinha (um "tomate" minimalista)
const icon = ({ size = 512, bg = "#1d1f24", radius = 112, safe = 1 } = {}) => {
  const s = 512, c = s / 2, r = 150 * safe, sw = 44 * safe;
  const circ = 2 * Math.PI * r;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${radius}" fill="${bg}"/>
  <circle cx="${c}" cy="${c + 14 * safe}" r="${r}" fill="none" stroke="#353843" stroke-width="${sw}"/>
  <circle cx="${c}" cy="${c + 14 * safe}" r="${r}" fill="none" stroke="#e5554f" stroke-width="${sw}"
    stroke-linecap="round" stroke-dasharray="${circ * 0.72} ${circ}" transform="rotate(-90 ${c} ${c + 14 * safe})"/>
  <path transform="translate(${c} ${c - r + 14 * safe}) scale(${safe})"
    d="M0 -6 C -26 -50 -66 -46 -82 -30 C -54 -26 -30 -16 0 -6 Z M0 -6 C 26 -50 66 -46 82 -30 C 54 -26 30 -16 0 -6 Z M-6 -6 L -2 -62 L 6 -62 L 6 -6 Z"
    fill="#3fae8c"/>
</svg>`;
};

const og = () => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1d1f24"/>
  <g transform="translate(90 135) scale(0.7)">${icon({ bg: "#262931", radius: 120 }).replace(/<\/?svg[^>]*>/g, "")}</g>
  <text x="530" y="270" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="68" font-weight="700" fill="#f1f1f1">Pomodoro Timer</text>
  <text x="532" y="340" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="32" fill="#a3a9b4">Simples, sem distrações e offline.</text>
  <text x="532" y="390" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="32" fill="#a3a9b4">Simple, distraction-free, offline.</text>
  <text x="532" y="480" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="24" fill="#e5554f">vieira-security.github.io/pomodoro-timer</text>
</svg>`;

const targets = [
  { file: "icons/icon-192.png", svg: icon(), size: 192 },
  { file: "icons/icon-512.png", svg: icon(), size: 512 },
  { file: "icons/maskable-512.png", svg: icon({ radius: 0, safe: 0.8 }), size: 512 },
  { file: "icons/apple-touch-icon.png", svg: icon({ radius: 0 }), size: 180 },
  { file: "og-image.png", svg: og(), w: 1200, h: 630 },
];

await mkdir(new URL("icons/", OUT), { recursive: true });
await writeFile(new URL("icons/icon.svg", OUT), icon());

const browser = await chromium.launch();
for (const tgt of targets) {
  const w = tgt.w || tgt.size, h = tgt.h || tgt.size;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const svg = tgt.svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`);
  await page.screenshot({ path: new URL(tgt.file, OUT).pathname, omitBackground: true });
  await page.close();
  console.log("✓", tgt.file);
}
await browser.close();
