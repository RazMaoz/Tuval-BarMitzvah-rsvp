import { test, expect } from '@playwright/test';

test.describe('RSVP App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app (assuming it runs on localhost:5173 or the deployed URL)
    await page.goto('/');
  });

  test('Happy Path: Complete Flow for Attending Family', async ({ page }) => {
    // Step 0: Welcome
    await expect(page.locator('h1', { hasText: 'בר מצווה לתוּבַל' }).first()).toBeVisible();
    await page.click('button:has-text("בואו נתחיל")');

    // Step 1: Name
    await page.fill('input[name="name"]', 'משפחת כהן בדיקות');
    await page.click('button:has-text("המשך")');

    // Step 2: Attending (Yes)
    await page.click('text=ברור, נגיע בשמחה!');
    await page.click('button:has-text("המשך")');

    // Step 3: Part
    await page.click('text=מגיעים להכל!');
    await page.click('button:has-text("המשך")');

    // Step 4: Guests count
    // Increase kids by 2
    await page.getByRole('button', { name: '+' }).nth(1).click();
    await page.getByRole('button', { name: '+' }).nth(1).click();
    await page.click('button:has-text("המשך")');

    // Step 5: Submit
    await expect(page.locator('text=משפחת כהן בדיקות')).toBeVisible();
    await expect(page.locator('text=מגיעים בשמחה')).toBeVisible();
    await expect(page.locator('text=2 ילדים')).toBeVisible();
    
    // We don't click submit in tests unless we want to pollute the DB, 
    // or we can intercept the API call. Let's intercept.
    await page.route('/api/rsvp', async route => {
      await route.fulfill({ json: { success: true } });
    });
    
    await page.click('button:has-text("אישור סופי")');

    // Success Screen
    await expect(page.locator('h1:has-text("איזה כיף שאתם באים!")')).toBeVisible();
    
    // Try blessing
    await page.click('button:has-text("השארת ברכה לתובל")');
    await page.fill('textarea', 'מזל טוב מכל הלב!');
    
    await page.route('/api/generate-blessing', async route => {
      await route.fulfill({ json: { result: 'מזל טוב משודרג וקסום! ✨' } });
    });
    
    await page.click('button:has-text("שדרוג הברכה בעזרת AI")');
    await expect(page.locator('textarea')).toHaveValue('מזל טוב משודרג וקסום! ✨');
  });

  test('Flow for Not Attending', async ({ page }) => {
    await page.click('button:has-text("בואו נתחיל")');
    await page.fill('input[name="name"]', 'אורח שלא מגיע');
    await page.click('button:has-text("המשך")');
    
    // Choose No
    await page.click('text=לצערנו לא נוכל');
    // Should skip directly to step 5
    await page.click('button:has-text("המשך")');
    
    await expect(page.locator('text=לא מגיעים')).toBeVisible();
    
    await page.route('/api/rsvp', async route => {
      await route.fulfill({ json: { success: true } });
    });
    
    await page.click('button:has-text("אישור סופי")');
    await expect(page.locator('h1:has-text("תודה רבה!")')).toBeVisible();
    await expect(page.locator('text=כתיבת ברכה לתובל')).toBeVisible();
  });
});
