import { test, expect } from '@playwright/test';

const BASE_URL = 'https://staging-qa.flytrex.com';

test('login succeeds and lands on mission-history', async ({ page }) => {
  await page.goto(BASE_URL);

  // After login (via Okta/Google), the app should redirect here
  await expect(page).toHaveURL(`${BASE_URL}/mission-history`);

  // Confirm we are not stuck on the login page
  await expect(
    page.getByRole('button', { name: 'Sign in with Okta' })
  ).not.toBeVisible();
});
