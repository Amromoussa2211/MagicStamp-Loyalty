const { test, expect } = require('../fixtures/web');
const { allure } = require('allure-playwright');
const {
  PORTAL_BASE_URL,
  validCredentials,
  performPortalLogin,
  waitForAuthenticatedPage,
} = require('../helpers/vendorSignin');

// PERFORMANCE — endpoints the web app calls, latency per call, and the
// bottleneck. Runs the real login + dashboard pages, collects:
//   - every API request (method, status, duration)
//   - page-load timing (navigation entry) per page
// Then asserts budgets and prints the slowest endpoints (the bottleneck).
const PAGES = ['overview', 'campaigns', 'stamp-card', 'rewards', 'outlets', 'magic-codes'];
const API_BUDGET_MS = 5000;   // no single API call should exceed this
const LOAD_BUDGET_MS = 10000; // no page should take longer to load

test.describe('Vendor Portal — Performance (API latency & bottleneck)', () => {
  test('dashboard pages meet latency budgets and expose the slowest endpoints', async ({ page }) => {
    const creds = validCredentials();
    test.skip(!creds, 'PORTAL_USERNAME / PORTAL_PASSWORD not set in .env');

    allure.label('layer', 'web');
    allure.label('feature', 'Vendor Performance');
    allure.label('suite', 'Performance — Dashboard');
    allure.label('severity', 'critical');

    const apiCalls = [];
    const failures = [];

    page.on('response', (res) => {
      const url = res.url();
      const req = res.request();
      const isApi = /auth0\.com|magicstamp-portal|parktechnology\.com/.test(url) &&
        !/\.(png|jpg|jpeg|svg|css|js|woff2?|ico)(\?|$)/.test(url);
      if (!isApi) return;
      try {
        const t = req.timing();
        apiCalls.push({
          method: req.method(),
          endpoint: url.replace(/\?.*/, '').slice(0, 110),
          status: res.status(),
          ms: Math.round(Math.max(0, t.responseEnd - t.startTime)),
        });
      } catch { /* timing not ready — ignore */ }
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      const err = req.failure()?.errorText || '';
      // Ignore static-asset noise: the S3 assets bucket requests get
      // ERR_BLOCKED_BY_ORB in Chromium (asset hosts, not API endpoints).
      if (/s3-eu-west-1|amazonaws/.test(url) || err === 'net::ERR_BLOCKED_BY_ORB') return;
      if (/parktechnology|auth0/.test(url)) {
        failures.push(`${req.method()} ${url.slice(0, 100)} :: ${err}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 500) failures.push(`${res.status()} ${res.url().slice(0, 100)}`);
    });

    const loginStart = Date.now();
    await allure.step('Login (timed)', async () => {
      await performPortalLogin(page, creds);
      await waitForAuthenticatedPage(page);
    });
    const loginMs = Date.now() - loginStart;

    const pageLoads = [];
    const resourceTimings = [];
    for (const p of PAGES) {
      await allure.step(`Load /${p} (timed)`, async () => {
        await page.goto(`${PORTAL_BASE_URL}/${p}`, { waitUntil: 'networkidle', timeout: 60000 })
          .catch(() => page.waitForTimeout(2000)); // fallback if networkidle never settles

        const nav = await page.evaluate(() => {
          const n = performance.getEntriesByType('navigation')[0];
          return n ? Math.round(n.loadEventEnd || n.domContentLoadedEventEnd) : 0;
        }).catch(() => 0);
        pageLoads.push({ page: p, loadMs: nav });

        const entries = await page.evaluate(() =>
          performance.getEntriesByType('resource')
            .filter((e) => /parktechnology|auth0/.test(e.name) && !/\.(png|jpg|svg|css|js|woff2?|ico)/.test(e.name))
            .map((e) => ({ endpoint: e.name.replace(/\?.*/, '').slice(0, 110), ms: Math.round(e.duration) }))
        ).catch(() => []);
        resourceTimings.push(...entries);
      });
    }

    await allure.step('Report: bottleneck endpoints + budgets', async () => {
      // Merge live-captured calls and resource timings, aggregate per endpoint.
      const all = [...apiCalls.map(c => ({ endpoint: c.endpoint, ms: c.ms, status: c.status })), ...resourceTimings.map(r => ({ ...r, status: 200 }))];
      const byEndpoint = {};
      all.forEach((c) => {
        (byEndpoint[c.endpoint] ||= { count: 0, totalMs: 0, maxMs: 0, statuses: new Set() });
        byEndpoint[c.endpoint].count++;
        byEndpoint[c.endpoint].totalMs += c.ms;
        byEndpoint[c.endpoint].maxMs = Math.max(byEndpoint[c.endpoint].maxMs, c.ms);
        byEndpoint[c.endpoint].statuses.add(c.status);
      });

      const ranked = Object.entries(byEndpoint)
        .map(([endpoint, s]) => ({ endpoint, count: s.count, avgMs: Math.round(s.totalMs / s.count), maxMs: s.maxMs, statuses: [...s.statuses].join(',') }))
        .sort((a, b) => b.maxMs - a.maxMs);

      console.log(`\n⏱ Login total: ${(loginMs / 1000).toFixed(1)}s`);
      console.log('⏱ Page loads:', pageLoads.map((p) => `${p.page}=${(p.loadMs / 1000).toFixed(1)}s`).join(' | '));
      console.log('\n🚦 TOP 10 slowest endpoints (bottlenecks):');
      ranked.slice(0, 10).forEach((r, i) => console.log(`  ${i + 1}. [${r.statuses}] ${r.endpoint} — avg ${r.avgMs}ms / max ${r.maxMs}ms (x${r.count})`));

      await allure.attachment(
        'api-latency-report.json',
        Buffer.from(JSON.stringify({ loginMs, pageLoads, ranked }, null, 2)),
        'application/json'
      );

      // Budgets
      expect(failures, `API failures/5xx: ${failures.join(' | ')}`).toHaveLength(0);
      expect(loginMs, `login took ${loginMs}ms`).toBeLessThan(120000);
      ranked.forEach((r) => expect(r.maxMs, `${r.endpoint} max latency ${r.maxMs}ms`).toBeLessThan(API_BUDGET_MS));
      pageLoads.forEach((p) => expect(p.loadMs, `${p.page} loaded in ${p.loadMs}ms`).toBeLessThan(LOAD_BUDGET_MS));
    });
  });
});
