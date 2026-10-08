# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: red-team-fuzz.spec.ts >> Red Team Fuzz Testing (No AI) >> The Indecisive Guest (State retention and backward navigation)
- Location: tests\red-team-fuzz.spec.ts:5:3

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "בר מצווה לתוּבַל" [level=1] [ref=e6]
  - generic [ref=e15]:
    - heading "איך קוראים לכם?" [level=2] [ref=e16]
    - textbox "שם משפחה / מלא" [active] [ref=e17]
  - generic [ref=e18]:
    - button "חזור" [ref=e19]
    - button "המשך" [disabled] [ref=e22]
```