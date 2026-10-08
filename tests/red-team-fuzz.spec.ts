import { test, expect } from '@playwright/test';

test.describe('Red Team Fuzz Testing (No AI)', () => {
  
  test('The Indecisive Guest (State retention and backward navigation)', async ({ page }) => {
    await page.goto('/');
    
    // Step 0 -> 1
    await page.click('button:has-text("בואו נתחיל")');
    
    // Step 1: Enter name
    await page.fill('input[name="name"]', 'אורח מתלבט');
    await page.click('button:has-text("המשך")');
    
    // Step 2: Choose Yes
    await page.click('text=ברור, נגיע בשמחה!');
    
    // Hardware/UI Back to Step 1
    await page.click('button:has-text("חזור")');
    
    // Clear name, try to bypass validation
    await page.fill('input[name="name"]', '   ');
    await page.click('button:has-text("המשך")');
    
    // Verify we are still blocked at Step 1
    await expect(page.locator('h2:has-text("איך קוראים לכם?")')).toBeVisible();
    
    // Fix name and continue
    await page.fill('input[name="name"]', 'אורח החלטי');
    await page.click('button:has-text("המשך")');
    
    // Step 2: Change mind to 'No'
    await page.click('text=לצערנו לא נוכל');
    await page.click('button:has-text("המשך")');
    
    // Should jump to Step 5 (Submit)
    await expect(page.locator('text=לא מגיעים')).toBeVisible();
    
    // Click Back, should jump correctly back to Step 2
    await page.click('button:has-text("חזור")');
    await expect(page.locator('h2:has-text("האם תגיעו לחגוג איתנו?")')).toBeVisible();
  });

  test('The Injector & Chaos Monkey (XSS, extreme state changes)', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("בואו נתחיל")');
    
    // Inject XSS payload into name field
    const maliciousPayload = '<script>alert("hacked")</script> DROP TABLE guests;';
    await page.fill('input[name="name"]', maliciousPayload);
    await page.click('button:has-text("המשך")');
    
    await page.click('text=ברור, נגיע בשמחה!');
    await page.click('button:has-text("המשך")');
    
    await page.click('text=רק למסיבה (17:00)');
    await page.click('button:has-text("המשך")');
    
    // Chaos monkey: Click adult '+' button 20 times rapidly
    const adultRow = page.locator('div').filter({ hasText: 'מבוגרים (12+)' }).last();
    for (let i = 0; i < 20; i++) {
      await adultRow.locator('button').nth(1).click();
    }
    
    // Chaos monkey: Click '-' 5 times
    for (let i = 0; i < 5; i++) {
      await adultRow.locator('button').first().click();
    }
    
    await page.click('button:has-text("המשך")');
    
    // Verification on Step 5
    // 1. Ensure React escaped the malicious payload safely (XSS protection)
    await expect(page.locator(`p:has-text("${maliciousPayload}")`)).toBeVisible();
    
    // 2. Ensure state handled rapid clicks (1 initial + 20 additions - 5 subtractions = 16)
    await expect(page.locator('text=16 מבוגרים')).toBeVisible();
  });
});
