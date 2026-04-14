import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('should load the dashboard and show server status', async ({ page }) => {
    await page.goto('http://localhost:3000/admin'); // Assuming admin-ui serves here
    await expect(page.locator('h1')).toContainText('SmoothRadio Admin');
    await expect(page.locator('text=Server Status')).toBeVisible();
  });

  test('should allow triggering a scan', async ({ page }) => {
    await page.goto('http://localhost:3000/admin');
    const input = page.locator('input[placeholder="/path/to/music"]');
    await input.fill('/tmp/music');
    await page.locator('button:has-text("Start Scan")').click();
    await expect(page.locator('text=Scan queued successfully!')).toBeVisible();
  });
});

test.describe('Auth Flow', () => {
  test('should register a new user', async ({ page }) => {
    // This assumes a registration page exists or a way to call the API
    // Since we only have the API, we'd normally test the API directly or via a UI
    // For now, we'll simulate the API call via page.evaluate if no UI exists
    const response = await page.evaluate(async () => {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' })
      });
      return res.status;
    });
    expect(response).toBe(201);
  });
});
