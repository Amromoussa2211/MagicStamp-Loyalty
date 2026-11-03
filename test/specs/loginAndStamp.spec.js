
// describe('Magic Stamp - Login Flow', () => {
//   const appPackage = 'com.parktechnology.purse.dev';
//   const phoneNumber = '01143236791';
//   const otpCode = process.env.OTP_CODE;

//   const timeout = 15000;

//   // --------------------------------------------------
//   // Helpers
//   // --------------------------------------------------

//   async function captureEvidence(name) {
//     const source = await browser.getPageSource();

//     console.log(`\n========== ${name} ==========\n`);
//     console.log(source);

//     await browser.saveScreenshot(
//       `./screenshots/${name}-${Date.now()}.png`
//     );

//     return source;
//   }

//   async function safeClick(element) {
//     await element.waitForDisplayed({ timeout });
//     await element.click();
//   }

//   async function getDescription(element) {
//     const contentDesc =
//       (await element.getAttribute('content-desc')) || '';
//     const text = (await element.getText()) || '';
//     const hint = (await element.getAttribute('hint')) || '';

//     return `${contentDesc} ${text} ${hint}`.trim();
//   }

//   // --------------------------------------------------
//   // Handle common Android system popups
//   // --------------------------------------------------

//   async function dismissSystemPopupIfPresent() {
//     const popupSelectors = [
//       '//*[@text="OK"]',
//       '//*[@text="Allow"]',
//       '//*[@text="While using the app"]',
//       '//*[@text="While using this app"]',
//       '//*[@text="Got it"]',
//       '//*[@text="Continue"]',
//     ];

//     for (const selector of popupSelectors) {
//       try {
//         const button = await $(selector);

//         if (await button.isDisplayed()) {
//           console.log(`Popup button detected: ${selector}`);
//           await button.click();

//           await browser.waitUntil(
//             async () => !(await button.isDisplayed()),
//             {
//               timeout: 3000,
//               interval: 250,
//               timeoutMsg: `Popup did not close: ${selector}`,
//             }
//           ).catch(() => {});

//           // Handle only one popup at a time.
//           return true;
//         }
//       } catch (_) {
//         // Element is not present or is no longer available.
//       }
//     }

//     return false;
//   }

//   async function handleInitialPopups() {
//     // Try a few times because Android may show sequential dialogs.
//     for (let attempt = 0; attempt < 3; attempt++) {
//       const dismissed = await dismissSystemPopupIfPresent();

//       if (!dismissed) {
//         break;
//       }
//     }
//   }

//   // --------------------------------------------------
//   // Select Egypt from the country picker
//   // --------------------------------------------------

//   async function selectEgyptCountry() {
//     const countryCodeButton = await $('~Select country code');

//     await safeClick(countryCodeButton);

//     const searchInput = await $('~Search');

//     await searchInput.waitForDisplayed({ timeout });
//     await searchInput.setValue('Egypt');

//     const egyptResult = await $(
//       '//*[@text="Egypt" or contains(@text, "Egypt") or ' +
//       '@content-desc="Egypt" or contains(@content-desc, "Egypt")]'
//     );

//     await egyptResult.waitForDisplayed({ timeout: 15000 });

//     console.log(
//       'Egypt result found:',
//       await getDescription(egyptResult)
//     );

//     // Prefer the nearest clickable parent when the text itself
//     // is not clickable.
//     let target = egyptResult;

//     try {
//       const clickable = await egyptResult.getAttribute('clickable');

//       if (clickable !== 'true') {
//         const parent = await $(
//           '//*[(@text="Egypt" or contains(@text, "Egypt") or ' +
//           '@content-desc="Egypt" or contains(@content-desc, "Egypt"))]' +
//           '/ancestor::*[@clickable="true"][1]'
//         );

//         if (await parent.isDisplayed()) {
//           target = parent;
//         }
//       }
//     } catch (_) {
//       // Use the result element if no clickable parent is found.
//     }

//     await target.click();

//     // Verify that the country picker has closed.
//     await browser.waitUntil(
//       async () => {
//         const source = await browser.getPageSource();

//         return !(
//           source.includes('Select country code') &&
//           /Search/.test(source)
//         );
//       },
//       {
//         timeout: 10000,
//         interval: 300,
//         timeoutMsg:
//           'Egypt was visible, but the country picker did not close.',
//       }
//     );

//     console.log('Country picker closed after selecting Egypt.');
//   }

//   // --------------------------------------------------
//   // Login test
//   // --------------------------------------------------

//   it('should login using phone number and OTP', async () => {
//     // IMPORTANT:
//     // Clear the app data manually before running this test.
//     // No adb_shell command is used by this test.

//     // 1. Launch the app.
//     await browser.activateApp(appPackage);

//     // 2. Handle the initial Android popup, if present.
//     await handleInitialPopups();

//     // 3. Continue from the welcome screen.
//     const continueButton = await $(
//       '//android.widget.Button[@content-desc="Continue"]'
//     );

//     await continueButton.waitForDisplayed({ timeout });
//     await continueButton.click();

//     await handleInitialPopups();

//     // 4. Select Egypt.
//     await selectEgyptCountry();

//     // 5. Enter the phone number.
//     const phoneInput = await $('~Phone number');

//     await phoneInput.waitForDisplayed({ timeout });
//     await phoneInput.setValue(phoneNumber);

//     // 6. Wait for Sign in to become enabled and stop showing busy.
//     const signInButton = await $(
//       '//android.widget.Button[contains(@content-desc, "Sign in")]'
//     );

//     await signInButton.waitForDisplayed({ timeout });

//     await browser.waitUntil(
//       async () => {
//         const description =
//           (await signInButton.getAttribute('content-desc')) || '';

//         return (
//           (await signInButton.isEnabled()) &&
//           !description.toLowerCase().includes('busy')
//         );
//       },
//       {
//         timeout: 30000,
//         interval: 500,
//         timeoutMsg:
//           'Sign in stayed disabled or busy. Check the phone number and network.',
//       }
//     );

//     // 7. Submit the phone number.
//     await signInButton.click();

//     // 8. Handle any system popup that appears after submission.
//     await handleInitialPopups();

//     // 9. Capture the screen after submitting the phone number.
//     let source = await captureEvidence('after-phone-submit');

//     // Wait for navigation away from the phone-entry screen.
//     await browser.waitUntil(
//       async () => {
//         source = await browser.getPageSource();

//         return (
//           /otp|verification code|verify your|enter.*code|one.time password/i.test(
//             source
//           ) ||
//           !source.includes('content-desc="Phone number"')
//         );
//       },
//       {
//         timeout: 30000,
//         interval: 500,
//         timeoutMsg:
//           'The app did not navigate after Sign in. Inspect after-phone-submit evidence.',
//       }
//     );

//     await handleInitialPopups();

//     source = await captureEvidence('otp-screen');

//     // 10. Require an actual OTP value from the test environment.
//     if (!otpCode) {
//       throw new Error(
//         'OTP_CODE is not set. Set OTP_CODE to the valid test OTP before running.'
//       );
//     }

//     if (!/^\d+$/.test(otpCode)) {
//       throw new Error('OTP_CODE must contain digits only.');
//     }

//     // 11. Find visible text fields on the OTP screen.
//     const editFields = await $$('//android.widget.EditText');
//     const visibleFields = [];

//     for (const field of editFields) {
//       try {
//         if (await field.isDisplayed()) {
//           visibleFields.push(field);
//         }
//       } catch (_) {
//         // Ignore stale elements.
//       }
//     }

//     const identifiedOtpFields = [];

//     for (const field of visibleFields) {
//       const description = await getDescription(field);

//       if (/otp|verification|one.time|code/i.test(description)) {
//         identifiedOtpFields.push(field);
//       }
//     }

//     let otpFields = identifiedOtpFields;

//     // Fall back only when the screen structure is unambiguous.
//     if (otpFields.length === 0) {
//       if (
//         visibleFields.length === 1 ||
//         visibleFields.length === otpCode.length
//       ) {
//         otpFields = visibleFields;
//       }
//     }

//     if (otpFields.length === 0) {
//       console.log('OTP fields could not be identified.');
//       console.log('Current screen source:\n', source);

//       throw new Error(
//         'Could not identify OTP input fields. Review otp-screen page source.'
//       );
//     }

//     // 12. Enter the OTP.
//     if (otpFields.length === 1) {
//       await otpFields[0].setValue(otpCode);
//     } else if (otpFields.length === otpCode.length) {
//       for (let index = 0; index < otpCode.length; index++) {
//         await otpFields[index].setValue(otpCode[index]);
//       }
//     } else {
//       throw new Error(
//         `OTP has ${otpCode.length} digits, but ${otpFields.length} input fields were found.`
//       );
//     }

//     // 13. Find a visible verification button, if the app has one.
//     // Some apps submit automatically after the last digit.
//     const buttons = await $$('//android.widget.Button');
//     let verifyButton = null;

//     for (const button of buttons) {
//       try {
//         if (!(await button.isDisplayed())) {
//           continue;
//         }

//         const description = await getDescription(button);

//         if (
//           /verify|confirm|submit|verify code|continue/i.test(description) &&
//           !/google|apple|email/i.test(description)
//         ) {
//           verifyButton = button;
//           break;
//         }
//       } catch (_) {
//         // Ignore stale elements.
//       }
//     }

//     if (verifyButton) {
//       await browser.waitUntil(
//         async () => await verifyButton.isEnabled(),
//         {
//           timeout: 10000,
//           interval: 300,
//           timeoutMsg: 'The OTP verification button stayed disabled.',
//         }
//       );

//       await verifyButton.click();
//     }

//     // 14. Handle any system popup after OTP submission.
//     await handleInitialPopups();

//     // 15. Capture the resulting screen.
//     await browser.pause(1000);

//     await captureEvidence('after-otp');

//     console.log(
//       'OTP submission step completed. Verify the resulting page source to confirm successful login.'
//     );
//   });
// });
