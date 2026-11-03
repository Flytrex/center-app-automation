// Description: Opens Flight Network from the side menu (globe icon) and checks the page loads.
import { test, expect } from '../../fixtures.js';

test('loads the flight network page', async ({ page }) => {
  // The globe icon in the side menu
  await page.locator('nav a[href="/flight-network"]').click();

  await expect(page).toHaveURL(/\/flight-network/);
  await expect(page.getByRole('heading', { name: 'Flight Network', level: 1 })).toBeVisible();
  await expect(page.getByText(/^\d+ Entities$/)).toBeVisible();
  await expect(page.getByRole('grid').getByRole('paragraph').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Map' })).toBeVisible();
});
