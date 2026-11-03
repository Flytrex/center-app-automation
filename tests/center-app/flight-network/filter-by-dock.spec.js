// Description: Opens the Flight Network filter (icon next to the search field), selects Dock, applies, and checks only docks are listed.
import { test, expect } from '../../fixtures.js';

// Open Flight Network directly, using the saved login session
test.use({ startPage: '/flight-network' });

test('filters the entities list by Dock', async ({ page }) => {
  const count = page.getByText(/^\d+ Entities$/);
  await expect(count).toBeVisible();
  const countBefore = await count.textContent();

  // The filter (funnel) icon is the first icon after the search field; the magnifier comes before it
  await page.locator('input[name="search"]').locator('xpath=following::*[name()="svg"][1]').click({ timeout: 10_000 });

  await page.getByText('Dock', { exact: true }).click({ timeout: 10_000 });
  await expect(page.locator('input[name="dock"]')).toBeChecked();
  await page.getByRole('button', { name: /apply/i }).click({ timeout: 10_000 });

  // Pause so the filtered result can be seen
  await page.waitForTimeout(1000);

  // The list now shows only docks
  await expect(count).not.toHaveText(countBefore);
  await page.getByRole('grid').evaluate(list => { list.scrollTop = 0; });
  const types = page.locator('[role="rowgroup"] p[type]');
  await expect(types.first()).toBeVisible();
  for (const type of await types.all()) {
    await expect(type).toHaveAttribute('type', 'dock');
  }
});
