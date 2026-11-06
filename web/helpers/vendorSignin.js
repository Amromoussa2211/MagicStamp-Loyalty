/**
 * Helpers for the Magic Stamp Vendor Portal sign-in suite (web/Playwright).
 *
 * Architecture (verified against the live portal):
 *   - https://<portal>/signin is a React SPA page with a single "Log in"
 *     button (`.login-page` / `.login-button`).
 *   - Clicking it redirects to the tenant's Auth0 hosted page, which renders
 *     the classic Auth0 Lock widget IN THE MAIN FRAME with a COMBINED form:
 *       email    → input[name="username"]   (placeholder "yours@example.com")
 *       password → input[name="password"]   (placeholder "your password")
 *       submit   → button "Log In"          (.auth0-lock-submit)
 *     plus a Google button, Log In / Sign Up tabs and a forgot-password link.
 *   - After success the browser is redirected back to the portal authenticated.
 *
 * Credentials live ONLY in .env (git-ignored). When PORTAL_USERNAME /
 * PORTAL_PASSWORD are not set, credential-dependent tests skip themselves
 * and negative tests (fake data) still run.
 */
require('dotenv').config();

const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'https://vendor-portal-sa.parktechnology.com';
const SIGNIN_URL = `${PORTAL_BASE_URL}/signin`;
const AUTH0_URL_MATCH = /auth0\.com/;

// Auth0 Lock selectors (main frame), with newer-UL fallbacks just in case the
// tenant later switches its hosted page flavour.
const EMAIL_INPUT = '.auth0-lock-input-email input, input[name="username"], #username';
const PASSWORD_INPUT = 'input[name="password"], #password, .auth0-lock-input-password input';
const SUBMIT_BUTTON = '.auth0-lock-submit, button[type="submit"], #login-submit';
const LOCK_ERROR = '.auth0-lock-error-msg, .auth0-lock-global-error, .auth0-lock-error, [data-testid="error-message"], #error-element-password, #error-element-username';

/** Valid credentials from .env, or null when absent (→ tests should skip). */
function validCredentials() {
  const email = process.env.PORTAL_USERNAME;
  const password = process.env.PORTAL_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

/** Open the portal sign-in page and confirm its Log in button rendered. */
async function openSignin(page) {
  const gotoSignIn = () =>
    page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // The portal occasionally stalls the first navigation (observed
  // intermittently) — one retry covers that without masking real outages.
  await gotoSignIn().catch(() => gotoSignIn());
  await page.locator('.login-page .login-button').waitFor({ state: 'visible', timeout: 20000 });
}

/** The portal "Log in" button (redirects to Auth0). */
async function clickPortalLoginButton(page) {
  await page.locator('.login-page .login-button').click();
}

/**
 * Click the identity provider's primary submit button (defensive selector).
 */
async function clickAuth0Submit(page) {
  await page.locator(SUBMIT_BUTTON).first().click();
}

/**
 * Fill the Auth0 Lock login form (combined layout; identifier-first fallback).
 */
async function fillAuth0LoginForm(page, { email, password }) {
  const username = page.locator(EMAIL_INPUT).first();
  await username.waitFor({ state: 'visible', timeout: 30000 });
  await username.fill(email);

  const passwordField = page.locator(PASSWORD_INPUT).first();
  if (!(await passwordField.isVisible().catch(() => false))) {
    // Identifier-first flavour: submit the email, then wait for password step.
    await clickAuth0Submit(page);
    await passwordField.waitFor({ state: 'visible', timeout: 30000 });
  }
  await passwordField.fill(password);
  await clickAuth0Submit(page);
}

/**
 * True once the browser is on the portal, past the /signin page, past the
 * OAuth redirect (`?code=...` "Signing you in…" spinner) — i.e. a real
 * authenticated portal URL.
 */
function isOnAuthenticatedPortal(url) {
  const s = String(url);
  return (
    !AUTH0_URL_MATCH.test(s) &&
    !s.includes('/signin') &&
    !s.includes('code=') &&
    !s.includes('state=')
  );
}

/**
 * Wait until the portal actually renders its authenticated shell. The SPA
 * spends a while on a "Signing you in…" spinner while exchanging the OAuth
 * code and loading accounts, so a URL check alone gives false positives.
 */
async function waitForAuthenticatedPage(page, timeout = 120000) {
  await page.waitForURL(isOnAuthenticatedPortal, { timeout });
  // Wait for the authenticated shell: the app dashboard/nav is rendered.
  await page
    .getByText(/overview|logout|regards, /i)
    .first()
    .waitFor({ state: 'visible', timeout: 60000 });
}

/**
 * Full happy-path login: portal → Auth0 → back to the portal authenticated.
 * Throws if any leg fails (so tests can assert on it independently).
 */
async function performPortalLogin(page, creds) {
  await openSignin(page);
  await clickPortalLoginButton(page);
  // The Lock widget may render on the Auth0 hosted page OR directly on a
  // tenant/custom-domain URL that doesn't contain "auth0.com" — so we treat
  // the URL wait as best-effort and rely on the form selector below, which is
  // what actually proves the login page is ready.
  await page.waitForURL(AUTH0_URL_MATCH, { timeout: 30000 }).catch(() => {});
  await fillAuth0LoginForm(page, creds);
  await waitForAuthenticatedPage(page);
}

/** Any error element visible on the Auth0 Lock login page. */
async function auth0HasError(page) {
  const errors = page.locator(LOCK_ERROR);
  if (await errors.first().isVisible().catch(() => false)) return true;
  // Last resort: Lock sometimes renders the message as plain text.
  return page
    .getByText(/wrong|invalid|incorrect|couldn'?t|not valid|error/i)
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * Wait for an error to show on the Auth0 Lock page. The Lock widget renders
 * the error as a plain <span> with NO class, and it only appears after the
 * auth round-trip, so this must poll (visible-within-timeout instead of an
 * instant isVisible check).
 */
async function waitForAuth0Error(page, timeout = 20000) {
  try {
    await page
      .locator('.auth0-lock-error-msg, .auth0-lock-global-error, .auth0-lock-error')
      .or(page.getByText(/wrong email|wrong|invalid|couldn'?t|not valid|failed|error/i).first())
      .first()
      .waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  PORTAL_BASE_URL,
  SIGNIN_URL,
  AUTH0_URL_MATCH,
  EMAIL_INPUT,
  PASSWORD_INPUT,
  SUBMIT_BUTTON,
  LOCK_ERROR,
  validCredentials,
  openSignin,
  clickPortalLoginButton,
  clickAuth0Submit,
  fillAuth0LoginForm,
  isOnAuthenticatedPortal,
  performPortalLogin,
  waitForAuthenticatedPage,
  auth0HasError,
  waitForAuth0Error,
};
