// Description: Searches Flight Network for 'launchpad', expands the first result to show its details, then collapses it.
import { test, expect } from '../../fixtures.js';

// Open Flight Network directly, using the saved login session
test.use({ startPage: '/flight-network' });

test('expands and collapses the first launchpad result', async ({ page }) => {
  await expect(page.getByText(/^\d+ Entities$/)).toBeVisible();

  // The list is virtualized, so DOM order isn't screen order: the first result is the row at top: 0
  const firstResult = page.locator('[role="rowgroup"] > div[style*="top: 0px"]');
  await expect(firstResult).toBeVisible();

  // Typing before the list settles can get wiped, so retype until the results are filtered
  const search = page.locator('input[name="search"]');
  await expect(async () => {
    await search.fill('launchpad');
    // The list keeps its scroll position after filtering, so scroll back up to bring the first result into view
    await page.getByRole('grid').evaluate(list => { list.scrollTop = 0; });
    await expect(firstResult.getByRole('paragraph').first()).toHaveText(/launchpad/i, { timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  const name = await firstResult.getByRole('paragraph').first().textContent();

  // Expand: the row turns into a details form with the entity's name and coordinates
  await firstResult.getByRole('paragraph').first().click();
  await expect(firstResult.locator('input[name="Entity name"]')).toHaveValue(name);
  await expect(firstResult.getByText('LAT (DEG)')).toBeVisible();
  await expect(firstResult.getByText('LONG (DEG)')).toBeVisible();

  // Pause so the details can be seen
  await page.waitForTimeout(1000);

  // Collapse: the name is now an input, so click the row's icon instead
  await firstResult.locator('svg').first().click();
  await expect(firstResult.locator('input[name="Entity name"]')).toHaveCount(0);
  await expect(firstResult.getByRole('paragraph').first()).toHaveText(name);
});
