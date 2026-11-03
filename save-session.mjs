import { chromium } from '@playwright/test';
import fs from 'fs';

const profileDir = './playwright/.profile';
const authFile = './playwright/.auth/user.json';
const sessionStorageFile = './playwright/.auth/session-storage.json';
const callbackResponseFile = './playwright/.auth/callback-response.json';

async function main() {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: ['--no-first-run', '--disable-sync', '--disable-signin-promo'],
  });

  // Capture the okta_callback response in full — that's where the backend returns auth data
  let callbackResponseBody = null;
  context.on('response', async response => {
    const url = response.url();
    if (!url.includes('api-staging-qa.')) return;
    const status = response.status();
    const path = url.replace(/https?:\/\/[^/:]+:\d+/, '');
    const headers = response.headers();
    const setCookie = headers['set-cookie'] || '';
    if (setCookie) {
      console.log(`   🍪 Set-Cookie on ${status} ${path}:\n      ${setCookie.slice(0, 300)}`);
      if (setCookie.includes('session_id')) {
        callbackResponseBody = { setCookieHeader: setCookie };
        console.log('   ✅ session_id IS being set via Set-Cookie!');
      }
    }
    try {
      const text = await response.text();
      if (url.includes('okta_callback') || url.includes('callback')) {
        console.log(`   📡 ${status} ${path} body: "${text.slice(0, 200)}"`);
      }
    } catch {}
  });

  // Also capture any Bearer tokens used in requests
  let capturedBearerToken = null;
  context.on('request', request => {
    const url = request.url();
    if (!url.includes('flytrex.com') && !url.includes('okta.com')) return;
    const auth = request.headers()['authorization'];
    if (auth && !capturedBearerToken) {
      console.log(`   📨 Bearer token on: ${request.method()} ${url.replace(/https?:\/\/[^/:]+:\d+/, '')}`);
      capturedBearerToken = auth;
    }
  });

  const page = context.pages()[0] || await context.newPage();

  await page.goto('https://staging-qa.flytrex.com/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });

  console.log('\n👉 Log in manually in the browser window.');
  console.log('   This window will stay open until login is complete.\n');

  await page.waitForURL('**/login/callback*', { timeout: 300_000 });
  console.log('   Okta callback received, waiting for app to finish...');

  await page.waitForURL('**/mission-history', { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  console.log('   Reached mission-history and page settled.');

  const ctxCookies = await context.cookies();
  const sessionCookie = ctxCookies.find(c => c.name === 'session_id');
  console.log('   session_id in context cookies:', sessionCookie ? `YES (expires ${new Date(sessionCookie.expires * 1000).toISOString()})` : 'NO');

  if (capturedBearerToken) {
    console.log('\n   ✅ Bearer token captured!');
  } else {
    console.log('\n   ℹ️  No Bearer token seen in requests');
  }

  fs.mkdirSync('./playwright/.auth', { recursive: true });

  if (callbackResponseBody) {
    fs.writeFileSync(callbackResponseFile, JSON.stringify(callbackResponseBody, null, 2));
    console.log('   ✅ Callback response saved to', callbackResponseFile);
    console.log('   Keys:', Object.keys(callbackResponseBody));
  } else {
    console.log('   ⚠️  No callback response captured');
  }

  if (capturedBearerToken) {
    fs.writeFileSync('./playwright/.auth/bearer-token.txt', capturedBearerToken);
    console.log('   ✅ Bearer token saved');
  }

  const allSS = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      data[key] = sessionStorage.getItem(key);
    }
    return data;
  });
  fs.writeFileSync(sessionStorageFile, JSON.stringify(allSS, null, 2));
  await context.storageState({ path: authFile });

  console.log('\n✅ Auth state saved to', authFile);
  console.log('   Profile saved to', profileDir, '\n');
  await context.close();
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
