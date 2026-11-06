// Shared upload asset — one real image (committed to the repo) reused for
// every file/photo upload step, resolved absolutely so it works identically
// when Playwright is launched from any directory (local, CI runner).
const path = require('path');

const UPLOAD_IMAGE = path.join(__dirname, 'favicon-black.png');

module.exports = { UPLOAD_IMAGE };
