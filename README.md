# Mobile Automation Lab — Magic Stamp

Android test automation framework built with **WebdriverIO**, **Appium**, and **JavaScript**. This project supports two execution modes: a real device (local) and an Android emulator (CI).

## Tech Stack

| Layer | Technology |
|---|---|
| Test Runner | WebdriverIO v9 |
| Automation Engine | Appium 2.x + UiAutomator2 |
| Language | JavaScript (Node.js) |
| Test Framework | Mocha (BDD) |
| Assertions | Built-in WebdriverIO `expect` |
| Reporting | Allure (HTML + JSON) |
| CI | GitHub Actions (Emulator) |

## Project Structure
mobile-automation-lab/
├── apks/ # APK under test
├── test/specs/ # Test suites (*.spec.js)
├── wdio.conf.js # Base WebdriverIO configuration
├── wdio.local.conf.js # Local execution (real device)
├── wdio.ci.conf.js # CI execution (emulator)
├── screenshots/ # Generated per-test screenshots (ignored)
├── logs/ # Generated ADB logcat dumps (ignored)
├── allure-results/ # Generated Allure raw results (ignored)
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