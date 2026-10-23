#!/usr/bin/env node
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
/**
 * Environment diagnostic (doctor).
 * Checks: node, npm, java, Android SDK, adb, appium, uiautomator2 driver, and a connected device.
 * Exit code 0 = all good, 1 = any problem found.
 */
const childProcess = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fail = [];
const ok = [];
/** Run a shell command, merging stdout+stderr so version info is captured. */
function run(cmd) {
    try {
        const out = childProcess.execFileSync('/bin/sh', ['-c', cmd], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
        return out || '';
    }
    catch (e) {
        const text = `${e.stdout || ''}\n${e.stderr || ''}`.toString().trim();
        return text;
    }
}
function section(title) {
    console.log('\n=== ' + title + ' ===');
}
// Node / npm
section('Node');
console.log('node:', run('node -v') || 'NOT FOUND');
console.log('npm:', run('npm -v') || 'NOT FOUND');
const nodeVer = run('node -v').replace('v', '');
const [major] = nodeVer.split('.').map(Number);
if (major >= 20)
    ok.push('node ' + nodeVer);
else
    fail.push('node ' + nodeVer + ' below 20');
// Java
section('Java');
const javaHome = process.env.JAVA_HOME || '/Users/t/.sdkman/candidates/java/current';
const javaBin = fs.existsSync(javaHome) ? javaHome : '';
const javaVer = run('java -version 2>&1') || '';
console.log('java:', javaVer || 'NOT FOUND');
console.log('java.home:', javaHome || 'NOT FOUND');
if (fs.existsSync(javaBin))
    ok.push('java present');
else
    fail.push('java not found');
// Android SDK / ADB
section('Android SDK & ADB');
const sdkHome = process.env.ANDROID_HOME || path.join(os.homedir(), 'Library', 'Android', 'sdk');
console.log('ANDROID_HOME:', sdkHome, fs.existsSync(sdkHome) ? 'OK' : 'MISSING');
if (fs.existsSync(sdkHome))
    ok.push('ANDROID_HOME');
const adb = path.join(sdkHome, 'platform-tools', 'adb');
if (fs.existsSync(adb))
    ok.push('platform-tools/adb');
else {
    const which = run('which adb 2>&1');
    console.log('which adb:', which);
}
const adbVer = run('adb version 2>&1') || '';
console.log('adb:', adbVer || 'NOT FOUND');
if (adbVer)
    ok.push('adb present');
else
    fail.push('adb missing');
// Appium + driver
section('Appium');
const candidates = [
    '/Users/t/.nvm/versions/node/v22.12.0/bin/appium',
    path.join(os.homedir(), '.nvm', 'versions', 'node', 'v22.12.0', 'bin', 'appium'),
];
let foundAppium = '';
for (const c of candidates) {
    if (fs.existsSync(c)) {
        foundAppium = c;
        break;
    }
}
if (!foundAppium)
    foundAppium = run('which appium 2>&1') || '';
console.log('appium:', foundAppium || 'NOT FOUND');
if (foundAppium) {
    const v = run('appium -v 2>&1') || '';
    console.log('appium -v:', v);
    if (v)
        ok.push('appium present');
}
const driverLog = fs.existsSync(path.join(os.homedir(), '.appium', 'plugins', 'uiautomator2'))
    ? 'plugins/uiautomator2 installed'
    : 'uiautomator2 not installed';
console.log('uiautomator2 driver:', driverLog);
if (driverLog.includes('installed'))
    ok.push('uiautomator2 driver');
else
    fail.push('uiautomator2 driver missing');
// Connected device
section('ADB devices');
const devices = run('adb devices 2>&1');
console.log(devices.replace(/\n$/, ''));
if (devices.includes('\tdevice') || devices.includes('\tDevice'))
    ok.push('device attached');
else
    fail.push('no device attached');
// Free disk space
section('Free disk space');
let avail = 'unknown';
try {
    const df = run('df -h /Users/t 2>&1');
    // macOS df: last whitespace token of the Avail column
    const line = df.split('\n').filter(Boolean).pop() || '';
    const parts = line.trim().split(/\s+/);
    avail = parts.length > 3 ? parts[parts.length - 2] : 'unknown';
}
catch (e) {
    avail = 'unknown';
}
console.log('Available (df -h):', avail);
ok.push('free space reported: ' + avail);
console.log('\n' + '='.repeat(40));
if (fail.length) {
    console.log('PROBLEMS:');
    fail.forEach((f) => console.log('  - ' + f));
    console.log('\nRESULT: FAIL');
    process.exit(1);
}
else {
    console.log('All checks passed.');
    console.log('RESULT: PASS');
    process.exit(0);
}
