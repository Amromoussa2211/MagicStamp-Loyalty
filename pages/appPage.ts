import { browser } from '@wdio/globals';

// Runtime surface of the connected Android driver.
const d = browser as any;

export class AppPage {
  get title(): Promise<string> {
    return d.getTitle();
  }

  async close(): Promise<void> {
    await d.deleteSession();
  }
}
