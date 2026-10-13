import { webkit, devices } from 'playwright';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

const PORT = 3040;
const BASE_URL = `http://localhost:${PORT}`;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:rsvp.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log('🚀 Starting Comprehensive Functional Verification Suite (Pre-Mortem Standards)...');

  // Launch local server
  const server = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });

  await new Promise((r) => setTimeout(r, 1200));

  const browser = await webkit.launch({ headless: true });

  try {
    // ==========================================
    // TEST 1: New Guest Complete Registration E2E
    // ==========================================
    console.log('\n--- TEST 1: New Guest Complete Registration E2E ---');
    const iPhone = devices['iPhone 14 Pro'];
    const context1 = await browser.newContext({ ...iPhone, locale: 'he-IL' });
    const page1 = await context1.newPage();

    let posthogDetected = false;
    page1.on('request', (req) => {
      if (req.url().includes('posthog.com')) posthogDetected = true;
    });

    await page1.goto(BASE_URL);

    // Screen 1: Enter Name
    await page1.fill('#guest-name-input', 'בדיקה אוטומטית שרה');
    await page1.click('button:has-text("אגיע בשמחה")');
    await page1.waitForTimeout(400);

    // Screen 2: Counters (2 adults, 1 kid, 1 baby)
    await page1.click('button[aria-label="הוסף מבוגר"]'); // adults: 2
    await page1.click('button[aria-label="הוסף ילד"]');   // kids: 1
    await page1.click('button[aria-label="הוסף תינוק"]'); // babies: 1
    await page1.click('button:has-text("המשך ⬅")');
    await page1.waitForTimeout(400);

    // Screen 3: Blessing
    await page1.fill('textarea', 'מזל טוב תובל היקר והאהוב!');
    await page1.click('button:has-text("שמירת הברכה והמשך ⬅")');
    await page1.waitForTimeout(400);

    // Screen 4: Final Submit
    await page1.click('button:has-text("סיום ואישור")');
    await page1.waitForSelector('button:has-text("סיום ואישור")', { state: 'hidden' });
    await page1.waitForSelector('text=הרכב רשום:');

    // Check PostHog absence
    const hasPostHog = await page1.evaluate(() => typeof window.posthog !== 'undefined');
    if (hasPostHog || posthogDetected) {
      throw new Error('FAIL: PostHog was detected in the client session!');
    }
    console.log('✓ PostHog completely absent from client environment.');

    // Assert DB State
    const dbRes1 = await db.execute({
      sql: 'SELECT * FROM guests WHERE name = ?',
      args: ['בדיקה אוטומטית שרה'],
    });
    if (dbRes1.rows.length === 0) throw new Error('FAIL: Guest not saved in DB!');
    const guest1 = dbRes1.rows[0];
    console.log(`DB Guest 1 record: adults=${guest1.adults}, kids=${guest1.kids}, babies=${guest1.babies}, attending=${guest1.attending}`);
    if (guest1.adults !== 2 || guest1.kids !== 1 || guest1.babies !== 1 || guest1.attending !== 1) {
      throw new Error(`FAIL: DB guest record mismatch! Got adults=${guest1.adults}, kids=${guest1.kids}, babies=${guest1.babies}`);
    }
    console.log('✓ Test 1 Passed: Data saved accurately in database.');

    // ==========================================
    // TEST 2: Returning Guest (The Rotem Eliyahu Test)
    // ==========================================
    console.log('\n--- TEST 2: Returning Guest Portal & Hydration ---');
    // Simulate user closing WhatsApp and re-opening link later in fresh page
    await page1.close();
    const page2 = await context1.newPage();
    await page2.goto(BASE_URL);

    // Assert: Directly lands in Returning Guest Portal
    await page2.waitForSelector('text=שלום, בדיקה אוטומטית שרה!');
    console.log('✓ Successfully landed on Returning Guest Portal.');

    // Assert: UI renders exact hydrated composition from DB (2 adults, 1 kid, 1 baby)
    const summaryCardText = await page2.locator('text=הרכב רשום:').locator('..').textContent();
    console.log('Rendered Composition on Portal:', summaryCardText.trim());
    if (!summaryCardText.includes('2 מבוגרים') || !summaryCardText.includes('1 ילדים') || !summaryCardText.includes('1 תינוקות')) {
      throw new Error(`FAIL: Portal did not display exact hydrated counts! Got: ${summaryCardText}`);
    }
    console.log('✓ Test 2 Passed: Exact hydrated DB counts rendered on Portal.');

    // Assert: Waze and Calendar buttons present
    const hasWaze = await page2.locator('a:has-text("ניווט ב-Waze")').isVisible();
    const hasGoogleCal = await page2.locator('a:has-text("Google Calendar")').isVisible();
    const hasAppleCal = await page2.locator('button:has-text("Apple / Outlook")').isVisible();
    const hasEditBtn = await page2.locator('text=יש ללחוץ כאן לעדכון').isVisible();

    if (!hasWaze || !hasGoogleCal || !hasAppleCal || !hasEditBtn) {
      throw new Error('FAIL: Required toolkit action buttons missing from Returning Guest Portal!');
    }
    console.log('✓ All portal action buttons (Waze, Calendars, Update) verified and visible.');

    // ==========================================
    // TEST 3: Returning Guest Edit Flow
    // ==========================================
    console.log('\n--- TEST 3: Returning Guest Edit Flow ---');
    await page2.click('button:has-text("יש ללחוץ כאן לעדכון")');
    await page2.waitForSelector('text=כמה מגיעים לחגוג?');

    // Change adults from 2 to 3
    await page2.click('button[aria-label="הוסף מבוגר"]'); // adults: 3
    await page2.click('button:has-text("המשך ⬅")');
    await page2.waitForTimeout(400);

    await page2.fill('textarea', 'מעדכנת ברכה: המון מזל טוב!');
    await page2.click('button:has-text("שמירת הברכה והמשך ⬅")');
    await page2.waitForTimeout(400);

    await page2.click('button:has-text("סיום ואישור")');
    await page2.waitForSelector('button:has-text("סיום ואישור")', { state: 'hidden' });
    await page2.waitForSelector('text=הרכב רשום:');

    // Assert DB State: must be updated to 3 adults, same ID, no duplicates!
    const dbRes2 = await db.execute({
      sql: 'SELECT * FROM guests WHERE name = ?',
      args: ['בדיקה אוטומטית שרה'],
    });
    if (dbRes2.rows.length !== 1) {
      throw new Error(`FAIL: Duplicate records found! Expected 1 record, got ${dbRes2.rows.length}`);
    }
    if (dbRes2.rows[0].adults !== 3) {
      throw new Error(`FAIL: Expected updated adults=3, got ${dbRes2.rows[0].adults}`);
    }
    console.log('✓ Test 3 Passed: Edit updated existing record seamlessly without duplicates.');

    // ==========================================
    // TEST 4: Declining Guest & Declined Portal
    // ==========================================
    console.log('\n--- TEST 4: Declining Guest & Declined Portal ---');
    const context2 = await browser.newContext({ ...iPhone, locale: 'he-IL' });
    const page3 = await context2.newPage();
    await page3.goto(BASE_URL);

    await page3.fill('#guest-name-input', 'בדיקה אוטומטית דן');
    await page3.click('button:has-text("לא מתאפשר לי להגיע")');
    await page3.waitForSelector('text=חבל שלא יתאפשר לך להגיע');

    // Submit decline
    await page3.click('button:has-text("סיום ללא ברכה")');
    await page3.waitForSelector('text=תשובתך נשמרה במערכת');

    // Assert DB
    const dbRes3 = await db.execute({
      sql: 'SELECT * FROM guests WHERE name = ?',
      args: ['בדיקה אוטומטית דן'],
    });
    if (dbRes3.rows.length === 0 || dbRes3.rows[0].attending !== 0) {
      throw new Error('FAIL: Declined guest not saved as attending=0 in DB!');
    }
    console.log('✓ Declined guest verified in DB with attending=0.');

    // Reopen in fresh tab
    await page3.close();
    const page4 = await context2.newPage();
    await page4.goto(BASE_URL);

    // Verify lands on Declined Portal with neutral badge
    await page4.waitForSelector('text=שלום, בדיקה אוטומטית דן');
    const hasNeutralBadge = await page4.locator('text=לא מתאפשר להגיע').isVisible();
    const hasChangeMindBtn = await page4.locator('button:has-text("שינוי החלטה ואישור הגעה")').isVisible();

    if (!hasNeutralBadge || !hasChangeMindBtn) {
      throw new Error('FAIL: Declined portal missing neutral status badge or change-mind button!');
    }
    console.log('✓ Test 4 Passed: Declined Portal correctly rendered with neutral phrasing.');

    // Take screenshots of both portal views as proof
    await page2.goto(BASE_URL);
    await page2.screenshot({ path: 'verified_portal_attending_live.png' });
    await page4.screenshot({ path: 'verified_portal_declined_live.png' });
    console.log('✓ Visual proof screenshots saved.');

    console.log('\n======================================================');
    console.log('🎉 ALL FUNCTIONAL PRE-MORTEM TESTS PASSED 100%! 🎉');
    console.log('======================================================\n');
  } finally {
    // Clean up test records
    await db.execute("DELETE FROM guests WHERE name LIKE 'בדיקה אוטומטית%'");
    await db.execute("DELETE FROM blessings WHERE author_name LIKE 'בדיקה אוטומטית%'");
    console.log('🧹 Cleaned up temporary automated test records from DB.');

    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error('❌ Functional test failed:', err);
  process.exit(1);
});
