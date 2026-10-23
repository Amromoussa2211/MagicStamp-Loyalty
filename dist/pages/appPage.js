"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppPage = void 0;
const globals_1 = require("@wdio/globals");
// Runtime surface of the connected Android driver.
const d = globals_1.browser;
class AppPage {
    get title() {
        return d.getTitle();
    }
    async close() {
        await d.deleteSession();
    }
}
exports.AppPage = AppPage;
