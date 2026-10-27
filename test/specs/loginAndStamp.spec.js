// describe('Magic Stamp - Login Flow', () => {
//     it('should enter phone number and continue', async () => {
        
//         // 1. نستنى التطبيق يحمل
//         await browser.pause(3000);
//         console.log('⏳ App loaded, looking for country code button...');

//         // 2. ندوس على "Select country code"
//         const countryCodeBtn = await $('~Select country code');
//         await countryCodeBtn.waitForDisplayed({ timeout: 10000 });
//         await countryCodeBtn.click();
//         console.log('✅ Clicked Select country code');

//         // 3. نستنى شاشة البحث تظهر
//         await browser.pause(1000);

//         // 4. نكتب "egy" في خانة البحث
//         // اللوكيتر اللي أنت جبته: accessibility id "Search" أو النص "Name or code"
//         const searchInput = await $('~Search'); 
//         await searchInput.waitForDisplayed({ timeout: 5000 });
//         await searchInput.setValue('egy');
//         console.log('✅ Typed "egy" in search');

//         // 5. نستنى النتائج تظهر وندوس على Egypt
//         await browser.pause(1500);
//         // اللوكيتر ده تقديري، لو مش شغال هنجيبه من Inspector
//         const egyptResult = await $('//android.widget.TextView[contains(@text, "Egypt")]');
//         await egyptResult.waitForDisplayed({ timeout: 5000 });
//         await egyptResult.click();
//         console.log('✅ Selected Egypt');

//         // 6. ندوس على خانة رقم التليفون ونكتب الرقم
//         const phoneInput = await $('~Phone number');
//         await phoneInput.waitForDisplayed({ timeout: 5000 });
//         await phoneInput.setValue('01143236791');
//         console.log('✅ Typed phone number');

//         // 7. هنا محتاجين الزرار اللي بيكمل بعد رقم التليفون
//         // أنت لسه ما بعتوش. ممكن يكون "Continue" أو "Next" أو "Login"
//         // افتح Appium Inspector وشوف الزرار اللي تحته رقم التليفون وابعتلي الـ id بتاعه
        
//         console.log('⚠️ STOP: Need the locator for the button after phone number.');
//         console.log('⚠️ Please check Appium Inspector and send the id of the button.');
//     });
// });