import { test as setup } from '@playwright/test';
import fs from 'fs';

const authFile = 'playwright/.auth/user.json';

setup('load session', async () => {
  if (!fs.existsSync(authFile)) {
    throw new Error(
      'No saved session found. Run: node save-session.js'
    );
  }
});
