# QA workflow

Recommended end-to-end working pattern for managing test cases, organizing tests, and maintaining quality throughout the testing lifecycle.

## Testing Lifecycle Overview

### Phase 1: Test Planning (Before Coding)

**Goal:** Define what needs to be tested and how.

**Activities:**
1. Review requirements and user stories
2. Identify features to be tested
3. Analyze risk areas (critical paths, complex features)
4. Design test coverage strategy
5. Create test suite structure
6. Define test data requirements

**Deliverables:**
- Test plan document
- Suite structure in Azure DevOps
- List of test scenarios

**Tools Used:**
- Azure DevOps (planning)
- Bromcom Test Builder (structure)

### Phase 2: Test Case Development (During Development)

**Goal:** Create comprehensive, maintainable test cases.

**Activities:**
1. Write test cases for planned scenarios
2. Define parameters and test data
3. Document step-by-step procedures
4. Get peer review and approval
5. Finalize and save to Azure DevOps

**Deliverables:**
- Complete test cases
- Test data parameters
- Step-by-step procedures

**Tools Used:**
- Bromcom Test Builder (primary)
- Azure DevOps (storage)

### Phase 3: Test Execution (During QA Phase)

**Goal:** Execute test cases and identify defects.

**Activities:**
1. Execute test cases manually or automated
2. Record results (pass/fail)
3. Log defects for failures
4. Verify fixes when code is updated
5. Iterate until quality gate is met

**Deliverables:**
- Test execution results
- Defect reports
- Quality metrics

**Tools Used:**
- Bromcom Test Builder (execution)
- Azure DevOps (tracking)
- Defect management system (logging)

### Phase 4: Test Maintenance (Ongoing)

**Goal:** Keep test cases relevant and effective.

**Activities:**
1. Update locators when UI changes
2. Add test cases for new features
3. Remove obsolete test cases
4. Review coverage periodically
5. Refactor for maintainability

**Deliverables:**
- Updated test cases
- Improved locators
- Enhanced coverage

**Tools Used:**
- Bromcom Test Builder (updates)
- Version control (tracking changes)

---

## Daily QA Workflow

### Morning Standup Prep (5 minutes)

```
Before meeting:
1. Review today's test execution list
2. Check for failed tests from previous day
3. Identify blockers or issues
4. Prepare status update
```

### Test Execution Routine

**Start of Day:**
1. Pull latest code/requirements
2. Update connection in Test Builder if needed
3. Review test cases for today
4. Check test data is available
5. Start test execution

**During Execution:**
1. Execute one test case at a time
2. Follow steps exactly
3. Record pass/fail status
4. If failed: create defect, note reproduction steps
5. If blocked: log issue and move to next case
6. Update case status in Azure DevOps

**Mid-Day Check:**
1. Review failed test cases
2. Check if fixes available
3. Re-test fixed cases
4. Update metrics/progress

**End of Day:**
1. Summarize execution results
2. Log any unresolved issues
3. Update team wiki with blockers
4. Save all work, close application
5. Prepare for next day

---

## Feature Testing Workflow

### New Feature: Login with SSO (Example)

#### Step 1: Understand Requirements

**Requirements:**
- Users should be able to log in via company SSO
- SSO button should display on login page
- Should redirect to SSO provider
- Should handle SSO provider errors gracefully
- Should not require password if SSO succeeds

**Risk Areas:**
- Network failure during SSO
- SSO provider timeout
- Token validation
- Fallback to manual login

#### Step 2: Create Test Suite Structure

```
Test Plan: Version 2.0 (New Features)
├── SSO Login
│   ├── Positive Tests
│   │   ├── User can log in via SSO
│   │   ├── User is redirected to dashboard after SSO
│   │   └── User's profile shows SSO as login method
│   ├── Negative Tests
│   │   ├── SSO provider returns error
│   │   ├── SSO token is invalid/expired
│   │   └── Network timeout during SSO
│   └── Edge Cases
│       ├── User has both password and SSO enabled
│       └── SSO provider is temporarily unavailable
```

#### Step 3: Write Test Cases

**Test Case 1: Positive Path**
```
Title: User can log in successfully using company SSO

Description:
Verify that users can authenticate via company SSO provider
instead of using password. After successful SSO, user should
be logged in and redirected to dashboard.

Parameters:
- ssoEmail = "john.smith@company.com"
- ssoProvider = "Okta"

Steps:
1. Navigate to login page
   - Action: Navigate to "{baseUrl}/login"
   - Expected: Login form displays with SSO button

2. Click SSO button
   - Action: Click button with ID "ssoLoginBtn"
   - Expected: Redirected to Okta login page

3. Enter SSO credentials
   - Action: Type "{ssoEmail}" in email field
   - Expected: Email entered in Okta form

4. Complete SSO authentication
   - Action: Follow Okta authentication flow
   - Expected: Redirected back to application

5. Verify user is logged in
   - Action: Verify URL is "/dashboard"
   - Expected: Dashboard loads, user menu shows name

6. Verify SSO is linked
   - Action: Navigate to Settings → Login Methods
   - Expected: Shows "SSO (Okta)" as active login method
```

**Test Case 2: Error Handling**
```
Title: User sees error message when SSO provider is unavailable

Description:
Verify that when Okta or SSO provider is down, user receives
helpful error message and can fall back to password login.

Steps:
1. Navigate to login page
   - Expected: Login form displays

2. Click SSO button
   - Expected: Redirected to Okta

3. Okta service is down
   - Expected: Okta error page shows

4. Click "Back to Login"
   - Expected: Redirected back to login page

5. Verify fallback message
   - Expected: Message shows "SSO temporarily unavailable"
   - Expected: Password login option is available

6. User can log in with password
   - Action: Enter password and log in
   - Expected: User successfully logged in
```

#### Step 4: Test Case Peer Review

**Checklist:**
```
□ All test cases follow naming convention
□ Steps are clear and unambiguous
□ Locators are verified in browser DevTools
□ Parameters are properly defined
□ Expected results are specific and measurable
□ No steps refer to other test cases (independent)
□ Both positive and negative cases covered
□ Edge cases identified and tested
□ Prerequisites documented
```

#### Step 5: Execute Test Cases

**Execution Log:**
```
Date: April 17, 2026
Tester: Jane Doe
Test Cases: 5

Results:
✓ Test 1: User can log in via SSO - PASS (0:45)
✓ Test 2: Redirected to dashboard - PASS (0:30)
✗ Test 3: SSO error handling - FAIL (1:15)
  Issue: Error message text is "SSO unavailable" not "temporarily unavailable"
  Defect: LOG-456

✓ Test 4: Fallback to password - PASS (0:50)
✓ Test 5: Profile shows SSO method - PASS (0:40)

Time: 4:00 total
Defects Found: 1
Status: Ready for review with 1 defect
```

#### Step 6: Log Defects

**Defect Report:**
```
ID: LOG-456
Title: SSO error message incorrect
Severity: Low (cosmetic)
Status: New

Description:
When SSO provider is unavailable, error message displays:
"SSO unavailable"

Expected:
"SSO temporarily unavailable"

Steps to Reproduce:
1. Navigate to login page
2. Simulate SSO provider down (see test case "error handling")
3. Click SSO button
4. Observe error message

Environment:
- App Version: 2.0-beta
- OS: Windows 10
- Browser: Chrome 108
- Date: April 17, 2026
```

#### Step 7: Retest After Fixes

```
Defect LOG-456: Fixed in build 2.0-beta2

Re-execution:
✓ Test 3: SSO error handling - PASS (now shows correct message)

Status: All tests pass, feature ready for release
```

---

## Test Maintenance Workflow

### Weekly Test Review (30 minutes)

**Monday Morning:**

1. **Check Test Status**
   ```
   Active Test Cases: 127
   - Passing: 122
   - Failing: 5
   - Skipped: 0
   - Success Rate: 96%
   ```

2. **Investigate Failures**
   - Test A: Failed due to UI change (no code required)
   - Test B: Failed due to locator change (update needed)
   - Test C: Failed due to environment (known issue)
   - Test D: Failed due to bug (new defect)
   - Test E: False positive (flaky test, needs fix)

3. **Update Failing Tests**
   ```
   Test A & B: Update locators (15 min)
   Test C: Skip for now, mark as blocked (2 min)
   Test D: Already logged as defect (no action)
   Test E: Add wait condition to stabilize (8 min)
   ```

4. **Document Changes**
   - Updated locator for login form (element ID changed)
   - Fixed flaky test by adding explicit wait
   - Marked 2 tests as blocked due to environment

5. **Report Status**
   - Weekly update: 4 cases updated, 1 blocked, 95% pass rate
   - No major issues, on track for quality goals

### Quarterly Test Audit (2 hours)

**Once per Quarter:**

1. **Coverage Analysis**
   ```
   Features Tested: 45/48 (94%)
   Positive Cases: 89 (70%)
   Negative Cases: 35 (27%)
   Boundary Cases: 3 (3%)
   
   Gaps Found:
   - Feature "Export to PDF": 0 cases (add 3)
   - Feature "Bulk Operations": 1 case (add 2)
   - Feature "Webhooks": 0 cases (add 4)
   ```

2. **Case Quality Review**
   ```
   Sample 20 random test cases:
   ✓ 18 cases: Well-written, clear steps
   ✗ 2 cases: Need refactoring (vague steps, missing locators)
   
   Action: Refactor 2 cases, update documentation
   ```

3. **Locator Stability Assessment**
   ```
   ID selectors: 45 (most stable) ✓
   CSS selectors: 28 (stable) ✓
   XPath: 15 (less stable) ◐
   Text-based: 4 (least stable) ✗
   
   Recommendation: 3 flaky XPaths should be replaced with IDs
   ```

4. **Test Execution Metrics**
   ```
   Average execution time per case: 2.5 minutes
   Total suite time: ~5 hours
   Success rate: 94%
   Defects found: 23 (8 critical, 15 minor)
   Defect escape rate: 2 (shipped bugs)
   ```

5. **Generate Improvement Plan**
   ```
   Q2 Goals:
   □ Increase coverage to 98% (add 5 cases)
   □ Improve success rate to 98% (stabilize flaky tests)
   □ Reduce XPath usage to 10% (replace with ID/CSS)
   □ Document 5 complex workflows
   ```

---

## Handling Test Failures

### When a Test Fails

```
1. Reproduction
   - Run test again (sometimes flaky)
   - If passes on re-run: Note as flaky, investigate

2. Investigation
   - What step failed?
   - Is it a test issue or product issue?
   - Can you reproduce manually?

3. Categorize
   
   Type A: Product Bug
   - Feature doesn't work as expected
   - Action: Log defect, assign to dev
   - Update: Mark test as blocked until fix
   
   Type B: Locator Change
   - Element ID/class changed by developers
   - Action: Update locator in test
   - Update: Verify test passes again
   
   Type C: Test Flaw
   - Test step is wrong or unreliable
   - Action: Refactor test case
   - Update: Add wait conditions or better locators
   
   Type D: Test Flake
   - Test passes/fails randomly
   - Action: Add explicit waits
   - Update: Stabilize test until 100% reliable

4. Resolution
   - Type A: Wait for fix, retest
   - Type B: Update locators, retest
   - Type C: Refactor steps, retest
   - Type D: Add waits, retest multiple times

5. Prevention
   - Add test to catch this issue again
   - Update similar tests to prevent same issue
   - Document the failure for team
```

### Flaky Test Diagnosis

**Problem:** Test passes sometimes, fails other times

**Investigation Steps:**

1. **Run 10 times in row**
   ```
   Results: P P F P P P F P P P (8/10 = 80% pass rate)
   Indicates: Timing or race condition issue
   ```

2. **Check for Missing Waits**
   ```
   Before:
   Step 1: Click "Load" button
   Step 2: Verify results display
   
   Issue: Results not loaded yet when verification runs
   
   After:
   Step 1: Click "Load" button
   Step 2: Wait for spinner to appear
   Step 3: Wait for spinner to disappear
   Step 4: Verify results display
   ```

3. **Check for Race Conditions**
   ```
   Before:
   Step: Type search query
   Step: Press Enter (form submits immediately)
   
   Issue: Form still processing from previous search
   
   After:
   Step: Type search query
   Step: Wait 500ms (debounce delay)
   Step: Press Enter
   Step: Wait for new results
   ```

4. **Improve Locator Stability**
   ```
   Before:
   XPath: //button[3]  (position-based, fragile)
   
   After:
   ID: submitBtn       (stable, always works)
   ```

5. **Re-test After Fixes**
   ```
   Run 10 times again: P P P P P P P P P P (10/10 = 100%)
   Test is now stable and reliable
   ```

---

## Test Case Lifecycle

### Lifecycle States

```
Draft
  ↓ (Peer review complete)
Ready
  ↓ (Development starts)
Active (in use)
  ├─ (Passing) → Maintained
  ├─ (Failing) → Under Investigation
  └─ (Blocked) → Waiting for Fix
  ↓ (Feature deprecated)
Archived
  ↓ (No longer needed)
Deleted
```

### State Transitions

**Draft → Ready:**
- Peer review complete
- All locators tested and working
- Steps are clear and unambiguous
- Prerequisites documented

**Ready → Active:**
- Development complete
- Test environment available
- Test data prepared
- Tester assigned

**Active → Maintained:**
- Test consistently passes
- No updates needed
- Monitor for brittleness

**Active → Under Investigation:**
- Test fails
- Root cause being identified
- Awaiting fix or test update

**Under Investigation → Active:**
- Issue resolved (code or test fix)
- Re-tested and passing
- Back to maintained state

**Active → Blocked:**
- Test cannot run (environment down, feature unavailable)
- Waiting for external dependency

**Blocked → Active:**
- Dependency resolved
- Test can run again

**Active → Archived:**
- Feature no longer relevant
- Case replaced by newer version
- Keep for historical reference

**Archived → Deleted:**
- Space cleanup
- Old case no longer needed

---

## Best Practices Summary

### Do's ✓

```
✓ Write one test per feature
✓ Use parameters for reusable data
✓ Document step-by-step procedures clearly
✓ Test locators before adding steps
✓ Group related tests in suites
✓ Review test cases regularly
✓ Maintain independent test cases
✓ Use descriptive test case titles
✓ Keep test data realistic
✓ Monitor test health continuously
✓ Update tests when UI changes
✓ Log defects when tests fail
✓ Refactor flaky tests
```

### Don'ts ✗

```
✗ Don't test multiple features in one case
✗ Don't hard-code sensitive data
✗ Don't skip updates after UI changes
✗ Don't create dependent test cases
✗ Don't ignore flaky tests
✗ Don't edit in Azure DevOps directly
✗ Don't use position-based locators (//button[3])
✗ Don't write vague expected results
✗ Don't skip peer review
✗ Don't let test suite grow indefinitely
✗ Don't test without documented preconditions
✗ Don't assume test will pass without verification
```

---

## Tools & Resources

### Key Tools in Workflow

| Tool | Purpose | When Used |
|------|---------|-----------|
| **Bromcom Test Builder** | Create and execute tests | Daily |
| **Azure DevOps** | Store test cases, track results | Daily |
| **Browser DevTools** | Test locators, debug | When creating cases |
| **Defect Tracker** | Log bugs found | When tests fail |
| **Spreadsheet** | Track metrics and status | Weekly |
| **Wiki/Confluence** | Document procedures, blockers | Weekly |

### Helpful Browser Extensions

- **XPath Finder**: Quickly generate XPaths
- **CSS Selector Generator**: Create CSS selectors
- **Inspect Element**: View element properties
- **Color Picker**: Verify visual styling
- **Screenshot Tool**: Capture failures

### Documentation Templates

- Test case template (in Testing Guide)
- Defect report template
- Weekly status template
- Quarterly audit template

---

## Metrics & Reporting

### Key Metrics to Track

```
Quality Metrics:
- Test pass rate (target: 95%+)
- Defect detection rate (cases finding bugs)
- Test execution time (trend over time)
- Locator stability (% using ID vs XPath)

Coverage Metrics:
- Feature coverage (% of features tested)
- Test case count (total test cases)
- Positive vs negative case ratio
- High-risk area coverage

Efficiency Metrics:
- Average time per test case
- Total suite execution time
- Defects found per case
- Test maintenance time
```

### Weekly Status Report Template

```
Week of April 15-19, 2026

Execution Summary:
- Total test cases: 127
- Executed: 120 (5 skipped, 2 blocked)
- Passed: 114
- Failed: 6
- Success Rate: 95%

Defects Found:
- Critical: 0
- High: 1
- Medium: 3
- Low: 2

Blockers:
- Environment issue: Test cannot access staging DB (in progress)
- Feature not ready: SSO module delayed (waiting until EOW)

Next Week:
- Complete SSO testing when feature available
- Fix 2 flaky tests in login suite
- Add 3 new cases for export functionality
- Complete re-test of 6 failed cases

Status: On Track ✓
```

---

**Ready to start testing?** Begin with [Writing Test Cases](TEST_CASE_WRITING_GUIDE.md) guide.
