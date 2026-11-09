/**
 * Shared Ant Design picker driver (Click-based — the vendor portal rejects
 * typed text and any PAST datetime: the OK button stays disabled until the
 * picked date+time is in the future). The placeholder may read mm/dd/yyyy,
 * but the value the app commits and displays is DD/MM/YYYY HH:mm.
 *
 * pickAntDate(page, fieldName, dateObj, options)
 *   - opens the picker for the given field, walks to the target month if
 *     needed, clicks the date cell (stable title="YYYY-MM-DD"), clicks the
 *     hour/minute columns, then OK once the app enables it.
 */
const { expect } = require('@playwright/test');

// The antd picker panel re-renders continuously on CI (live "Now" display +
// timezone recalculation), so its cells/buttons never pass Playwright's
// element-STABILITY check — the default click retries forever and burns the
// whole test budget (run 42666769696: "retrying click action" x15 → timeout).
// Strategy: a short normal click first (keeps local runs honest), then a
// FORCE click that skips actionability entirely and lands the DOM event.
async function clickStable(locator, { normalTimeout = 5000, okTimeout = 15000 } = {}) {
  try {
    await locator.click({ timeout: normalTimeout });
  } catch {
    await locator.click({ force: true, timeout: okTimeout });
  }
}

async function pickAntDate(page, fieldName, dateObj, { hour = 10, minute = 0 } = {}) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const title = `${y}-${m}-${d}`;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const input = page.getByRole('textbox', { name: fieldName });

  // Bound every action — an unbounded click inheriting the TEST timeout
  // burned 240s on CI (run 42666769696) instead of failing fast.
  await input.click({ timeout: 8000 }).catch(() => {
    // Slow 2-core CI can see the form re-layout under the pointer; retry once.
    return input.click({ force: true, timeout: 15000 });
  });
  // Scope everything to the VISIBLE dropdown — hidden dropdowns of previous
  // picks stay in the DOM with identical grids inside.
  const dd = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first();
  await dd.waitFor({ state: 'visible', timeout: 10000 });

  // Cross month-end? Walk forward until the target date cell exists.
  const cell = dd.locator(`.ant-picker-cell[title="${title}"]`).first();
  for (let i = 0; i < 13; i++) {
    if (await cell.isVisible().catch(() => false)) break;
    await dd.locator('.ant-picker-next-btn').first()
      .click({ force: true, timeout: 5000 }).catch(() => {});
    await cell.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  }
  if (!(await cell.isVisible().catch(() => false))) {
    throw new Error(`${fieldName}: date cell ${title} never appeared in the picker`);
  }
  // The cell click MUST go through the stability workaround — antd's panel
  // re-renders continuously (live "Now" + timezone recalc), so a plain
  // click never passes Playwright's stability check and retried forever on
  // CI, burning the whole test budget (run 42677697271: locator resolved,
  // click never landed). Local runs usually win the race; CI never does.
  await clickStable(cell);

  // Time columns may not exist (pure date pickers have none).
  const timeColumns = dd.locator('.ant-picker-time-panel-column');
  const hasTime = (await timeColumns.count()) > 0 && (
    await timeColumns.nth(0).isVisible().catch(() => false)
  );
  // Pick the date (+time when present), then confirm only once OK is ENABLED.
  // On 2-core CI the picker re-renders slowly and can swallow the first cell
  // click — leaving OK permanently DISABLED (run 42481009511 boost failure:
  // calendar open, OK disabled, start field empty at test abort). Re-pick
  // once before giving up with a precise diagnosis.
  const pickOnce = async () => {
    await clickStable(cell);
    if (hasTime) {
      await clickStable(timeColumns.nth(0)
        .locator('.ant-picker-time-panel-cell-inner', { hasText: new RegExp(`^${hour}$`) })
        .first());
      await clickStable(timeColumns.nth(1)
        .locator('.ant-picker-time-panel-cell-inner', { hasText: new RegExp(`^0*${minute}$`) })
        .first());
    }
  };
  let committed;
  if (hasTime) {
    committed = `${d}/${m}/${y} ${hh}:${mm}`;
  } else {
    // Pure date pickers display "DD MMM YYYY" (e.g. 07 Nov 2026).
    const mon = dateObj.toLocaleString('en', { month: 'short' });
    committed = `${d} ${mon} ${y}`;
  }

  // PURE date pickers commit + close the panel on the cell click itself (no
  // OK button at all — and their closing animation lasts ~200ms, so only by
  // the OK button EXISTING do we know confirmation is needed).
  const ok = dd.locator('button:has-text("OK")').first();
  if ((await ok.count()) > 0) {
    let enabled = false;
    for (let attempt = 1; attempt <= 2 && !enabled; attempt++) {
      await pickOnce();
      enabled = await ok.isEnabled({ timeout: attempt === 1 ? 4000 : 10_000 }).catch(() => false);
      if (!enabled) {
        // Re-open the panel: a swallowed pick may have closed/reactivated it.
        await input.click({ timeout: 8000 }).catch(() =>
          input.click({ force: true, timeout: 8000 }).catch(() => {}));
        await dd.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      }
    }
    if (!enabled) {
      throw new Error(
        `pickAntDate(${fieldName}): picker OK stayed DISABLED after 2 pick attempts ` +
        `(picked ${committed}) — the app rejects this datetime (too old?) or the pick never registered.`
      );
    }
    await clickStable(ok, { okTimeout: 8000 });
  }

  // Commit proof: input holds the picked value. Formats differ per picker
  // ("DD/MM/YYYY HH:mm" here, "DD MMM YYYY" for date-only ones, and raw ISO
  // "YYYY-MM-DD HH:mm:ss" in newer forms like the boost wizard).
  const iso = `${y}-${m}-${d} ${hh}:${mm}`;
  await expect(input).toHaveValue(new RegExp(`^(${committed.replace(/[/.]/g, '.')}|${iso})`), { timeout: 10000 });
}

/** Select the FIRST rendered option of an open antd Select dropdown. */
async function selectFirstAntOption(page) {
  const dd = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .first();
  const option = dd.locator('.ant-select-item-option').first();
  // The virtual list can re-render while clicking, which never satisfies the
  // default actionability check — force the click, then PROVE the selection
  // by waiting for the dropdown to close (selection always closes it).
  // On CI (bundled Linux Chromium + different fonts/scrollbars) the resolved
  // option can sit outside the viewport → force click alone still fails
  // ("Element is outside of the viewport", run 42468451637). Scroll it in
  // first; virtual-list re-layouts may race, so tolerate a failed scroll.
  await option.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await option.click({ force: true, timeout: 10000 });
  await expect(dd).toBeHidden({ timeout: 10000 });
}

module.exports = { pickAntDate, selectFirstAntOption };
