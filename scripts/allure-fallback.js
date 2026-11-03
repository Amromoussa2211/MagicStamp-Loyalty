#!/usr/bin/env node
/**
 * Allure watchdog — guarantees the combined report is an honest picture of the run.
 *
 * Scenario: the mobile WDIO suite fails at SESSION level (no device connected,
 * Appium unavailable, capability error). In that case no test ever starts and
 * @wdio/allure-reporter writes NO results at all — the suite silently vanishes
 * from the combined report even though it ran and failed.
 *
 * This script scans allure-results/ and, if ZERO mobile results exist, writes
 * one synthetic FAILED Allure result per spec file so the report clearly shows:
 *   "Mobile suite did not execute — <reason>"
 *
 * Web (Playwright) results are detected via their `framework: Playwright`
 * label and are never affected. Mobile results that did run are never touched.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const RESULTS = path.join(ROOT, 'allure-results');
const SPECS_DIR = path.join(ROOT, 'test', 'specs');

function initResultsDir() {
  if (!fs.existsSync(RESULTS)) fs.mkdirSync(RESULTS, { recursive: true });
}

function readAllResults() {
  try {
    return fs
      .readdirSync(RESULTS)
      .filter((f) => f.endsWith('-result.json'))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(RESULTS, f), 'utf8'));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isMobileResult(r) {
  const labels = r.labels || [];
  const framework = (labels.find((l) => l.name === 'framework') || {}).value || '';
  return framework !== 'Playwright';
}

function writeResult(result) {
  const file = path.join(RESULTS, `${result.uuid}-result.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
}

function main() {
  initResultsDir();

  const all = readAllResults();
  const mobileResults = all.filter(isMobileResult);
  const webResults = all.length - mobileResults.length;

  if (mobileResults.length > 0) {
    console.log(
      `✅ allure-fallback: ${mobileResults.length} mobile result(s) found` +
        (webResults ? ` (+${webResults} web). Nothing to do.` : '. Nothing to do.')
    );
    return;
  }

  const specs = fs
    .readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith('.spec.js'))
    .sort();

  if (specs.length === 0) {
    console.log('⚠️ allure-fallback: no spec files found — nothing to write.');
    return;
  }

  const now = Date.now();
  let written = 0;

  for (const spec of specs) {
    const name = spec.replace('.spec.js', '');
    const fullName = path.join('test', 'specs', spec);
    const uuid = crypto.randomUUID();
    const historyId = crypto
      .createHash('sha256')
      .update(fullName)
      .digest('hex')
      .slice(0, 32);

    writeResult({
      uuid,
      historyId,
      testCaseId: historyId,
      name: `${name} — MOBILE SUITE DID NOT EXECUTE`,
      fullName,
      status: 'failed',
      statusDetails: {
        message:
          'No mobile Allure results were produced for this spec. ' +
          'The WDIO session most likely failed before any test started ' +
          '(device not connected, Appium unavailable, or capability error). ' +
          'Check ci/local runner logs and `adb devices`.',
        trace:
          'Infrastructure-level failure injected by scripts/allure-fallback.js ' +
          'so the suite cannot silently disappear from the report.',
      },
      stage: 'finished',
      start: now,
      stop: now,
      labels: [
        { name: 'layer', value: 'mobile' },
        { name: 'framework', value: 'WebdriverIO' },
        { name: 'host', value: 'runner' },
        { name: 'severity', value: 'blocker' },
        { name: 'status', value: 'infrastructure-failure' },
      ],
      links: [],
      attachments: [],
      parameters: [],
      steps: [],
    });
    written++;
  }

  console.log(
    `🚨 allure-fallback: mobile suite produced NO results — wrote ${written} ` +
      `synthetic failed result(s) so the report reflects the failure.`
  );
}

main();
