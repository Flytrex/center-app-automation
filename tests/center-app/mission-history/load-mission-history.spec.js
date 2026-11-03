// Description: Logs in and checks the Mission History page loads.
import { test, expect } from '../../fixtures.js';

test('logs in and loads mission history', async ({ page }) => {
  await expect(page).toHaveURL(/\/mission-history/);
  await expect(page.getByRole('searchbox', { name: 'Mission ID' })).toBeVisible();
});
