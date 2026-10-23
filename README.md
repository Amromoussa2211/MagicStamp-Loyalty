# Mobile Automation Lab — Real Android Device (WebdriverIO + Appium 2.x)

A lightweight, real-device-first QA framework. Runs against an **attached physical Android phone** (UiAutomator2). No emulator images, no Android Studio, no extra SDK downloads — everything reuses what is already installed.

## Column

| Item | Value |
| --- | --- |
| Project | `~/mobile-automation-lab` |
| Automation stack | Appium 2.x, UiAutomator2, WebdriverIO 10, TypeScript, Mocha |
| Runtime | Node.js 22 (nvm v22.12.0), npm 11.6.1 |
| Android tools (reused) | `~/Library/Android/sdk` (platform-tools 35.0.2), Java Temurin 17 |
| Execution | Real device over USB ADB |

## Commands

| Script | What it does |
| --- | --- |
| `npm run doctor` | Verify node, java, adb, appium, uiautomator2 driver, and device. |
| `npm run android:devices` | List USB devices. |
| `npm run appium:start` | Start the Appium server (localhost:4723). |
| `npm run test:android` | Run the full Mocha suite. |
| `npm run test:smoke` | Run only the `smoke` suite. |
| `npm run report` | Alias of `test:android`. |
| `npm run allure:report` | Generate the Allure HTML report from JSON results. |
| `npm run allure:serve` | Serve the Allure report at `http://localhost:9001`. |

Sequence: `doctor` → `appium:start` (in a terminal) → `test:android`.

## File map

- `wdio.conf.ts` — WebdriverIO + capabilities (real device).
- `tests/` — **Your test scripts live here.** All `.spec.ts` files in this folder are run by Wdio. Add new spec files to test new features.
  - `tests/smoke.android.ts` — sample smoke suite (device & Appium session checks).
- `pages/` — Page Object Model base classes.
- `helpers/` — reusable waits/assertions.
- `scripts/` — environment self-check, utilities.
- `apks/` — **Drop your APK files here.** The `APP_FILE` env var points Wdio to this folder.
- `reports/` — JUnit XML + screenshots (git-ignored).
- `allure-report/` — generated Allure HTML report (git-ignored).
- `.github/workflows/android-e2e.yml` — CI pipeline (see below).

## Environment requirements

- macOS 12.7 (Intel), 8 GB RAM
- Node ≥ 20 (nvm v22.12.0 in use), npm 11.6.1
- Java 17, Android SDK at `~/Library/Android/sdk`, ADB 35.0.2
- Appium 2.19.0 + `uiautomator2@4.2.9` driver (installed)

## Where things go

| What | Where | How to edit |
| --- | --- | --- |
| **APK files** | `apks/` folder | Drop `.apk` files here. Point `APP_FILE` in `.env` (or `wdio.conf.ts`) at the file you want. |
| **Test scripts** | `tests/*.spec.ts` | Add new files with `describe`/`it` blocks. Wdio auto-discovers all `*.spec.ts` files. |
| **Test data** | `test-data/` | (optional) JSON/XML/CSV fixtures for your tests. |
| **Page objects** | `pages/` | TypeScript classes that wrap page interactions. |
| **Reusable helpers** | `helpers/` | Waits, assertions, custom commands. |

## Allure reporting

The framework uses `@wdio/allure-reporter` plus the `allure-commandline` CLI.

1. **Run tests** — `npm run test:android` (writes JSON to `reports/allure-results/`)
2. **Generate HTML report** — `npm run allure:report` (writes to `allure-report/`)
3. **View report** — `npm run allure:serve` → open `http://localhost:9001`

Local Allure CLI is installed as a devDependency. If you prefer not to install it, remove the `allure` reporter from `wdio.conf.ts`.

## GitHub Actions CI

The workflow `.github/workflows/android-e2e.yml` runs on every push to `main` and on pull requests. It performs:

1. **Prepare environment** — Node.js 20, Java 17 (Temurin), Android SDK (platform-tools, API 34, build-tools 34.0.0)
2. **Prepare environment variables** — `APP_FILE`, `DEVICE_NAME`, `ALLURE_RESULTS`
3. **Download APK** — pulls the APK from the `APK_DOWNLOAD_URL` (set as a workflow input; default `https://example.com/app-release.apk`)
4. **Run tests** — starts Appium on localhost:4723, then `npm run test:android`
5. **Publish artifacts** — uploads the Allure HTML report, JUnit XML, the APK, and the Appium log

### Run manually

- Open **Actions** tab → **Android E2E** → **Run workflow**
- Optionally override the APK URL:
  ```
  APK_DOWNLOAD_URL=https://example.com/my-app.apk run workflow
  ```

### Required secrets / env (local)

None. The workflow downloads the APK via `curl`. Only an APK file you have permission to download is used.

## Notes

- **No emulator images** are installed; the phone is the target.
- **Important limitation:** Appium 2.x server and the `uiautomator2` driver versions listed here are the supported set. `appium-uiautomator2-driver@8.x` targets Appium 3 and is intentionally **not** used.
- The sample smoke test runs **without an app file**; it verifies the session/device plumbing.
