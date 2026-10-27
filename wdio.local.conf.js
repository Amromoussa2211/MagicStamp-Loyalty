const { execSync } = require('child_process');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const allure = require('allure-commandline');

exports.config = {
    runner: 'local',
    hostname: 'localhost',
    protocol: 'http',
    port: 4723,
    path: '/',
    specs: ['./test/specs/**/*.spec.js'],
    exclude: [],
    maxInstances: 1,
    specFileRetries: 0,
    maxInstancesPerCapability: 1,

    logLevel: 'info',
    bail: 0,
    waitforTimeout: 15000,
    connectionRetryTimeout: 200000,
    // connectionRetryCount: 3,

    services: ['appium'],
    
    capabilities: [
        {
            platformName: 'Android',
            'appium:deviceName': 'CPH1937',
            'appium:udid': '93bb1813',
            'appium:appPackage': 'com.parktechnology.purse.dev',
            'appium:appActivity': '.MainActivity',
            'appium:automationName': 'UiAutomator2',
            'appium:autoGrantPermissions': true,
            'appium:ignoreHiddenApiPolicyError': true,
            'appium:noReset': true,
            'appium:fullReset': false,
            'appium:newCommandTimeout': 120,
            'appium:autoLaunch': true,

            'appium:systemPort': 8201,
            'appium:uiautomator2ServerLaunchTimeout': 60000,
            'appium:uiautomator2ServerInstallTimeout': 60000
        }
    ],

    framework: 'mocha',
    reporters: [
        'spec',
        ['allure', {
            outputDir: 'allure-results',
            disableWebdriverStepsReporting: false,
            disableWebdriverScreenshotsReporting: false
        }]
    ],
    mochaOpts: {
        ui: 'bdd',
        timeout: 360000,
        retries: 2
    },

    onPrepare: async function () {
        try {
            const allureResultsDir = path.join(__dirname, 'allure-results');
            if (!fs.existsSync(allureResultsDir)) fs.mkdirSync(allureResultsDir, { recursive: true });

            const envContent = [
                'Environment=DEV',
                'Platform=Android',
                'DeviceName=CPH1937',
                'UDID=93bb1813',
                'AppPackage=com.parktechnology.purse.dev',
                'Runner=Local',
                `Tester=${process.env.USER || 'local'}`,
                `Timestamp=${new Date().toISOString()}`
            ].join('\n');
            fs.writeFileSync(path.join(allureResultsDir, 'environment.properties'), envContent);

            const executor = {
                name: 'Local Machine',
                type: 'local',
                buildName: `local-${new Date().toISOString().slice(0, 10)}`
            };
            fs.writeFileSync(path.join(allureResultsDir, 'executor.json'), JSON.stringify(executor, null, 2));

            console.log('✅ Allure environment.properties + executor.json written (DEV)');
        } catch (err) {
            console.warn('⚠️ Failed to write Allure env/executor files:', err.message);
        }

        console.log('📦 Preparing test environment...');
        try {
            execSync('adb shell am force-stop io.appium.uiautomator2.server', { stdio: 'ignore' });
            execSync('adb shell am force-stop io.appium.uiautomator2.server.test', { stdio: 'ignore' });
            console.log('✅ Force-stopped old uiautomator sessions');
        } catch (err) {
            console.warn('⚠️ No uiautomator processes to stop or failed:', err.message);
        }
    },

    beforeTest: async function () {
        try {
            // ✅ FIX: افتح التطبيق (لأن afterTest قفله في التيست اللي قبله)
            await driver.activateApp('com.parktechnology.purse.dev');
            console.log('🔄 App activated');

            // ✅ انتظر لحد ما التطبيق يبقى جاهز (UiAutomator2 يرد)
            await driver.waitUntil(
                async () => {
                    try {
                        const pkg = await driver.getCurrentPackage();
                        return pkg === 'com.parktechnology.purse.dev';
                    } catch {
                        return false;
                    }
                },
                {
                    timeout: 15000,
                    interval: 500,
                    timeoutMsg: 'App did not become responsive in 15s'
                }
            );
            console.log('✅ App is responsive, ready for test');

            // ✅ استقرار إضافي للـ UI
            await driver.pause(1500);
        } catch (err) {
            console.warn('⚠️ Could not activate app:', err.message);
        }
    },

    afterTest: async function (test, context, { error }) {
        const screenshotDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

        const fileName = path.join(
            screenshotDir,
            `${test.title.replace(/[^a-zA-Z0-9]/g, '_')}_${error ? 'FAILED' : 'PASSED'}.png`
        );

        try {
            await browser.saveScreenshot(fileName);
            console.log(`📸 Screenshot saved: ${fileName}`);
        } catch (err) {
            console.error(`❌ Skipped screenshot: ${err.message}`);
        }

        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

        const logFile = path.join(logDir, `device_failure_${Date.now()}.log`);
        try {
            execSync(`adb logcat -d -v time > ${logFile}`);
            console.log('📄 ADB logs collected');
        } catch (err) {
            console.error(`❌ Failed to fetch logcat: ${err.message}`);
        }

        // ✅ اقفل التطبيق بعد كل test (عشان كل test يبدأ من حالة نظيفة)
        // ملاحظة: beforeTest هيفتحه تاني
        try {
            console.log('🧹 Terminating app after test...');
            await driver.terminateApp('com.parktechnology.purse.dev');
            console.log('✅ App terminated successfully');
        } catch (err) {
            console.warn('⚠️ Could not terminate app:', err.message);
        }

        // ❌ مش بنقفل UiAutomator2 — الـ session محتاجاه
        // (الـ force-stop للحزمتين معمول في onPrepare بس)

        await driver.pause(1500);
    },

    onComplete: async function () {
        console.log('📊 Generating Allure Report...');
        const reportError = new Error('Could not generate Allure report');
        const generation = allure(['generate', 'allure-results', '--clean']);

        return new Promise((resolve, reject) => {
            generation.on('exit', function (exitCode) {
                if (exitCode !== 0) {
                    reject(reportError);
                } else {
                    console.log('✅ Allure Report generated successfully!');
                    resolve();
                }
            });
        });
    }
};