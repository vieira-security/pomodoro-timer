# 🍅 Pomodoro Timer

[![CI](https://github.com/vieira-security/pomodoro-timer/actions/workflows/ci.yml/badge.svg)](https://github.com/vieira-security/pomodoro-timer/actions/workflows/ci.yml)
![Playwright](https://img.shields.io/badge/tested%20with-Playwright-2EAD33?logo=playwright&logoColor=white)
![Lighthouse Performance](https://img.shields.io/badge/performance-100-brightgreen?logo=lighthouse&logoColor=white)
![Lighthouse Accessibility](https://img.shields.io/badge/accessibility-100-brightgreen?logo=lighthouse&logoColor=white)
![Lighthouse Best Practices](https://img.shields.io/badge/best%20practices-100-brightgreen?logo=lighthouse&logoColor=white)
![Lighthouse SEO](https://img.shields.io/badge/SEO-100-brightgreen?logo=lighthouse&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

A minimal, distraction-free Pomodoro timer. Installable as an app (PWA), works offline, and has no frameworks, no build step, and no tracking.

**▶ Live demo: [vieira-security.github.io/pomodoro-timer](https://vieira-security.github.io/pomodoro-timer/)**

<p align="center">
  <img src="docs/demo.gif" alt="Demo: starting a focus session, the ring animating, switching to a short break, toggling language and theme, and zen mode" width="520">
</p>

## Features

| | |
|---|---|
| ⏱️ **Accurate timer** | Based on timestamps, not tick counting, so it stays correct when the tab sits in the background. The progress ring animates smoothly at 60 fps with `requestAnimationFrame`. |
| 📲 **Installable & offline** | PWA with a web manifest, maskable icons, and a service worker that uses a stale-while-revalidate cache. |
| 🧘 **Zen mode** | Fullscreen view that shows only the time. Press `F` to enter and `Esc` to leave. |
| 🔔 **Alarms** | Three synthesized alarm sounds (bell, digital, soft), each with a different melody for "focus ended" and "break ended". Includes a volume slider, a test button, system notifications, and vibration on mobile. |
| 🌧️ **Ambient sound** | Optional white noise, brown noise, or rain while you focus. Generated with the Web Audio API, so no audio files are downloaded. |
| 📊 **Daily stats** | "Today: 4 pomodoros · 1h 40min focused". Resets automatically at midnight. |
| ✍️ **Current task** | Type what you're working on. It shows in the tab title and in zen mode. |
| 🌗 **Themes** | Auto (follows the OS), light, or dark. Applied before the first paint, so the screen doesn't flash. |
| 🌐 **i18n** | Portuguese 🇧🇷 and English 🇺🇸. Detects the browser language on the first visit. |
| ⌨️ **Keyboard shortcuts** | `Space` start/pause · `R` reset · `S` skip · `F` zen mode |
| ♿ **Accessible** | Semantic HTML, labelled controls, visible focus, WCAG AA contrast, and support for `prefers-reduced-motion`. |

## Tech stack

- **App:** vanilla HTML, CSS, and JavaScript. No dependencies, about 40 KB of code.
- **Tests:** [Playwright](https://playwright.dev/) + TypeScript
- **Quality gate:** [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- **CI/CD:** GitHub Actions → GitHub Pages

## Testing

The E2E suite has **34 scenarios**, and each one runs on **desktop and mobile** (Pixel 7) Chromium.

```bash
npm install
npx playwright install chromium
npm test            # run everything
npm run test:ui     # Playwright UI mode
npm run report      # open the last HTML report
```

### What's covered

| Spec | Covers |
|---|---|
| `timer.spec.ts` | countdown, pause/resume, reset, focus → short break → long break cycle, skip, background-tab accuracy, keyboard shortcuts |
| `settings.spec.ts` | durations (incl. boundary values), auto-start, alarm choice/volume persistence, alarm & vibration off, ambient sound only during focus |
| `features.spec.ts` | current task in tab title, daily stats reset at midnight, theme cycle & persistence, zen mode |
| `i18n.spec.ts` | language toggle, persistence, dynamic strings, browser-locale detection |
| `pwa.spec.ts` | manifest validity, icon availability, Open Graph tags, **works offline** after first visit |

### How it's tested

- **Fake clock (`page.clock`):** a full 25-minute session runs in milliseconds. `runFor()` simulates real ticking. `fastForward()` simulates a throttled background tab waking up, which checks that the timer relies on timestamps and not on counting ticks.
- **Page Object + custom fixture** (`tests/fixtures.ts`): the fixture installs the clock before the page loads, spies on `navigator.vibrate`, and records the app's `pomodoro:*` custom events. Tests check *that the alarm fired and which sound* without trying to listen to audio.
- **Stable selectors:** every test uses `data-testid`, so changing the copy or the styles doesn't break tests.
- **Real offline check:** service workers are blocked by default and allowed only in the PWA spec. That spec uses `context.setOffline(true)` and reloads the page.

> 🐛 The suite already caught a real bug. Typing `0` as the focus duration fell back to the default (25) instead of clamping to the minimum (1), because `parseInt("0") || 25` treats `0` as falsy. A boundary-value test exposed it.

## CI/CD

Every push and every pull request runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

```
┌──────────────┐   ┌──────────────────┐
│  E2E tests   │   │  Lighthouse CI   │   ← run in parallel
│ (Playwright) │   │ perf ≥ 95, a11y, │
│              │   │ BP, SEO = 100    │
└──────┬───────┘   └────────┬─────────┘
       └─────────┬──────────┘
                 ▼
        Deploy to GitHub Pages     ← main branch only, only if both pass
```

The HTML Playwright report (with traces from failed tests) and the Lighthouse reports are uploaded as build artifacts.

## Run locally

```bash
npm install
npm start          # http://localhost:4173
```

Or open `public/index.html` directly in a browser. The service worker only runs over `http(s)://`.

## Project structure

```
public/                  ← everything that gets deployed
├── index.html
├── styles.css
├── app.js               ← timer, audio engine, i18n, settings
├── sw.js                ← offline cache
├── manifest.webmanifest
├── og-image.png         ← link preview (1200×630)
└── icons/
tests/                   ← Playwright specs + fixtures/page object
scripts/
├── generate-assets.mjs  ← renders icons & OG image from SVG
└── record-demo.mjs      ← records docs/demo.gif
.github/workflows/ci.yml
lighthouserc.json
playwright.config.ts
```

## License

[MIT](LICENSE) © Gabriel Vieira de Sousa
