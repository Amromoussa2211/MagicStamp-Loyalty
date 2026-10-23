"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForVisible = waitForVisible;
exports.waitForText = waitForText;
// Reusable webdriverIO wait helper (explicit, no sleep)
const globals_1 = require("@wdio/globals");
// Runtime surface of the connected driver: this environment ships an empty
// `WebdriverIO.Browser` stub; cast to the real shape so helpers resolve.
const d = globals_1.browser;
async function waitForVisible(cssSelector, timeoutMs = 15000) {
    await d.waitUntil(async () => await d.$(cssSelector).isDisplayed(), {
        timeout: timeoutMs,
        timeoutMsg: `element not visible: ${cssSelector}`,
        interval: 500,
    });
}
async function waitForText(cssSelector, expectedText, timeoutMs = 15000) {
    const el = await d.$(cssSelector);
    const text = await el.getText();
    await d.waitUntil(async () => text === (await el.getText()), { timeout: timeoutMs, timeoutMsg: `text mismatch on: ${cssSelector}`, interval: 500 });
    return text;
}
