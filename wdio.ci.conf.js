const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const baseConfig = require('./wdio.conf.js');

// Helper to handle the System UI crash dialog
const handleSystemUIDialog = async () => {
  try {
    const closeButton = await $('android=new UiSelector().textContains("Close app")');
    if (await closeButton.waitForDisplayed({ timeout: 5000 })) {
      console.warn('⚠️ System UI crash dialog found. Clicking "Close app"...');
      await browser.pause(500);
      await closeButton.click();
      await browser.pause(3000);
    }
  } catch {
    // no dialog present
  }
};

exports.config = {
  ...baseConfig.config,

  maxInstances: 1,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  specFileRetries: 1,

  capabilities: [{
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    
    // إعدادات الـ Emulator (تأكد من اسم ونسخة الـ Emulator عندك في البايب لاين)
    'appium:deviceName': 'emulator-5554',
    'appium:platformVersion': '14',
    
    'appium:autoGrantPermissions': true,
    'appium:noReset': true,
    'appium:fullReset': false, 
    'appium:autoLaunch': true, // <--- مهم جداً: عشان يفتح التطبيق أوتوماتيك
    'appium:newCommandTimeout': 1800,
    'appium:adbExecTimeout': 60000,
    
    // مسار الـ APK
    'appium:app': path.join(__dirname, 'apks', 'app-release.apk'),
    
    // بيانات التطبيق
    'appium:appPackage': 'com.parktechnology.purse.dev',
    'appium:appActivity': '.MainActivity',
  }],

  onPrepare: () => {
    console.log('📦 onPrepare: cleaning up before Appium starts (CI Mode)');
    try { execSync('adb shell pkill -f uiautomator', { stdio: 'ignore' }); } catch {}
    try { execSync('adb shell rm -f /sdcard/DCIM/Camera/*.png', { stdio: 'ignore' }); } catch {}
    try { execSync('adb shell screencap -p /sdcard/DCIM/Camera/onPrepare.png', { stdio: 'ignore' }); } catch {}

    ['diagnostics', 'screenshots', 'logs'].forEach(dir => {
      const d = path.join(__dirname, dir);
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
  },

  beforeTest: async () => {
    // بنستنى شوية عشان التطبيق يفتح، وبعدين نتعامل مع أي رسايل خطأ
    await browser.pause(2000);
    await handleSystemUIDialog();
  },
  
  afterTest: async (test, context, { error }) => {
    const safeName = test.title.replace(/[^a-zA-Z0-9]/g, '_');
    const status = error ? 'FAIL' : 'PASS';
    
    // لقطة شاشة
    try {
      const shotPath = path.join(__dirname, 'screenshots', `${safeName}_${status}.png`);
      await browser.saveScreenshot(shotPath);
      console.log(`📸 Screenshot saved: ${shotPath}`);
    } catch (e) {
      console.warn(`❌ Failed to save screenshot: ${e.message}`);
    }

    // لوجات الجهاز
    try {
      const logFile = path.join(__dirname, 'logs', `logcat_${Date.now()}.txt`);
      execSync(`adb logcat -d -v time > ${logFile}`);
      console.log(`📄 Logcat dumped: ${logFile}`);
    } catch (e) {
      console.warn(`❌ Failed to dump logcat: ${e.message}`);
    }
  },

  onComplete: () => new Promise((resolve, reject) => {
    console.log('🎉 onComplete: generating Allure report (CI Mode)');
    try {
      execSync('allure generate allure-results --clean');
      resolve();
    } catch (error) {
      console.error('Failed to generate Allure report:', error);
      reject(error);
    }
  }),
};