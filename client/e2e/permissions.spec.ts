import { test, expect } from '@playwright/test';

/**
 * E2E Permission Enforcement Tests
 * 
 * These tests verify that document permissions are properly enforced
 * and users can only perform actions they're authorized for.
 * 
 * Requirements: 11.6 - Permission enforcement testing
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

function generateTestUser(suffix: string) {
  const timestamp = Date.now();
  return {
    email: `test-${suffix}-${timestamp}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${suffix}`,
  };
}

test.describe('Permission Enforcement', () => {
  test('viewer cannot edit document', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const owner = generateTestUser('owner');
    const viewer = generateTestUser('viewer');

    try {
      // Owner creates document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', owner.email);
      await page1.fill('input[name="password"]', owner.password);
      await page1.fill('input[name="name"]', owner.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'View Only Document');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      // Share with viewer role
      await page1.click('button:has-text("Share")');
      await page1.fill('input[name="email"]', viewer.email);
      await page1.selectOption('select[name="role"]', 'viewer');
      await page1.click('button:has-text("Share")');

      // Viewer registers and opens document
      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', viewer.email);
      await page2.fill('input[name="password"]', viewer.password);
      await page2.fill('input[name="name"]', viewer.name);
      await page2.click('button[type="submit"]');
      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      // Editor should be read-only
      const editor = page2.locator('.monaco-editor');
      await expect(editor).toHaveAttribute('data-readonly', 'true');

      // Try to type (should not work)
      await editor.click();
      await page2.keyboard.type('Attempt to edit');

      // Content should not change
      await expect(editor).not.toContainText('Attempt to edit');

      // Should show read-only indicator
      await expect(page2.locator('.read-only-indicator')).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('editor can edit but not delete document', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const owner = generateTestUser('owner');
    const editor = generateTestUser('editor');

    try {
      // Owner creates document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', owner.email);
      await page1.fill('input[name="password"]', owner.password);
      await page1.fill('input[name="name"]', owner.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Editor Test Document');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      // Share with editor role
      await page1.click('button:has-text("Share")');
      await page1.fill('input[name="email"]', editor.email);
      await page1.selectOption('select[name="role"]', 'editor');
      await page1.click('button:has-text("Share")');

      // Editor registers and opens document
      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', editor.email);
      await page2.fill('input[name="password"]', editor.password);
      await page2.fill('input[name="name"]', editor.name);
      await page2.click('button[type="submit"]');
      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      // Editor can type
      const editorElement = page2.locator('.monaco-editor');
      await editorElement.click();
      await page2.keyboard.type('Editor content');
      await expect(editorElement).toContainText('Editor content');

      // But cannot delete document
      await page2.click('button:has-text("Settings")');
      const deleteButton = page2.locator('button:has-text("Delete")');
      await expect(deleteButton).toBeDisabled();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('owner can delete document', async ({ page }) => {
    const owner = generateTestUser('owner');

    // Owner creates document
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', owner.email);
    await page.fill('input[name="password"]', owner.password);
    await page.fill('input[name="name"]', owner.name);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Owner Delete Test');
    await page.click('button:has-text("Create")');

    // Owner can delete
    await page.click('button:has-text("Settings")');
    const deleteButton = page.locator('button:has-text("Delete")');
    await expect(deleteButton).toBeEnabled();

    await deleteButton.click();
    await page.click('button:has-text("Confirm")');

    // Should redirect to document list
    await expect(page).toHaveURL(/\/documents/);
  });

  test('non-owner cannot share document', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const owner = generateTestUser('owner');
    const editor = generateTestUser('editor');

    try {
      // Owner creates and shares document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', owner.email);
      await page1.fill('input[name="password"]', owner.password);
      await page1.fill('input[name="name"]', owner.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Share Permission Test');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      await page1.click('button:has-text("Share")');
      await page1.fill('input[name="email"]', editor.email);
      await page1.selectOption('select[name="role"]', 'editor');
      await page1.click('button:has-text("Share")');

      // Editor opens document
      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', editor.email);
      await page2.fill('input[name="password"]', editor.password);
      await page2.fill('input[name="name"]', editor.name);
      await page2.click('button[type="submit"]');
      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      // Share button should not be visible or disabled
      const shareButton = page2.locator('button:has-text("Share")');
      await expect(shareButton).not.toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('cannot access document without permission', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const owner = generateTestUser('owner');
    const unauthorized = generateTestUser('unauthorized');

    try {
      // Owner creates document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', owner.email);
      await page1.fill('input[name="password"]', owner.password);
      await page1.fill('input[name="name"]', owner.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Private Document');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      // Unauthorized user tries to access
      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', unauthorized.email);
      await page2.fill('input[name="password"]', unauthorized.password);
      await page2.fill('input[name="name"]', unauthorized.name);
      await page2.click('button[type="submit"]');

      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      // Should show permission denied error
      await expect(page2.locator('.error-message')).toContainText(/permission denied|not authorized/i);

      // Should not show editor
      const editor = page2.locator('.monaco-editor');
      await expect(editor).not.toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('owner can change user permissions', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const owner = generateTestUser('owner');
    const user = generateTestUser('user');

    try {
      // Owner creates and shares document as viewer
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', owner.email);
      await page1.fill('input[name="password"]', owner.password);
      await page1.fill('input[name="name"]', owner.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Permission Change Test');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      await page1.click('button:has-text("Share")');
      await page1.fill('input[name="email"]', user.email);
      await page1.selectOption('select[name="role"]', 'viewer');
      await page1.click('button:has-text("Share")');

      // User opens as viewer
      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', user.email);
      await page2.fill('input[name="password"]', user.password);
      await page2.fill('input[name="name"]', user.name);
      await page2.click('button[type="submit"]');
      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      // Should be read-only
      const editor = page2.locator('.monaco-editor');
      await expect(editor).toHaveAttribute('data-readonly', 'true');

      // Owner upgrades to editor
      await page1.click('button:has-text("Share")');
      await page1.locator(`[data-user-email="${user.email}"]`).locator('select').selectOption('editor');
      await page1.click('button:has-text("Update")');

      // User refreshes
      await page2.reload();

      // Should now be editable
      await expect(editor).not.toHaveAttribute('data-readonly', 'true');
      await editor.click();
      await page2.keyboard.type('Now I can edit');
      await expect(editor).toContainText('Now I can edit');
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
