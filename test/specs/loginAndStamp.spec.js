// Login flow spec — replaced the old fully-commented draft with a working
// version built on helpers/mobileSession.js (flow verified on-device).
//
// If a valid session already exists (appium:noReset persists app data),
// this test simply proves the session and reaches Home. Otherwise it runs
// the full phone + OTP login once, and every later spec reuses the session.
const { ensureLoggedIn } = require('../../helpers/mobileSession');

describe('Magic Stamp - Login Flow', () => {
  it('should log in with phone number and OTP and reach the Home screen', async () => {
    await ensureLoggedIn();

    // Assert the Home markers explicitly — ensureLoggedIn does the same
    // checks internally, but the test owns its own final assertion.
    const homeTab = await $('~Home tab');
    await homeTab.waitForDisplayed({ timeout: 15000 });
    console.log('✅ Home screen reached (session valid)');
  });
});
