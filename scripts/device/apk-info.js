#!/usr/bin/env node
'use strict';

/**
 * Inspect APK files and extract their manifest metadata (read-only).
 *
 * Usage:
 *   node scripts/device/apk-info.js [apk ...] [--pretty]
 *
 * With no arguments, every *.apk under apks/ is inspected.
 *
 * Outputs JSON:
 *   { generatedAt, aapt, apks: [{ file, package, versionCode, ... }], warnings }
 */

const fs = require('fs');
const path = require('path');
const lib = require('./lib');

function parseBadging(text) {
  const info = {
    package: null,
    versionCode: null,
    versionName: null,
    applicationLabel: null,
    launchableActivity: null,
    minSdk: null,
    targetSdk: null,
    compileSdk: null,
    abis: [],
    permissions: [],
  };

  for (const line of String(text).split('\n')) {
    let m;
    if (line.startsWith('package:')) {
      m = line.match(/name='([^']+)'/);
      if (m) info.package = m[1];
      m = line.match(/versionCode='([^']+)'/);
      if (m) info.versionCode = parseInt(m[1], 10);
      m = line.match(/versionName='([^']+)'/);
      if (m) info.versionName = m[1];
      m = line.match(/compileSdkVersion='([^']+)'/);
      if (m) info.compileSdk = parseInt(m[1], 10);
    } else if (line.startsWith('sdkVersion:')) {
      m = line.match(/'([^']+)'/);
      if (m) info.minSdk = parseInt(m[1], 10);
    } else if (line.startsWith('targetSdkVersion:')) {
      m = line.match(/'([^']+)'/);
      if (m) info.targetSdk = parseInt(m[1], 10);
    } else if (line.startsWith('application-label:')) {
      m = line.match(/'([^']+)'/);
      if (m) info.applicationLabel = m[1];
    } else if (line.startsWith('launchable-activity:')) {
      m = line.match(/name='([^']+)'/);
      if (m) info.launchableActivity = m[1];
    } else if (line.startsWith('native-code:')) {
      info.abis = [...line.matchAll(/([a-z0-9_-]+)/g)].map((x) => x[1]).filter((a) => /^(arm|x86|mips)/.test(a));
    } else if (line.startsWith('uses-permission:')) {
      const name = (line.match(/name='([^']+)'/) || [])[1];
      const maxSdk = (line.match(/maxSdkVersion='([^']+)'/) || [])[1];
      if (name) info.permissions.push({ name, maxSdkVersion: maxSdk ? parseInt(maxSdk, 10) : null });
    }
  }

  return info;
}

function inspectApk(aapt, file) {
  const res = lib.run(aapt.path, ['dump', 'badging', file], { timeout: 60000 });
  const stat = fs.statSync(file);
  const base = {
    file: path.relative(lib.PROJECT_ROOT, file),
    absolutePath: file,
    sizeBytes: stat.size,
    size: lib.formatBytes(stat.size),
    modifiedAt: stat.mtime.toISOString(),
  };
  if (!res.ok) {
    return { ...base, error: res.stderr || res.stdout || 'aapt failed' };
  }
  return { ...base, ...parseBadging(res.stdout) };
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--pretty');
  const pretty = process.argv.includes('--pretty');

  const warnings = [];
  const aapt = lib.aaptBin();
  if (!aapt) {
    warnings.push('No aapt/aapt2 found in Android SDK build-tools. Install build-tools or use the Android Studio bundled one.');
  }

  let files = args.map((a) => path.resolve(a));
  if (!files.length) {
    const dir = path.join(lib.PROJECT_ROOT, 'apks');
    files = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.apk')).map((f) => path.join(dir, f))
      : [];
    if (!files.length) warnings.push('No APK files found in apks/');
  }

  const apks = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      warnings.push(`File not found: ${file}`);
      continue;
    }
    if (!aapt) {
      const stat = fs.statSync(file);
      apks.push({
        file: path.relative(lib.PROJECT_ROOT, file),
        absolutePath: file,
        sizeBytes: stat.size,
        size: lib.formatBytes(stat.size),
        error: 'aapt unavailable',
      });
      continue;
    }
    apks.push(inspectApk(aapt, file));
  }

  const result = {
    generatedAt: new Date().toISOString(),
    aapt: aapt ? { path: aapt.path, buildToolsVersion: aapt.buildToolsVersion } : null,
    apks,
    warnings,
  };

  if (pretty) {
    for (const apk of apks) {
      console.log(`\n${apk.file} (${apk.size})`);
      if (apk.error) {
        console.log('  ERROR:', apk.error);
        continue;
      }
      console.log(`  package:        ${apk.package}`);
      console.log(`  version:        ${apk.versionName} (code ${apk.versionCode})`);
      console.log(`  min / target:   ${apk.minSdk} / ${apk.targetSdk}`);
      console.log(`  abis:           ${apk.abis.join(', ') || 'none'}`);
      console.log(`  launchable:     ${apk.launchableActivity || '?'}`);
      console.log(`  permissions:    ${apk.permissions.length}`);
    }
    if (warnings.length) {
      console.log('\nWarnings:');
      warnings.forEach((w) => console.log('  - ' + w));
    }
  } else {
    lib.printJson(result);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseBadging, inspectApk };
