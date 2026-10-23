# AGENTS.md

Guidelines for AI agents working in `mobile-automation-lab`.

## Build / run

- `npm i` — install devDependencies only (no appium in package.json; Appium is global).
- `npx wdio run wdio.conf.ts` — run tests; set `APP_FILE` env to target an APK.
- `npm run doctor` — pre-flight env check.
- `npm run android:devices` — confirm USB device.

## Constraints

- Real-device-first. Do **not** install emulator images, Android Studio, or extra SDK platforms.
- Use `uiautomator2` driver (v4.x compatible with Appium 2.x). Do not use `8.x` (Appium 3).
- Fast, deterministic tests: explicit waits only (see `helpers/waits.ts`), no arbitrary `sleep`s.
- Keep output concise. Separate console reporter (`dot`) is configured; there are no chai tests by default.

## Doctype

- TypeScript, Mocha (BDD), WebdriverIO 10, Chai.
- Page Object Model in `pages/`, helpers in `helpers/`.
- Environment self-check: `scripts/doctor.ts`.

## Output contract

- Screenshots and JUnit XML land in `reports/` (git-ignored). Treat them as evidence, not as tests.
- Never report a test as passed without having executed it.
