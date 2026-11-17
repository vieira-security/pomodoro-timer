# 🍅 Pomodoro Timer

[![CI](https://github.com/vieira-security/pomodoro-timer/actions/workflows/ci.yml/badge.svg)](https://github.com/vieira-security/pomodoro-timer/actions/workflows/ci.yml)
[![Production monitor](https://github.com/vieira-security/pomodoro-timer/actions/workflows/monitor.yml/badge.svg)](https://github.com/vieira-security/pomodoro-timer/actions/workflows/monitor.yml)
[![OWASP ZAP](https://github.com/vieira-security/pomodoro-timer/actions/workflows/zap.yml/badge.svg)](https://github.com/vieira-security/pomodoro-timer/actions/workflows/zap.yml)
[![CodeQL](https://github.com/vieira-security/pomodoro-timer/actions/workflows/codeql.yml/badge.svg)](https://github.com/vieira-security/pomodoro-timer/actions/workflows/codeql.yml)
![Playwright](https://img.shields.io/badge/E2E-Chromium%20·%20Firefox%20·%20WebKit-2EAD33?logo=playwright&logoColor=white)
![Mutation score](https://img.shields.io/badge/mutation%20score-98.6%25-brightgreen?logo=stryker&logoColor=white)
![Lighthouse](https://img.shields.io/badge/Lighthouse-100%20·%20100%20·%20100%20·%20100-brightgreen?logo=lighthouse&logoColor=white)
![WCAG 2.2 AA](https://img.shields.io/badge/WCAG-2.2%20AA-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

A minimal, distraction-free Pomodoro timer. Installable (PWA), works offline, no frameworks, no build step, no tracking — and tested like production software.

**▶ Live: [vieira-security.github.io/pomodoro-timer](https://vieira-security.github.io/pomodoro-timer/)**

<p align="center">
  <img src="docs/demo.gif" alt="Demo: starting a focus session, the ring animating, switching to a short break, toggling language and theme, and zen mode" width="520">
</p>

## Features

| | |
|---|---|
| ⏱️ **Accurate timer** | Timestamp-based (not tick counting), so it stays correct in background tabs. The ring animates at 60 fps. |
| 🪟 **Floating mini timer** | Document Picture-in-Picture window that stays on top of other apps (Chromium). |
| 🧘 **Zen mode** | Fullscreen, time only. Keeps the screen awake while running (Screen Wake Lock). |
| 🔖 **Tab icon progress** | The favicon becomes a live progress ring. |
| 📊 **History** | 7-day chart, 7/30-day totals, day streak, CSV export. Everything stays in your browser. |
| ⚡ **Presets** | 25/5, 50/10, 90/20 with one click, or custom durations. |
| 🔄 **Multi-tab sync** | Open it in several tabs: they stay in sync (BroadcastChannel). The alarm and stats run exactly once (Web Locks). |
| 🔔 **Alarms** | Three synthesized sounds with volume, notifications, and vibration on mobile. |
| 🌧️ **Ambient sound** | Real rain recording (lazy-loaded, seamless loop) or generated white/brown noise. |
| 📲 **PWA** | Installable, offline-first (service worker), maskable icons, share preview. |
| 🌗 🌐 ⌨️ | Light/dark/auto theme · Portuguese and English · keyboard shortcuts (`Space` `R` `S` `F`). |

## Quality strategy

```
                    ┌──────────────────────────────┐
  every push / PR → │ Unit + mutation              │──┐
                    │ (Vitest, Stryker ≥ 95%)      │  │
                    ├──────────────────────────────┤  │
                    │ E2E × 3 engines, in parallel │──┤
                    │ Chromium · Firefox · WebKit  │  │  all green?
                    ├──────────────────────────────┤  ├────────────→ Deploy to GitHub Pages
                    │ Visual regression (container)│──┤                      │
                    ├──────────────────────────────┤  │                      ▼
                    │ Lighthouse CI (100 gate)     │──┘        ┌──────────────────────────┐
                    └──────────────────────────────┘           │ Production monitor       │ ← also daily
  + CodeQL (code & workflows) · Dependabot                      │ OWASP ZAP baseline scan  │ ← also weekly
                                                                └──────────────────────────┘
```

| Layer | Tool | What it proves |
|---|---|---|
| **Unit** | Vitest — 101 tests, 100% line coverage of the core logic | Durations, cycles, streaks, history, CSV and tab-sync validation are correct, including edge cases (month/year/leap-year boundaries, corrupted storage). |
| **Mutation** | Stryker — **98.6% mutation score**, build breaks below 95% | The unit tests actually catch bugs, not just execute lines. The remaining survivors are equivalent mutants. |
| **E2E** | Playwright — 85 scenarios × 5 browser profiles = **425 runs** | Real user flows in Chromium, Firefox and WebKit, desktop and mobile (Pixel 7, iPhone 15). |
| **Accessibility** | axe-core — WCAG 2.2 AA in 8 UI states × 2 themes | No violations in any state, plus keyboard order and visible focus. A control test proves the auditor can fail. |
| **Visual** | `toHaveScreenshot()` — 22 baselines | Unintended CSS changes fail the build. Baselines are generated in the official Playwright container, so fonts match CI. |
| **Performance & SEO** | Lighthouse CI | 100 in all four categories, enforced. |
| **Production** | Synthetic monitor (daily + after every deploy) | The *live* site loads, the timer runs, every asset has the right content type, HTTPS/HSTS/CSP are active, and the deployed version matches `main`. Opens a GitHub issue on failure and closes it on recovery. |
| **Security** | OWASP ZAP, CodeQL, CSP tests | See [Security](#security). |

### Testing techniques worth a look

- **Fake clock** (`page.clock`): a 25-minute session runs in milliseconds; `fastForward()` simulates a throttled background tab to prove the timer is timestamp-based.
- **Multi-tab tests**: two pages in one browser context verify sync, that a late tab picks up the running state, and that the alarm fires **once** across tabs.
- **Browser API test doubles**: Picture-in-Picture, Wake Lock and vibration are replaced by spies, so behavior is asserted without real hardware.
- **Page Object + fixtures** (`tests/fixtures.ts`), `data-testid` selectors, and app events (`pomodoro:*`) to assert side effects like alarms without listening to audio.

### 🐛 Real bugs the suite caught

| Found by | Bug |
|---|---|
| Boundary-value test | Typing `0` as a duration fell back to 25 instead of clamping to 1 (`parseInt("0") \|\| 25`). |
| Security test on mobile | After scrolling, the top bar sat *behind* the timer ring and couldn't be tapped. |
| PiP "unsupported" test | `display: grid` overrode the `hidden` attribute, so the mini-timer button showed in browsers without support. |
| **Firefox** run | Requesting notification permission exits fullscreen, so starting the timer in zen mode kicked the user out. |
| **WebKit** run | Replacing a button's text during a click cancels the click in Safari; the mini timer rewrote it every frame. Text is now only written when it changes. |
| Mutation testing | Weak unit tests and redundant branches (fixed / removed). |

## Security

Static site: no backend, accounts, cookies, analytics or third-party requests. Data never leaves `localStorage`. Still hardened as if it mattered:

| Layer | Measure |
|---|---|
| Browser | Strict CSP via `<meta>` (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`); the one inline script is allowed by **SHA-256 hash** (`npm run csp`). No `unsafe-inline`/`unsafe-eval`. |
| Code | User input is only rendered with `textContent`; cross-tab messages are schema-validated before use. |
| Clickjacking | GitHub Pages can't send `X-Frame-Options`/`frame-ancestors`, so the app detects being framed by another site, hides the UI and shows only a link to open it in its own tab. |
| Supply chain | Zero runtime dependencies. Actions **pinned to commit SHAs**, least-privilege `permissions`, `persist-credentials: false`, Dependabot weekly. |
| SAST | **CodeQL** (`security-extended`) on JS/TS *and* on the workflow files. |
| DAST | **OWASP ZAP** baseline scan of the live site (weekly + after deploy). Accepted findings are triaged with a written justification in [`.zap/rules.tsv`](.zap/rules.tsv); any new finding fails the scan. |
| Tests | `security.spec.ts`: no CSP violations during full usage, inert XSS payload, cross-origin script blocked, framing mitigation. |

Known platform limitation: GitHub Pages doesn't allow custom response headers (X-Frame-Options, X-Content-Type-Options, Permissions-Policy, COOP/COEP). Each one is documented in `.zap/rules.tsv`. Report vulnerabilities via [SECURITY.md](SECURITY.md).

## Run locally

```bash
npm install
npx playwright install          # browsers
npm start                       # http://localhost:4173

npm test                        # E2E on all 5 browser profiles
npm run test:unit               # Vitest + coverage
npm run test:mutation           # Stryker
npm run test:visual             # visual regression (only meaningful inside the Playwright container)
PROD_MONITOR=1 npx playwright test --project=production   # smoke tests against the live site
```

Intentional visual change? Run **Actions → Update visual baselines**: it regenerates and commits the screenshots in the same container that CI uses.

## Project structure

```
public/                       ← deployed as-is (no build step)
├── index.html  styles.css  sw.js  manifest.webmanifest
├── js/
│   ├── core.js               ← pure logic (unit + mutation tested)
│   ├── i18n.js               ← PT/EN strings
│   ├── audio.js              ← alarms + ambient sound (Web Audio)
│   ├── extras.js             ← favicon progress, Wake Lock, Picture-in-Picture
│   └── main.js               ← UI wiring, tab sync, storage
├── sounds/rain.mp3  icons/  og-image.png
tests/
├── *.spec.ts                 ← E2E (timer, settings, history, sync, a11y, security, PWA...)
├── unit/                     ← Vitest
├── visual/                   ← screenshot tests + baselines
└── smoke/                    ← production monitor
.github/workflows/            ← ci, monitor, zap, codeql, visual-baselines
.zap/rules.tsv                ← triaged ZAP findings
```

## License

Code: [MIT](LICENSE) © Gabriel Vieira de Sousa

Rain recording ("Relaxing Rain") by Dragon Studio, from [Pixabay](https://pixabay.com/), used under the [Pixabay Content License](https://pixabay.com/service/license-summary/). Trimmed, crossfaded into a loop and loudness-normalized.
