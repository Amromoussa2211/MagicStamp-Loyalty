describe('Magic Stamp - Sidebar Options Smoke Test', () => {
    it('should navigate through sidebar options, send gift, and logout', async () => {
        
        // ==========================================
        // 1. Wait for Home Screen to load
        // ==========================================
        // 1. Wait for Home Screen to load
console.log('⏳ Waiting for Home Screen to load...');
await browser.pause(5000);

// 2. Click on "More tab"
console.log('⏳ Waiting for "More tab"...');
const moreTab = await $('android=new UiSelector().description("More tab")');
await moreTab.waitForDisplayed({ timeout: 15000 });
await moreTab.click();
console.log('✅ Clicked "More tab"');
await browser.pause(2000); // استنى القائمة تفتح
        // ==========================================
        // 2. Click on "Your Orders"
        // ==========================================
        console.log('⏳ Waiting for "Your Orders"...');
        const yourOrders = await $('~Your Orders');
        await yourOrders.waitForDisplayed({ timeout: 10000 });
        await yourOrders.click();
        console.log('✅ Clicked "Your Orders"');
        await browser.pause(2000);

        // ==========================================
        // 3. Click on the SVG Icon (Filter)
        // ==========================================
        console.log('⏳ Waiting for SVG icon...');
        const svgIcon = await $('android=new UiSelector().className("com.horcrux.svg.SvgView")');
        await svgIcon.waitForDisplayed({ timeout: 10000 });
        await svgIcon.click();
        console.log('✅ Clicked SVG icon');
        await browser.pause(1500);

        // ==========================================
        // 4. Click on "Redeem Magic Code"
        // ==========================================
        console.log('⏳ Waiting for "Redeem Magic Code"...');
        const redeemMagicCode = await $('~Redeem Magic Code');
        await redeemMagicCode.waitForDisplayed({ timeout: 10000 });
        await redeemMagicCode.click();
        console.log('✅ Clicked "Redeem Magic Code"');
        await browser.pause(2000);

        // ==========================================
        // 5. Click on PathView (instance 2)
        // ==========================================
        console.log('⏳ Waiting for PathView (instance 2)...');
        const pathView2 = await $('android=new UiSelector().className("com.horcrux.svg.PathView").instance(2)');
        await pathView2.waitForDisplayed({ timeout: 10000 });
        await pathView2.click();
        console.log('✅ Clicked PathView (instance 2)');
        await browser.pause(1500);

        // ==========================================
        // 6. Click on PathView (instance 286)
        // ==========================================
        console.log('⏳ Waiting for PathView (instance 286)...');
        const pathView286 = await $('android=new UiSelector().className("com.horcrux.svg.PathView").instance(286)');
        await pathView286.waitForDisplayed({ timeout: 15000 });
        await pathView286.click();
        console.log('✅ Clicked PathView (instance 286)');
        await browser.pause(1500);

        // ==========================================
        // 7. Click on "Back"
        // ==========================================
        console.log('⏳ Waiting for "Back" button...');
        const backBtn1 = await $('~Back');
        await backBtn1.waitForDisplayed({ timeout: 10000 });
        await backBtn1.click();
        console.log('✅ Clicked "Back" (1)');
        await browser.pause(1500);

        // ==========================================
        // 8. Click on "Send Gift"
        // ==========================================
        console.log('⏳ Waiting for "Send Gift"...');
        const sendGift = await $('~Send Gift');
        await sendGift.waitForDisplayed({ timeout: 10000 });
        await sendGift.click();
        console.log('✅ Clicked "Send Gift"');
        await browser.pause(2000);

        // ==========================================
        // 9. Enter Text in EditText
        // ==========================================
        console.log('⏳ Waiting for EditText...');
        const editText = await $('android=new UiSelector().className("android.widget.EditText")');
        await editText.waitForDisplayed({ timeout: 10000 });
        await editText.click();
        await editText.addValue('automation gift');
        console.log('✅ Typed "automation gift" in EditText');
        await browser.pause(1000);

        // ==========================================
        // 10. Click on "Back" again
        // ==========================================
        console.log('⏳ Waiting for "Back" button (2)...');
        const backBtn2 = await $('~Back');
        await backBtn2.waitForDisplayed({ timeout: 10000 });
        await backBtn2.click();
        console.log('✅ Clicked "Back" (2)');
        await browser.pause(1500);

        // ==========================================
        // 11. Click on "Order & Pay"
        // ==========================================
        console.log('⏳ Waiting for "Order & Pay"...');
        const orderAndPay = await $('~Order & Pay'); 
        await orderAndPay.waitForDisplayed({ timeout: 10000 });
        await orderAndPay.click();
        console.log('✅ Clicked "Order & Pay"');
        await browser.pause(2000);

        // ==========================================
        // 12. Click on "Back" third time
        // ==========================================
        console.log('⏳ Waiting for "Back" button (3)...');
        const backBtn3 = await $('~Back');
        await backBtn3.waitForDisplayed({ timeout: 10000 });
        await backBtn3.click();
        console.log('✅ Clicked "Back" (3)');
        await browser.pause(1500);

        // ==========================================
        // 13. Swipe Action (Scroll Down)
        // ==========================================
        console.log('⏳ Performing swipe action...');
        await driver.action('pointer')
            .move({ duration: 0, x: 475, y: 1158 })
            .down({ button: 0 })
            .move({ duration: 1000, x: 472, y: 415 })
            .up({ button: 0 })
            .perform();
        console.log('✅ Swipe performed');
        await browser.pause(1000);

        // ==========================================
        // 14. Click on "Log out"
        // ==========================================
        // Note: "Log out" and "Confirm" are not in the XML you provided.
        // They might be inside Settings or need scrolling. We'll try anyway.
        console.log('⏳ Waiting for "Log out"...');
        const logoutBtn = await $('~Log out');
        // await logoutBtn.waitForDisplayed({ timeout: 10000 });
        // await logoutBtn.click();
        // console.log('✅ Clicked "Log out"');
        // await browser.pause(1500);

        // ==========================================
        // 15. Confirm Logout
        // ==========================================
        console.log('⏳ Waiting for "Confirm" button...');
        // const confirmBtn = await $('~Confirm');
        // await confirmBtn.waitForDisplayed({ timeout: 10000 });
        // await confirmBtn.click();
        // console.log('✅ Clicked "Confirm"');
        // await browser.pause(3000);

        // ==========================================
        // 16. Print Current Package and Session ID
    //     // ==========================================
    //     console.log('⏳ Getting current package and session details...');
    //     let packageName = await driver.executeScript("mobile: getCurrentPackage");
    //     let sessionDetails = await driver.getSession();
        
    //     console.log(`📦 Current Package: ${packageName}`);
    //     console.log(`🆔 Session ID: ${sessionDetails.sessionId}`);
    //     console.log('✅ Sidebar Options Smoke Test Completed Successfully!');
    });
});