// Description: Turns on edit mode, exports the flight network from the 3-dots menu, and saves the 2 KML files to Downloads.
import { test, expect } from '../../fixtures.js';
import os from 'os';
import path from 'path';

// Open Flight Network directly, using the saved login session
test.use({ startPage: '/flight-network' });

test('exports the flight network as KML files', async ({ page }) => {
  await expect(page.getByText(/^\d+ Entities$/)).toBeVisible();

  // Turn on edit mode; if someone else is editing, take over
  // The real checkbox sits hidden behind the switch, so click it from the page's side
  const editToggle = page.locator('#edit-mode-toggle');
  await editToggle.evaluate(toggle => toggle.click());
  const takeOver = page.getByRole('button', { name: /take over edit mode/i });
  await expect(async () => {
    if (await takeOver.isVisible()) await takeOver.click();
    await expect(editToggle).toBeChecked({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  // Save every downloaded file to the Downloads folder
  const saved = [];
  page.on('download', download => {
    const file = path.join(os.homedir(), 'Downloads', download.suggestedFilename());
    saved.push(download.saveAs(file).then(() => file));
  });

  // The 3-dots menu is the button right after Publish
  await page.getByRole('button', { name: /publish/i }).locator('xpath=following::button[1]').click({ timeout: 10_000 });
  await page.getByText(/export network/i).click({ timeout: 10_000 });

  await expect(page.getByText('Export successful. Your flight network has been downloaded')).toBeVisible({ timeout: 30_000 });

  const files = await Promise.all(saved);
  console.log(`DOWNLOADED: ${files.join(', ')}`);
  expect(files).toHaveLength(2);
  for (const file of files) expect(file).toMatch(/\.kml$/i);
});
