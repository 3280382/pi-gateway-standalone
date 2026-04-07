# Mandatory Feature Verification Prompt Template

## Usage Instructions

When you need me to complete feature fixes or verification, please copy the following template and paste it into the conversation.

---

## Standard Feature Verification Template

```
Must execute in the following order, explicitly report results after each step, only say "complete" after all checked:

□ STEP 1 - Code modification complete
  Modified files: [List all modified file paths]
  
□ STEP 2 - Build compilation passed
  Run: npm run build
  Result: [Success/Failure, if failure list detailed error info]
  
□ STEP 3 - Type check passed
  Run: npm run typecheck
  Result: [Pass/Fail, if fail list first 3 errors]
  
□ STEP 4 - Unit tests passed
  Run: npm test
  Result: [Passed X/Failed Y]
  
□ STEP 5 - Service verification normal
  Run: node scripts/tmux-controller.js status
  Result: [Frontend normal/abnormal] [Backend normal/abnormal]
  
□ STEP 6 - [Gold Standard] Simulated browser testing (mandatory requirement)
  **Requirement**: Must create actual automated test to verify functionality
  **Prohibited**: Only code review, API testing, or curl requests as functional verification
  
  Create tests based on functional requirements, verify the following aspects:
  
  □ User interface elements exist
    - Test code: [Paste test code]
    - Verification: [Element selector can find target element]
  
  □ User interaction triggers state update
    - Test code: [Paste test code]
    - Verification: [Click/input operations trigger state changes]
  
  □ DOM elements render correctly
    - Test code: [Paste test code]
    - Verification: [Elements visible, CSS classes correct, styles applied]
  
  □ Network requests trigger correctly
    - Test code: [Paste test code]
    - Verification: [API requests sent, parameters correct]
  
  □ Data displays correctly
    - Test code: [Paste test code]
    - Verification: [Data loads and displays correctly in UI]
  
  Test run results:
  ```
  [Paste complete test run output]
  ```
  
□ STEP 7 - Actual behavior verification (mandatory requirement)
  Prove the following through logs or test output:
  
  □ State updates actually occur
    Evidence: [Logs/output showing state changes]
  
  □ Components actually re-render
    Evidence: [Logs/output showing render triggers]
  
  □ API requests actually sent
    Evidence: [Network logs/backend logs showing requests]
  
  □ Data actually loaded
    Evidence: [Response data/UI updates proving functionality]

⚠️ Important Declarations:
- "Code modification complete" ≠ "Feature fix complete"
- Build success ≠ Runtime correct
- API test normal ≠ Feature normal
- TypeScript compilation pass ≠ JavaScript execution correct

**Before completing STEP 6-7, strictly prohibited from saying "complete", "fixed", or "passed".**
```

---

## Quick Verification Template (for simple fixes)

```
For simple fixes, minimum required:

□ Code modification complete and build successful
□ Service running normally
□ [Gold Standard] Create and run a test proving feature works
   - Test code: [Paste code]
   - Run results: [Paste output]

Without completing above three items, do not say "complete".
```

---

## Why This Template is Needed

### Problem Background
In previous fix attempts, I (AI) often made the following mistakes:
1. Declared "complete" after only code review
2. Only used API tests (curl) to verify functionality
3. Ignored actual browser runtime behavior
4. Confused "code correct" with "feature normal"

### Consequences
- User reports feature still not working
- Repeated fixes for same issue
- Wasted time and trust

### Solution
This mandatory template ensures:
1. Code quality checks (build, type, test)
2. Service verification (frontend and backend running normally)
3. **Gold Standard: Actual browser/functional testing**

Only step 3 can prove the feature really works.

---

## Reference Documentation

- Complete process: /root/pi-gateway-standalone/DEVELOPMENT.md
- System rules: /root/pi-gateway-standalone/SYSTEM.md
- Project overview: /root/pi-gateway-standalone/README.md
