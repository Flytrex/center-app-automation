import { test, expect } from './fixtures.js';

test('test', async ({ page }) => {
  // page is already on mission-history (fixture handled navigation + login)
  await page.getByRole('searchbox', { name: 'Mission ID' }).click();
  await page.getByRole('searchbox', { name: 'Mission ID' }).fill('7c6');
  await page.getByText('FOA_9713_756bdeb0').click();
});
