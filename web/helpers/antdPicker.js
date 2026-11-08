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

async function pickAntDate(page, fieldName, dateObj, { hour = 10, minute = 0 } = {}) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const title = `${y}-${m}-${d}`;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const input = page.getByRole('textbox', { name: fieldName });

  await input.click();
  // Scope everything to the VISIBLE dropdown — hidden dropdowns of previous
  // picks stay in the DOM with identical grids inside.
  const dd = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').first();
  await dd.waitFor({ state: 'visible', timeout: 10000 });

  // Cross month-end? Walk forward until the target date cell exists.
  const cell = dd.locator(`.ant-picker-cell[title="${title}"]`).first();
  for (let i = 0; i < 13; i++) {
    if (await cell.isVisible().catch(() => false)) break;
    await dd.locator('.ant-picker-next-btn').first().click();
    await cell.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
  }
  if (!(await cell.isVisible().catch(() => false))) {
    throw new Error(`${fieldName}: date cell ${title} never appeared in the picker`);
  }
  await cell.click();

  // Time columns may not exist (pure date pickers have none).
  const timeColumns = dd.locator('.ant-picker-time-panel-column');
  const hasTime = (await timeColumns.count()) > 0 && (
    await timeColumns.nth(0).isVisible().catch(() => false)
  );
  let committed;
  if (hasTime) {
    await timeColumns.nth(0)
      .locator('.ant-picker-time-panel-cell-inner', { hasText: new RegExp(`^${hour}$`) })
      .first().click();
    await timeColumns.nth(1)
      .locator('.ant-picker-time-panel-cell-inner', { hasText: new RegExp(`^0*${minute}$`) })
      .first().click();
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
  const okExists = (await ok.count()) > 0;
  if (okExists) {
    await expect(ok).toBeEnabled({ timeout: 10000 });
    await ok.click();
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
  await option.click({ force: true, timeout: 10000 });
  await expect(dd).toBeHidden({ timeout: 10000 });
}

module.exports = { pickAntDate, selectFirstAntOption };
