import { test, expect } from '@playwright/test';

test('Full Edit Flow: Initial Submit -> Edit Mode -> Update with Zero Duplicates', async ({ page }) => {
  // Unique name per run to avoid collision with leftover records
  const testName = `בדיקת עריכה ${Date.now()}`;

  // 1. Navigate to RSVP
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');

  // 2. Fill name and submit attending
  await page.fill('input[placeholder*="שם מלא"]', testName);
  await page.click('button:has-text("אגיע בשמחה")');

  // 3. Screen 2: Adjust counts
  await page.waitForSelector('text=כמה מגיעים לחגוג?');
  // Add 1 adult (so adults = 2)
  await page.click('button[aria-label="הוסף מבוגרים"]');
  // Add 2 kids (so kids = 2)
  await page.click('button[aria-label="הוסף ילדים"]');
  await page.click('button[aria-label="הוסף ילדים"]');
  
  await page.click('button:has-text("המשך ←")');

  // 4. Screen 3: Add blessing & submit
  await page.waitForSelector('text=רוצה להשאיר ברכה לתובל?');
  await page.fill('textarea', 'מזל טוב ענק לתובל לרגל בר המצווה!');
  await page.click('button:has-text("אישור סופי ושליחה")');

  // 5. Screen 4: Confirmation screen
  await page.waitForSelector('text=זהו לעת עתה! הכל נשמר בהצלחה.');

  // 6. Click Edit Details ("טעות? עריכת פרטי הגעה")
  await page.click('button:has-text("עריכת פרטי הגעה")');

  // 7. Verify back on Screen 1 with Compact Edit Mode Badge
  await page.waitForSelector('text=מצב עריכה: מעדכן רישום עבור');
  await expect(page.locator('text=מצב עריכה: מעדכן רישום עבור')).toBeVisible();
  await expect(page.locator(`text=${testName}`)).toBeVisible();

  // Take screenshot of Compact Edit Mode Badge and full screen 1
  await page.screenshot({ path: 'C:/Users/razmm/.gemini/antigravity/brain/2ac546f7-f9c7-4d92-9b8d-0f56fe5e39ec/screen1_edit_mode.png' });
  const banner = page.locator('text=מצב עריכה: מעדכן רישום עבור').locator('..');
  await banner.screenshot({ path: 'C:/Users/razmm/.gemini/antigravity/brain/2ac546f7-f9c7-4d92-9b8d-0f56fe5e39ec/edit_mode_banner.png' });

  // 8. Continue to update guest counts
  await page.click('button:has-text("המשך לעדכון כמויות")');
  await page.waitForSelector('text=כמה מגיעים לחגוג?');

  // Increase kids to 3
  await page.click('button[aria-label="הוסף ילדים"]');

  await page.click('button:has-text("המשך ←")');

  // 9. Screen 3: Verify button label
  await page.waitForSelector('text=שמירת עדכון ההגעה');
  await page.click('button:has-text("שמירת עדכון ההגעה")');

  // 10. Screen 4 again
  await page.waitForSelector('text=זהו לעת עתה! הכל נשמר בהצלחה.');
  await expect(page.locator(`text=תודה רבה, ${testName}!`)).toBeVisible();

  // 11. Verify via API that there is EXACTLY 1 guest with this name and kids = 3
  const guestsRes = await page.request.get('http://localhost:3001/api/guests');
  const guests = await guestsRes.json();
  const matchedGuests = guests.filter((g: any) => g.name === testName);
  
  expect(matchedGuests.length).toBe(1);
  expect(matchedGuests[0].adults).toBe(2);
  expect(matchedGuests[0].kids).toBe(3);
  expect(matchedGuests[0].updated_at).not.toBeNull();

  // Clean up
  await page.request.delete(`http://localhost:3001/api/guests/${matchedGuests[0].id}`);
  console.log('✅ Edit mode test passed with 100% precision: 1 single record in DB!');
});
