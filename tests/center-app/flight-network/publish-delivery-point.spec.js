// Description: Turns on edit mode, adds a delivery point inside the operational area on the map, and publishes it.
import { test, expect } from '../../fixtures.js';

// Open Flight Network directly, using the saved login session
test.use({ startPage: '/flight-network' });

test('adds a delivery point and publishes', async ({ page }) => {
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

  // Delivery icon in the toolbar above the map (each icon holds a hidden tooltip with its name)
  await page.locator('div:has(> svg):has(> div:text-is("Delivery"))').click({ timeout: 10_000 });

  // The map opens zoomed in on the operational area's center, so the whole view is inside the circle.
  // Click an empty spot in the lower-left part of the map, away from existing markers.
  const map = page.getByRole('region', { name: 'Map' });
  const box = await map.boundingBox();
  // Google Maps covers the map with its own layer, so click the screen position with the mouse
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.8);

  // The new point opens with its details
  const nameField = page.locator('input[name="Entity name"]');
  await expect(nameField).toBeVisible({ timeout: 10_000 });
  const pointName = await nameField.inputValue();

  // A new entity must be confirmed before publishing: tick the circle checkbox in its expanded row in the list.
  // It's the last icon in the row, right after the entity's ID.
  const newRow = page.locator('[role="rowgroup"] > div').filter({ has: nameField });
  const pointId = await newRow.getByText(/^[0-9a-f]{8}-[0-9a-f-]{27}$/).textContent();
  console.log(`NEW POINT: ${pointName} (ID ${pointId})`);
  await newRow.locator('svg').last().click({ timeout: 10_000 });

  const publish = page.getByRole('button', { name: /publish/i });
  await expect(publish).toBeEnabled({ timeout: 10_000 });
  await publish.click();

  // Publishing ends with a success snackbar
  await expect(page.getByText('Flight network published successfully')).toBeVisible({ timeout: 30_000 });
});
