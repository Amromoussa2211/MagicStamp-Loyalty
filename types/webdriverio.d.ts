// Ambient type definitions for the WebdriverIO API surface used by this
// project, so that `browser.waitUntil`, `browser.$`, `browser.getTitle` and
// `browser.deleteSession` resolve to the real commands instead of empty stubs.
// (Kept minimal to match this environment's WebdriverIO type build.)
declare global {
  namespace WebdriverIO {
    interface Browser {
      waitUntil(
        condition: (() => Promise<boolean>) | ((client: unknown) => Promise<boolean>),
        opts?: { timeout?: number; timeoutMsg?: string; interval?: number },
      ): Promise<boolean>;

      $(selector: string): Element;

      getTitle(): Promise<string>;

      deleteSession(): Promise<void>;
    }

    interface Element {
      getText(): Promise<string>;
    }
  }
}
