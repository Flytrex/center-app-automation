import { test, expect } from './fixtures.js';

test('test', async ({ page }) => {
  await page.getByRole('link', { name: 'Flight Network' }).click();
  await page.getByRole('link', { name: 'Vehicles' }).click();
  await page.getByRole('link', { name: 'Part Numbers' }).click();
  await page.getByRole('link', { name: 'Discrepancy Reports' }).click();
  await page.getByRole('link', { name: 'Checklists' }).click();
  await page.getByRole('link', { name: 'Checklist Reports' }).click();
  await page.getByRole('link', { name: 'Users' }).click();
  await page.getByRole('link', { name: 'Center Settings' }).click();
});
