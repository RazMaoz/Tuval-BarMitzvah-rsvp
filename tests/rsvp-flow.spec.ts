import { test, expect } from '@playwright/test';

test.describe('RSVP App E2E Tests (Redesigned Flow)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Happy Path: Complete Flow for Attending Guest', async ({ page }) => {
    // Screen 1: Combined Landing Screen
    await expect(page.locator('h1', { hasText: 'בר־המצווה של תובל' })).toBeVisible();
    await expect(page.locator('text=עוד נפגש ויהיה לנו טוב')).toBeVisible();

    // Try clicking without name - should show validation error
    await page.click('button:has-text("אגיע בשמחה")');
    await expect(page.locator('text=נא להזין שם מלא כדי להמשיך')).toBeVisible();

    // Fill name and continue
    await page.fill('input[placeholder*="שם מלא"]', 'משפחת כהן בדיקות');
    await page.click('button:has-text("אגיע בשמחה")');

    // Screen 2: Guest Counters
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();
    await expect(page.locator('text=מבוגרים (11+)')).toBeVisible();
    await expect(page.locator('text=ילדים (3-11)')).toBeVisible();
    await expect(page.locator('text=תינוקות (עד 3)')).toBeVisible();

    // Increase kids by 1
    await page.locator('button:has-text("+")').nth(1).click();
    await page.click('button:has-text("המשך")');

    // Screen 3: Blessing & Final Submit
    await expect(page.locator('text=הרכב:')).toBeVisible();
    await expect(page.locator('text=1 מבוגרים, 1 ילדים')).toBeVisible();

    // Mock API calls
    await page.route('/api/rsvp', async (route) => {
      await route.fulfill({ json: { success: true } });
    });
    await page.route('/api/blessings', async (route) => {
      await route.fulfill({ json: { success: true } });
    });

    await page.fill('textarea', 'מזל טוב תובל היקר מכל הלב!');
    await page.click('button:has-text("אישור סופי ושליחה")');

    // Screen 4: Success & Waze
    await expect(page.locator('h2', { hasText: 'איזה כיף, נתראה בשמחה!' })).toBeVisible();
    await expect(page.locator('text=ניווט עם Waze')).toBeVisible();
    await expect(page.locator('text=Google Calendar')).toBeVisible();
    await expect(page.locator('text=Apple / Outlook')).toBeVisible();
  });

  test('Flow for Not Attending Guest', async ({ page }) => {
    // Screen 1: Fill name and decline
    await page.fill('input[placeholder*="שם מלא"]', 'דוד ישראל');

    await page.route('/api/rsvp', async (route) => {
      await route.fulfill({ json: { success: true } });
    });

    await page.click('button:has-text("לא מתאפשר לי להגיע")');

    // Screen 2 (Decline): Success & Blessing
    await expect(page.locator('h2', { hasText: 'תודה רבה!' })).toBeVisible();
    await expect(page.locator('text=חבל שלא יתאפשר לך להגיע')).toBeVisible();
    await expect(page.locator('text=בכל מקרה, נשמח לברכה עבור תובל')).toBeVisible();
    await expect(page.locator('text=גלויה לכולם')).toBeVisible();
    await expect(page.locator('text=פרטית לתובל')).toBeVisible();

    // Return link check
    await expect(page.locator('text=← טעות? עדכון תשובה')).toBeVisible();
  });

  test('Screen 1 fits strictly without scrolling on small mobile viewport with address bar (375x500)', async ({ page }) => {
    // Simulate short mobile screen where browser search/address bar reduces available height
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto('/');

    // Verify all Screen 1 key elements are visible and within viewport
    await expect(page.locator('h1', { hasText: 'בר־המצווה של תובל' })).toBeInViewport();
    await expect(page.locator('input[placeholder*="שם מלא"]')).toBeInViewport();
    await expect(page.locator('button:has-text("אגיע בשמחה")')).toBeInViewport();
    await expect(page.locator('button:has-text("לא מתאפשר לי להגיע")')).toBeInViewport();

    // Verify no scroll overflow on body
    const scrollInfo = await page.evaluate(() => {
      return {
        bodyScrollHeight: document.body.scrollHeight,
        windowHeight: window.innerHeight,
      };
    });
    expect(scrollInfo.bodyScrollHeight).toBeLessThanOrEqual(scrollInfo.windowHeight + 1);
  });

  test('Capture visual screenshots with 50% font increase', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/razmm/.gemini/antigravity/brain/2ac546f7-f9c7-4d92-9b8d-0f56fe5e39ec/screen1_font50.png' });

    await page.fill('input[placeholder*="שם מלא"]', 'משפחת לוי');
    await page.click('button:has-text("אגיע בשמחה")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/razmm/.gemini/antigravity/brain/2ac546f7-f9c7-4d92-9b8d-0f56fe5e39ec/screen2_font50.png' });

    await page.click('button:has-text("המשך")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/razmm/.gemini/antigravity/brain/2ac546f7-f9c7-4d92-9b8d-0f56fe5e39ec/screen3_font50.png' });
  });
});
