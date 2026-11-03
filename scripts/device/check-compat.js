#!/usr/bin/env node
'use strict';

/**
 * Cross-check APK compatibility against connected devices and known AVDs (read-only).
 *
 * Usage:
 *   node scripts/device/check-compat.js [--pretty]
 *
 * Outputs JSON:
 *   { generatedAt, apks, targets, recommendation, warnings }
 */

const path = require('path');
const childProcess = require('child_process');
const lib = require('./lib');

const MIN_FREE_BYTES = 5 * 1024 * 1024 * 1024;

/** Run a sibling inspection script and parse its JSON output. */
function runJsonScript(name) {
  const script = path.join(__dirname, name);
  try {
    const out = childProcess.execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      timeout: 90000,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (e) {
    return { error: (e.stderr || e.message || 'script failed').toString().trim() };
  }
}

/** Device API level and ABI list via adb, with per-property fallbacks. */
function probeDevice(serial) {
  const adb = lib.toolPath('adb');
  const api = lib.run(adb, ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']).stdout.trim();
  const abilist = lib.run(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abilist']).stdout.trim();
  const abi = lib.run(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abi']).stdout.trim();
  const model = lib.run(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.model']).stdout.trim();
  const abis = (abilist || abi).split(',').map((s) => s.trim()).filter(Boolean);
  return {
    apiLevel: Number.isFinite(parseInt(api, 10)) ? parseInt(api, 10) : null,
    abis,
    model: model || null,
  };
}

/** Evaluate one APK against one target. Last rule wins: any hard failure blocks. */
function evaluate(apk, target) {
  const reasons = [];
  let compatible = true;

  if (target.apiLevel == null) {
    compatible = false;
    reasons.push('Unknown device API level');
  } else if (apk.minSdk != null && target.apiLevel < apk.minSdk) {
    compatible = false;
    reasons.push(`Device API ${target.apiLevel} < APK minSdk ${apk.minSdk}`);
  }

  const apkAbis = apk.abis || [];
  if (apkAbis.length && target.abis && target.abis.length) {
    const shared = apkAbis.filter((a) => target.abis.includes(a));
    if (!shared.length) {
      compatible = false;
      reasons.push(`No shared ABI (apk: ${apkAbis.join(',')}; target: ${target.abis.join(',')})`);
    } else {
      reasons.push(`Shared ABI: ${shared.join(',')}`);
    }
  }

  if (compatible && !reasons.length) reasons.push('API and ABI compatible');

  return { compatible, reasons };
}

function main() {
  const pretty = process.argv.includes('--pretty');
  const warnings = [];

  const discover = runJsonScript('discover.js');
  const apkData = runJsonScript('apk-info.js');

  if (discover.error) warnings.push(`discover.js: ${discover.error}`);
  if (apkData.error) warnings.push(`apk-info.js: ${apkData.error}`);
  warnings.push(...(discover.warnings || []), ...(apkData.warnings || []));

  const apks = (apkData.apks || []).filter((a) => !a.error && a.package);
  if (!apks.length) warnings.push('No inspectable APK found');

  const targets = [];
  for (const device of discover.devices || []) {
    if (device.state !== 'device') {
      targets.push({
        type: 'device',
        id: device.serial,
        state: device.state,
        model: device.model,
        apiLevel: null,
        abis: [],
        ready: false,
        note: `Device is ${device.state}`,
      });
      continue;
    }
    const probed = probeDevice(device.serial);
    targets.push({
      type: 'device',
      id: device.serial,
      state: device.state,
      model: device.model || probed.model,
      apiLevel: probed.apiLevel,
      abis: probed.abis,
      ready: true,
    });
  }

  for (const avd of discover.avds || []) {
    targets.push({
      type: 'avd',
      id: avd.name,
      state: 'defined',
      model: avd.device,
      apiLevel: avd.apiLevel,
      abis: avd.abi ? [avd.abi] : [],
      ready: true,
      note: avd.error || null,
    });
  }

  const matrix = [];
  for (const apk of apks) {
    for (const target of targets) {
      const verdict = target.ready
        ? evaluate(apk, target)
        : { compatible: false, reasons: [target.note || 'Target not ready'] };
      matrix.push({
        apk: apk.file,
        package: apk.package,
        targetType: target.type,
        targetId: target.id,
        ready: target.ready,
        compatible: verdict.compatible,
        reasons: verdict.reasons,
      });
    }
  }

  // Prefer physical devices (project rule), then the newest compatible AVD.
  const readyDevices = targets.filter((t) => t.type === 'device' && t.ready);
  const readyAvds = targets
    .filter((t) => t.type === 'avd' && t.ready)
    .sort((a, b) => (b.apiLevel || 0) - (a.apiLevel || 0));

  let recommendation = null;
  const pick = (target) => {
    const row = matrix.find((m) => m.targetId === target.id && m.compatible);
    if (!row) return null;
    return {
      targetType: target.type,
      targetId: target.id,
      apiLevel: target.apiLevel,
      abis: target.abis,
      apk: row.apk,
      package: row.package,
      reason:
        target.type === 'device'
          ? 'Existing physical device preferred by safety rules'
          : 'Emulator is compatible; verify it is not in use before starting',
    };
  };
  for (const device of readyDevices) {
    recommendation = pick(device);
    if (recommendation) break;
  }
  if (!recommendation) {
    for (const avd of readyAvds) {
      recommendation = pick(avd);
      if (recommendation) break;
    }
  }

  if (!recommendation) {
    warnings.push(
      'No compatible execution target online. Connect a device or create an AVD (requires approval + free disk).'
    );
  }

  const freeBytes = discover.disk ? discover.disk.freeBytes : lib.diskFreeBytes(lib.PROJECT_ROOT);
  if (freeBytes != null && freeBytes < MIN_FREE_BYTES) {
    warnings.push(`Disk free ${lib.formatBytes(freeBytes)} < ${lib.formatBytes(MIN_FREE_BYTES)}; emulator work may fail.`);
  }

  const result = {
    generatedAt: new Date().toISOString(),
    diskFree: lib.formatBytes(freeBytes),
    apks: apks.map((a) => ({
      file: a.file,
      package: a.package,
      versionName: a.versionName,
      versionCode: a.versionCode,
      minSdk: a.minSdk,
      targetSdk: a.targetSdk,
      abis: a.abis,
    })),
    targets,
    matrix,
    recommendation,
    warnings,
  };

  if (pretty) {
    console.log('APKs:');
    for (const a of result.apks) console.log(`  ${a.file}  ${a.package} ${a.versionName} (minSdk ${a.minSdk})`);
    console.log('\nTargets:');
    if (!targets.length) console.log('  (none)');
    for (const t of targets) {
      console.log(`  [${t.type}] ${t.id}  api=${t.apiLevel ?? '?'}  abis=${t.abis.join(',') || '?'}  ready=${t.ready}`);
    }
    console.log('\nCompatibility:');
    for (const m of matrix) {
      console.log(`  ${m.compatible ? 'PASS' : 'FAIL'}  ${m.targetId}  ${m.reasons.join('; ')}`);
    }
    console.log('\nRecommendation:', recommendation ? `${recommendation.targetId} (${recommendation.targetType})` : 'none');
    if (warnings.length) {
      console.log('\nWarnings:');
      [...new Set(warnings)].forEach((w) => console.log('  - ' + w));
    }
  } else {
    lib.printJson({ ...result, warnings: [...new Set(warnings)] });
  }
}

main();
