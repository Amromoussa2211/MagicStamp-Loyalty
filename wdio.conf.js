exports.config = {
    runner: 'local',
    port: 4723,
    specs: [
        './test/specs/**/*.js'
    ],
    exclude: [],
    maxInstances: 1,
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 15000,
    connectionRetryTimeout: 200000,
    connectionRetryCount: 3,
    
    // مهم جداً: إضافة خدمة Appium لكي يتم تشغيل السيرفر تلقائياً
    services: ['appium'],
    
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 360000
    },
}