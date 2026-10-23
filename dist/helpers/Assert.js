"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTrue = isTrue;
exports.isDefined = isDefined;
// Reusable assertions / assertions hub. Wrap chai assertions here to keep
// specs readable and consistent.
const chai_1 = require("chai");
function isTrue(actual) {
    return (0, chai_1.expect)(actual).to.be.true;
}
function isDefined(actual) {
    return (0, chai_1.expect)(actual).to.not.be.undefined.and.not.be.null;
}
