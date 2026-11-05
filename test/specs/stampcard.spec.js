// ============================================================
// Config
// ============================================================
const TOTAL_STAMPS = 10; // fallback فقط لو العداد مش مقروء (للتشخيص)
const REWARD_TEXT = 'You did it! 🎉';
const ADD_NEW_CARD = 'android=new UiSelector().text("Add new card")';
const REMOVE_BTN = 'android=new UiSelector().descriptionStartsWith("Remove ")';
const ADD_BTN = 'android=new UiSelector().descriptionMatches("^Add .* stamp card$")';
const CARDS_TO_USE = 2;

const MAX_STAMP_ATTEMPTS = 20;      // حد أقصى احتياطي للمحاولات
const PAUSE_AFTER_STAMP_MS = 2000;  // استنى بعد كل استامب قبل ما تشوف الرسالة

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

// يدور على رسالة النجاح بأكتر من طريقة (text / textContains / content-desc)
async function isRewardShown() {
  if (await isDisplayedSafe(`android=new UiSelector().text("${REWARD_TEXT}")`)) return true;
  if (await isDisplayedSafe('android=new UiSelector().textContains("did it")')) return true;
  if (await isDisplayedSafe('android=new UiSelector().descriptionContains("did it")')) return true;
  return false;
}

// ============================================================
// getStampCount — للتشخيص فقط (مش للتحكم في الـ loop)
// بيرجع { current, total } أو null
// ============================================================
async function getStampCount() {
  const src = await driver.getPageSource();

  // 1) من content-desc بتاع زرار التقدم
  //    مثال: "1 of 8 stamps to get reward..."
  const descMatch = src.match(/content-desc="(\d+)\s+of\s+(\d+)\s+stamps?/i);
  if (descMatch) {
    return {
      current: parseInt(descMatch[1], 10),
      total: parseInt(descMatch[2], 10),
    };
  }

  // 2) fallback: من النص "1/8"
  const textMatch = src.match(/text="(\d+)\s*\/\s*(\d+)"/);
  if (textMatch) {
    return {
      current: parseInt(textMatch[1], 10),
      total: parseInt(textMatch[2], 10),
    };
  }

  return null;
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
  // The numbered markers (1..5) only exist while the finger-guide overlay
  // is toggled on. If marker 1 is missing, tap the top-bar eye icon.
  const stampSel = (n) => `android=new UiSelector().text("${n}")`;
  if (!(await isDisplayedSafe(stampSel('1'), 3000))) {
    const guideBtn = await $('~Show finger guide');
    if (await guideBtn.isDisplayed().catch(() => false)) {
      console.log('👁️ Finger overlay off — tapping "Show finger guide"');
      await guideBtn.click().catch(() => {});
      await driver.pause(1500);
    }
  }

  for (const label of ['1', '2', '3', '4']) {
    const el = await $(`${stampSel(label)}`);
    await el.waitForDisplayed({ timeout: 10000 });
  }

  // Working pattern coordinates (verified against the 10-stamp card layout)
  const points = [
    { x: 245, y: 690 },
    { x: 476, y: 690 },
    { x: 204, y: 915 },
    { x: 516, y: 915 },
  ];
  let p5 = { x: 360, y: 939 };
  try {
    const el5 = await $(stampSel('5'));
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
    if (/session|invalid|disconnected/i.test(err.message)) throw err;
  } finally {
    await driver.releaseActions().catch(() => {});
  }

  await driver.pause(1500);
  if (isRegistered && (await isRegistered())) {
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
      if (/session|invalid|disconnected/i.test(err.message)) throw err;
    } finally {
      await driver.releaseActions().catch(() => {});
    }

    await driver.pause(1500);
    if (isRegistered && (await isRegistered())) {
      console.log(`✅ Stamp registered in phase 2 (round ${round})`);
      return true;
    }
  }

  console.warn('❌ Stamp not confirmed by isRegistered after all rounds');
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

async function goBackToCards() {
  await driver.pause(1500);
  await driver.back();
  await driver.pause(1500);
}

async function ensureSheetOpen() {
  if (await isDisplayedSafe('~Close')) return;

  if (await isDisplayedSafe(ADD_NEW_CARD)) {
    await openAddCardSheet();
    return;
  }

  await goBackToCards();

  if (!(await isDisplayedSafe(ADD_NEW_CARD))) {
    await driver.back().catch(() => {});
    await driver.pause(1500);
  }

  await openAddCardSheet();
}

// ============================================================
// Sheet helpers
// ============================================================

// بيشيل كل الكاردات المضافة الظاهرة في الشيت
async function removeAllAddedCards() {
  await ensureSheetOpen();

  let removed = 0;
  // Rows may legally repeat (same card name in different locations, e.g.
  // "1863" ×3) → same content-desc. Track *consecutive* repeats instead of
  // banning any repeat, and only bail when the same button survives clicks.
  let lastDesc = null;
  let sameStreak = 0;

  while (true) {
    const btn = await $(REMOVE_BTN);
    const visible = await btn.isDisplayed().catch(() => false);
    if (!visible) break;

    const desc = await btn.getAttribute('content-desc').catch(() => '');
    if (!desc) break;

    if (desc === lastDesc) {
      sameStreak++;
      if (sameStreak >= 3) {
        console.warn(`⚠️ "${desc}" still visible after 3 clicks — stopping to avoid loop`);
        break;
      }
    } else {
      sameStreak = 0;
      lastDesc = desc;
    }

    console.log(`🗑️ Removing: ${desc}`);
    try {
      await btn.click();
    } catch (err) {
      console.warn(`⚠️ Remove click failed: ${err.message}`);
      break;
    }

    await driver.pause(2500);
    removed++;

    await ensureSheetOpen();

    if (removed >= 30) {
      console.warn('⚠️ Removed 30 cards — stopping (safety limit)');
      break;
    }
  }

  console.log(`✅ Removed ${removed} card(s) from sheet`);
}

async function readTopAddCards(n = CARDS_TO_USE) {
  await driver.pause(1500);
  const buttons = await $$(ADD_BTN);
  const names = [];
  for (const btn of buttons) {
    if (names.length >= n) break;
    if (!(await btn.isDisplayed().catch(() => false))) continue;
    const desc = await btn.getAttribute('content-desc').catch(() => '');
    if (!desc || !desc.startsWith('Add ')) continue;
    if (!desc.endsWith(' stamp card')) continue;
    const name = desc.replace(/^Add /, '').replace(/ stamp card$/, '');
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

async function addCard(name) {
  await ensureSheetOpen();
  await safeClick(`~Add ${name} stamp card`);
  await driver.pause(2000);

  const removeSel = `~Remove ${name} stamp card`;
  const removeBtn = await $(removeSel);
  const stillThere = await removeBtn.isDisplayed().catch(() => false);
  if (!stillThere) {
    console.log(`ℹ️ "${name}" added (Remove button not visible — app may have opened the card)`);
  } else {
    console.log(`✅ Added "${name}" (Remove button visible)`);
  }
}

// Navigate back to the Home tab from any depth (card screen, sheets,
// Stamp cards screen — none of them show the bottom tab bar).
async function goHomeFromAnywhere() {
  const homeTab = await $('~Home tab');
  for (let i = 0; i < 4 && !(await homeTab.isDisplayed().catch(() => false)); i++) {
    await driver.back();
  }
  await homeTab.waitForDisplayed({ timeout: 10000 });
  await homeTab.click();
  const addNewCard = await $(ADD_NEW_CARD);
  await addNewCard.waitForDisplayed({ timeout: 10000 });
}

// ============================================================
// Tests
// ============================================================
const { ensureLoggedIn } = require('../../helpers/mobileSession');

describe('Magic Stamp - Navigation & Filtering', () => {
  // Login once (or reuse the persisted session) before any navigation test.
  before(async () => {
    await ensureLoggedIn();
  });

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
    // 0. الرجوع للـ Home أولاً — التست اللي قبله بيترك التطبيق على شاشة
    // Stamp Cards (مفيش فيها تابات سفلية) — نرجع بالـ Back لحد ما الهوم يظهر.
    await goHomeFromAnywhere();

    // 1. افتح الشيت وشيل كل الكاردات المضافة
    await openAddCardSheet();
    await removeAllAddedCards();

    // 2. اقفل الشيت وافتحه تاني
    await closeSheet();
    await ensureSheetOpen();

    // 3. اقرا أول كاردين ظاهرين
    const names = await readTopAddCards(CARDS_TO_USE);
    if (names.length < CARDS_TO_USE) {
      throw new Error(`Expected ${CARDS_TO_USE} Add cards, found ${names.length}: [${names.join(', ')}]`);
    }
    console.log('📋 Cards to add:', names.join(' | '));

    // 4. ضيف الأول ثم Back
    await addCard(names[0]);
    await goBackToCards();

    // 5. افتح الشيت وضيف التاني (اللي هنعمل عليه الاستامبات)
    await goHomeFromAnywhere();
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

    // 7. لو الكارد مكتمل خلاص → اخرج
    if (await isRewardShown()) {
      console.log('🎉 Card already complete, nothing to do');
      return;
    }

    // 8. اقرا العداد للتشخيص بس (مش للتحكم)
    const startInfo = await getStampCount();
    if (startInfo) {
      console.log(`📊 Starting at: ${startInfo.current}/${startInfo.total} (diagnostic only)`);
    } else {
      console.log('📊 Stamp count unreadable at start (diagnostic only — continuing)');
    }

    // 9. الـ loop الأساسي: اعمل استامب لحد ما رسالة النجاح تظهر
    let attempt = 0;
    let success = false;

    while (attempt < MAX_STAMP_ATTEMPTS) {
      attempt++;
      console.log(`\n🎯 Stamp attempt ${attempt}/${MAX_STAMP_ATTEMPTS}`);

      const infoBefore = await getStampCount();

      // 9a. اعمل استامب
      // isRegistered هنا بس عشان makeStamp تقرر تكمّل Phase 2 ولا لأ
      await makeStamp({
        isRegistered: async () => {
          if (await isRewardShown()) return true;
          const info = await getStampCount();
          if (info === null) return false;
          // لو العداد زاد عن آخر قراءة → فيه تقدم
          return infoBefore ? info.current > infoBefore.current : false;
        },
      });

      // 9b. استنى شوية (animation / تحديث الشاشة)
      await driver.pause(PAUSE_AFTER_STAMP_MS);

      // 9c. الشرط الحقيقي: هل الرسالة ظهرت؟
      if (await isRewardShown()) {
        console.log(`\n🎉 SUCCESS! Reward message appeared after ${attempt} stamp attempt(s)`);
        success = true;
        break;
      }

      // 9d. تشخيص: اقرا العداد (اختياري)
      const info = await getStampCount();
      if (info) {
        console.log(`   📊 Now at: ${info.current}/${info.total} (diagnostic)`);
      } else {
        console.log('   📊 Stamp count unreadable (diagnostic)');
      }
    }

    // 10. لو خلصت المحاولات ومفيش رسالة → فشل
    if (!success) {
      throw new Error(
        `❌ After ${MAX_STAMP_ATTEMPTS} attempts, reward message "${REWARD_TEXT}" did not appear`
      );
    }

    // 11. تأكيد نهائي إن الرسالة ظاهرة
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
// const ADD_NEW_CARD = 'android=new UiSelector().text("Add new card")';
// const CARD_BTN = 'android=new UiSelector().descriptionMatches("^(Add|Remove) .* stamp card$")';
// const CARDS_TO_USE = 2; // أول كاردين ظاهرين في الشيت

// // ============================================================
// // Helpers
// // ============================================================
// async function getCenter(el) {
//   const loc = await el.getLocation();
//   const size = await el.getSize();
//   return { x: Math.floor(loc.x + size.width / 2), y: Math.floor(loc.y + size.height / 2) };
// }

// async function isDisplayedSafe(selector) {
//   const el = await $(selector);
//   return await el.isDisplayed().catch(() => false);
// }

// async function isRewardShown() {
//   return await isDisplayedSafe(`android=new UiSelector().text("${REWARD_TEXT}")`);
// }

// // بيقرا العدد الحالي من الـ page source (مثلاً "7/10" أو "7 of 10")
// async function getStampCount() {
//   const src = await driver.getPageSource();
//   const m = src.match(new RegExp(`(\\d+)\\s*(?:/|of|out of)\\s*${TOTAL_STAMPS}`, 'i'));
//   return m ? parseInt(m[1], 10) : null;
// }

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
// // Navigation helpers
// // ============================================================
// async function openAddCardSheet() {
//   await driver.pause(1000);
//   await safeClick(ADD_NEW_CARD);
//   await driver.pause(1500);
// }

// async function closeSheet() {
//   try {
//     await safeClick('~Close', { timeout: 3000 });
//   } catch {
//     console.log('ℹ️ Close not found (sheet may have closed itself)');
//   }
//   await driver.pause(1500);
// }

// // Back بتاع الأندرويد (من شاشة الكارد لقائمة الكاردات)
// async function goBackToCards() {
//   await driver.pause(1500);
//   await driver.back();
//   await driver.pause(1500);
// }

// // بيتأكد إن الشيت مفتوح (لو مش مفتوح بيفتحه، ولو إحنا في شاشة كارد بيرجع الأول)
// async function ensureSheetOpen() {
//   if (await isDisplayedSafe('~Close')) return;
//   if (!(await isDisplayedSafe(ADD_NEW_CARD))) await goBackToCards();
//   await openAddCardSheet();
// }

// // ============================================================
// // Sheet helpers
// // ============================================================

// // بيقرا أول N كاردات ظاهرة في الشيت: [{ name, state: 'add' | 'remove' }]
// async function readTopCards(n = CARDS_TO_USE) {
//   await driver.pause(1000);
//   const buttons = await $$(CARD_BTN);
//   const cards = [];
//   for (const btn of buttons) {
//     if (cards.length >= n) break;
//     if (!(await btn.isDisplayed().catch(() => false))) continue;
//     const desc = await btn.getAttribute('content-desc');
//     const m = desc.match(/^(Add|Remove) (.*) stamp card$/);
//     if (m) cards.push({ name: m[2], state: m[1].toLowerCase() });
//   }
//   return cards;
// }

// async function removeCard(name) {
//   await ensureSheetOpen();
//   const sel = `~Remove ${name} stamp card`;
//   if (!(await isDisplayedSafe(sel))) {
//     console.log(`ℹ️ No Remove button for "${name}", skipping`);
//     return;
//   }
//   await safeClick(sel);
//   console.log(`🗑️ Removed "${name}"`);
//   await driver.pause(2500);
// }

// async function addCard(name) {
//   await ensureSheetOpen();
//   const sel = `~Add ${name} stamp card`;
//   const end = Date.now() + 10000;
//   while (Date.now() < end && !(await isDisplayedSafe(sel))) {
//     await driver.pause(500);
//   }
//   if (!(await isDisplayedSafe(sel))) {
//     const src = await driver.getPageSource();
//     console.log(src.split('\n').filter(l => l.includes('content-desc')).join('\n'));
//     throw new Error(`Cannot find Add ${name} stamp card`);
//   }
//   await safeClick(sel);
//   console.log(`✅ Added "${name}" (app opens the card after adding)`);
//   await driver.pause(2000);
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
//     // 1. افتح الشيت واقرا أول كاردين ظاهرين
//     await openAddCardSheet();
//     const cards = await readTopCards(CARDS_TO_USE);
//     if (cards.length < CARDS_TO_USE) {
//       throw new Error(`Expected ${CARDS_TO_USE} cards in the sheet, found ${cards.length}`);
//     }
//     console.log('📋 Top cards:', cards.map(c => `${c.name} (${c.state})`).join(' | '));

//     // 2. اللي متضاف → شيله
//     const toRemove = cards.filter(c => c.state === 'remove');
//     for (const c of toRemove) {
//       await removeCard(c.name);
//     }

//     // 3. لو شيلنا حاجة: اقفل الشيت وافتحه تاني
//     if (toRemove.length > 0) {
//       if (await isDisplayedSafe('~Close')) await closeSheet();
//       await ensureSheetOpen();
//     }

//     // 4. ضيف الكارد الأول (التطبيق هيدخل عليه) → Back
//     await addCard(cards[0].name);
//     await goBackToCards();

//     // 5. افتح الشيت وضيف الكارد التاني (التطبيق هيدخل عليه = اللي هنعمل عليه الاستامبات)
//     await openAddCardSheet();
//     await addCard(cards[1].name);
//     await driver.pause(1500);

//     // 6. Show finger guide (لو موجود)
//     try {
//       if (await isDisplayedSafe('~Show finger guide')) {
//         await safeClick('~Show finger guide');
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
//           if (c === null) return true;
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