// Reusable assertions / assertions hub. Wrap chai assertions here to keep
// specs readable and consistent.
import { expect } from 'chai';

export function isTrue(actual: any): any {
  return expect(actual).to.be.true;
}

export function isDefined(actual: any): any {
  return expect(actual).to.not.be.undefined.and.not.be.null;
}
