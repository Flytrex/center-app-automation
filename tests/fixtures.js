import { test as base, chromium, expect } from '@playwright/test';
import fs from 'fs';

const profileDir = 'playwright/.profile';
const sessionFile = 'playwright/.auth/session.json';
const credentialsFile = 'playwright/.auth/credentials.json';
const BASE_URL = 'https://center.staging-qa.gcs-staging-qa.flytrex.com';

// Waits until the page has been at mission-history without navigating away for 5 seconds.
// After login the route guard can redirect to /login then trigger a second Okta flow;
// this absorbs that and only resolves once auth has fully settled.
function waitForStableMissionHistory(page) {
  const target = `${BASE_URL}/mission-history`;
  return new Promise((resolve, reject) => {
    let stableTimer = null;
    let timeoutTimer = null;

    const cleanup = () => {
      clearTimeout(stableTimer);
      clearTimeout(timeoutTimer);
      page.off('framenavigated', onNav);
    };

    const onNav = (frame) => {
      if (frame !== page.mainFrame()) return;
      clearTimeout(stableTimer);
      if (frame.url().startsWith(target)) {
        stableTimer = setTimeout(() => { cleanup(); resolve(); }, 5000);
      }
    };

    page.on('framenavigated', onNav);
    timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for stable mission-history'));
    }, 150_000);

    if (page.url().startsWith(target)) {
      stableTimer = setTimeout(() => { cleanup(); resolve(); }, 5000);
    }
  });
}

function loadEmail() {
  if (process.env.OKTA_EMAIL) return process.env.OKTA_EMAIL;
  if (fs.existsSync(credentialsFile)) {
    return JSON.parse(fs.readFileSync(credentialsFile, 'utf-8')).email;
  }
  return null;
}

export const test = base.extend({
  persistentContext: [async ({}, use) => {
    const ctx = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      // Larger browser window and page area (Playwright's default is 1280x720)
      viewport: { width: 1920, height: 1080 },
      args: ['--no-first-run', '--disable-sync', '--disable-signin-promo', '--window-size=1920,1080'],
    });

    // Inject saved session cookies from previous run if available
    if (fs.existsSync(sessionFile)) {
      const { cookies } = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      await ctx.addCookies(cookies);
    }

    await use(ctx);

    // Save session cookies so the next run can skip login if session is still valid
    fs.mkdirSync('playwright/.auth', { recursive: true });
    await ctx.storageState({ path: sessionFile });

    await ctx.close();
  }, { scope: 'worker' }],

  // The page a test starts on. Override per file with test.use({ startPage: '/flight-network' }).
  startPage: ['/mission-history', { option: true }],

  page: async ({ persistentContext, startPage }, use) => {
    const page = await persistentContext.newPage();

    // Open the start page directly. With a saved session the app shows its side menu;
    // otherwise it sends us to the login page and we sign in first.
    await page.goto(`${BASE_URL}${startPage}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });

    const sideMenu = page.locator('nav a[href="/flight-network"]');
    const oktaButton = page.getByRole('button', { name: /sign in with okta/i });
    await expect(sideMenu.or(oktaButton).first()).toBeVisible({ timeout: 30_000 });
    const alreadyIn = await sideMenu.isVisible();

    if (!alreadyIn) {
      await page.getByRole('button', { name: /sign in with okta/i }).click({ timeout: 10_000 });

      // When the Okta session is expired, the email form appears.
      // Auto-fill it from the gitignored credentials file so no manual input is needed.
      const email = loadEmail();
      if (email) {
        const fillEmail = async (frame) => {
          if (frame !== page.mainFrame()) return;
          if (!frame.url().includes('okta.com')) return;
          try {
            await page.locator('input[name="identifier"]').waitFor({ state: 'visible', timeout: 3_000 });
            await page.locator('input[name="identifier"]').fill(email);
            await page.keyboard.press('Enter');
          } catch {}
        };
        page.on('framenavigated', fillEmail);
        await page.waitForURL('**/login/callback**', { timeout: 120_000 });
        page.off('framenavigated', fillEmail);
      } else {
        await page.waitForURL('**/login/callback**', { timeout: 300_000 });
      }

      await waitForStableMissionHistory(page);

      if (startPage !== '/mission-history') {
        await page.goto(`${BASE_URL}${startPage}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      }
    }

    await use(page);
    await page.close();
  },
});

export { expect };
