# Mobile Automation Lab — Magic Stamp

Android test automation framework built with **WebdriverIO**, **Appium**, and **JavaScript**. This project supports two execution modes: a real device (local) and an Android emulator (CI). A **web (Playwright)** suite can run alongside mobile and both appear in **one combined Allure report**.

## Tech Stack

| Layer | Technology |
|---|---|
| Test Runner | WebdriverIO v9 |
| Automation Engine | Appium 2.x + UiAutomator2 |
| Web Test Runner | Playwright (Chromium) |
| Language | JavaScript (Node.js) |
| Test Framework | Mocha (BDD) |
| Assertions | Built-in WebdriverIO `expect` |
| Reporting | Allure (HTML + JSON) |
| CI | GitHub Actions (Emulator) |

## Project Structure
mobile-automation-lab/
├── apks/ # APK under test
├── test/specs/ # Mobile test suites (*.spec.js)
├── web/specs/ # Web test suites — Playwright (*.spec.js)
├── playwright.config.js # Web runner config (Allure → same allure-results/)
├── wdio.conf.js # Base WebdriverIO configuration
├── wdio.local.conf.js # Local execution (real device)
├── wdio.ci.conf.js # CI execution (emulator)
├── screenshots/ # Generated per-test screenshots (ignored)
├── logs/ # Generated ADB logcat dumps (ignored)
├── allure-results/ # Generated Allure raw results — mobile + web (ignored)
├── allure-report/ # Generated Allure HTML report (ignored)
└── package.json

text

## Prerequisites

- **Node.js** ≥ 20
- **Android SDK** (platform-tools, build-tools)
- **Java** 17+
- **Appium 2.x** and **UiAutomator2 driver**
- A **real Android device** with USB debugging enabled OR an **Android emulator**

Install Appium and the UiAutomator2 driver (if not already installed):

```bash
npm install -g appium
appium driver install uiautomator2
Installation
bash
npm install
Running Tests Locally (Real Device)
Make sure the device is connected and recognized:

bash
adb devices
The device name and UDID are defined in wdio.local.conf.js. Update them to match your device if needed.

Run the tests:

bash
npx wdio run ./wdio.local.conf.js
Running Tests in CI (Emulator)
The GitHub Actions workflow (.github/workflows/android-e2e.yml) boots an Android emulator, installs the APK from apks/app-release.apk, and runs the tests.

To run the CI configuration locally against an emulator:

bash
npx wdio run ./wdio.ci.conf.js
Allure Reports
After a test run, generate and open the Allure report:

bash
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report

Web Tests (Playwright)
Web specs live in web/specs/ and write Allure results into the same allure-results/ folder as the mobile suite, so a single report contains both.

bash
npm run test:web          # run web tests only
npm run test:web:setup    # install Playwright Chromium browser (CI)
npm run test:all          # mobile (local) + web + generate + open combined report

Notes:
- Web tests are tagged `layer: web` in Allure so they are easy to filter from mobile specs.
- On macOS 12 the bundled Chromium build is unsupported; the config automatically falls back
  to the system-installed Google Chrome (`channel: 'chrome'`). Set `PLAYWRIGHT_BROWSER` to
  override. CI (Linux) uses the normal downloaded Chromium.

GitHub Actions
The workflow (.github/workflows/android-e2e.yml) has three jobs:

- e2e-tests — boots the emulator and runs the mobile suite (unchanged behavior)
- web-tests — runs the Playwright suite (only when the run_web input is true)
- generate-report — merges both Allure results artifacts and generates ONE combined report

To skip web tests in CI (reproduce the old mobile-only run), dispatch the workflow with `run_web: false`.
Screenshots and Logs
Screenshots are saved to screenshots/ after each test.

ADB logcat dumps are saved to logs/ after each test.

Both directories are ignored by Git.

Configuration Notes
Local execution uses wdio.local.conf.js and targets a real device. The device UDID and app package are hardcoded; update them for your environment.

CI execution uses wdio.ci.conf.js and targets an emulator (emulator-5554). The APK path is resolved relative to the project root.

The base wdio.conf.js contains shared settings (runner, reporters, hooks). It does not define capabilities; those are defined in the local and CI configs.

Troubleshooting
Problem	Solution
ECONNREFUSED on port 4723	Start Appium manually (npx appium) or ensure the Appium service is enabled in your config.
App not launching / com.oppo.launcher returned	Ensure appium:autoLaunch: true is set and the app package/activity are correct.
No specs found	Ensure test files are placed in test/specs/ and end with .spec.js.
Device unauthorized	Run adb devices and approve the RSA fingerprint on the device.
Emulator not booting in CI	Verify the AVD name and system image in the workflow file.