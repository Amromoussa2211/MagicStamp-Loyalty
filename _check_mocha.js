const mocha = require('mocha');
console.log('describe:', typeof mocha.describe);
console.log('it:', typeof mocha.it);
console.log('before:', typeof mocha.before);
console.log('after:', typeof mocha.after);
const keys = Object.keys(mocha).filter(k => ['describe','it','before','after','warn'].includes(k));
console.log('keys:', keys);
