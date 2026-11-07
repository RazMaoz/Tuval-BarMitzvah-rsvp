import { chromium, devices } from 'playwright';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config();

const PORT = 3055;
const BASE_URL = `http://localhost:${PORT}/admin`;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:rsvp.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  console.log('🚀 Starting Admin Add Guest E2E & Integrity Verification Suite...');

  // Start local server
  const server = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'inherit',
  });

  await new Promise((r) => setTimeout(r, 2000));

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Step 1: Verify baseline state
    console.log('\n--- Step 1: Verifying baseline state ---');
    const title = await page.locator('h1').textContent();
    console.log('Page Title:', title);
    if (!title.includes('פאנל ניהול מוזמנים וברכות')) {
      throw new Error('FAIL: Admin page failed to load correctly!');
    }

    const initialRowsCount = await page.locator('tbody tr').count();
    console.log(`Initial rows count in table: ${initialRowsCount}`);
    if (initialRowsCount < 19) {
      throw new Error(`FAIL: Expected at least 19 rows, got ${initialRowsCount}`);
    }
    console.log('✓ Baseline 19+ guests intact and rendered.');

    // Step 2: Open Add Guest Modal
    console.log('\n--- Step 2: Opening Add Guest Modal ---');
    const addBtn = page.locator('button:has-text("הוספת אורח")');
    await addBtn.click();
    await page.waitForSelector('text=הוספת אורח ידנית');
    console.log('✓ Modal opened successfully.');

    // Step 3: Test Soft Warning for Duplicate Names
    console.log('\n--- Step 3: Testing soft duplicate warning ---');
    const nameInput = page.locator('#new-guest-name');
    await nameInput.fill('ניר מינץ');
    await page.waitForSelector('text=אורח בשם זה כבר קיים ברשימה');
    console.log('✓ Soft warning displayed as expected for existing guest name.');

    // Step 4: Test Cancel Modal
    console.log('\n--- Step 4: Testing Cancel button ---');
    await page.click('button:has-text("ביטול")');
    await page.waitForSelector('text=הוספת אורח ידנית', { state: 'hidden' });
    console.log('✓ Modal closed on cancel without side effects.');

    // Step 5: Test Adding Attending Guest
    console.log('\n--- Step 5: Adding a new attending guest ---');
    await addBtn.click();
    await page.waitForSelector('text=הוספת אורח ידנית');

    const testAttendingName = 'בדיקת מנהל אוטומטית שרה';
    await nameInput.fill(testAttendingName);

    // Increase adults to 2 (initial is 1, click + once)
    await page.click('button[aria-label="הוסף מבוגר"]');

    // Increase kids to 1 (initial is 0, click + once)
    await page.click('button[aria-label="הוסף ילד"]');

    // Select category: משפחה רז
    await page.selectOption('#new-guest-category', 'משפחה רז');

    // Take Desktop Screenshot of Modal
    await page.screenshot({ path: 'verified_add_guest_modal_desktop.png' });

    // Submit modal
    await page.click('button:has-text("הוסף אורח")');
    await page.waitForSelector('text=הוספת אורח ידנית', { state: 'hidden' });
    await page.waitForTimeout(500);

    // Assert DB State for attending guest
    const dbRes1 = await db.execute({
      sql: 'SELECT * FROM guests WHERE name = ?',
      args: [testAttendingName],
    });
    if (dbRes1.rows.length !== 1) {
      throw new Error('FAIL: Attending guest was not saved in DB!');
    }
    const savedGuest1 = dbRes1.rows[0];
    console.log('DB Record 1:', {
      name: savedGuest1.name,
      attending: savedGuest1.attending,
      adults: savedGuest1.adults,
      kids: savedGuest1.kids,
      category: savedGuest1.category,
    });
    if (savedGuest1.adults !== 2 || savedGuest1.kids !== 1 || savedGuest1.attending !== 1 || savedGuest1.category !== 'משפחה רז') {
      throw new Error(`FAIL: DB fields mismatch! Got: ${JSON.stringify(savedGuest1)}`);
    }
    console.log('✓ DB Assertion Passed: Attending guest saved with exact counts and category.');

    // Assert in UI Table
    await page.waitForSelector(`text=${testAttendingName}`);
    console.log('✓ UI Assertion Passed: New guest rendered in table.');

    // Step 6: Test Adding Declined Guest
    console.log('\n--- Step 6: Adding a declined guest ---');
    await addBtn.click();
    await page.waitForSelector('text=הוספת אורח ידנית');

    const testDeclinedName = 'בדיקת מנהל לא מגיע דן';
    await nameInput.fill(testDeclinedName);

    // Click "לא מגיע" inside the modal form
    await page.locator('form button:has-text("לא מגיע")').click();
    await page.waitForSelector('text=ההרכב מאופס באופן אוטומטי');

    await page.locator('form button:has-text("הוסף אורח")').click();
    await page.waitForSelector('text=הוספת אורח ידנית', { state: 'hidden' });
    await page.waitForTimeout(500);

    // Assert DB State for declined guest
    const dbRes2 = await db.execute({
      sql: 'SELECT * FROM guests WHERE name = ?',
      args: [testDeclinedName],
    });
    if (dbRes2.rows.length !== 1) {
      throw new Error('FAIL: Declined guest was not saved in DB!');
    }
    const savedGuest2 = dbRes2.rows[0];
    console.log('DB Record 2:', {
      name: savedGuest2.name,
      attending: savedGuest2.attending,
      adults: savedGuest2.adults,
      kids: savedGuest2.kids,
    });
    if (savedGuest2.attending !== 0 || savedGuest2.adults !== 0 || savedGuest2.kids !== 0) {
      throw new Error(`FAIL: Declined guest mismatch! Got: ${JSON.stringify(savedGuest2)}`);
    }
    console.log('✓ DB Assertion Passed: Declined guest saved with attending=0 and 0 counts.');

    // Step 7: Mobile Viewport Verification
    console.log('\n--- Step 7: Mobile Viewport Verification ---');
    await page.setViewportSize({ width: 390, height: 844 });
    await addBtn.click();
    await page.waitForSelector('text=הוספת אורח ידנית');
    await page.screenshot({ path: 'verified_add_guest_modal_mobile.png' });
    await page.click('button[title="סגור חלון"]');
    await page.waitForSelector('text=הוספת אורח ידנית', { state: 'hidden' });
    console.log('✓ Mobile modal verified and screenshot saved.');

    console.log('\n======================================================');
    console.log('🎉 ALL ADMIN FUNCTIONAL E2E TESTS PASSED 100%! 🎉');
    console.log('======================================================\n');
  } finally {
    // Surgical cleanup: ONLY delete our test records
    console.log('🧹 Surgically cleaning up temporary automated test records...');
    await db.execute("DELETE FROM guests WHERE name LIKE 'בדיקת מנהל%'");
    
    // Verify cleanup
    const remainingTest = await db.execute("SELECT COUNT(*) as count FROM guests WHERE name LIKE 'בדיקת מנהל%'");
    console.log(`Remaining test records in DB: ${remainingTest.rows[0].count}`);

    const totalRealGuests = await db.execute("SELECT COUNT(*) as count FROM guests");
    console.log(`Total real guests in DB after test: ${totalRealGuests.rows[0].count}`);

    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error('❌ Functional test failed:', err);
  process.exit(1);
});
