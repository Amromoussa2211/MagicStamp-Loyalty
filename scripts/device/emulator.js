#!/usr/bin/env node
'use strict';

/**
 * Reusable emulator launcher for mobile-automation-lab.
 *
 * Usage:
 *   node scripts/device/emulator.js --check            # preflight only, starts nothing
 *   node scripts/device/emulator.js                    # start (windowed) + wait for boot
 *   node scripts/device/emulator.js --headless         # start without a window
 *   node scripts/device/emulator.js --apk apks/app-release.apk
 *   node scripts/device/emulator.js --stop             # graceful shutdown
 *
 * Emulator 35.x requires ~7.37 GB free before boot (hard-coded, independent of
 * the AVD profile). This script refuses to start below that threshold instead
 * of letting the emulator fail halfway.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const lib = require('./lib');

const REAL_REQUIRED_BYTES = Math.ceil(7372.8 * 1024 * 1024); // emulator's own check
const HEADROOM_BYTES = 128 * 1024 * 1024;
const REQUIRED_BYTES = REAL_REQUIRED_BYTES + HEADROOM_BYTES;
const DEFAULT_AVD = 'qa_nexus5';
const BOOT_TIMEOUT_SEC = 300;

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const has = (flag) => process.argv.includes(flag);

function emulatorSerial() {
  const devices = lib.parseAdbDevices(lib.run(lib.toolPath('adb'), ['devices']).stdout);
  const emu = devices.find((d) => d.serial.startsWith('emulator-') && d.state === 'device');
  return emu ? emu.serial : null;
}

function avdExists(name) {
  return lib.listAvds().some((a) => a.name === name);
}

function swapInfo() {
  const out = lib.runShell('sysctl -n vm.swapusage 2>/dev/null');
  const used = (out.match(/used = ([\d.]+)M/) || [])[1];
  const total = (out.match(/total = ([\d.]+)M/) || [])[1];
  return { usedMb: used ? Math.round(parseFloat(used)) : null, totalMb: total ? Math.round(parseFloat(total)) : null };
}

function preflight(avd) {
  const freeBytes = lib.diskFreeBytes(lib.PROJECT_ROOT);
  const running = emulatorSerial();
  const avdOk = avdExists(avd);
  const enough = freeBytes != null && freeBytes >= REQUIRED_BYTES;
  const swap = swapInfo();
  const problems = [];
  if (!avdOk) problems.push(`AVD "${avd}" not found. Create one with avdmanager.`);
  if (!running && !enough) {
    const missing = REQUIRED_BYTES - (freeBytes || 0);
    problems.push(
      `Not enough free disk: ${lib.formatBytes(freeBytes)} available, ` +
        `${lib.formatBytes(REQUIRED_BYTES)} required (emulator hard limit). ` +
        `Free at least ${lib.formatBytes(missing)} more.`
    );
    if (swap.usedMb && swap.usedMb > 4096) {
      problems.push(
        `System swap is ${Math.round(swap.usedMb / 1024 * 10) / 10} GB and consumes disk. ` +
          'Rebooting macOS clears it and usually frees several GB.'
      );
    }
  }
  return { avd, avdOk, running, freeBytes, free: lib.formatBytes(freeBytes), required: lib.formatBytes(REQUIRED_BYTES), enough, swap, problems };
}

function check(avd) {
  const p = preflight(avd);
  lib.printJson({ mode: 'check', ...p, ready: p.problems.length === 0 });
  return p.problems.length === 0;
}

function stop() {
  const adb = lib.toolPath('adb');
  const devices = lib.parseAdbDevices(lib.run(adb, ['devices']).stdout).filter((d) =>
    d.serial.startsWith('emulator-')
  );
  for (const d of devices) lib.run(adb, ['-s', d.serial, 'emu', 'kill']);
  lib.printJson({ mode: 'stop', stopped: devices.map((d) => d.serial) });
}

function waitForBoot(serial, timeoutSec) {
  const adb = lib.toolPath('adb');
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    const boot = lib.run(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed']);
    if (boot.stdout.trim() === '1') return true;
    lib.run('sleep', ['2']);
  }
  return false;
}

function findNewEmulator(before) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const current = emulatorSerial();
    if (current && current !== before) return current;
    lib.run('sleep', ['2']);
  }
  return emulatorSerial();
}

function waitForSpace(seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if ((lib.diskFreeBytes(lib.PROJECT_ROOT) || 0) >= REQUIRED_BYTES) return true;
    lib.run('sleep', ['3']);
  }
  return false;
}

function start(avd, opts) {
  let p = preflight(avd);
  if (!p.running && !p.enough && opts.waitSpace > 0) {
    const ok = waitForSpace(opts.waitSpace);
    if (ok) p = preflight(avd);
  }
  if (p.running) {
    lib.printJson({ mode: 'start', reused: true, serial: p.running, note: 'Emulator already running' });
    return 0;
  }
  if (p.problems.length) {
    lib.printJson({ mode: 'start', error: 'preflight failed', ...p });
    return 2;
  }

  const emulator = lib.toolPath('emulator');
  const gpu = opts.gpu || (opts.headless ? 'swiftshader_indirect' : 'host');
  const args = ['-avd', avd, '-no-audio', '-no-boot-anim', '-no-snapshot', '-gpu', gpu];
  if (opts.headless) args.push('-no-window');

  const logPath = path.join(lib.PROJECT_ROOT, 'reports', 'emulator.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = fs.openSync(logPath, 'a');
  const child = spawn(emulator, args, { detached: true, stdio: ['ignore', log, log] });
  child.unref();

  const serial = findNewEmulator(null);
  if (!serial) {
    lib.printJson({ mode: 'start', error: 'emulator did not register with adb', log: 'reports/emulator.log' });
    return 1;
  }
  const booted = waitForBoot(serial, opts.timeout);
  let apkResult = null;
  if (booted && opts.apk) {
    const apkPath = path.resolve(opts.apk);
    if (fs.existsSync(apkPath)) {
      apkResult = lib.run(lib.toolPath('adb'), ['-s', serial, 'install', '-r', '-d', apkPath], {
        timeout: 180000,
      });
      apkResult = { installed: apkResult.ok, output: apkResult.stdout || apkResult.stderr };
    } else {
      apkResult = { installed: false, output: `APK not found: ${apkPath}` };
    }
  }

  lib.printJson({
    mode: 'start',
    avd,
    serial,
    gpu,
    windowed: !opts.headless,
    booted,
    apk: apkResult,
    log: 'reports/emulator.log',
    next: booted ? `adb -s ${serial} shell ...` : 'Boot did not finish; check reports/emulator.log',
  });
  return booted && (!apkResult || apkResult.installed) ? 0 : 1;
}

function main() {
  const avd = arg('--avd', DEFAULT_AVD);
  const opts = {
    headless: has('--headless'),
    gpu: arg('--gpu', null),
    apk: arg('--apk', null),
    timeout: parseInt(arg('--timeout', String(BOOT_TIMEOUT_SEC)), 10),
    waitSpace: parseInt(arg('--wait-space', '0'), 10),
  };

  if (has('--help') || has('-h')) {
    console.log(
      'Usage: node scripts/device/emulator.js [--check|--stop] [--avd name] ' +
        '[--headless] [--gpu host|swiftshader_indirect] [--apk file] [--timeout sec] [--wait-space sec]'
    );
    return;
  }
  if (has('--stop')) return stop();
  if (has('--check')) return check(avd) ? 0 : 2;
  return start(avd, opts);
}

process.exitCode = main() || 0;
