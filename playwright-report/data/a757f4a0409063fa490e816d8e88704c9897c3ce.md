# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: red-team-fuzz.spec.ts >> Red Team Fuzz Testing (No AI) >> The Injector & Chaos Monkey (XSS, extreme state changes)
- Location: tests\red-team-fuzz.spec.ts:44:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('div').filter({ hasText: 'מבוגרים (12+)' }).last().getByRole('button', { name: '+' }).nth(1)

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "בר מצווה לתוּבַל" [level=1] [ref=e6]
  - generic [ref=e15]:
    - heading "כמה מגיעים?" [level=2] [ref=e16]
    - generic [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]: מבוגרים (12+)
        - generic [ref=e20]:
          - button "-" [ref=e21]
          - generic [ref=e22]: "1"
          - button "+" [ref=e23]
      - generic [ref=e24]:
        - generic [ref=e25]: ילדים (2-12)
        - generic [ref=e26]:
          - button "-" [ref=e27]
          - generic [ref=e28]: "0"
          - button "+" [ref=e29]
      - generic [ref=e30]:
        - generic [ref=e31]: תינוקות (0-2)
        - generic [ref=e32]:
          - button "-" [ref=e33]
          - generic [ref=e34]: "0"
          - button "+" [ref=e35]
  - generic [ref=e36]:
    - button "חזור" [ref=e37]
    - button "המשך" [active] [ref=e40]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Red Team Fuzz Testing (No AI)', () => {
  4  |   
  5  |   test('The Indecisive Guest (State retention and backward navigation)', async ({ page }) => {
  6  |     await page.goto('/');
  7  |     
  8  |     // Step 0 -> 1
  9  |     await page.click('button:has-text("בואו נתחיל")');
  10 |     
  11 |     // Step 1: Enter name
  12 |     await page.fill('input[name="name"]', 'אורח מתלבט');
  13 |     await page.click('button:has-text("המשך")');
  14 |     
  15 |     // Step 2: Choose Yes
  16 |     await page.click('text=ברור, נגיע בשמחה!');
  17 |     
  18 |     // Hardware/UI Back to Step 1
  19 |     await page.click('button:has-text("חזור")');
  20 |     
  21 |     // Clear name, try to bypass validation
  22 |     await page.fill('input[name="name"]', '   ');
  23 |     await page.click('button:has-text("המשך")');
  24 |     
  25 |     // Verify we are still blocked at Step 1
  26 |     await expect(page.locator('h2:has-text("איך קוראים לכם?")')).toBeVisible();
  27 |     
  28 |     // Fix name and continue
  29 |     await page.fill('input[name="name"]', 'אורח החלטי');
  30 |     await page.click('button:has-text("המשך")');
  31 |     
  32 |     // Step 2: Change mind to 'No'
  33 |     await page.click('text=לצערנו לא נוכל');
  34 |     await page.click('button:has-text("המשך")');
  35 |     
  36 |     // Should jump to Step 5 (Submit)
  37 |     await expect(page.locator('text=לא מגיעים')).toBeVisible();
  38 |     
  39 |     // Click Back, should jump correctly back to Step 2
  40 |     await page.click('button:has-text("חזור")');
  41 |     await expect(page.locator('h2:has-text("האם תגיעו לחגוג איתנו?")')).toBeVisible();
  42 |   });
  43 | 
  44 |   test('The Injector & Chaos Monkey (XSS, extreme state changes)', async ({ page }) => {
  45 |     await page.goto('/');
  46 |     await page.click('button:has-text("בואו נתחיל")');
  47 |     
  48 |     // Inject XSS payload into name field
  49 |     const maliciousPayload = '<script>alert("hacked")</script> DROP TABLE guests;';
  50 |     await page.fill('input[name="name"]', maliciousPayload);
  51 |     await page.click('button:has-text("המשך")');
  52 |     
  53 |     await page.click('text=ברור, נגיע בשמחה!');
  54 |     await page.click('button:has-text("המשך")');
  55 |     
  56 |     await page.click('text=רק למסיבה (17:00)');
  57 |     await page.click('button:has-text("המשך")');
  58 |     
  59 |     // Chaos monkey: Click adult '+' button 20 times rapidly
  60 |     const adultRow = page.locator('div').filter({ hasText: 'מבוגרים (12+)' }).last();
  61 |     for (let i = 0; i < 20; i++) {
> 62 |       await adultRow.getByRole('button', { name: '+' }).nth(1).click();
     |                                                                ^ Error: locator.click: Test timeout of 30000ms exceeded.
  63 |     }
  64 |     
  65 |     // Chaos monkey: Click '-' 5 times
  66 |     for (let i = 0; i < 5; i++) {
  67 |       await adultRow.getByRole('button', { name: '-' }).first().click();
  68 |     }
  69 |     
  70 |     await page.click('button:has-text("המשך")');
  71 |     
  72 |     // Verification on Step 5
  73 |     // 1. Ensure React escaped the malicious payload safely (XSS protection)
  74 |     await expect(page.locator(`p:has-text("${maliciousPayload}")`)).toBeVisible();
  75 |     
  76 |     // 2. Ensure state handled rapid clicks (1 initial + 20 additions - 5 subtractions = 16)
  77 |     await expect(page.locator('text=16 מבוגרים')).toBeVisible();
  78 |   });
  79 | });
  80 | 
```