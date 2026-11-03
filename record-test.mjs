import { chromium } from '@playwright/test';

const profileDir = './playwright/.profile';
const BASE_URL = 'https://center.staging-qa.gcs-staging-qa.flytrex.com';

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

async function main() {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: ['--no-first-run', '--disable-sync', '--disable-signin-promo'],
  });

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15_000 });

  const alreadyIn = await page.waitForURL(`${BASE_URL}/mission-history`, { timeout: 3_000 })
    .then(() => true).catch(() => false);

  if (!alreadyIn) {
    console.log('\n👉 Log in manually in the browser window.');
    await page.waitForURL('**/login/callback**', { timeout: 300_000 });
    await waitForStableMissionHistory(page);
  }

  console.log('\n✅ Authenticated — now on mission-history.');
  console.log('   The Playwright Inspector is open. Click the Record button and perform your actions.');
  console.log('   When done, copy the generated code from the inspector.\n');

  await page.pause();

  await context.close();
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
