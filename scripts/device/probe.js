#!/usr/bin/env node
'use strict';

/**
 * Capture the current screen of the running app for agent-driven exploration.
 *
 * Saves a numbered step into reports/explore-<ts>/:
 *   step-N.png       screenshot
 *   step-N.xml       raw UI hierarchy
 *   step-N.json      parsed elements (text, id, class, clickable, center)
 *   crashes.log      crash-buffer tail (appended)
 *   explore.json     running index
 *
 * Read-only towards the app: it does NOT tap or change state.
 *
 * Usage:
 *   node scripts/device/probe.js [--serial <udid>] [--label <name>]
 */

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const lib = require('./lib');

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  return idx > -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function adb(serial, args, timeout = 20000) {
  return lib.run(lib.toolPath('adb'), ['-s', serial, ...args], { timeout });
}

function pickSerial(explicit) {
  if (explicit) return explicit;
  const online = lib.parseAdbDevices(lib.run(lib.toolPath('adb'), ['devices']).stdout).filter(
    (d) => d.state === 'device'
  );
  return online.length === 1 ? online[0].serial : null;
}

/** Parse Android's uiautomator XML with a minimal attribute reader. */
function parseHierarchy(xml) {
  const nodes = [];
  const re = /<node\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = {};
    const attrRe = /([\w-]+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(m[1]))) attrs[a[1]] = a[2];
    const bounds = (attrs.bounds || '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!bounds) continue;
    const [x1, y1, x2, y2] = bounds.slice(1).map(Number);
    const text = attrs.text || '';
    const id = attrs['resource-id'] || '';
    const desc = attrs['content-desc'] || '';
    if (!text && !id && !desc) continue;
    nodes.push({
      text,
      id,
      desc,
      class: attrs.class || '',
      clickable: attrs.clickable === 'true',
      enabled: attrs.enabled === 'true',
      bounds: { x1, y1, x2, y2 },
      center: { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) },
      scrollable: attrs.scrollable === 'true',
    });
  }
  return nodes;
}

function main() {
  const serial = pickSerial(argValue('--serial', null));
  const label = argValue('--label', '');

  if (!serial) {
    lib.printJson({ error: 'No single online device found. Use --serial or connect a device.' });
    process.exitCode = 2;
    return;
  }

  const adbBin = lib.toolPath('adb');
  const base = path.join(lib.PROJECT_ROOT, 'reports');
  fs.mkdirSync(base, { recursive: true });

  // Reuse the newest explore dir for this run, so steps accumulate.
  let dir = null;
  if (fs.existsSync(base)) {
    const runs = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('explore-'))
      .map((e) => path.join(base, e.name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    dir = runs[0] || null;
  }
  if (!dir) dir = fs.mkdirSync(path.join(base, `explore-${new Date().toISOString().replace(/[:.]/g, '-')}`), { recursive: true });

  const statePath = path.join(dir, 'explore.json');
  const state = fs.existsSync(statePath)
    ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
    : { createdAt: new Date().toISOString(), device: serial, steps: [] };
  const step = state.steps.length + 1;
  const prefix = path.join(dir, `step-${step}`);

  // 1. UI hierarchy
  adb(serial, ['shell', 'uiautomator', 'dump', '/sdcard/window_dump.xml'], 30000);
  const xmlRes = adb(serial, ['exec-out', 'cat', '/sdcard/window_dump.xml'], 30000);
  const xml = xmlRes.ok ? xmlRes.stdout : '';
  fs.writeFileSync(`${prefix}.xml`, xml);
  const nodes = xml ? parseHierarchy(xml) : [];

  // 2. Screenshot
  let screenshot = null;
  try {
    const png = childProcess.execFileSync(adbBin, ['-s', serial, 'exec-out', 'screencap', '-p'], {
      timeout: 20000,
      maxBuffer: 64 * 1024 * 1024,
    });
    fs.writeFileSync(`${prefix}.png`, png);
    screenshot = path.relative(lib.PROJECT_ROOT, `${prefix}.png`);
  } catch (e) {
    /* keep going: hierarchy is still useful */
  }

  // 3. Crash buffer (appended, deduped by line)
  const crashes = adb(serial, ['logcat', '-d', '-b', 'crash'], 15000);
  const crashLines = crashes.ok ? crashes.stdout.split('\n').filter(Boolean) : [];
  const crashPath = path.join(dir, 'crashes.log');
  if (crashLines.length) {
    const previous = fs.existsSync(crashPath) ? fs.readFileSync(crashPath, 'utf8').split('\n') : [];
    const fresh = crashLines.filter((l) => !previous.includes(l));
    if (fresh.length) fs.appendFileSync(crashPath, fresh.join('\n') + '\n');
  }

  // 4. Foreground activity
  const top = adb(serial, ['shell', 'dumpsys', 'window', 'windows'], 15000);
  const focus = (top.stdout.match(/mCurrentFocus=([^\n]+)/) || [])[1] || null;

  const summary = {
    step,
    timestamp: new Date().toISOString(),
    label: label || null,
    device: serial,
    screenshot,
    screenshotAbs: `${prefix}.png`,
    xml: path.relative(lib.PROJECT_ROOT, `${prefix}.xml`),
    foreground: focus,
    elementCount: nodes.length,
    elements: nodes.slice(0, 60),
    crashesInBuffer: crashLines.length,
  };

  fs.writeFileSync(`${prefix}.json`, JSON.stringify(summary, null, 2) + '\n');
  state.steps.push({
    step,
    label: label || null,
    screenshot: summary.screenshot,
    foreground: focus,
    elements: nodes.length,
    crashes: crashLines.length,
  });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  lib.printJson({
    reportDir: path.relative(lib.PROJECT_ROOT, dir),
    step,
    screenshot: summary.screenshot,
    foreground: focus,
    crashes: crashLines.length,
    clickable: nodes.filter((n) => n.clickable).slice(0, 20),
    texts: [...new Set(nodes.map((n) => n.text).filter(Boolean))].slice(0, 40),
  });
}

main();
