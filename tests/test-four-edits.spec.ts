import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

test('4 Consecutive Forward/Backward Edits yield exactly 1 DB record and perfect UX', async ({ page }) => {
  const testName = `אריק טסט 4 סבבים ${Date.now()}`;

  // Cleanup any leftover before test
  await db.execute({
    sql: 'DELETE FROM guests WHERE name = ?',
    args: [testName],
  });

  // --- ROUND 1: Initial Registration (Attending) ---
  await page.goto('/');
  await page.fill('input[placeholder*="שם מלא"]', testName);
  await page.click('button:has-text("אגיע בשמחה")');

  // Step 2: Counters
  await expect(page.locator('text=כמה מגיעים לחגוג?')).toBeVisible();
  await page.click('button:has-text("המשך")');

  // Step 3: Blessing & Submit
  await expect(page.locator('text=אישור סופי ושליחה')).toBeVisible();
  await page.click('button:has-text("אישור סופי ושליחה")');

  // Step 4: Verify Screen 4 & Personal Greeting
  await expect(page.locator('h2', { hasText: `תודה רבה, ${testName}!` })).toBeVisible();
  await expect(page.locator('text=איזה כיף, נתראה בשמחה!')).toBeVisible();
  // Verify NO "+ אורח חדש" button anywhere
  await expect(page.locator('text=+ אורח חדש')).toHaveCount(0);

  // --- ROUND 2: Edit back to Screen 1 -> modify and submit ---
  await page.click('text=← טעות? עריכת פרטי הגעה');
  // Check slim edit indicator
  await expect(page.locator('text=מצב עריכה: מעדכן רישום עבור')).toBeVisible();
  // Check NO "+ אורח חדש" button
  await expect(page.locator('text=+ אורח חדש')).toHaveCount(0);
  
  // Advance to step 2 & increase adults
  await page.click('button:has-text("המשך לעדכון כמויות")');
  await page.locator('button[aria-label="הוסף מבוגרים"]').click(); // now 2
  await page.click('button:has-text("המשך")');
  await page.click('button:has-text("שמירת עדכון ההגעה")');
  await expect(page.locator('h2', { hasText: `תודה רבה, ${testName}!` })).toBeVisible();

  // --- ROUND 3: Edit back to Screen 1 -> change to decline ---
  await page.click('text=← טעות? עריכת פרטי הגעה');
  await expect(page.locator('text=מצב עריכה: מעדכן רישום עבור')).toBeVisible();
  await page.click('button:has-text("עדכון לסטטוס לא מגיע")');

  // Screen Decline: Verify Personal Greeting and Concluding Reassurance Card
  await expect(page.locator('h2', { hasText: `תודה רבה, ${testName}!` })).toBeVisible();
  await expect(page.locator('text=חבל שלא יתאפשר לך להגיע...')).toBeVisible();
  await expect(page.locator('text=תשובתך נשמרה במערכת בהצלחה!')).toBeVisible();
  await expect(page.locator('text=אפשר לסגור חלון זה בבטחה.')).toBeVisible();
  // Check NO "+ אורח חדש"
  await expect(page.locator('text=+ אורח חדש')).toHaveCount(0);

  // --- ROUND 4: Edit back from decline -> change back to attending ---
  await page.click('text=← טעות? עדכון תשובה');
  await expect(page.locator('text=מצב עריכה: מעדכן רישום עבור')).toBeVisible();
  await page.click('button:has-text("המשך לעדכון כמויות")');
  await page.click('button:has-text("המשך")');
  await page.click('button:has-text("שמירת עדכון ההגעה")');
  await expect(page.locator('h2', { hasText: `תודה רבה, ${testName}!` })).toBeVisible();

  // --- DB VERIFICATION: Verify EXACTLY 1 record exists in Turso DB ---
  const result = await db.execute({
    sql: 'SELECT id, name, attending, adults, kids, babies FROM guests WHERE name = ?',
    args: [testName],
  });

  console.log(`Database records for ${testName}:`, result.rows);
  expect(result.rows.length).toBe(1);
  expect(Number(result.rows[0].attending)).toBe(1);
  expect(Number(result.rows[0].adults)).toBe(2);

  // Clean up
  await db.execute({
    sql: 'DELETE FROM guests WHERE name = ?',
    args: [testName],
  });
  console.log('✅ 4 consecutive edits test passed with EXACTLY 1 DB record!');
});
