import { test, expect } from '@playwright/test';

test('login page loads correctly', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Restaurant Finance' })).toBeVisible();
  await expect(page.getByText('Sign in to your account')).toBeVisible();

  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start free trial' })).toBeVisible();
});
