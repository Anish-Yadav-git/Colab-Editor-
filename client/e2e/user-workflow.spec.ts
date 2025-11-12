import { test, expect, Page } from '@playwright/test';

/**
 * E2E User Workflow Tests
 * 
 * These tests verify complete user workflows from registration to document sharing.
 * 
 * Requirements: 11.6 - End-to-end flows including authentication, editing, and persistence
 */

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Helper to generate unique test data
function generateTestUser() {
  const timestamp = Date.now();
  return {
    email: `test-${timestamp}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${timestamp}`,
  };
}

test.describe('Complete User Workflow', () => {
  test('user can register, create document, edit, and share', async ({ page }) => {
    const user = generateTestUser();

    // Step 1: Navigate to registration page
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveTitle(/Collaborative Editor/);

    // Step 2: Register new user
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    // Should redirect to document list
    await expect(page).toHaveURL(/\/documents/);

    // Step 3: Create new document
    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'My Test Document');
    await page.click('button:has-text("Create")');

    // Should redirect to editor
    await expect(page).toHaveURL(/\/editor\//);

    // Step 4: Edit document
    const editor = page.locator('.monaco-editor');
    await expect(editor).toBeVisible();

    // Type some content
    await editor.click();
    await page.keyboard.type('Hello, this is a test document!');

    // Wait for auto-save
    await page.waitForTimeout(1000);

    // Step 5: Share document
    await page.click('button:has-text("Share")');
    await page.fill('input[name="email"]', 'collaborator@example.com');
    await page.selectOption('select[name="role"]', 'editor');
    await page.click('button:has-text("Share")');

    // Should show success message
    await expect(page.locator('.success-message')).toBeVisible();

    // Step 6: Navigate back to document list
    await page.click('a:has-text("Documents")');
    await expect(page).toHaveURL(/\/documents/);

    // Should see the created document
    await expect(page.locator('text=My Test Document')).toBeVisible();
  });

  test('user can login and access existing documents', async ({ page, context }) => {
    // First, create a user and document
    const user = generateTestUser();

    // Register
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    // Create document
    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Persistent Document');
    await page.click('button:has-text("Create")');

    // Add content
    const editor = page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.type('This content should persist');
    await page.waitForTimeout(1000);

    // Logout
    await page.click('button:has-text("Logout")');

    // Clear cookies to simulate fresh session
    await context.clearCookies();

    // Login again
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');

    // Should see document list
    await expect(page).toHaveURL(/\/documents/);
    await expect(page.locator('text=Persistent Document')).toBeVisible();

    // Open document
    await page.click('text=Persistent Document');

    // Content should be preserved
    await expect(editor).toContainText('This content should persist');
  });

  test('user cannot access documents without authentication', async ({ page }) => {
    // Try to access editor directly
    await page.goto(`${BASE_URL}/editor/test-doc-id`);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('user can delete document', async ({ page }) => {
    const user = generateTestUser();

    // Register and create document
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Document to Delete');
    await page.click('button:has-text("Create")');

    // Go back to document list
    await page.click('a:has-text("Documents")');

    // Delete document
    await page.click('[data-testid="document-menu"]');
    await page.click('button:has-text("Delete")');

    // Confirm deletion
    await page.click('button:has-text("Confirm")');

    // Document should be removed from list
    await expect(page.locator('text=Document to Delete')).not.toBeVisible();
  });

  test('user can update document title', async ({ page }) => {
    const user = generateTestUser();

    // Register and create document
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Original Title');
    await page.click('button:has-text("Create")');

    // Open settings
    await page.click('button:has-text("Settings")');

    // Update title
    await page.fill('input[name="title"]', 'Updated Title');
    await page.click('button:has-text("Save")');

    // Go back to document list
    await page.click('a:has-text("Documents")');

    // Should see updated title
    await expect(page.locator('text=Updated Title')).toBeVisible();
    await expect(page.locator('text=Original Title')).not.toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('shows error for invalid login credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText(/Invalid credentials/);
  });

  test('shows validation errors for invalid registration', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);

    // Try to register with invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'short');
    await page.fill('input[name="name"]', '');
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('handles network errors gracefully', async ({ page, context }) => {
    const user = generateTestUser();

    // Register
    await page.goto(`${BASE_URL}/register`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="name"]', user.name);
    await page.click('button[type="submit"]');

    // Create document
    await page.click('button:has-text("Create Document")');
    await page.fill('input[name="title"]', 'Network Test');
    await page.click('button:has-text("Create")');

    // Simulate network offline
    await context.setOffline(true);

    // Try to make edits
    const editor = page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.type('Offline edit');

    // Should show offline indicator
    await expect(page.locator('.offline-indicator')).toBeVisible();

    // Restore network
    await context.setOffline(false);

    // Should sync and hide offline indicator
    await expect(page.locator('.offline-indicator')).not.toBeVisible({ timeout: 5000 });
  });
});
