import { test, expect } from '@playwright/test';

/**
 * E2E Offline Editing and Sync Tests
 * 
 * These tests verify that users can continue editing while offline
 * and that changes sync correctly when connection is restored.
 * 
 * Requirements: 11.6 - Offline editing and sync testing
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

function generateTestUser() {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${timestamp}`,
  };
}

test.describe('Offline Editing and Sync', () => {
  test('user can edit document while offline', async ({ page, context }) => {
    const user = generateTestUser();

    // Register and create document
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Offline Test');
    await page.click('button:has-text("Create")');

    const editor = page.locator('.monaco-editor');
    await expect(editor).toBeVisible();

    // Type some content while online
    await editor.click();
    await page.keyboard.type('Online content');
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Should show offline indicator
    await expect(page.locator('.offline-indicator')).toBeVisible();

    // Continue editing while offline
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Offline content');

    // Content should be visible locally
    await expect(editor).toContainText('Online content Offline content');

    // Go back online
    await context.setOffline(false);

    // Should sync and hide offline indicator
    await expect(page.locator('.offline-indicator')).not.toBeVisible({ timeout: 5000 });

    // Refresh page to verify persistence
    await page.reload();
    await expect(editor).toContainText('Online content Offline content');
  });

  test('offline edits sync when connection restored', async ({ page, context }) => {
    const user = generateTestUser();

    // Setup
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Sync Test');
    await page.click('button:has-text("Create")');

    const editor = page.locator('.monaco-editor');

    // Make multiple edits while offline
    await context.setOffline(true);

    await editor.click();
    await page.keyboard.type('Edit 1');
    await page.waitForTimeout(100);

    await page.keyboard.press('Enter');
    await page.keyboard.type('Edit 2');
    await page.waitForTimeout(100);

    await page.keyboard.press('Enter');
    await page.keyboard.type('Edit 3');

    // Check queued operations count
    const offlineIndicator = page.locator('.offline-indicator');
    await expect(offlineIndicator).toContainText(/queued/i);

    // Restore connection
    await context.setOffline(false);

    // Wait for sync
    await expect(offlineIndicator).not.toBeVisible({ timeout: 5000 });

    // Verify all edits persisted
    await page.reload();
    await expect(editor).toContainText('Edit 1');
    await expect(editor).toContainText('Edit 2');
    await expect(editor).toContainText('Edit 3');
  });

  test('handles intermittent connectivity', async ({ page, context }) => {
    const user = generateTestUser();

    // Setup
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Intermittent Test');
    await page.click('button:has-text("Create")');

    const editor = page.locator('.monaco-editor');

    // Simulate intermittent connectivity
    for (let i = 0; i < 5; i++) {
      // Go offline
      await context.setOffline(true);
      await editor.click();
      await page.keyboard.type(`Offline ${i} `);
      await page.waitForTimeout(200);

      // Go online
      await context.setOffline(false);
      await page.waitForTimeout(500);
    }

    // Final sync
    await page.waitForTimeout(2000);

    // Verify all edits persisted
    await page.reload();
    for (let i = 0; i < 5; i++) {
      await expect(editor).toContainText(`Offline ${i}`);
    }
  });

  test('offline edits merge with concurrent online edits', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const user1 = generateTestUser();
    const user2 = generateTestUser();

    try {
      // User 1 creates document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', user1.email);
      await page1.fill('input[name="password"]', user1.password);
      await page1.fill('input[name="name"]', user1.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Merge Test');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      // Share with user 2
      await page1.click('button:has-text("Share")');
      await page1.fill('input[name="email"]', user2.email);
      await page1.selectOption('select[name="role"]', 'editor');
      await page1.click('button:has-text("Share")');

      // User 2 joins
      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', user2.email);
      await page2.fill('input[name="password"]', user2.password);
      await page2.fill('input[name="name"]', user2.name);
      await page2.click('button[type="submit"]');
      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      const editor1 = page1.locator('.monaco-editor');
      const editor2 = page2.locator('.monaco-editor');

      // User 1 goes offline
      await context1.setOffline(true);

      // User 1 edits offline
      await editor1.click();
      await page1.keyboard.type('User 1 offline');

      // User 2 edits online
      await editor2.click();
      await page2.keyboard.type('User 2 online');
      await page2.waitForTimeout(1000);

      // User 1 comes back online
      await context1.setOffline(false);

      // Wait for sync
      await page1.waitForTimeout(2000);

      // Both should have merged content
      const content1 = await editor1.textContent();
      const content2 = await editor2.textContent();

      expect(content1).toBe(content2);
      expect(content1).toContain('User 1 offline');
      expect(content1).toContain('User 2 online');
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('shows last sync time', async ({ page, context }) => {
    const user = generateTestUser();

    // Setup
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Sync Time Test');
    await page.click('button:has-text("Create")');

    const editor = page.locator('.monaco-editor');

    // Make edit
    await editor.click();
    await page.keyboard.type('Test');
    await page.waitForTimeout(1000);

    // Go offline
    await context.setOffline(true);

    // Offline indicator should show last sync time
    const offlineIndicator = page.locator('.offline-indicator');
    await expect(offlineIndicator).toBeVisible();
    await expect(offlineIndicator).toContainText(/last sync/i);
  });
});
