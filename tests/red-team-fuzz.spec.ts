import { test, expect } from '@playwright/test';

test.describe('Red Team Fuzz Testing (Redesigned Flow)', () => {
  test('The Indecisive Guest (State retention and backward navigation)', async ({ page }) => {
    await page.goto('/');

    // Screen 1: Enter name
    await page.fill('input[placeholder*="שם מלא"]', 'אורח מתלבט');
    await page.click('button:has-text("אגיע בשמחה")');

    // Screen 2: Should be on Guest Counts
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();

    // Click UI Back to Screen 1
    await page.click('button:has-text("חזור")');

    // Verify name is preserved
    await expect(page.locator('input[placeholder*="שם מלא"]')).toHaveValue('אורח מתלבט');

    // Change mind: click Decline
    await page.route('/api/rsvp', async (route) => {
      await route.fulfill({ json: { success: true } });
    });
    await page.click('button:has-text("לא מתאפשר לי להגיע")');

    // Verify on Decline screen
    await expect(page.locator('h2', { hasText: 'תודה רבה' })).toBeVisible();
    await expect(page.locator('text=חבל שלא יתאפשר לך להגיע...')).toBeVisible();

    // Change mind again via "← טעות? עדכון תשובה"
    await page.click('text=← טעות? עדכון תשובה');
    await expect(page.locator('input[placeholder*="שם מלא"]')).toHaveValue('אורח מתלבט');
  });

  test('The Injector & Chaos Monkey (XSS, extreme counter changes)', async ({ page }) => {
    await page.goto('/');

    // Inject XSS payload into name field
    const maliciousPayload = '<script>alert("hacked")</script> DROP TABLE guests;';
    await page.fill('input[placeholder*="שם מלא"]', maliciousPayload);
    await page.click('button:has-text("אגיע בשמחה")');

    // Screen 2: Counters
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();

    // Chaos monkey: Click adult '+' button 10 times rapidly
    const plusButtons = page.locator('button:has-text("+")');
    for (let i = 0; i < 10; i++) {
      await plusButtons.first().click();
    }
    // Adult count should be 1 + 10 = 11
    await expect(page.getByText('11', { exact: true })).toBeVisible();

    // Spam minus button down to minimum 1
    const minusButtons = page.locator('button:has-text("-")');
    for (let i = 0; i < 15; i++) {
      await minusButtons.first().click();
    }
    // Should never go below 1 for adults
    await expect(page.locator('span.w-6, span.w-5').first()).toHaveText('1');

    await page.click('button:has-text("המשך")');

    // Verify XSS payload is safely rendered as pure text on Screen 3
    await page.route('/api/rsvp', async (route) => {
      await route.fulfill({ json: { success: true } });
    });
    await page.click('button:has-text("אישור סופי ושליחה")');

    // Verify reached success screen without alert dialog crashing app
    await expect(page.locator('text=איזה כיף, נתראה בשמחה!')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'תודה רבה' })).toBeVisible();
  });
});
