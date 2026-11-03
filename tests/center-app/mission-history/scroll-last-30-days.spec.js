// Description: Switches the date filter to Last 30 days and scrolls to the bottom of the flights list.
import { test, expect } from '../../fixtures.js';

test('filters to last 30 days and scrolls to the bottom of the flights list', async ({ page }) => {
  const dateFilter = page.locator('select[name="date"]');
  const table = page.getByRole('table');
  const rows = table.getByRole('rowgroup').nth(1).getByRole('row');

  await expect(dateFilter).toHaveValue('Last 7 days');

  await dateFilter.selectOption('Last 30 days');
  await expect(dateFilter).toHaveValue('Last 30 days');

  await page.waitForLoadState('networkidle');
  await expect(rows.first()).toBeVisible();

  // Scroll the table's scrollable container until its height stops growing (handles lazy-loaded rows)
  const scrollToBottom = () => table.evaluate((el) => {
    let container = el.parentElement;
    while (container && !(/(auto|scroll)/.test(getComputedStyle(container).overflowY) && container.scrollHeight > container.clientHeight)) {
      container = container.parentElement;
    }
    if (!container) return null;
    container.scrollTop = container.scrollHeight;
    return {
      height: container.scrollHeight,
      atBottom: Math.ceil(container.scrollTop + container.clientHeight) >= container.scrollHeight,
    };
  });

  let previousHeight = -1;
  await expect.poll(async () => {
    const state = await scrollToBottom();
    if (!state) return true; // list fits without scrolling
    const settled = state.atBottom && state.height === previousHeight;
    previousHeight = state.height;
    return settled;
  }, { intervals: [1000], timeout: 60_000 }).toBe(true);

  await expect(rows.last()).toBeInViewport();
});
