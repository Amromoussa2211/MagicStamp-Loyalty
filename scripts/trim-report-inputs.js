/**
 * Trim heavy attachments from an allure-results directory before report
 * generation. Currently removes ONLY the `trace` attachments (Playwright
 * trace.zip) — they measured ~101 MB of a ~151 MB single-file report.
 * Screenshots, error-contexts and every other evidence type are kept.
 *
 * Run in the generate-report job only, on the MERGED copy downloaded from
 * artifacts — the raw `allure-results-*` artifacts are NOT touched, so traces
 * remain downloadable for debugging.
 *
 * Usage: node scripts/trim-report-inputs.js [resultsDir=allure-results]
 * Skip with: TRIM=0 node scripts/trim-report-inputs.js
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'allure-results';
const isHeavy = (att) =>
  att && att.source && String(att.source).endsWith('.zip') &&
  String(att.name || '').toLowerCase().includes('trace');

function stripHeavy(obj, victims) {
  if (Array.isArray(obj)) {
    return obj.filter((item) => {
      if (isHeavy(item)) { victims.push(item.source); return false; }
      stripHeavy(item, victims);
      return true;
    });
  }
  if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (Array.isArray(child) && child.some(isHeavy)) {
        obj[key] = child.filter((item) => {
          if (isHeavy(item)) { victims.push(item.source); return false; }
          stripHeavy(item, victims);
          return true;
        });
      } else {
        stripHeavy(child, victims);
      }
    }
  }
  return obj;
}

if (process.env.TRIM === '0') {
  console.log('trim-report-inputs: TRIM=0 — skipping, results left untouched');
} else {
  const victims = []; // basename of removed trace zips
  let jsonsUpdated = 0;

  for (const file of fs.readdirSync(dir)) {
    if (!/-(result|container)\.json$/.test(file)) continue;
    const full = path.join(dir, file);
    let json;
    try { json = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { continue; }
    const before = victims.length;
    stripHeavy(json, victims);
    if (victims.length > before) {
      fs.writeFileSync(full, JSON.stringify(json));
      jsonsUpdated += 1;
    }
  }

  let removed = 0;
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.zip') && victims.includes(file)) {
      fs.unlinkSync(path.join(dir, file));
      removed += 1;
    }
  }

  console.log(
    `trim-report-inputs: removed ${removed} trace.zip attachment(s) ` +
    `(${jsonsUpdated} result/container jsons updated). ` +
    `Screenshots & other evidence untouched; traces remain available in the raw allure-results-* artifacts.`,
  );
}
