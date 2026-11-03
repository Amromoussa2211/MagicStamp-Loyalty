#!/usr/bin/env node
'use strict';

/**
 * Discover the local Android execution surface (read-only).
 *
 * Usage:
 *   node scripts/device/discover.js [--pretty]
 *
 * Outputs JSON:
 *   { generatedAt, sdk, devices, avds, disk, warnings }
 */

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

function main() {
  const pretty = process.argv.includes('--pretty');
  const home = lib.sdkHome();
  const warnings = [];

  const sdk = {
    home,
    exists: fs.existsSync(home),
    adb: lib.toolPath('adb'),
    emulator: lib.toolPath('emulator'),
    platforms: lib.listDirs(path.join(home, 'platforms')),
    buildTools: lib.listDirs(path.join(home, 'build-tools')),
    systemImages: lib.listDirs(path.join(home, 'system-images')),
    avdManager: path.join(home, 'cmdline-tools', 'latest', 'bin', 'avdmanager'),
  };

  if (!sdk.exists) warnings.push(`Android SDK not found at ${home}`);
  if (!sdk.buildTools.length) warnings.push('No build-tools installed (APK inspection will fail)');
  if (!sdk.systemImages.length) {
    warnings.push('No emulator system images installed — creating an AVD requires a large download (needs approval)');
  }

  const adb = lib.run(sdk.adb, ['devices', '-l']);
  if (!adb.ok) warnings.push(`adb failed: ${adb.stderr || adb.stdout || 'unknown error'}`);
  const devices = lib.parseAdbDevices(adb.stdout);

  const avds = lib.listAvds();
  for (const avd of avds) {
    if (avd.error) warnings.push(`AVD "${avd.name}": ${avd.error}`);
  }

  const freeBytes = lib.diskFreeBytes(lib.PROJECT_ROOT);
  const MIN_FREE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB: plan's safety floor
  if (freeBytes != null && freeBytes < MIN_FREE_BYTES) {
    warnings.push(
      `Low disk space: ${lib.formatBytes(freeBytes)} free (< ${lib.formatBytes(MIN_FREE_BYTES)}). ` +
        'Creating/starting AVDs may fail; clean up before emulator work.'
    );
  }

  const onlineDevices = devices.filter((d) => d.state === 'device');
  if (!onlineDevices.length) {
    warnings.push('No physical device online (adb reports none)');
  }

  const result = {
    generatedAt: new Date().toISOString(),
    sdk,
    devices,
    avds,
    disk: {
      projectRoot: lib.PROJECT_ROOT,
      freeBytes,
      free: lib.formatBytes(freeBytes),
    },
    summary: {
      onlineDevices: onlineDevices.map((d) => d.serial),
      avdCount: avds.length,
      canRunOnPhysical: onlineDevices.length > 0,
      canRunOnEmulator: avds.length > 0,
    },
    warnings,
  };

  if (pretty) {
    console.log('Android SDK:', sdk.home);
    console.log('Platforms:', sdk.platforms.join(', ') || 'none');
    console.log('Build-tools:', sdk.buildTools.join(', ') || 'none');
    console.log('System images:', sdk.systemImages.join(', ') || 'none');
    console.log('\nDevices:');
    if (!devices.length) console.log('  (none)');
    for (const d of devices) {
      console.log(`  ${d.serial}  state=${d.state}  model=${d.model || '?'}`);
    }
    console.log('\nAVDs:');
    if (!avds.length) console.log('  (none)');
    for (const a of avds) {
      console.log(`  ${a.name}  api=${a.apiLevel ?? '?'}  abi=${a.abi || '?'}  size=${a.sizeGb ?? '?'} GB`);
    }
    console.log('\nDisk free:', result.disk.free);
    if (warnings.length) {
      console.log('\nWarnings:');
      warnings.forEach((w) => console.log('  - ' + w));
    }
  } else {
    lib.printJson(result);
  }
}

main();
