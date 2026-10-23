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
const child_process_1 = require("child_process");
const http = __importStar(require("http"));
const chai_1 = require("chai");
const mocha_1 = require("mocha");
(0, mocha_1.describe)('Real-device smoke test (template)', function () {
    this.timeout(60000);
    let deviceName = '';
    let apiLevel = 0;
    let platformVersion = '';
    (0, mocha_1.before)(async function () {
        const adb = (args) => (0, child_process_1.execFileSync)('adb', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        deviceName = adb(['shell', 'getprop', 'ro.product.model']).split('\n')[0] || 'unknown';
        platformVersion = adb(['shell', 'getprop', 'ro.build.version.release']).split('\n')[0] || 'unknown';
        apiLevel = parseInt(adb(['shell', 'getprop', 'ro.build.version.sdk']).split('\n')[0] || '0', 10) || 0;
    });
    (0, mocha_1.it)('should confirm the device is listed by ADB', function () {
        const lines = (0, child_process_1.execFileSync)('adb', ['devices'], { encoding: 'utf8' })
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(1)
            .filter((l) => !l.endsWith('offline') && !l.endsWith('unauthorized'));
        (0, chai_1.expect)(lines.length, 'no attached device').to.be.greaterThan(0);
        (0, chai_1.expect)(lines[0], 'no device state').to.contain('device');
    });
    (0, mocha_1.it)('should confirm Appium server responds (/status)', function (done) {
        const req = http.get({ host: 'localhost', port: 4723, path: '/status' }, (res) => {
            (0, chai_1.expect)(res.statusCode, 'Appium /status').to.equal(200);
            res.resume();
            done();
        });
        req.on('error', done);
        req.setTimeout(5000);
        req.end();
    });
    (0, mocha_1.it)('should read device model, platform version and API level', function () {
        (0, chai_1.expect)(deviceName, 'deviceName').to.not.equal('');
        (0, chai_1.expect)(apiLevel, 'apiLevel').to.be.a('number').and.to.be.gte(21);
        (0, chai_1.expect)(platformVersion, 'platformVersion').to.not.equal('');
    });
});
