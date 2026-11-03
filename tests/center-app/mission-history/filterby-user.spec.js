// Description: Selects the user Yoni-Tester in the Users filter.
import { test, expect } from '../../fixtures.js';

test('filters mission history by user yoni-tester', async ({ page }) => {
  const userFilter = page.locator('select[name="user"]');

  await expect(userFilter).toHaveValue('__all__');

  await userFilter.selectOption('yoni_tester_@flytrex.com');

  await expect(userFilter).toHaveValue('yoni_tester_@flytrex.com');
  await expect(userFilter.locator('option:checked')).toHaveText('Yoni-Tester - yoni_tester_@flytrex.com');

  // Pause so the selection can be seen before the browser closes
  await page.waitForTimeout(1000);
});
