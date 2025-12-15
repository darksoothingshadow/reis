import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function globalSetup(config: FullConfig) {
  const username = process.env.MENDELU_USER;
  const password = process.env.MENDELU_PASS;

  if (!username || !password) {
    console.log('⚠️  MENDELU_USER or MENDELU_PASS not set in .env');
    console.log('   Skipping login - tests requiring auth will fail');
    
    // Create empty storage state so tests can still run
    const emptyState = { cookies: [], origins: [] };
    fs.writeFileSync(
      path.join(__dirname, '..', 'storageState.json'),
      JSON.stringify(emptyState)
    );
    return;
  }

  console.log('🔐 Logging into is.mendelu.cz...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://is.mendelu.cz/auth/login.pl', { timeout: 30000 });

    // Check if already logged in (redirected away from login)
    if (!page.url().includes('login.pl')) {
      console.log('   ✅ Already logged in');
    } else {
      // Fill login form
      await page.fill('input[name="credential_0"]', username);
      await page.fill('input[name="credential_1"]', password);
      await page.click('input[type="submit"], button[type="submit"]');
      // Wait for navigation to complete (success or failure)
      await page.waitForLoadState('networkidle');

      const url = page.url();
      if (url.includes('/auth/')) {
          console.log('   ✅ Login successful (URL contains /auth/)');
          await context.storageState({ path: path.join(__dirname, '..', 'storageState.json') });
      } else {
          // We are likely still on login page or some error page
          console.log(`   ❌ Login failed? URL: ${url}`);
          
          // Try to dump content
          try {
              const content = await page.content();
              fs.writeFileSync('login-failure.html', content);
              await page.screenshot({ path: 'login-failure.png' });
              
              // simple check for known error text (czech)
              if (content.includes('Špatné jméno nebo heslo') || content.includes('Neplatné přihlášení')) {
                   throw new Error('Login failed: Invalid username or password.');
              }
          } catch (e) {
              console.log('   ⚠️ Could not capture failure evidence:', e);
          }
          
          throw new Error(`Login failed - stuck on ${url}`);
      }
      
      console.log('   ✅ Login successful');
    }

    // Save authentication state
    await context.storageState({ 
      path: path.join(__dirname, '..', 'storageState.json') 
    });
    console.log('   💾 Session saved to storageState.json');
    
  } catch (error) {
    console.error('   ❌ Login failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
