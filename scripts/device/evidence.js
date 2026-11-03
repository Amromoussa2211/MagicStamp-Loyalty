#!/usr/bin/env node
'use strict';

/**
 * Create a timestamped evidence bundle under reports/ and capture the current
 * device state (logcat + screenshot). Read-only towards the device.
 *
 * Usage:
 *   node scripts/device/evidence.js [--label <name>] [--serial <udid>]
 *
 * Outputs JSON: { reportDir, files, device, warnings }
 */

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  return idx > -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Create (never delete) a report directory inside reports/. */
function createReportDir(label) {
  const base = path.join(lib.PROJECT_ROOT, 'reports');
  fs.mkdirSync(base, { recursive: true });
  const safeLabel = (label || 'mobile-exec').replace(/[^a-zA-Z0-9_-]+/g, '-');
  const dir = path.join(base, `${safeLabel}-${timestamp()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pickSerial(explicit) {
  if (explicit) return explicit;
  const res = lib.run(lib.toolPath('adb'), ['devices']);
  const online = lib.parseAdbDevices(res.stdout).filter((d) => d.state === 'device');
  return online.length === 1 ? online[0].serial : null;
}

function main() {
  const label = argValue('--label', 'mobile-exec');
  const serial = pickSerial(argValue('--serial', null));
  const warnings = [];
  const files = [];

  const reportDir = createReportDir(label);

  if (!serial) {
    warnings.push('No single online device found; skipping logcat/screenshot capture.');
  } else {
    const adb = lib.toolPath('adb');

    const logcat = lib.run(adb, ['-s', serial, 'logcat', '-d', '-v', 'threadtime'], { timeout: 30000 });
    if (logcat.ok) {
      const p = path.join(reportDir, 'logcat.txt');
      fs.writeFileSync(p, logcat.stdout + '\n');
      files.push(path.relative(lib.PROJECT_ROOT, p));
    } else {
      warnings.push(`logcat capture failed: ${logcat.stderr || 'unknown error'}`);
    }

    try {
      const png = require('child_process').execFileSync(
        adb,
        ['-s', serial, 'exec-out', 'screencap', '-p'],
        { timeout: 20000, maxBuffer: 64 * 1024 * 1024 }
      );
      const p = path.join(reportDir, 'screenshot.png');
      fs.writeFileSync(p, png);
      files.push(path.relative(lib.PROJECT_ROOT, p));
    } catch (e) {
      warnings.push(`screenshot capture failed: ${(e.message || '').toString().trim()}`);
    }
  }

  const meta = {
    createdAt: new Date().toISOString(),
    label,
    device: serial,
    diskFree: lib.formatBytes(lib.diskFreeBytes(lib.PROJECT_ROOT)),
    files,
    warnings,
  };
  const metaPath = path.join(reportDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
  files.push(path.relative(lib.PROJECT_ROOT, metaPath));

  lib.printJson({ reportDir: path.relative(lib.PROJECT_ROOT, reportDir), files, device: serial, warnings });
}

if (require.main === module) {
  main();
}

module.exports = { createReportDir, timestamp };
