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
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 15000,
    connectionRetryTimeout: 200000,
    
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
            'appium:autoLaunch': true // <--- أضفنا هذا السطر لفتح التطبيق تلقائياً
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
        console.log('📦 Preparing test environment...');
        try {
            execSync('adb shell pkill -f uiautomator');
            console.log('✅ Killed old uiautomator sessions');
        } catch (err) {
            console.warn('⚠️ No uiautomator processes to kill or failed:', err.message);
        }
    },

    beforeTest: async function () {
        // تصحيح: استخدام terminateApp و activateApp بدلاً من reset
        try {
            console.log('🔄 Restarting app before test...');
            await driver.terminateApp('com.parktechnology.purse.dev');
            await driver.activateApp('com.parktechnology.purse.dev');
            console.log('✅ App restarted successfully');
        } catch (err) {
            console.warn('⚠️ Could not restart app:', err.message);
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
            console.error(`❌ Skipped screenshot: App crashed or session closed: ${err.message}`);
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