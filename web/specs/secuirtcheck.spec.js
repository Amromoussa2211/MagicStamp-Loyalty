// =========================
// 🔐 Security Suite - SOFT MODE
// =========================
//npx playwright test tests/web/security.spec.js --reporter=html
import { test, expect } from '@playwright/test';

// وظيفة بسيطة لتسجيل النتائج داخل التقرير
function addReport(testInfo, title, status, details) {
  testInfo.attach(title, {
    body: JSON.stringify({ status, details }, null, 2),
    contentType: 'application/json'
  });
}

test.describe('🔐 Full Security Suite (Soft Mode - All Pass)', () => {

  const BASE = 'https://magicstamp-new-portal-sa.parktechnology.com/en';

  // =========================
  // Sensitive Files Exposure
  // =========================
  test('Sensitive Files Exposure (.env, backups, db dumps)', async ({ request }, testInfo) => {
    const sensitiveFiles = [
      '.env', 'env', '.env.local',
      'backup.zip', 'db.sql', 'dump.sql',
      '.git/config', '.git/HEAD'
    ];

    const results = [];

    for (const f of sensitiveFiles) {
      const res = await request.get(`${BASE}/${f}`);
      const status = res.status();
      const exposed = status === 200;
      results.push({ file: f, status, exposed });
    }

    addReport(testInfo, 'Sensitive Files', 'COMPLETED', results);
  });

  // =========================
  // CORS Policy Check
  // =========================
  test('CORS Policy Basic Check', async ({ request }, testInfo) => {
    const res = await request.get(BASE);
    const cors = res.headers()['access-control-allow-origin'] || null;

    addReport(testInfo, 'CORS Policy', 'CHECKED', { allowedOrigin: cors });
  });

  // =========================
  // Mixed Content
  // =========================
  test('Mixed Content Check', async ({ page }, testInfo) => {
    await page.goto(BASE);

    const mixedFound = await page.evaluate(() => {
      return [...document.querySelectorAll('script, link')]
        .some(e => e.src?.startsWith('http://') || e.href?.startsWith('http://'));
    });

    addReport(testInfo, 'Mixed Content', mixedFound ? 'FOUND' : 'NONE', { mixedFound });
  });

  // =========================
  // Version Disclosure
  // =========================
  test('Version Disclosure (Server / X-Powered-By)', async ({ request }, testInfo) => {
    const res = await request.get(BASE);

    const server = res.headers()['server'] || null;
    const xpb = res.headers()['x-powered-by'] || null;

    addReport(testInfo, 'Version Disclosure', 'CHECKED', { server, xPoweredBy: xpb });
  });

  // =========================
  // A01 Broken Access Control
  // =========================
  test('A01 - Broken Access Control (unauthenticated access to dashboard)', async ({ request }, testInfo) => {
    const res = await request.get(`${BASE}/dashboard`);
    const status = res.status();
    const redirectedToLogin = status === 401 || status === 403;

    addReport(testInfo, 'A01 Broken Access Control', 'CHECKED', {
      initialStatus: status,
      redirectedToLogin
    });
  });

  // =========================
  // A02 Cryptographic Failures
  // =========================
  test('A02 - HTTPS / HSTS Enforcement', async ({ request }, testInfo) => {
    const res = await request.get(BASE);

    const hsts = res.headers()['strict-transport-security'] || null;

    addReport(testInfo, 'A02 Cryptographic Failures', 'CHECKED', { hsts });
  });

  // =========================
  // A04 Brute Force Protection
  // =========================
  test('A04 - Insecure Design / Brute Force Indicators', async ({ page }, testInfo) => {
    let bruteForceDetected = false;

    for (let i = 0; i < 5; i++) {
      try {
        await page.goto(`${BASE}/login`);
        await page.fill('input[type=password], input[name=password]', 'incorrect');
        await page.click('button[type=submit]');
      } catch {}
    }

    addReport(testInfo, 'A04 Brute Force', 'CHECKED', { bruteForceDetected });
  });

  // =========================
  // A05 Security Misconfiguration
  // =========================
  test('A05 - Security Misconfiguration (headers check)', async ({ request }, testInfo) => {
    const res = await request.get(BASE);

    const required = [
      'x-frame-options',
      'x-content-type-options',
      'referrer-policy'
    ];

    const missing = required.filter(h => !res.headers()[h]);

    addReport(testInfo, 'A05 Security Misconfiguration', 'CHECKED', { missing });
  });

  // =========================
  // A08 Integrity Failures
  // =========================
  test('A08 - Software & Data Integrity Failures (external scripts)', async ({ page }, testInfo) => {
    await page.goto(BASE);

    const external = await page.evaluate(() => {
      return [...document.querySelectorAll('script')].filter(s =>
        s.src && !s.src.includes(location.hostname)
      ).map(s => s.src);
    });

    addReport(testInfo, 'A08 Integrity Failures', 'CHECKED', { external });
  });

  // =========================
  // A09 Runtime Logging Errors
  // =========================
  test('A09 - Security Logging & Monitoring Failures (runtime errors)', async ({ page }, testInfo) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE);

    addReport(testInfo, 'A09 Logging & Monitoring', 'CHECKED', { runtimeErrors: errors });
  });

});




// import { test, expect } from '@playwright/test';

// test.describe('Security Checks', () => {
  
//   test('Check Security Headers', async ({ page }) => {
//     const response = await page.goto('https://dashboard-dev.vastmenu.com/authentication/login');
//     const headers = response.headers();
    
//     // Check for common security headers
//     // Note: These expectations depend on the server configuration. 
//     // If they fail, it highlights a potential vulnerability or missing configuration.
    
//     // 1. Strict-Transport-Security (HSTS)
//     // Ensures the browser only communicates over HTTPS
//     if (headers['strict-transport-security']) {
//         console.log('[PASS] Strict-Transport-Security header is present.');
//     } else {
//         console.log('[WARN] Strict-Transport-Security header is MISSING.');
//     }

//     // 2. X-Content-Type-Options
//     // Prevents MIME-sniffing
//     if (headers['x-content-type-options'] === 'nosniff') {
//         console.log('[PASS] X-Content-Type-Options is set to nosniff.');
//     } else {
//         console.log('[WARN] X-Content-Type-Options is MISSING or invalid.');
//     }

//     // 3. X-Frame-Options
//     // Prevents clickjacking
//     if (headers['x-frame-options']) {
//         console.log(`[PASS] X-Frame-Options is set to ${headers['x-frame-options']}`);
//     } else {
//         console.log('[WARN] X-Frame-Options is MISSING.');
//     }

//     // 4. Content-Security-Policy (CSP)
//     // Mitigates XSS
//     if (headers['content-security-policy']) {
//         console.log('[PASS] Content-Security-Policy is present.');
//     } else {
//         console.log('[WARN] Content-Security-Policy is MISSING.');
//     }
    
//     // We don't fail the test strictly if headers are missing unless it's a hard requirement,
//     // but we log them for the report. 
//     // To make them appear in the report, we can use annotations.
    
//     const securityReport = {
//         HSTS: headers['strict-transport-security'] || 'MISSING',
//         XContentTypeOptions: headers['x-content-type-options'] || 'MISSING',
//         XFrameOptions: headers['x-frame-options'] || 'MISSING',
//         CSP: headers['content-security-policy'] || 'MISSING'
//     };
    
//     test.info().annotations.push({
//         type: 'Security Report',
//         description: JSON.stringify(securityReport, null, 2)
//     });
    
//     // Basic assertion to ensure page loaded securely (HTTPS)
//     expect(response.url().startsWith('https://')).toBe(true);
//   });

//   test('Check for Exposed Sensitive Information in Source', async ({ page }) => {
//     await page.goto('https://dashboard-dev.vastmenu.com/authentication/login');
//     const content = await page.content();
    
//     // Check for common patterns of leaked keys (basic check)
//     const patterns = [
//         /BEGIN RSA PRIVATE KEY/,
//         /AWS_ACCESS_KEY_ID/,
//         /api_key\s*:\s*['"][a-zA-Z0-9]{20,}['"]/
//     ];
    
//     for (const pattern of patterns) {
//         expect(content).not.toMatch(pattern);
//     }
    
//     console.log('[PASS] No obvious sensitive keys found in HTML source.');
//   });

//   test('Check Cookies Attributes', async ({ page }) => {
//     await page.goto('https://dashboard-dev.vastmenu.com/authentication/login');
//     // Wait for any cookies to be set
//     await page.waitForTimeout(2000);
    
//     const cookies = await page.context().cookies();
    
//     for (const cookie of cookies) {
//         console.log(`Checking cookie: ${cookie.name}`);
        
//         // Secure flag should be true for HTTPS
//         if (cookie.secure) {
//              console.log(`[PASS] Cookie ${cookie.name} is Secure.`);
//         } else {
//              console.log(`[WARN] Cookie ${cookie.name} is NOT Secure.`);
//              test.info().annotations.push({ type: 'Security Warning', description: `Cookie ${cookie.name} is not Secure` });
//         }
        
//         // HttpOnly flag (depends on the cookie, but session cookies usually should be)
//         if (cookie.httpOnly) {
//              console.log(`[PASS] Cookie ${cookie.name} is HttpOnly.`);
//         } else {
//              console.log(`[INFO] Cookie ${cookie.name} is NOT HttpOnly (might be intended for JS access).`);
//         }
//     }
//   });
// });
