import { test, expect } from '@playwright/test'

test('homepage loads and shows heading', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('ScrapeGoat')
})
