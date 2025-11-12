# End-to-End Tests with Playwright

This directory contains E2E tests for the real-time collaborative editor.

## Setup

To run these tests, you need to install Playwright:

```bash
npm install -D @playwright/test
npx playwright install
```

## Running Tests

```bash
# Run all E2E tests
npx playwright test

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test user-workflow.spec.ts

# Run tests in debug mode
npx playwright test --debug
```

## Test Structure

- `user-workflow.spec.ts` - Complete user workflows (register, create, edit, share)
- `offline-sync.spec.ts` - Offline editing and synchronization
- `collaboration.spec.ts` - Multi-user collaboration scenarios
- `permissions.spec.ts` - Permission enforcement tests

## Requirements

These tests verify:
- Requirement 11.6: End-to-end flows including authentication, editing, and persistence
- Complete user workflows from registration to document sharing
- Offline editing and sync behavior
- Multi-user collaboration
- Permission enforcement

## Notes

- Tests require both server and client to be running
- Use test database to avoid affecting production data
- Tests should be idempotent and clean up after themselves
