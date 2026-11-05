// Mobile session helpers — shared by all mobile specs.
//
// Flow verified on-device (Nov 2026):
//   cold launch → permissions onboarding ("Allow access" + Continue)
//   → no session: login (country code + phone) → OTP (6 digits) → Home
//   → session persisted (noReset): straight to Home (+ "Allow Location" prompt)
//
// The app stores its login token in app data, so with 'appium:noReset: true'
// a login performed by any spec is reused by every later spec — login runs
// only when the Home screen is not reachable.

require('dotenv').config();

const APP_PACKAGE = 'com.parktechnology.purse.dev';

const PHONE_NUMBER = process.env.MOBILE_PHONE_NUMBER || '01143236791';
// OTP placeholder — the backend will accept a fixed (static) OTP later.
// Change ONLY this value (or set MOBILE_OTP) when it lands.
const OTP_CODE = process.env.MOBILE_OTP || '123456';

const TIMEOUT = 15000;

// --- low-level helpers ------------------------------------------------------

async function isDisplayedSafe(selector, timeout = 2000) {
    const el = await $(selector);
    return await el.isDisplayed().catch(() => false);
}

async function waitUntilTrue(fn, timeout, timeoutMsg) {
    await browser.waitUntil(fn, { timeout, interval: 500, timeoutMsg });
}

// Dismiss Android system dialogs (permissions, "OK / Allow / While using…").
// Handles one dialog per call; Android may queue several.
async function dismissSystemPopups(maxRounds = 3) {
    const popupSelectors = [
        '//*[@text="While using the app"]',
        '//*[@text="While using this app"]',
        '//*[@text="Allow"]',
        '//*[@text="OK"]',
        '//*[@text="Got it"]',
    ];
    for (let round = 0; round < maxRounds; round++) {
        let dismissed = false;
        for (const sel of popupSelectors) {
            const btn = await $(sel);
            if (await btn.isDisplayed().catch(() => false)) {
                await btn.click();
                dismissed = true;
                break; // one dialog at a time — the next round picks the next one
            }
        }
        if (!dismissed) return;
    }
}

// --- onboarding --------------------------------------------------------------

// Cold launch shows a permissions primer ("Allow access") with a Continue
// button, on every launch, even with a valid session. Tap it only if present.
async function dismissOnboarding() {
    const continueBtn = $('android=new UiSelector().text("Continue")');
    if (await continueBtn.isDisplayed().catch(() => false)) {
        await continueBtn.waitForDisplayed({ timeout: TIMEOUT });
        await continueBtn.click();
        console.log('✅ Onboarding dismissed (Continue)');
    }
    await dismissSystemPopups();
}

// The in-app "Allow Location" card on Home — dismiss it so it never blocks
// Home-based assertions. Not an Android system dialog; it lives in the app UI.
async function dismissLocationPrompt() {
    const allow = $('~Allow Location');
    if (await allow.isDisplayed().catch(() => false)) {
        await allow.click();
        console.log('✅ Location prompt dismissed');
        await dismissSystemPopups();
    }
}

// --- session state -----------------------------------------------------------

async function isOnHome() {
    return (
        (await isDisplayedSafe('~Home tab')) ||
        (await isDisplayedSafe('android=new UiSelector().text("My stamp Cards")'))
    );
}

// --- login flow (phone + OTP) -------------------------------------------------

async function selectEgyptCountry() {
    // Egypt already selected?
    if (await isDisplayedSafe('android=new UiSelector().text("+20")')) return;

    await $('~Select country code').click();

    const search = await $('android=new UiSelector().text("Name or code")');
    await search.waitForDisplayed({ timeout: TIMEOUT });
    await search.setValue('Egypt');

    // The Egypt row is a Button whose content-desc is "🇪🇬, Egypt, EG +20".
    const egypt = $('android=new UiSelector().descriptionContains("Egypt")');
    await egypt.waitForDisplayed({ timeout: TIMEOUT });
    await egypt.click();

    // Picker closed → the login screen shows +20.
    await waitUntilTrue(
        async () => isDisplayedSafe('android=new UiSelector().text("+20")'),
        10000,
        'Egypt was selected but the country code still is not +20'
    );
    console.log('✅ Country code set to +20 (Egypt)');
}

async function loginWithPhone() {
    // Sanity: make sure we are actually on the login screen.
    if (!(await isDisplayedSafe('~Sign in', 5000))) {
        throw new Error(
            'Login screen not detected (no "Sign in" button) and no Home session — ' +
            'capture the current screen and check the launch flow.'
        );
    }

    await selectEgyptCountry();

    const phone = $('~Phone number');
    await phone.waitForDisplayed({ timeout: TIMEOUT });
    await phone.setValue(PHONE_NUMBER);

    const signIn = $('~Sign in');
    await signIn.waitForDisplayed({ timeout: TIMEOUT });
    // Wait until Sign in is enabled and not showing a busy state.
    await waitUntilTrue(
        async () =>
            (await signIn.isEnabled()) &&
            !((await signIn.getAttribute('content-desc')) || '')
                .toLowerCase()
                .includes('busy'),
        30000,
        'Sign in stayed disabled/busy — check the phone number and network'
    );
    await signIn.click();

    // OTP screen: one 6-digit field + "Verify Account".
    await waitUntilTrue(
        async () => isDisplayedSafe('~Verify Account'),
        30000,
        'OTP screen did not appear after submitting the phone number'
    );

    const otpField = await $('//android.widget.EditText');
    await otpField.waitForDisplayed({ timeout: TIMEOUT });
    await otpField.setValue(OTP_CODE); // setValue replaces any previous input

    await $('~Verify Account').click();

    // Honest outcome handling: success → Home; rejection → clear failure
    // that says exactly which value to update.
    let loggedIn = false;
    let rejected = false;
    await waitUntilTrue(async () => {
        if (await isOnHome()) { loggedIn = true; return true; }
        if (await isDisplayedSafe('android=new UiSelector().textContains("Access denied")')) {
            rejected = true;
            return true;
        }
        return false;
    }, 30000, 'Neither Home nor a verification result appeared after OTP submit');

    if (rejected) {
        throw new Error(
            `OTP rejected ("Access denied") for ${PHONE_NUMBER}. ` +
            `The backend does not accept the configured OTP yet — update the ` +
            `static OTP value in helpers/mobileSession.js (OTP_CODE / MOBILE_OTP).`
        );
    }
    if (!loggedIn) {
        throw new Error('Login did not reach the Home screen after OTP verification');
    }
    console.log('✅ Logged in via phone + OTP');
}

// Wait until the app shows ANY known screen (onboarding, login or Home).
// After activateApp the app may still be on splash / loading its JS bundle,
// so every state decision must wait for a recognizable screen first.
async function waitForAnyAppState(timeout = 30000) {
    let state = 'unknown';
    await waitUntilTrue(async () => {
        if (await isDisplayedSafe('android=new UiSelector().text("Continue")', 1000)) {
            state = 'onboarding'; return true;
        }
        if (await isDisplayedSafe('~Sign in', 1000)) {
            state = 'login'; return true;
        }
        if (await isOnHome()) {
            state = 'home'; return true;
        }
        return false;
    }, timeout, `App did not reach a known screen (onboarding/login/home) within ${timeout}ms`);
    return state;
}

// --- public entry point -------------------------------------------------------

// Wait for a known app screen; if the app is stuck on an intermediate screen
// (e.g. a sheet left open by a crashed previous run), relaunch it cleanly and
// wait again. Throws honestly if no known screen is reachable at all.
async function ensureKnownAppState() {
    try {
        return await waitForAnyAppState(20000);
    } catch (err) {
        console.warn('⚠️ App stuck on an unknown screen — relaunching it');
        await driver.terminateApp(APP_PACKAGE).catch(() => {});
        await driver.activateApp(APP_PACKAGE);
        return await waitForAnyAppState(30000); // throws if still unknown
    }
}

// Call at the start of every mobile test:
//   1. wait for a known app screen (splash/loading can take a while)
//   2. dismiss the onboarding Continue (if shown)
//   3. reuse the persisted session when Home is reachable
//   4. otherwise perform the full phone + OTP login once
async function ensureLoggedIn() {
    const state = await ensureKnownAppState();
    console.log(`📱 App state after launch: ${state}`);

    if (state === 'onboarding') await dismissOnboarding();

    // The location card can appear on Home on every fresh app start.
    if (await isOnHome()) {
        await dismissLocationPrompt();
        console.log('✅ Session reused — already logged in');
        return;
    }

    await loginWithPhone();
    await dismissLocationPrompt();
}

module.exports = {
    APP_PACKAGE,
    PHONE_NUMBER,
    OTP_CODE,
    ensureLoggedIn,
    dismissOnboarding,
    dismissLocationPrompt,
    dismissSystemPopups,
};
