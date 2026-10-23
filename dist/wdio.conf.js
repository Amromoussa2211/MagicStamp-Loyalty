"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const appFile = process.env.APP_FILE || '';
const reportsDir = path.resolve(__dirname, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(path.join(reportsDir, 'screenshots'), { recursive: true });
fs.mkdirSync(path.join(reportsDir, 'junit'), { recursive: true });
fs.mkdirSync(path.join(reportsDir, 'allure-results'), { recursive: true });
const config = {
    runner: 'local',
    specs: [path.resolve(__dirname, 'tests/smoke.android.js'), path.resolve(__dirname, 'tests')],
    exclude: [],
    maxInstances: 1,
    logLevel: 'info',
    // Appium server connection
    hostname: 'localhost',
    port: 4723,
    path: '/wd/hub',
    capabilities: [
        {
            platformName: 'Android',
            'appium:deviceName': process.env.DEVICE_NAME || 'Android Device',
            'appium:udid': process.env.DEVICE_UDID || '',
            'appium:appPackage': process.env.APP_PACKAGE || '',
            'appium:appActivity': process.env.APP_ACTIVITY || '',
            'appium:automationName': 'UiAutomator2',
            'appium:autoGrantPermissions': true,
            'appium:ignoreHiddenApiPolicyError': true,
            'appium:noReset': true,
            'appium:fullReset': false,
            'appium:newCommandTimeout': 120,
        },
    ],
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
    },
    reporters: ['dot', 'junit', ['allure', { outputDir: path.join(reportsDir, 'allure-results') }]],
    // @ts-ignore — junitReporterOptions is accepted by the wdio CLI (this type
    // build omits it), but the reporter works at runtime.
    junitReporterOptions: {
        outputDir: path.join(reportsDir, 'junit'),
        outputFile: 'TESTS-results.xml',
        suite: 'mobile-automation-lab',
        useFilePath: true,
    },
    onPrepare: async () => {
        console.log('[setup] Android capabilities ready (UiAutomator2):', config.capabilities);
    },
};
exports.config = config;
