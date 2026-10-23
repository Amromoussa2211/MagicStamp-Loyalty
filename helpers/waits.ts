// Reusable webdriverIO wait helper (explicit, no sleep)
import { browser } from '@wdio/globals';

// Runtime surface of the connected driver: this environment ships an empty
// `WebdriverIO.Browser` stub; cast to the real shape so helpers resolve.
const d = browser as any;

export async function waitForVisible(cssSelector: string, timeoutMs = 15000): Promise<void> {
  await d.waitUntil(async () => await (d.$(cssSelector) as any).isDisplayed(), {
    timeout: timeoutMs,
    timeoutMsg: `element not visible: ${cssSelector}`,
    interval: 500,
  });
}

export async function waitForText(cssSelector: string, expectedText: string, timeoutMs = 15000): Promise<string> {
  const el = await (d.$(cssSelector) as any);
  const text = await el.getText();
  await d.waitUntil(async () => text === (await el.getText()), { timeout: timeoutMs, timeoutMsg: `text mismatch on: ${cssSelector}`, interval: 500 });
  return text;
}
