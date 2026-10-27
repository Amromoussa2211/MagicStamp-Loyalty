describe('Magic Stamp App Launch', () => {
    it('should launch the app successfully and get the package name', async () => {
        // الانتظار حتى يظهر التطبيق
        await browser.pause(2000);
        
        // التحقق من اسم الحزمة
        const currentPackage = await driver.getCurrentPackage();
        console.log('📱 Current Package is:', currentPackage);
        
        // expect(currentPackage).toEqual('com.parktechnology.purse.dev');
    });
});