
import { test, expect } from '../../fixtures/extension';

test.describe('Visual: Invisible Onboarding', () => {
  test.beforeEach(async ({ extensionPage }) => {
    await extensionPage.waitForLoadState('domcontentloaded');
  });

  test('App loads without overlay (Invisible Onboarding)', async ({ extensionPage }) => {
    // Assert Overlay is NOT present
    const overlay = extensionPage.locator('.card-title', { hasText: 'Vítejte v REIS' });
    await expect(overlay).toHaveCount(0);

    // Verify Dashboard state
    await expect(extensionPage).toHaveScreenshot('dashboard-invisible-onboarding.png', {
      fullPage: true,
    });
  });

  test('Search Bar has instructional placeholder', async ({ extensionPage }) => {
    const searchInput = extensionPage.locator('input[placeholder*="Hledat předměty"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Hledat předměty, učitele, akce... (Ctrl + K)');
    
    // Screenshot of just the header area
    const header = extensionPage.locator('header').first(); 
    // Assuming standard layout, if header tag exists. Else fallback to top.
    if (await header.count() > 0) {
        await expect(header).toHaveScreenshot('header-search-instruction.png');
    }
  });

  test('Upcoming Outlook Connect button is visible when not synced', async ({ extensionPage }) => {
    // By default, test environment likely implies !isSyncEnabled unless mocked otherwise
    const connectBtn = extensionPage.getByText('Pro zobrazení Teams schůzek připojte Outlook.');
    await expect(connectBtn).toBeVisible();
    
    const btn = extensionPage.getByRole('button', { name: 'Připojit' });
    await expect(btn).toBeVisible();
  });

  test('Legacy IS link is present in Sidebar', async ({ extensionPage }) => {
      const legacyLink = extensionPage.getByText('Starý IS');
      await expect(legacyLink).toBeVisible();
  });
});
