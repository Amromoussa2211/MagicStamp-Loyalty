'use strict';

/**
 * Shared helpers for the Mobile Device & Execution tooling.
 * Read-only by default: wraps adb / emulator / aapt with no mutations.
 */

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** Resolve the Android SDK home from env, falling back to the macOS default. */
function sdkHome() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || candidates[candidates.length - 1];
}

/** Absolute path for a platform tool, falling back to PATH lookup by name. */
function toolPath(name) {
  const home = sdkHome();
  const rel = name === 'adb' ? ['platform-tools', 'adb'] : ['emulator', 'emulator'];
  const abs = path.join(home, ...rel);
  return fs.existsSync(abs) ? abs : name;
}

/** Run a binary, capturing output. Never throws. */
function run(file, args = [], opts = {}) {
  const timeout = opts.timeout || 20000;
  try {
    const stdout = childProcess.execFileSync(file, args, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
    return { ok: true, status: 0, stdout: (stdout || '').trim(), stderr: '' };
  } catch (e) {
    return {
      ok: false,
      status: typeof e.status === 'number' ? e.status : -1,
      stdout: (e.stdout || '').toString().trim(),
      stderr: (e.stderr || '').toString().trim(),
    };
  }
}

/** Run a shell one-liner (for `cmd | head` style checks). Never throws. */
function runShell(cmd, timeout = 20000) {
  try {
    const out = childProcess.execFileSync('/bin/sh', ['-c', cmd], {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return (out || '').trim();
  } catch (e) {
    return `${(e.stdout || '').toString()}\n${(e.stderr || '').toString()}`.trim();
  }
}

/** Numeric compare for dotted version dirs (34.0.0 > 33.0.1). */
function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** List subdirectories of a directory, newest version first when numeric. */
function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(compareVersions)
    .reverse();
}

/** Locate the newest aapt/aapt2 binary available in build-tools. */
function aaptBin() {
  const buildTools = path.join(sdkHome(), 'build-tools');
  for (const version of listDirs(buildTools)) {
    for (const name of ['aapt', 'aapt2']) {
      const candidate = path.join(buildTools, version, name);
      if (fs.existsSync(candidate)) return { path: candidate, name, buildToolsVersion: version };
    }
  }
  return null;
}

/** Parse `adb devices -l` output into structured entries. */
function parseAdbDevices(stdout) {
  return String(stdout)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices') && !line.startsWith('*'))
    .map((line) => {
      const parts = line.split(/\s+/);
      const serial = parts[0];
      const state = parts[1];
      const attrs = {};
      for (const token of parts.slice(2)) {
        const idx = token.indexOf(':');
        if (idx > 0) attrs[token.slice(0, idx)] = token.slice(idx + 1);
      }
      return {
        serial,
        state,
        model: attrs.model || null,
        product: attrs.product || null,
        device: attrs.device || null,
        transportId: attrs.transport_id || null,
      };
    });
}

/** Parse an AVD config.ini into a flat key/value map. */
function parseIni(text) {
  const out = {};
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const idx = line.indexOf('=');
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

/** Read an AVD definition (config.ini + disk size) without modifying it. */
function avdInfo(name) {
  const iniPath = path.join(os.homedir(), '.android', 'avd', `${name}.ini`);
  let avdDir = path.join(os.homedir(), '.android', 'avd', `${name}.avd`);
  if (fs.existsSync(iniPath)) {
    const ini = parseIni(fs.readFileSync(iniPath, 'utf8'));
    if (ini.path) avdDir = ini.path;
  }
  const configPath = path.join(avdDir, 'config.ini');
  if (!fs.existsSync(configPath)) {
    return { name, error: 'config.ini not found', directory: avdDir };
  }
  const config = parseIni(fs.readFileSync(configPath, 'utf8'));
  const sysdir = config['image.sysdir.1'] || config['image.sysdir.2'] || '';
  const apiMatch = sysdir.match(/android-(\d+)/);
  const abi = config['abi.type'] || config['hw.cpu.arch'] || null;
  const size = run('du', ['-sk', avdDir], { timeout: 15000 });
  return {
    name,
    directory: avdDir,
    apiLevel: apiMatch ? parseInt(apiMatch[1], 10) : null,
    abi,
    tag: config['tag.id'] || null,
    target: config.target || null,
    device: config['hw.device.name'] || null,
    playStore: config['PlayStore.enabled'] === 'true',
    gpuMode: config['hw.gpu.mode'] || null,
    sizeGb: size.ok && size.stdout ? Math.round((parseInt(size.stdout, 10) / 1024 / 1024) * 10) / 10 : null,
  };
}

/** All AVDs known to the emulator binary. */
function listAvds() {
  const emulator = toolPath('emulator');
  const res = run(emulator, ['-list-avds']);
  const names = res.ok ? res.stdout.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  return names.map(avdInfo);
}

/** Free bytes on the filesystem containing a path. */
function diskFreeBytes(targetPath = PROJECT_ROOT) {
  const res = run('df', ['-k', targetPath]);
  if (!res.ok) return null;
  const line = res.stdout.split('\n').filter(Boolean).pop() || '';
  const parts = line.trim().split(/\s+/);
  const availKb = parseInt(parts[3], 10);
  return Number.isFinite(availKb) ? availKb * 1024 : null;
}

/** Human-readable byte count. */
function formatBytes(bytes) {
  if (bytes == null) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** Print JSON to stdout (the machine-readable contract). */
function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

module.exports = {
  PROJECT_ROOT,
  sdkHome,
  toolPath,
  run,
  runShell,
  compareVersions,
  listDirs,
  aaptBin,
  parseAdbDevices,
  avdInfo,
  listAvds,
  diskFreeBytes,
  formatBytes,
  printJson,
};
