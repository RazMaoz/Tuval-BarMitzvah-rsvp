import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/razmm/.gemini/antigravity/brain/2ac546f7-f9c7-4d92-9b8d-0f56fe5e39ec/scratch/rsvp-app/.env' });
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

test.describe('RED TEAM AUDIT: Layer 1 - UI/UX & Scrolling Across Viewports', () => {

  const viewports = [
    { name: 'Desktop Full HD', width: 1920, height: 1080 },
    { name: 'iPhone 12/13/14 Pro (390x844)', width: 390, height: 844 },
    { name: 'iPhone SE / Small Screen (375x667)', width: 375, height: 667 },
  ];

  for (const vp of viewports) {
    test(`/admin scrolling on ${vp.name}: Can users scroll to see all 25+ guests and all 12+ blessings`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // 1. Verify Guests Tab
      const guestRows = page.locator('tbody tr');
      const guestCount = await guestRows.count();
      console.log(`[${vp.name}] Admin guests loaded count: ${guestCount}`);
      expect(guestCount).toBeGreaterThanOrEqual(25);

      // Verify page is vertically scrollable if content exceeds viewport
      const guestsScrollable = await page.evaluate(() => {
        return document.documentElement.scrollHeight > window.innerHeight ||
               document.body.scrollHeight > window.innerHeight;
      });
      console.log(`[${vp.name}] Admin Guests scrollable: ${guestsScrollable}`);

      // Scroll to bottom of guests table
      const lastGuest = guestRows.last();
      await lastGuest.scrollIntoViewIfNeeded();
      await expect(lastGuest).toBeInViewport();

      // Take screenshot of scrolled guests
      await page.screenshot({ 
        path: `C:/Users/razmm/.gemini/antigravity/brain/3c632a4f-d2cc-4121-9dba-0e1342f45434/scratch/admin_guests_${vp.width}x${vp.height}.png` 
      });

      // 2. Switch to Blessings Tab
      const blessingsTab = page.locator('button:has-text("ברכות")').first();
      await blessingsTab.click();
      await page.waitForTimeout(500);

      const blessingCards = page.locator('div.grid > div');
      const blessingsCount = await blessingCards.count();
      console.log(`[${vp.name}] Admin blessings loaded count: ${blessingsCount}`);
      expect(blessingsCount).toBeGreaterThanOrEqual(12);

      // Scroll to bottom of blessings
      const lastBlessing = blessingCards.last();
      await lastBlessing.scrollIntoViewIfNeeded();
      await expect(lastBlessing).toBeInViewport();

      // Take screenshot of scrolled blessings
      await page.screenshot({ 
        path: `C:/Users/razmm/.gemini/antigravity/brain/3c632a4f-d2cc-4121-9dba-0e1342f45434/scratch/admin_blessings_${vp.width}x${vp.height}.png` 
      });
    });
  }

  test('Screen 1 zero-scroll behavior on short mobile viewport (375x500)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto('/');

    // Check all critical components fit strictly inside viewport
    await expect(page.locator('h1', { hasText: 'בר־המצווה של תובל' })).toBeInViewport();
    await expect(page.locator('input[placeholder*="שם מלא"]')).toBeInViewport();
    await expect(page.locator('button:has-text("אגיע בשמחה")')).toBeInViewport();
    await expect(page.locator('button:has-text("לא מתאפשר לי להגיע")')).toBeInViewport();

    // Verify document does not overflow vertically
    const scrollInfo = await page.evaluate(() => ({
      bodyScrollHeight: document.body.scrollHeight,
      docScrollHeight: document.documentElement.scrollHeight,
      windowHeight: window.innerHeight,
    }));

    console.log('Screen 1 Short Viewport Dimensions:', scrollInfo);
    expect(scrollInfo.bodyScrollHeight).toBeLessThanOrEqual(scrollInfo.windowHeight + 2);
    expect(scrollInfo.docScrollHeight).toBeLessThanOrEqual(scrollInfo.windowHeight + 2);

    await page.screenshot({ 
      path: 'C:/Users/razmm/.gemini/antigravity/brain/3c632a4f-d2cc-4121-9dba-0e1342f45434/scratch/screen1_short_375x500.png' 
    });
  });

  test('Screen 2, Screen 3, Screen 4 & Decline Screen scrolling behavior on short mobile viewport (375x500)', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto('/');

    // Go to Screen 2
    await page.fill('input[placeholder*="שם מלא"]', 'בדיקת גלילה מסכים');
    await page.click('button:has-text("אגיע בשמחה")');

    // Screen 2 check
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();
    const s2Button = page.locator('button:has-text("המשך")');
    await s2Button.scrollIntoViewIfNeeded();
    await expect(s2Button).toBeInViewport();
    await page.screenshot({ 
      path: 'C:/Users/razmm/.gemini/antigravity/brain/3c632a4f-d2cc-4121-9dba-0e1342f45434/scratch/screen2_short_375x500.png' 
    });

    // Go to Screen 3
    await s2Button.click();
    await expect(page.locator('text=הרכב:')).toBeVisible();
    const s3Submit = page.locator('button:has-text("אישור סופי ושליחה")');
    await s3Submit.scrollIntoViewIfNeeded();
    await expect(s3Submit).toBeInViewport();
    await page.screenshot({ 
      path: 'C:/Users/razmm/.gemini/antigravity/brain/3c632a4f-d2cc-4121-9dba-0e1342f45434/scratch/screen3_short_375x500.png' 
    });

    // Submit to reach Screen 4
    await s3Submit.click();
    await expect(page.locator('text=איזה כיף, נתראה בשמחה!')).toBeVisible({ timeout: 10000 });
    // Screen 4 check: verify elements at bottom are reachable via scroll
    const calendarSection = page.locator('text=זהו לעת עתה! הכל נשמר בהצלחה.');
    await calendarSection.scrollIntoViewIfNeeded();
    await expect(calendarSection).toBeInViewport();
    const editLink = page.locator('text=← טעות? עריכת פרטי הגעה');
    await editLink.scrollIntoViewIfNeeded();
    await expect(editLink).toBeInViewport();
    await page.screenshot({ 
      path: 'C:/Users/razmm/.gemini/antigravity/brain/3c632a4f-d2cc-4121-9dba-0e1342f45434/scratch/screen4_short_375x500.png' 
    });

    // Cleanup Screen 4 test guest
    await db.execute("DELETE FROM guests WHERE name = 'בדיקת גלילה מסכים'");

    // Test Decline screen scrolling in a fresh page context
    const declinePage = await context.newPage();
    await declinePage.setViewportSize({ width: 375, height: 500 });
    await declinePage.goto('/');
    await declinePage.fill('input[placeholder*="שם מלא"]', 'בדיקת גלילה סירוב');
    await declinePage.click('button:has-text("לא מתאפשר לי להגיע")');
    await expect(declinePage.locator('h2', { hasText: 'תודה רבה' })).toBeVisible({ timeout: 10000 });

    const updateReturnBtn = declinePage.locator('text=← טעות? עדכון תשובה');
    await updateReturnBtn.scrollIntoViewIfNeeded();
    await expect(updateReturnBtn).toBeInViewport();
    await declinePage.screenshot({ 
      path: 'C:/Users/razmm/.gemini/antigravity/brain/3c632a4f-d2cc-4121-9dba-0e1342f45434/scratch/decline_short_375x500.png' 
    });

    // Cleanup the temporary decline test entry from DB
    await db.execute("DELETE FROM guests WHERE name = 'בדיקת גלילה סירוב'");
    await declinePage.close();
  });
});

test.describe('RED TEAM AUDIT: Layer 2 & 3 - Real Backend Functionality, State & Turso DB Contracts', () => {

  test('Attending Flow End-to-End against Real Backend (NO MOCKS)', async ({ page }) => {
    const testGuestName = `אורח בדיקה חי ${Date.now()}`;
    const testBlessing = `ברכה חיה מכל הלב לתובל ${Date.now()} 🎉`;

    await page.goto('/');

    // Step 1: Fill name
    await page.fill('input[placeholder*="שם מלא"]', testGuestName);
    await page.click('button:has-text("אגיע בשמחה")');

    // Step 2: Set counts (Adults: 2, Kids: 2, Babies: 1)
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();
    const plusButtons = page.locator('button:has-text("+")');
    await plusButtons.nth(0).click(); // Adults: 1 + 1 = 2
    await plusButtons.nth(1).click(); // Kids: 0 + 1 = 1
    await plusButtons.nth(1).click(); // Kids: 1 + 1 = 2
    await plusButtons.nth(2).click(); // Babies: 0 + 1 = 1

    await page.click('button:has-text("המשך")');

    // Step 3: Blessing and Submit
    await expect(page.locator('text=הרכב:')).toBeVisible();
    await expect(page.locator('text=2 מבוגרים, 2 ילדים, 1 תינוקות')).toBeVisible();

    await page.fill('textarea', testBlessing);
    // Leave default isPublic = true
    await page.click('button:has-text("אישור סופי ושליחה")');

    // Step 4: Verify Success screen
    await expect(page.locator('text=איזה כיף, נתראה בשמחה!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=תודה רבה, ${testGuestName}!`)).toBeVisible();
    await expect(page.locator('text=ניווט עם Waze')).toBeVisible();

    // Verify Real DB Record in Turso
    const guestCheck = await db.execute({
      sql: 'SELECT * FROM guests WHERE name = ?',
      args: [testGuestName]
    });
    expect(guestCheck.rows.length).toBe(1);
    const gRow = guestCheck.rows[0];
    console.log('Real DB Guest Row verified:', gRow);
    expect(gRow.attending).toBe(1);
    expect(gRow.adults).toBe(2);
    expect(gRow.kids).toBe(2);
    expect(gRow.babies).toBe(1);
    expect(gRow.event_part).toBe('האירוע המלא');

    const blessingCheck = await db.execute({
      sql: 'SELECT * FROM blessings WHERE author_name = ?',
      args: [testGuestName]
    });
    expect(blessingCheck.rows.length).toBe(1);
    const bRow = blessingCheck.rows[0];
    console.log('Real DB Blessing Row verified:', bRow);
    expect(bRow.content).toBe(testBlessing);
    expect(bRow.is_public).toBe(1);

    // Clean up
    await db.execute({ sql: 'DELETE FROM guests WHERE id = ?', args: [gRow.id] });
    await db.execute({ sql: 'DELETE FROM blessings WHERE id = ?', args: [bRow.id] });
  });

  test('Decline Flow without Blessing against Real Backend', async ({ page }) => {
    const declineName1 = `אורח מסרב ללא ברכה ${Date.now()}`;
    await page.goto('/');
    await page.fill('input[placeholder*="שם מלא"]', declineName1);
    await page.click('button:has-text("לא מתאפשר לי להגיע")');

    await expect(page.locator('h2', { hasText: 'תודה רבה' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=תודה רבה, ${declineName1}!`)).toBeVisible();
    const check1 = await db.execute({
      sql: 'SELECT * FROM guests WHERE name = ?',
      args: [declineName1]
    });
    expect(check1.rows.length).toBe(1);
    expect(check1.rows[0].attending).toBe(0);
    expect(check1.rows[0].adults).toBe(0);
    expect(check1.rows[0].kids).toBe(0);
    expect(check1.rows[0].babies).toBe(0);
    expect(check1.rows[0].event_part).toBe('אינו מגיע');

    // Clean up
    await db.execute({ sql: 'DELETE FROM guests WHERE id = ?', args: [check1.rows[0].id] });
  });

  test('Decline Flow with Blessing against Real Backend', async ({ page }) => {
    const declineName2 = `אורח מסרב עם ברכה ${Date.now()}`;
    const blessingContent = `מזל טוב מכל הלב למרות שלא אוכל להגיע! ${Date.now()}`;
    await page.goto('/');
    await page.fill('input[placeholder*="שם מלא"]', declineName2);
    await page.click('button:has-text("לא מתאפשר לי להגיע")');

    await expect(page.locator('h2', { hasText: 'תודה רבה' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=תודה רבה, ${declineName2}!`)).toBeVisible();
    await page.fill('textarea', blessingContent);

    // Set to private blessing
    await page.click('button:has-text("פרטית לתובל")');
    await page.click('button:has-text("שליחת ברכה")');

    await expect(page.locator('text=תודה רבה! הברכה נשלחה באהבה לתובל.')).toBeVisible({ timeout: 10000 });

    const check2 = await db.execute({
      sql: 'SELECT * FROM blessings WHERE author_name = ?',
      args: [declineName2]
    });
    expect(check2.rows.length).toBe(1);
    expect(check2.rows[0].content).toBe(blessingContent);
    expect(check2.rows[0].is_public).toBe(0);

    // Clean up
    await db.execute({ sql: 'DELETE FROM guests WHERE name = ?', args: [declineName2] });
    await db.execute({ sql: 'DELETE FROM blessings WHERE author_name = ?', args: [declineName2] });
  });

  test('Browser Back and Forward History Navigation', async ({ page }) => {
    await page.goto('/');

    // Step 1 -> Step 2
    await page.fill('input[placeholder*="שם מלא"]', 'נווט היסטוריה');
    await page.click('button:has-text("אגיע בשמחה")');
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();

    // Step 2 -> Step 3
    await page.click('button:has-text("המשך")');
    await expect(page.locator('text=הרכב:')).toBeVisible();

    // Browser Back to Step 2
    await page.goBack();
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();

    // Browser Back to Step 1
    await page.goBack();
    await expect(page.locator('input[placeholder*="שם מלא"]')).toBeVisible();
    // Name must be preserved!
    await expect(page.locator('input[placeholder*="שם מלא"]')).toHaveValue('נווט היסטוריה');

    // Browser Forward to Step 2
    await page.goForward();
    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();

    // Browser Forward to Step 3
    await page.goForward();
    await expect(page.locator('text=הרכב:')).toBeVisible();
  });

  test('Rapid Clicking & Chaos Monkey on + and - Counter Buttons', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder*="שם מלא"]', 'קליקר מהיר');
    await page.click('button:has-text("אגיע בשמחה")');

    await expect(page.locator('h2', { hasText: 'כמה מגיעים לחגוג?' })).toBeVisible();

    const adultPlus = page.locator('button:has-text("+")').nth(0);
    const adultMinus = page.locator('button:has-text("-")').nth(0);
    const kidsPlus = page.locator('button:has-text("+")').nth(1);
    const kidsMinus = page.locator('button:has-text("-")').nth(1);

    // Rapid spam '+' on adults 25 times
    for (let i = 0; i < 25; i++) {
      await adultPlus.click();
    }
    // Expected: 1 + 25 = 26
    await expect(page.locator('span.w-6').nth(0)).toHaveText('26');

    // Rapid spam '-' on adults 35 times (should not go below 1)
    for (let i = 0; i < 35; i++) {
      await adultMinus.click();
    }
    await expect(page.locator('span.w-6').nth(0)).toHaveText('1');

    // Rapid spam '+' on kids 10 times, then '-' 15 times (should not go below 0)
    for (let i = 0; i < 10; i++) {
      await kidsPlus.click();
    }
    await expect(page.locator('span.w-6').nth(1)).toHaveText('10');
    for (let i = 0; i < 15; i++) {
      await kidsMinus.click();
    }
    await expect(page.locator('span.w-6').nth(1)).toHaveText('0');
  });

  test('VERIFIED FIX: Refresh on Step 3 retains name from sessionStorage and prevents empty submission to DB', async ({ page }) => {
    const reloadTestName = `טסטר רענון ${Date.now()}`;
    await page.goto('/');
    await page.fill('input[placeholder*="שם מלא"]', reloadTestName);
    await page.click('button:has-text("אגיע בשמחה")');
    await page.click('button:has-text("המשך")');
    await expect(page.locator('text=הרכב:')).toBeVisible();

    // Reload page while on Step 3
    await page.reload();

    // App is still on Step 3 and retains name
    await expect(page.locator('text=הרכב:')).toBeVisible();

    const submitBtn = page.locator('button:has-text("אישור סופי ושליחה")');
    await expect(submitBtn).toBeEnabled();

    // Submitting now will post with preserved name
    await submitBtn.click();
    await expect(page.locator('text=איזה כיף, נתראה בשמחה!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=תודה רבה, ${reloadTestName}!`)).toBeVisible();

    // Verify row was created with the correct name, NOT empty
    const row = await db.execute({
      sql: "SELECT * FROM guests WHERE name = ?",
      args: [reloadTestName]
    });
    expect(row.rows.length).toBe(1);

    // Clean up
    await db.execute({ sql: 'DELETE FROM guests WHERE id = ?', args: [row.rows[0].id] });
  });
});
