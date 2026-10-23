describe('Magic Stamp App Launch', () => {
    it('should launch the app successfully and get the package name', async () => {
        // بما أننا استخدمنا noReset: true، التطبيق يجب أن يكون مفتوحاً أو سيتم فتحه
        const currentPackage = await driver.getCurrentPackage();
        console.log('📱 Current Package is:', currentPackage);
        
        // التحقق من أن التطبيق الذي يعمل هو تطبيقنا (نسخة الـ Dev)
        expect(currentPackage).toEqual('com.parktechnology.purse.dev');
    });
});