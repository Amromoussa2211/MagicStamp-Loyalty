/**
 * CI job summary for the soft-fail pipeline.
 *
 * Prints a small markdown table for $GITHUB_STEP_SUMMARY from
 * allure-results/*-result.json: total run, passed, failed, broken, skipped
 * and the names of failed/broken tests. The pipeline stays green in
 * SOFT_FAIL mode, so this summary is where the true verdict shows up.
 *
 * Usage: node scripts/allure-summary.js "Android E2E"   (prints markdown)
 */
const fs = require('fs');
const path = require('path');

const label = process.argv[2] || 'Tests';
const dir = path.join('allure-results');

function main() {
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => /^.*-result\.json$/.test(f));
  } catch {
    return console.log(`| ${label} | no allure-results directory found |`);
  }
  if (!files.length) return console.log(`| ${label} | no test results found |`);

  const counts = { passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0 };
  const failures = [];
  for (const f of files) {
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const status = (r.status || 'unknown').toLowerCase();
      counts[status] = (counts[status] || 0) + 1;
      if (status === 'failed' || status === 'broken') {
        const name = (r.name || r.fullName || f).toString().slice(0, 120);
        failures.push(name);
      }
    } catch {
      /* ignore unreadable result file */
    }
  }

  const total = files.length;
  const lines = [];
  lines.push(`| Suite | Status | Total | ✅ Passed | ❌ Failed/Broken | ⏭ Skipped |`);
  lines.push(`|---|---|---|---|---|---|`);
  lines.push(
    `| ${label} | ${failures.length ? `⚠️ ${failures.length} failing` : '✅ all passed'} | ${total} | ${counts.passed} | ${counts.failed + counts.broken} | ${counts.skipped} |`,
  );
  if (failures.length) {
    lines.push('');
    lines.push('<details><summary>Failing tests</summary>');
    lines.push('');
    failures.forEach((n) => lines.push(`- ❌ ${n}`));
    lines.push('');
    lines.push('</details>');
  }
  console.log(lines.join('\n') + '\n');
}

main();
