# Security Policy

## Supported versions

Only the version currently deployed at
[vieira-security.github.io/pomodoro-timer](https://vieira-security.github.io/pomodoro-timer/)
(the `main` branch) receives fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through
[GitHub Security Advisories](https://github.com/vieira-security/pomodoro-timer/security/advisories/new).

Include the steps to reproduce, the impact, and the browser/OS you used.
You should get a reply within 7 days.

## Security model

This is a static site with no backend, accounts, cookies, analytics, or third-party requests.
Settings, the current task, and daily stats are stored only in the browser's `localStorage`
and never leave the device.

Hardening in place:

- **Content Security Policy** (`<meta>`): only same-origin scripts, styles, and media;
  the single inline script is allowed by its SHA-256 hash. No `unsafe-inline` or `unsafe-eval`.
- **No HTML injection sinks for user input**: user text is rendered with `textContent` only.
- **Supply chain**: the deployed site has zero runtime dependencies. GitHub Actions are pinned
  to full commit SHAs, workflows run with least-privilege `permissions`, and Dependabot keeps
  actions and dev dependencies up to date.
- **Static analysis**: CodeQL scans the JavaScript/TypeScript code and the workflows on every
  push, on every pull request, and weekly.
- **Automated tests**: Playwright checks the CSP, asserts that no CSP violations happen during
  normal use, and verifies that an XSS payload typed by the user stays inert.

Known limitation: GitHub Pages does not allow custom HTTP headers, so `frame-ancestors`
(clickjacking protection) and HSTS preload cannot be configured. The impact for a timer
with no account or sensitive actions is negligible.
