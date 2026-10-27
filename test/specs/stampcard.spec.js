// ============================================================
// Config
// ============================================================
const TOTAL_STAMPS = 10;
const REWARD_TEXT = 'You did it! 🎉';
const ADD_NEW_CARD = 'android=new UiSelector().text("Add new card")';
const REMOVE_BTN = 'android=new UiSelector().descriptionStartsWith("Remove ")';
const ADD_BTN = 'android=new UiSelector().descriptionMatches("^Add .* stamp card$")';
const CARDS_TO_USE = 2; // أول كاردين Add ظاهرين في الشيت

// ============================================================
// Helpers
// ============================================================
async function getCenter(el) {
  const loc = await el.getLocation();
  const size = await el.getSize();
  return { x: Math.floor(loc.x + size.width / 2), y: Math.floor(loc.y + size.height / 2) };
}

async function isDisplayedSafe(selector) {
  const el = await $(selector);
  return await el.isDisplayed().catch(() => false);
}

async function isRewardShown() {
  return await isDisplayedSafe(`android=new UiSelector().text("${REWARD_TEXT}")`);
}

// بيقرا العدد الحالي من الـ page source (مثلاً "7/10" أو "7 of 10")
async function getStampCount() {
  const src = await driver.getPageSource();
  const m = src.match(new RegExp(`(\\d+)\\s*(?:/|of|out of)\\s*${TOTAL_STAMPS}`, 'i'));
  return m ? parseInt(m[1], 10) : null;
}

// بيدور على العنصر من جديد في كل محاولة، ويعيد لو حصل stale
async function safeClick(selector, { timeout = 10000, retries = 3 } = {}) {
  for (let i = 1; i <= retries; i++) {
    try {
      const el = await $(selector);
      await el.waitForDisplayed({ timeout });
      await el.click();
      return;
    } catch (err) {
      const stale = /stale|does not exist in DOM/i.test(err.message);
      if (!stale || i === retries) throw err;
      console.warn(`⚠️ Stale element on "${selector}", retry ${i}/${retries}`);
      await driver.pause(1000);
    }
  }
}

// ============================================================
// makeStamp
// Phase 1: 5 fingers together for 30s
// Phase 2 (fallback): 4 fingers held + tapping 5
// ============================================================
async function makeStamp({ isRegistered, fiveFingerHoldMs = 30000, fallbackRounds = 5 } = {}) {
  for (const label of ['1', '2', '3', '4']) {
    const el = await $(`android=new UiSelector().text("${label}")`);
    await el.waitForDisplayed({ timeout: 10000 });
  }

  const points = [
    { x: 245, y: 690 },
    { x: 476, y: 690 },
    { x: 204, y: 915 },
    { x: 516, y: 915 },
  ];
  let p5 = { x: 360, y: 939 };
  try {
    const el5 = await $('android=new UiSelector().text("5")');
    if (await el5.isDisplayed().catch(() => false)) p5 = await getCenter(el5);
  } catch {}
  console.log(`📍 Finger 5 at (${p5.x}, ${p5.y})`);

  const holdFinger = (point, i, holdMs) => ({
    type: 'pointer',
    id: `finger${i + 1}`,
    parameters: { pointerType: 'touch' },
    actions: [
      { type: 'pointerMove', duration: 0, x: point.x, y: point.y },
      { type: 'pointerDown', button: 0 },
      { type: 'pause', duration: holdMs },
      { type: 'pointerUp', button: 0 },
    ],
  });

  // ---------- Phase 1 ----------
  try {
    console.log(`🖐️ Phase 1: 5 fingers for ${fiveFingerHoldMs / 1000}s`);
    await driver.performActions([
      ...points.map((p, i) => holdFinger(p, i, fiveFingerHoldMs)),
      holdFinger(p5, 4, fiveFingerHoldMs),
    ]);
  } catch (err) {
    console.warn('⚠️ 5-finger gesture failed:', err.message);
  } finally {
    await driver.releaseActions().catch(() => {});
  }

  await driver.pause(1000);
  if (await isRegistered()) {
    console.log('✅ Stamp registered in phase 1');
    return true;
  }

  // ---------- Phase 2 ----------
  console.log('🔁 Phase 2: 4 fingers held + tapping 5');
  const tapsPerRound = 10;
  const tapDown = 150;
  const tapGap = 400;
  const roundMs = 1000 + tapsPerRound * (tapDown + tapGap) + 500;

  for (let round = 1; round <= fallbackRounds; round++) {
    console.log(`   Round ${round}/${fallbackRounds}`);

    const fingers14 = points.map((p, i) => holdFinger(p, i, roundMs));

    const tapActions = [
      { type: 'pause', duration: 1000 },
      { type: 'pointerMove', duration: 0, x: p5.x, y: p5.y },
    ];
    for (let t = 0; t < tapsPerRound; t++) {
      tapActions.push(
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: tapDown },
        { type: 'pointerUp', button: 0 },
        { type: 'pause', duration: tapGap },
      );
    }
    const finger5 = {
      type: 'pointer',
      id: 'finger5',
      parameters: { pointerType: 'touch' },
      actions: tapActions,
    };

    try {
      await driver.performActions([...fingers14, finger5]);
    } catch (err) {
      console.warn('⚠️ Phase 2 gesture failed:', err.message);
    } finally {
      await driver.releaseActions().catch(() => {});
    }

    await driver.pause(1000);
    if (await isRegistered()) {
      console.log(`✅ Stamp registered in phase 2 (round ${round})`);
      return true;
    }
  }

  console.warn('❌ Stamp not registered after all rounds');
  return false;
}

// ============================================================
// Navigation helpers
// ============================================================
async function openAddCardSheet() {
  await driver.pause(1000);
  await safeClick(ADD_NEW_CARD);
  await driver.pause(1500);
}

async function closeSheet() {
  try {
    await safeClick('~Close', { timeout: 3000 });
  } catch {
    console.log('ℹ️ Close not found (sheet may have closed itself)');
  }
  await driver.pause(1500);
}

// Back بتاع الأندرويد (من شاشة الكارد لقائمة الكاردات)
async function goBackToCards() {
  await driver.pause(1500);
  await driver.back();
  await driver.pause(1500);
}

// بيتأكد إن الشيت مفتوح (لو مش مفتوح بيفتحه، ولو إحنا في شاشة كارد بيرجع الأول)
async function ensureSheetOpen() {
  if (await isDisplayedSafe('~Close')) return;
  if (!(await isDisplayedSafe(ADD_NEW_CARD))) await goBackToCards();
  await openAddCardSheet();
}

// ============================================================
// Sheet helpers
// ============================================================

// بيشيل كل الكاردات المضافة الظاهرة في الشيت (واحد واحد، وبيدور من جديد بعد كل Remove)
async function removeAllAddedCards(maxLoops = 10) {
  await ensureSheetOpen();
  for (let i = 0; i < maxLoops; i++) {
    const btn = await $(REMOVE_BTN);
    if (!(await btn.isDisplayed().catch(() => false))) break;
    const desc = await btn.getAttribute('content-desc').catch(() => '');
    console.log(`🗑️ Removing: ${desc}`);
    await btn.click().catch(() => {});
    await driver.pause(2500);
    await ensureSheetOpen(); // لو الشيت اتقفل بعد الـ Remove
  }
}

// بيقرا أول N كاردات "Add" ظاهرة (بالاسم من الـ content-desc)
async function readTopAddCards(n = CARDS_TO_USE) {
  await driver.pause(1500);
  const buttons = await $$(ADD_BTN);
  const names = [];
  for (const btn of buttons) {
    if (names.length >= n) break;
    if (!(await btn.isDisplayed().catch(() => false))) continue;
    const desc = await btn.getAttribute('content-desc');
    const name = desc.replace(/^Add /, '').replace(/ stamp card$/, '');
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

// بيضيف كارد بالاسم (بيدور عليه من جديد قبل الضغط)
async function addCard(name) {
  await ensureSheetOpen();
  await safeClick(`~Add ${name} stamp card`);
  console.log(`✅ Added "${name}" (app opens the card after adding)`);
  await driver.pause(2000);
}

// ============================================================
// Tests
// ============================================================
describe('Magic Stamp - Navigation & Filtering', () => {
  it('should navigate to Stamp Cards, open Filter, and select A-Z', async () => {
    const stampCardsTab = await $('~Stamp Cards tab');
    await stampCardsTab.waitForDisplayed({ timeout: 10000 });
    await stampCardsTab.click();

    const filterBtn = await $('android=new UiSelector().text("Filter")');
    await filterBtn.waitForDisplayed({ timeout: 5000 });
    await filterBtn.click();

    const sortAZ = await $('android=new UiSelector().text("A–Z")');
    await sortAZ.waitForDisplayed({ timeout: 5000 });
    await sortAZ.click();

    const closeIcon = await $('android=new UiSelector().className("com.horcrux.svg.PathView").instance(0)');
    await closeIcon.waitForDisplayed({ timeout: 5000 });
    await closeIcon.click();

    console.log('✅ Test 1 done');
  });

  it('should navigate close place from selected location', async () => {
    // 1. افتح الشيت وشيل كل الكاردات المضافة
    await openAddCardSheet();
    await removeAllAddedCards();

    // 2. اقفل الشيت وافتحه تاني
    await closeSheet();
    await ensureSheetOpen();

    // 3. اقرا أول كاردين ظاهرين (كلهم Add دلوقتي)
    const names = await readTopAddCards(CARDS_TO_USE);
    if (names.length < CARDS_TO_USE) {
      throw new Error(`Expected ${CARDS_TO_USE} Add cards, found ${names.length}`);
    }
    console.log('📋 Cards to add:', names.join(' | '));

    // 4. ضيف الأول (التطبيق هيدخل عليه) ثم Back
    await addCard(names[0]);
    await goBackToCards();

    // 5. افتح الشيت وضيف التاني (التطبيق هيدخل عليه = اللي هنعمل عليه الاستامبات)
    await openAddCardSheet();
    await addCard(names[1]);
    await driver.pause(1500);

    // 6. Show finger guide (لو موجود)
    try {
      if (await isDisplayedSafe('~Show finger guide')) {
        await safeClick('~Show finger guide');
        console.log('✅ Clicked Show finger guide');
        await driver.pause(1000);
      }
    } catch (err) {
      console.warn('⚠️ Show finger guide error:', err.message);
    }

    // 7. اعمل بس الاستامبات الناقصة
    if (await isRewardShown()) {
      console.log('🎉 Card already complete, nothing to do');
      return;
    }

    let count = await getStampCount();
    if (count === null) {
      console.warn('⚠️ Could not read stamp count, assuming 0');
      count = 0;
    }
    const remaining = TOTAL_STAMPS - count;
    console.log(`📊 Current: ${count}/${TOTAL_STAMPS} → need ${remaining} more`);

    for (let n = 1; n <= remaining; n++) {
      const before = count;
      console.log(`\n🎯 Stamp ${n}/${remaining} (card at ${before})`);

      const ok = await makeStamp({
        isRegistered: async () => {
          if (await isRewardShown()) return true;
          const c = await getStampCount();
          if (c === null) return true;
          return c > before;
        },
      });

      if (!ok) throw new Error(`Stamp ${n} failed (card stuck at ${before}/${TOTAL_STAMPS})`);

      if (await isRewardShown()) break;
      count = (await getStampCount()) ?? before + 1;
    }

    // 8. تأكد إن رسالة النجاح ظهرت
    const msg = await $(`android=new UiSelector().text("${REWARD_TEXT}")`);
    await msg.waitForDisplayed({ timeout: 15000 });
    console.log('🎉 SUCCESS: "You did it! 🎉" displayed');
  });
});
// // ============================================================
// // Config
// // ============================================================
// const TOTAL_STAMPS = 10;
// const REWARD_TEXT = 'You did it! 🎉';

// // ============================================================
// // Helpers
// // ============================================================
// async function getCenter(el) {
//   const loc = await el.getLocation();
//   const size = await el.getSize();
//   return { x: Math.floor(loc.x + size.width / 2), y: Math.floor(loc.y + size.height / 2) };
// }

// async function isRewardShown() {
//   const msg = await $(`android=new UiSelector().text("${REWARD_TEXT}")`);
//   return await msg.isDisplayed().catch(() => false);
// }

// // بيقرا العدد الحالي من الـ page source (مثلاً "7/10" أو "7 of 10")
// // لو الشكل مختلف بيرجع null
// async function getStampCount() {
//   const src = await driver.getPageSource();
//   const m = src.match(new RegExp(`(\\d+)\\s*(?:/|of|out of)\\s*${TOTAL_STAMPS}`, 'i'));
//   return m ? parseInt(m[1], 10) : null;
// }

// // بيدور على العنصر من جديد في كل محاولة، ويعيد لو حصل stale
// async function safeClick(selector, { timeout = 10000, retries = 3 } = {}) {
//   for (let i = 1; i <= retries; i++) {
//     try {
//       const el = await $(selector);
//       await el.waitForDisplayed({ timeout });
//       await el.click();
//       return;
//     } catch (err) {
//       const stale = /stale|does not exist in DOM/i.test(err.message);
//       if (!stale || i === retries) throw err;
//       console.warn(`⚠️ Stale element on "${selector}", retry ${i}/${retries}`);
//       await driver.pause(1000);
//     }
//   }
// }

// // ============================================================
// // makeStamp
// // Phase 1: 5 fingers together for 30s
// // Phase 2 (fallback): 4 fingers held + tapping 5
// // ============================================================
// async function makeStamp({ isRegistered, fiveFingerHoldMs = 30000, fallbackRounds = 5 } = {}) {
//   for (const label of ['1', '2', '3', '4']) {
//     const el = await $(`android=new UiSelector().text("${label}")`);
//     await el.waitForDisplayed({ timeout: 10000 });
//   }

//   const points = [
//     { x: 245, y: 690 },
//     { x: 476, y: 690 },
//     { x: 204, y: 915 },
//     { x: 516, y: 915 },
//   ];
//   let p5 = { x: 360, y: 939 };
//   try {
//     const el5 = await $('android=new UiSelector().text("5")');
//     if (await el5.isDisplayed().catch(() => false)) p5 = await getCenter(el5);
//   } catch {}
//   console.log(`📍 Finger 5 at (${p5.x}, ${p5.y})`);

//   const holdFinger = (point, i, holdMs) => ({
//     type: 'pointer',
//     id: `finger${i + 1}`,
//     parameters: { pointerType: 'touch' },
//     actions: [
//       { type: 'pointerMove', duration: 0, x: point.x, y: point.y },
//       { type: 'pointerDown', button: 0 },
//       { type: 'pause', duration: holdMs },
//       { type: 'pointerUp', button: 0 },
//     ],
//   });

//   // ---------- Phase 1 ----------
//   try {
//     console.log(`🖐️ Phase 1: 5 fingers for ${fiveFingerHoldMs / 1000}s`);
//     await driver.performActions([
//       ...points.map((p, i) => holdFinger(p, i, fiveFingerHoldMs)),
//       holdFinger(p5, 4, fiveFingerHoldMs),
//     ]);
//   } catch (err) {
//     console.warn('⚠️ 5-finger gesture failed:', err.message);
//   } finally {
//     await driver.releaseActions().catch(() => {});
//   }

//   await driver.pause(1000);
//   if (await isRegistered()) {
//     console.log('✅ Stamp registered in phase 1');
//     return true;
//   }

//   // ---------- Phase 2 ----------
//   console.log('🔁 Phase 2: 4 fingers held + tapping 5');
//   const tapsPerRound = 10;
//   const tapDown = 150;
//   const tapGap = 400;
//   const roundMs = 1000 + tapsPerRound * (tapDown + tapGap) + 500;

//   for (let round = 1; round <= fallbackRounds; round++) {
//     console.log(`   Round ${round}/${fallbackRounds}`);

//     const fingers14 = points.map((p, i) => holdFinger(p, i, roundMs));

//     const tapActions = [
//       { type: 'pause', duration: 1000 },
//       { type: 'pointerMove', duration: 0, x: p5.x, y: p5.y },
//     ];
//     for (let t = 0; t < tapsPerRound; t++) {
//       tapActions.push(
//         { type: 'pointerDown', button: 0 },
//         { type: 'pause', duration: tapDown },
//         { type: 'pointerUp', button: 0 },
//         { type: 'pause', duration: tapGap },
//       );
//     }
//     const finger5 = {
//       type: 'pointer',
//       id: 'finger5',
//       parameters: { pointerType: 'touch' },
//       actions: tapActions,
//     };

//     try {
//       await driver.performActions([...fingers14, finger5]);
//     } catch (err) {
//       console.warn('⚠️ Phase 2 gesture failed:', err.message);
//     } finally {
//       await driver.releaseActions().catch(() => {});
//     }

//     await driver.pause(1000);
//     if (await isRegistered()) {
//       console.log(`✅ Stamp registered in phase 2 (round ${round})`);
//       return true;
//     }
//   }

//   console.warn('❌ Stamp not registered after all rounds');
//   return false;
// }

// // ============================================================
// // findCardButton
// // ============================================================
// async function findCardButton(cardName) {
//   const selectors = [
//     `~Add ${cardName} stamp card`,
//     `~Remove ${cardName} stamp card`,
//     `android=new UiSelector().descriptionContains("${cardName}")`,
//     `android=new UiSelector().textContains("${cardName}")`,
//   ];

//   for (const sel of selectors) {
//     try {
//       const el = await $(sel);
//       if (await el.isDisplayed().catch(() => false)) {
//         console.log(`✅ Found "${cardName}" using selector: ${sel}`);
//         return el;
//       }
//     } catch {}
//   }
//   return null;
// }

// // ============================================================
// // scrollDown
// // ============================================================
// async function scrollDown() {
//   const { width, height } = await driver.getWindowSize();
//   await driver.action('pointer')
//     .move({ x: Math.floor(width / 2), y: Math.floor(height * 0.8) })
//     .down()
//     .move({ x: Math.floor(width / 2), y: Math.floor(height * 0.2) })
//     .up()
//     .perform();
//   await driver.pause(1000);
// }

// // ============================================================
// // Bottom sheet: open / close
// // ============================================================
// async function openAddCardSheet() {
//   await driver.pause(1000); // استنى الـ animation يخلص
//   await safeClick('android=new UiSelector().text("Add new card")');
//   await driver.pause(1500);
// }

// async function closeSheet() {
//   await safeClick('~Close');
//   await driver.pause(1500);
// }

// // ============================================================
// // ensureCardAdded
// // لو الكارد مضاف (الزرار Remove) بيشيله ويضيفه تاني = استامبات من الصفر
// // ============================================================
// async function ensureCardAdded(cardName) {
//   console.log(`🔍 Looking for "${cardName}" card...`);
//   let card = await findCardButton(cardName);

//   if (!card) {
//     await scrollDown();
//     card = await findCardButton(cardName);
//   }
//   if (!card) throw new Error(`Cannot find ${cardName} card in the sheet`);

//   const desc = await card.getAttribute('content-desc').catch(() => '');
//   const text = await card.getText().catch(() => '');

//   if ((desc + text).toLowerCase().includes('remove')) {
//     console.log(`⚠️ "${cardName}" already added → removing then re-adding`);
//     await card.click();
//     await driver.pause(2500);

//     // الـ sheet ممكن يتقفل بعد الـ Remove، فنفتحه تاني لو لزم
//     let add = await findCardButton(cardName);
//     if (!add) {
//       const addNew = await $('android=new UiSelector().text("Add new card")');
//       if (await addNew.isDisplayed().catch(() => false)) {
//         await openAddCardSheet();
//       }
//       add = await findCardButton(cardName);
//       if (!add) {
//         await scrollDown();
//         add = await findCardButton(cardName);
//       }
//     }
//     if (!add) throw new Error(`Cannot find Add ${cardName} after removing`);
//     card = add;
//   }

//   await card.click();
//   console.log(`✅ Added "${cardName}"`);
//   await driver.pause(1500);
// }

// // ============================================================
// // Tests
// // ============================================================
// describe('Magic Stamp - Navigation & Filtering', () => {
//   it('should navigate to Stamp Cards, open Filter, and select A-Z', async () => {
//     const stampCardsTab = await $('~Stamp Cards tab');
//     await stampCardsTab.waitForDisplayed({ timeout: 10000 });
//     await stampCardsTab.click();

//     const filterBtn = await $('android=new UiSelector().text("Filter")');
//     await filterBtn.waitForDisplayed({ timeout: 5000 });
//     await filterBtn.click();

//     const sortAZ = await $('android=new UiSelector().text("A–Z")');
//     await sortAZ.waitForDisplayed({ timeout: 5000 });
//     await sortAZ.click();

//     const closeIcon = await $('android=new UiSelector().className("com.horcrux.svg.PathView").instance(0)');
//     await closeIcon.waitForDisplayed({ timeout: 5000 });
//     await closeIcon.click();

//     console.log('✅ Test 1 done');
//   });

//   it('should navigate close place from selected location', async () => {
//     // 1. افتح الـ sheet وضيف 1066 Bakery
//     await openAddCardSheet();
//     await ensureCardAdded('1066 Bakery');

//     // 2. اقفل الـ sheet
//     await closeSheet();

//     // 3. افتحه تاني وضيف 10 Islands
//     await openAddCardSheet();
//     await ensureCardAdded('10 Islands');

//     // 4. اقفل الـ sheet
//     await closeSheet();

//     // 5. افتح كارد 10 Islands من القائمة
//     let islandsCard = await $('android=new UiSelector().textContains("10 Islands")');
//     if (!(await islandsCard.isDisplayed().catch(() => false))) {
//       await scrollDown();
//       islandsCard = await $('android=new UiSelector().textContains("10 Islands")');
//     }
//     await islandsCard.waitForDisplayed({ timeout: 10000 });
//     await islandsCard.click();
//     await driver.pause(2000);

//     // 6. Show finger guide (لو موجود)
//     try {
//       const showfinger = await $('~Show finger guide');
//       if (await showfinger.isDisplayed().catch(() => false)) {
//         await showfinger.click();
//         console.log('✅ Clicked Show finger guide');
//         await driver.pause(1000);
//       }
//     } catch (err) {
//       console.warn('⚠️ Show finger guide error:', err.message);
//     }

//     // 7. اعمل بس الاستامبات الناقصة
//     if (await isRewardShown()) {
//       console.log('🎉 Card already complete, nothing to do');
//       return;
//     }

//     let count = await getStampCount();
//     if (count === null) {
//       console.warn('⚠️ Could not read stamp count, assuming 0');
//       count = 0;
//     }
//     const remaining = TOTAL_STAMPS - count;
//     console.log(`📊 Current: ${count}/${TOTAL_STAMPS} → need ${remaining} more`);

//     for (let n = 1; n <= remaining; n++) {
//       const before = count;
//       console.log(`\n🎯 Stamp ${n}/${remaining} (card at ${before})`);

//       const ok = await makeStamp({
//         isRegistered: async () => {
//           if (await isRewardShown()) return true;
//           const c = await getStampCount();
//           if (c === null) return true; // العداد مش مقروء: نفترض إن الـ phase 1 نجحت
//           return c > before;
//         },
//       });

//       if (!ok) throw new Error(`Stamp ${n} failed (card stuck at ${before}/${TOTAL_STAMPS})`);

//       if (await isRewardShown()) break;
//       count = (await getStampCount()) ?? before + 1;
//     }

//     // 8. تأكد إن رسالة النجاح ظهرت
//     const msg = await $(`android=new UiSelector().text("${REWARD_TEXT}")`);
//     await msg.waitForDisplayed({ timeout: 15000 });
//     console.log('🎉 SUCCESS: "You did it! 🎉" displayed');
//   });
// });
// // ============================================================
// // Helper: makeStamp
// // Holds stamps 1, 2, 3, and 4 simultaneously.
// // While holding them, presses stamp 5 for 2 seconds.
// // ============================================================
//   async function getCenter(el) {
//   const loc = await el.getLocation();
//   const size = await el.getSize();
//   return { x: Math.floor(loc.x + size.width / 2), y: Math.floor(loc.y + size.height / 2) };
// }

// // عدّل الدالة دي حسب أي مؤشر فعلي للاستامب (عداد، نص، ..إلخ)
// async function didStampRegister() {
//   const msg = await $('android=new UiSelector().textContains("collected all")');
//   return await msg.isDisplayed().catch(() => false);
// }

// // ============================================================
// // makeStamp
// // ============================================================
// async function makeStamp({ fiveFingerHoldMs = 30000, fallbackRounds = 5 } = {}) {
//   for (const label of ['1', '2', '3', '4']) {
//     const el = await $(`android=new UiSelector().text("${label}")`);
//     await el.waitForDisplayed({ timeout: 10000 });
//   }

//   // إحداثيات 1-4 ثابتة، وإصبع 5 من العنصر نفسه (fallback للإحداثي الثابت)
//   const points = [
//     { x: 245, y: 690 },
//     { x: 476, y: 690 },
//     { x: 204, y: 915 },
//     { x: 516, y: 915 },
//   ];
//   let p5 = { x: 360, y: 939 };
//   try {
//     const el5 = await $('android=new UiSelector().text("5")');
//     if (await el5.isDisplayed().catch(() => false)) p5 = await getCenter(el5);
//   } catch {}
//   console.log(`📍 Finger 5 at (${p5.x}, ${p5.y})`);

//   const holdFinger = (point, i, holdMs) => ({
//     type: 'pointer',
//     id: `finger${i + 1}`,
//     parameters: { pointerType: 'touch' },
//     actions: [
//       { type: 'pointerMove', duration: 0, x: point.x, y: point.y },
//       { type: 'pointerDown', button: 0 },
//       { type: 'pause', duration: holdMs },
//       { type: 'pointerUp', button: 0 },
//     ],
//   });

//   // ---------- المرحلة 1: 5 صوابع مع بعض 30 ثانية ----------
//   try {
//     console.log(`🖐️ Phase 1: 5 fingers for ${fiveFingerHoldMs / 1000}s`);
//     await driver.performActions([
//       ...points.map((p, i) => holdFinger(p, i, fiveFingerHoldMs)),
//       holdFinger(p5, 4, fiveFingerHoldMs),
//     ]);
//   } catch (err) {
//     console.warn('⚠️ 5-finger gesture failed:', err.message);
//   } finally {
//     await driver.releaseActions().catch(() => {});
//   }

//   await driver.pause(1000);
//   if (await didStampRegister()) {
//     console.log('✅ Stamp registered in phase 1');
//     return;
//   }

//   // ---------- المرحلة 2: 4 صوابع ثابتة + ضغطات متكررة على 5 ----------
//   console.log('🔁 Phase 2: 4 fingers held + tapping 5');
//   const tapsPerRound = 10;
//   const tapDown = 150;   // مدة الضغطة
//   const tapGap = 400;    // الفاصل بين الضغطات
//   const roundMs = 1000 + tapsPerRound * (tapDown + tapGap) + 500;

//   for (let round = 1; round <= fallbackRounds; round++) {
//     console.log(`   Round ${round}/${fallbackRounds}`);

//     const fingers14 = points.map((p, i) => holdFinger(p, i, roundMs));

//     const tapActions = [
//       { type: 'pause', duration: 1000 }, // استنى الأربعة يتثبتوا
//       { type: 'pointerMove', duration: 0, x: p5.x, y: p5.y },
//     ];
//     for (let t = 0; t < tapsPerRound; t++) {
//       tapActions.push(
//         { type: 'pointerDown', button: 0 },
//         { type: 'pause', duration: tapDown },
//         { type: 'pointerUp', button: 0 },
//         { type: 'pause', duration: tapGap },
//       );
//     }
//     const finger5 = {
//       type: 'pointer',
//       id: 'finger5',
//       parameters: { pointerType: 'touch' },
//       actions: tapActions,
//     };

//     try {
//       await driver.performActions([...fingers14, finger5]);
//     } catch (err) {
//       console.warn('⚠️ Phase 2 gesture failed:', err.message);
//     } finally {
//       await driver.releaseActions().catch(() => {});
//     }

//     await driver.pause(1000);
//     if (await didStampRegister()) {
//       console.log(`✅ Stamp registered in phase 2 (round ${round})`);
//       return;
//     }
//   }

//   console.warn('❌ Stamp not registered after all rounds');
// }
// // async function makeStamp() {
// //   const labels = ['1', '2', '3', '4'];

// //   for (const label of labels) {
// //     const el = await $(`android=new UiSelector().text("${label}")`);
// //     await el.waitForDisplayed({ timeout: 10000 });
// //   }

// //   // Coordinates are based on the current 720x1456 UI hierarchy.
// //   // Verify the fifth coordinate against the actual stamp-5 target.
// //   const points = [
// //     { x: 245, y: 690 },  // Finger 1
// //     { x: 476, y: 690 },  // Finger 2
// //     { x: 204, y: 915 },  // Finger 3
// //     { x: 516, y: 915 },  // Finger 4
// //   { x: 360, y: 939 },  // Finger 5 — new test
// //   ];

// //   const firstFour = points.slice(0, 4).map((point, index) => ({
// //     type: 'pointer',
// //     id: `finger${index + 1}`,
// //     parameters: { pointerType: 'touch' },
// //     actions: [
// //       { type: 'pointerMove', duration: 0, x: point.x, y: point.y },
// //       { type: 'pointerDown', button: 0 },

// //       // Align with finger 5, then keep all five pressed together.
// //       { type: 'pause', duration: 1000 },
// //       { type: 'pause', duration: 2000 },

// //       // Keep fingers 1-4 down briefly after finger 5 lifts.
// //       { type: 'pause', duration: 500 },
// //       { type: 'pointerUp', button: 0 },
// //     ],
// //   }));

// //   const fifthFinger = {
// //     type: 'pointer',
// //     id: 'finger5',
// //     parameters: { pointerType: 'touch' },
// //     actions: [
// //       { type: 'pause', duration: 1000 },
// //       { type: 'pointerMove', duration: 0, x: points[4].x, y: points[4].y },
// //       { type: 'pointerDown', button: 0 },

// //       // All five fingers stay pressed together for 2 seconds.
// //       { type: 'pause', duration: 2000 },
// //       { type: 'pointerUp', button: 0 },
// //       { type: 'pause', duration: 500 },
// //     ],
// //   };

// //   try {
// //     console.log('Starting five-finger stamp gesture...');
// //     await driver.performActions([...firstFour, fifthFinger]);
// //     console.log('Five-finger gesture completed.');
// //   } finally {
// //     await driver.releaseActions();
// //   }

// //   await driver.pause(1000);
// // }



// // async function makeStamp() {
// //     // 1. لاقي العناصر
// //     const el1 = await $('android=new UiSelector().text("1")');
// //     const el2 = await $('android=new UiSelector().text("2")');
// //     const el3 = await $('android=new UiSelector().text("3")');
// //     const el4 = await $('android=new UiSelector().text("4")');
// //     const el5 = await $('android=new UiSelector().text("5")');

// //     await el1.waitForDisplayed({ timeout: 10000 });
// //     await el2.waitForDisplayed({ timeout: 10000 });
// //     await el3.waitForDisplayed({ timeout: 10000 });
// //     await el4.waitForDisplayed({ timeout: 10000 });

// //     // ✅ تشخيص: هل 5 موجود ومرئي؟
// //     console.log('🔍 Checking element 5...');
// //     let el5Displayed = false;
// //     let el5Loc = null;
// //     let el5Size = null;
// //     try {
// //         el5Displayed = await el5.isDisplayed().catch(() => false);
// //         el5Loc = await el5.getLocation().catch(() => null);
// //         el5Size = await el5.getSize().catch(() => null);
// //         console.log(`   5 displayed: ${el5Displayed}`);
// //         console.log(`   5 location: ${JSON.stringify(el5Loc)}`);
// //         console.log(`   5 size: ${JSON.stringify(el5Size)}`);
// //     } catch (err) {
// //         console.warn('   ⚠️ Error checking element 5:', err.message);
// //     }

// //     if (!el5Displayed) {
// //         console.warn('⚠️ Element 5 is NOT displayed! Dumping page source...');
// //         const source = await driver.getPageSource();
// //         const lines = source.split('\n').filter(l => l.includes('text="5"') || l.includes('text="4"'));
// //         console.log('📋 Lines with text="5" or text="4":');
// //         console.log(lines.join('\n'));
// //         throw new Error('Element 5 not displayed — cannot make stamp');
// //     }

// //     // 2. احسب الإحداثيات
// //     const getCenter = async (el) => {
// //         const loc = await el.getLocation();
// //         const size = await el.getSize();
// //         return {
// //             x: Math.floor(loc.x + size.width / 2),
// //             y: Math.floor(loc.y + size.height / 2),
// //         };
// //     };

// //     const c1 = await getCenter(el1);
// //     const c2 = await getCenter(el2);
// //     const c3 = await getCenter(el3);
// //     const c4 = await getCenter(el4);
// //     const c5 = { x: Math.floor(el5Loc.x + el5Size.width / 2), y: Math.floor(el5Loc.y + el5Size.height / 2) };

// //     console.log(`🔢 Coordinates: 1=(${c1.x},${c1.y}), 2=(${c2.x},${c2.y}), 3=(${c3.x},${c3.y}), 4=(${c4.x},${c4.y}), 5=(${c5.x},${c5.y})`);

// //     // 3. ✅ 1,2,3,4 multi-touch (4 أصابع — مدعوم)
// //     console.log('👆 Tapping 1,2,3,4 (multi-touch)...');
// //     await driver.performActions([
// //         { type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions: [
// //             { type: 'pointerMove', duration: 0, x: c1.x, y: c1.y },
// //             { type: 'pointerDown', button: 0 },
// //             { type: 'pause', duration: 1500 },  // ✅ فضل دايس 1.5 ثانية
// //             { type: 'pointerUp', button: 0 },
// //         ]},
// //         { type: 'pointer', id: 'finger2', parameters: { pointerType: 'touch' }, actions: [
// //             { type: 'pointerMove', duration: 0, x: c2.x, y: c2.y },
// //             { type: 'pointerDown', button: 0 },
// //             { type: 'pause', duration: 5000 },
// //             { type: 'pointerUp', button: 0 },
// //         ]},
// //         { type: 'pointer', id: 'finger3', parameters: { pointerType: 'touch' }, actions: [
// //             { type: 'pointerMove', duration: 0, x: c3.x, y: c3.y },
// //             { type: 'pointerDown', button: 0 },
// //             { type: 'pause', duration: 5000 },
// //             { type: 'pointerUp', button: 0 },
// //         ]},
// //         { type: 'pointer', id: 'finger4', parameters: { pointerType: 'touch' }, actions: [
// //             { type: 'pointerMove', duration: 0, x: c4.x, y: c4.y },
// //             { type: 'pointerDown', button: 0 },
// //             { type: 'pause', duration: 5000 },
// //             { type: 'pointerUp', button: 0 },
// //         ]},
// //     ]);
// //     console.log('✅ Tapped 1,2,3,4 (multi-touch, 1.5s hold)');

// //     // 4. ✅ استنى شوية
// //     await driver.pause(300);

// //     // 5. ✅ 5 single touch — بطريقتين (احتياطي)
// //     console.log('👆 Tapping 5 (single touch)...');
    
// //     // طريقة 1: el5.click()
// //     try {
// //         await el5.click();
// //         console.log('✅ Tapped 5 via el5.click()');
// //     } catch (err) {
// //         console.warn('⚠️ el5.click() failed:', err.message);
        
// //         // طريقة 2: performActions بإصبع واحد
// //         try {
// //             await driver.performActions([
// //                 { type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions: [
// //                     { type: 'pointerMove', duration: 0, x: c5.x, y: c5.y },
// //                     { type: 'pointerDown', button: 0 },
// //                     { type: 'pause', duration: 5000 },
// //                     { type: 'pointerUp', button: 0 },
// //                 ]},
// //             ]);
// //             console.log('✅ Tapped 5 via performActions (single)');
// //         } catch (err2) {
// //             console.error('❌ Both tap methods failed:', err2.message);
            
// //             // طريقة 3: ADB
// //             try {
// //                 const { execSync } = require('child_process');
// //                 execSync(`adb shell input tap ${c5.x} ${c5.y}`);
// //                 console.log('✅ Tapped 5 via ADB');
// //             } catch (err3) {
// //                 console.error('❌ ADB also failed:', err3.message);
// //                 throw err3;
// //             }
// //         }
// //     }

// //     await driver.pause(1000);
// // }



// // ============================================================
// // Helper: findCardButton
// // Finds a card button (Add or Remove) using multiple selectors.
// // ============================================================
// async function findCardButton(cardName) {
//     const selectors = [
//         `~Add ${cardName} stamp card`,
//         `~Remove ${cardName} stamp card`,
//         `android=new UiSelector().descriptionContains("Add ${cardName}")`,
//         `android=new UiSelector().descriptionContains("Remove ${cardName}")`,
//         `android=new UiSelector().descriptionContains("${cardName}")`,
//         `android=new UiSelector().textContains("${cardName}")`,
//         `//*[contains(@content-desc, "${cardName}")]`,
//         `//*[contains(@text, "${cardName}")]`,
//     ];

//     for (const sel of selectors) {
//         try {
//             const el = await $(sel);
//             const isDisplayed = await el.isDisplayed().catch(() => false);
//             if (isDisplayed) {
//                 console.log(`✅ Found "${cardName}" using selector: ${sel}`);
//                 return el;
//             }
//         } catch {}
//     }
//     return null;
// }

// // ============================================================
// // Helper: scrollDown
// // ============================================================
// async function scrollDown() {
//     const { width, height } = await driver.getWindowSize();
//     await driver.action('pointer')
//         .move({ x: Math.floor(width / 2), y: Math.floor(height * 0.8) })
//         .down()
//         .move({ x: Math.floor(width / 2), y: Math.floor(height * 0.2) })
//         .up()
//         .perform();
//     await driver.pause(1000);
// }

// // ============================================================
// // Helper: ensureCardAdded
// // If the card is already added (button says "Remove"), remove it
// // first, then add it. If not added, just add it.
// // Returns the button element after adding (should say "Remove").
// // ============================================================
// async function ensureCardAdded(cardName) {
//     console.log(`🔍 Looking for "${cardName}" card...`);
//     let card = await findCardButton(cardName);

//     if (!card) {
//         console.log('⏳ Not found, scrolling down...');
//         await scrollDown();
//         card = await findCardButton(cardName);
//     }

//     if (!card) {
//         console.error(`❌ Could not find "${cardName}" card.`);
//         const source = await driver.getPageSource();
//         const relevant = source.split('\n').filter(l =>
//             l.includes('content-desc') || l.includes(cardName)
//         );
//         console.log(relevant.join('\n'));
//         throw new Error(`Cannot find ${cardName} card on screen`);
//     }

//     const desc = await card.getAttribute('content-desc').catch(() => '');
//     const text = await card.getText().catch(() => '');
//     const isRemove = (desc + text).toLowerCase().includes('remove');

//     if (isRemove) {
//         console.log(`⚠️ "${cardName}" already added, removing it first...`);
//         await card.click();
//         await driver.pause(2500);

//         // ✅ بعد الإزالة، ارجع لصفحة "Add new card" تاني
//         console.log('🔄 Going back to "Add new card" page...');
//         try {
//             const backBtn = await $('~Back');
//             if (await backBtn.isDisplayed().catch(() => false)) {
//                 await backBtn.click();
//                 await driver.pause(1500);
//             }
//         } catch {}

//         // ✅ ادخل "Add new card" تاني
//         const addNewCard = await $('android=new UiSelector().text("Add new card")');
//         await addNewCard.waitForDisplayed({ timeout: 10000 });
//         await addNewCard.click();
//         await driver.pause(1500);

//         // ✅ دور على الكارت تاني
//         card = await findCardButton(cardName);

//         if (!card) {
//             console.log('⏳ Card not found after re-entering, scrolling...');
//             await scrollDown();
//             card = await findCardButton(cardName);
//         }

//         if (!card) {
//             console.error(`❌ Could not find "${cardName}" after re-entering. Page source:`);
//             const source = await driver.getPageSource();
//             const relevant = source.split('\n').filter(l =>
//                 l.includes('content-desc') || l.includes(cardName)
//             );
//             console.log(relevant.join('\n'));
//             throw new Error(`Cannot find Add ${cardName} after re-entering`);
//         }
//     }

//     await card.click();
//     console.log(`✅ Clicked "${cardName}" card (added)`);

//     await driver.pause(1500);
//     return card;
// }
// // ============================================================
// // Tests
// // ============================================================
// describe('Magic Stamp - Navigation & Filtering', () => {
//     it('should navigate to Stamp Cards, open Filter, and select A-Z', async () => {
//         const stampCardsTab = await $('~Stamp Cards tab');
//         await stampCardsTab.waitForDisplayed({ timeout: 10000 });
//         await stampCardsTab.click();

//         const filterBtn = await $('android=new UiSelector().text("Filter")');
//         await filterBtn.waitForDisplayed({ timeout: 5000 });
//         await filterBtn.click();

//         const sortAZ = await $('android=new UiSelector().text("A–Z")');
//         await sortAZ.waitForDisplayed({ timeout: 5000 });
//         await sortAZ.click();

//         const closeIcon = await $('android=new UiSelector().className("com.horcrux.svg.PathView").instance(0)');
//         await closeIcon.waitForDisplayed({ timeout: 5000 });
//         await closeIcon.click();

//         console.log('✅ Test 1 done');
//     });

//    it('should navigate close place from selected location', async () => {
//     // 1. Add new card
//     const addNewCard = await $('android=new UiSelector().text("Add new card")');
//     await addNewCard.waitForDisplayed({ timeout: 10000 });
//     await addNewCard.click();
//     await driver.pause(1500);

//     // 2. Ensure "1066 Bakery" is added
//     await ensureCardAdded('1066 Bakery');

//     // 3. Go back
//     const backBtn = await $('~Back');
//     await backBtn.waitForDisplayed({ timeout: 5000 });
//     await backBtn.click();
//     await driver.pause(1500);

//     // 4. Add new card again
//     const addNewCard2 = await $('android=new UiSelector().text("Add new card")');
//     await addNewCard2.waitForDisplayed({ timeout: 10000 });
//     await addNewCard2.click();
//     await driver.pause(1500);

//     // 5. Ensure "10 Islands" is added
//     await ensureCardAdded('10 Islands');

//     // 6. ادخل على الكارت نفسه (عشان تشوف شاشة الـ stamp)
//     const islandsCard = await findCardButton('10 Islands');
//     if (islandsCard) {
//         await islandsCard.click();
//         await driver.pause(2000);
//     }

//     // 7. Show finger guide (لو موجود)
//     try {
//         const showfinger = await $('~Show finger guide');
//         const isDisplayed = await showfinger.isDisplayed().catch(() => false);
//         if (isDisplayed) {
//             await showfinger.click();
//             console.log('✅ Clicked Show finger guide');
//             await driver.pause(1000);
//         } else {
//             console.log('⚠️ Show finger guide not found, skipping');
//         }
//     } catch (err) {
//         console.warn('⚠️ Show finger guide error:', err.message);
//     }

//     // 8. ✅ Loop على makeStamp لحد ما تظهر رسالة "collected all 10 stamps"
//     const successMessage = 'You’ve collected all 10 stamps and unlocked your reward!';
//     const maxAttempts = 15;  // 15 محاولة كحد أقصى (أكتر من 10 احتياطي)
    
//     for (let attempt = 1; attempt <= maxAttempts; attempt++) {
//         console.log(`\n🎯 Stamp attempt ${attempt}/${maxAttempts}`);
        
//         // 8a. اعمل stamp
//         try {
//             await makeStamp();
//             console.log(`✅ Stamp ${attempt} completed`);
//         } catch (err) {
//             console.warn(`⚠️ Stamp ${attempt} failed:`, err.message);
//         }

//         // 8b. استنى 5 ثواني (زي ما طلبت)
//         await driver.pause(5000);

//         // 8c. شوف لو الرسالة ظهرت
//         const messageEl = await $(`android=new UiSelector().text("${successMessage}")`);
//         const isMessageDisplayed = await messageEl.isDisplayed().catch(() => false);

//         if (isMessageDisplayed) {
//             console.log(`\n🎉 SUCCESS! Message appeared after ${attempt} stamps:`);
//             console.log(`   "${successMessage}"`);
//             break;  // خلاص، اخرج من الـ loop
//         } else {
//             console.log(`⏳ Message not shown yet (attempt ${attempt}/${maxAttempts})`);
//         }

//         // 8d. لو وصلنا لآخر محاولة ومفيش رسالة، نفشل
//         if (attempt === maxAttempts) {
//             throw new Error(
//                 `❌ After ${maxAttempts} attempts, message "${successMessage}" did not appear`
//             );
//         }
//     }

//     console.log('✅ Test 2 done');
// });
// });