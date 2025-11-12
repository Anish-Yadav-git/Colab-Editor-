import { test, expect, Browser, Page } from '@playwright/test';

/**
 * E2E Multi-User Collaboration Tests
 * 
 * These tests verify that multiple users can collaborate on the same document
 * in real-time with proper synchronization.
 * 
 * Requirements: 11.6 - Multi-user collaboration testing
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

test.describe('Multi-User Collaboration', () => {
  test('two users can edit same document simultaneously', async ({ browser }) => {
    // Create two browser contexts (two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const user1 = generateTestUser('user1');
    const user2 = generateTestUser('user2');

    try {
      // User 1: Register and create document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', user1.email);
      await page1.fill('input[name="password"]', user1.password);
      await page1.fill('input[name="name"]', user1.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Collaborative Document');
      await page1.click('button:has-text("Create")');

      // Get document ID from URL
      const url = page1.url();
      const documentId = url.split('/').pop();

      // Share document with user 2
      await page1.click('button:has-text("Share")');
      await page1.fill('input[name="email"]', user2.email);
      await page1.selectOption('select[name="role"]', 'editor');
      await page1.click('button:has-text("Share")');

      // User 2: Register
      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', user2.email);
      await page2.fill('input[name="password"]', user2.password);
      await page2.fill('input[name="name"]', user2.name);
      await page2.click('button[type="submit"]');

      // User 2: Open shared document
      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      // Wait for both editors to be ready
      const editor1 = page1.locator('.monaco-editor');
      const editor2 = page2.locator('.monaco-editor');
      await expect(editor1).toBeVisible();
      await expect(editor2).toBeVisible();

      // User 1 types
      await editor1.click();
      await page1.keyboard.type('User 1 typing');
      await page1.waitForTimeout(500);

      // User 2 should see User 1's text
      await expect(editor2).toContainText('User 1 typing');

      // User 2 types
      await editor2.click();
      await page2.keyboard.press('End');
      await page2.keyboard.type(' and User 2 typing');
      await page2.waitForTimeout(500);

      // User 1 should see User 2's text
      await expect(editor1).toContainText('User 1 typing and User 2 typing');

      // Both should have same content
      const content1 = await editor1.textContent();
      const content2 = await editor2.textContent();
      expect(content1).toBe(content2);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('users can see each other\'s cursors', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const user1 = generateTestUser('cursor1');
    const user2 = generateTestUser('cursor2');

    try {
      // Setup: User 1 creates and shares document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', user1.email);
      await page1.fill('input[name="password"]', user1.password);
      await page1.fill('input[name="name"]', user1.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Cursor Test');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

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

      // Wait for presence indicators
      await page1.waitForTimeout(1000);

      // User 1 should see User 2 in presence list
      await expect(page1.locator('.presence-indicator')).toContainText(user2.name);

      // User 2 should see User 1 in presence list
      await expect(page2.locator('.presence-indicator')).toContainText(user1.name);

      // Check for cursor indicators
      const editor1 = page1.locator('.monaco-editor');
      const editor2 = page2.locator('.monaco-editor');

      await editor2.click();
      await page2.keyboard.type('Test');

      // User 1 should see User 2's cursor
      await expect(page1.locator('.collaborative-cursor')).toBeVisible();
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('concurrent edits converge correctly', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    const user1 = generateTestUser('conv1');
    const user2 = generateTestUser('conv2');
    const user3 = generateTestUser('conv3');

    try {
      // Setup: User 1 creates document
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', user1.email);
      await page1.fill('input[name="password"]', user1.password);
      await page1.fill('input[name="name"]', user1.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Convergence Test');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      // Share with users 2 and 3
      for (const user of [user2, user3]) {
        await page1.click('button:has-text("Share")');
        await page1.fill('input[name="email"]', user.email);
        await page1.selectOption('select[name="role"]', 'editor');
        await page1.click('button:has-text("Share")');
      }

      // Users 2 and 3 register and join
      for (const [page, user] of [[page2, user2], [page3, user3]]) {
        await page.goto(`${BASE_URL}/register`);
        await page.fill('input[name="email"]', user.email);
        await page.fill('input[name="password"]', user.password);
        await page.fill('input[name="name"]', user.name);
        await page.click('button[type="submit"]');
        await page.goto(`${BASE_URL}/editor/${documentId}`);
      }

      // All users type simultaneously
      const editor1 = page1.locator('.monaco-editor');
      const editor2 = page2.locator('.monaco-editor');
      const editor3 = page3.locator('.monaco-editor');

      await Promise.all([
        (async () => {
          await editor1.click();
          await page1.keyboard.type('AAA');
        })(),
        (async () => {
          await editor2.click();
          await page2.keyboard.type('BBB');
        })(),
        (async () => {
          await editor3.click();
          await page3.keyboard.type('CCC');
        })(),
      ]);

      // Wait for convergence
      await page1.waitForTimeout(2000);

      // All editors should have same content
      const content1 = await editor1.textContent();
      const content2 = await editor2.textContent();
      const content3 = await editor3.textContent();

      expect(content1).toBe(content2);
      expect(content2).toBe(content3);

      // Content should contain all edits
      expect(content1).toContain('A');
      expect(content1).toContain('B');
      expect(content1).toContain('C');
    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test('user leaving does not affect other users', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const user1 = generateTestUser('leave1');
    const user2 = generateTestUser('leave2');

    try {
      // Setup
      await page1.goto(`${BASE_URL}/register`);
      await page1.fill('input[name="email"]', user1.email);
      await page1.fill('input[name="password"]', user1.password);
      await page1.fill('input[name="name"]', user1.name);
      await page1.click('button[type="submit"]');

      await page1.click('button:has-text("Create Document")');
      await page1.fill('input[name="title"]', 'Leave Test');
      await page1.click('button:has-text("Create")');

      const documentId = page1.url().split('/').pop();

      await page1.click('button:has-text("Share")');
      await page1.fill('input[name="email"]', user2.email);
      await page1.selectOption('select[name="role"]', 'editor');
      await page1.click('button:has-text("Share")');

      await page2.goto(`${BASE_URL}/register`);
      await page2.fill('input[name="email"]', user2.email);
      await page2.fill('input[name="password"]', user2.password);
      await page2.fill('input[name="name"]', user2.name);
      await page2.click('button[type="submit"]');
      await page2.goto(`${BASE_URL}/editor/${documentId}`);

      // Both users type
      const editor1 = page1.locator('.monaco-editor');
      const editor2 = page2.locator('.monaco-editor');

      await editor1.click();
      await page1.keyboard.type('Before leave');
      await page1.waitForTimeout(500);

      // User 2 leaves
      await page2.close();

      // User 1 continues editing
      await editor1.click();
      await page1.keyboard.press('End');
      await page1.keyboard.type(' After leave');

      // Should work without errors
      await expect(editor1).toContainText('Before leave After leave');
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
