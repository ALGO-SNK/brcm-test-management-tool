# Root Cause Analysis: Initial Steps Field Not Displaying

## Timeline of Issue

### Phase 1: Field Name Error (RESOLVED ✅)
**Original Problem:** Code was using `Custom.InitialSteps` (plural)
**Actual Field Name:** `Custom.InitialStep` (singular)
**Resolution:** Field name corrected across all files

### Phase 2: Current Issue (BEING DEBUGGED 🔍)
**Symptoms:**
- Field is correctly named (`Custom.InitialStep`)
- Data exists in Azure DevOps
- API is being called correctly
- **But:** Field is still not appearing in the application's view mode

## Hypothesis: Invalid API Expansion Parameter

### The Root Cause

The code was using this API call:
```typescript
GET https://dev.azure.com/{org}/{project}/_apis/wit/workitems/{id}?$expand=fields&api-version=7.2
```

**Problem:** The `$expand=fields` parameter may not be valid for the work items API.

### Why This Matters

In Azure DevOps REST API:
- The work items endpoint **returns all fields by default**
- The `$expand` parameter is typically used for:
  - Expanding related items (e.g., relations, links)
  - Not for field expansion
- An invalid parameter might cause the API to:
  - Ignore it silently (unlikely)
  - Return an error response
  - Return an incomplete response without custom fields

### The Fix

**Before:**
```typescript
?$expand=fields&api-version=7.2
```

**After:**
```typescript
?api-version=7.2
```

**Reasoning:**
Custom fields should be included by default in the response. Removing the invalid parameter should allow the API to return all fields correctly.

## Why We Added Debugging

Instead of guessing, we added console logs at two critical points:

### 1. At the API Layer (adoApi.ts)
```typescript
if (workItem.fields) {
  const customFields = Object.keys(workItem.fields).filter(k => k.startsWith('Custom.'));
  if (customFields.length > 0) {
    console.debug('[ADO API] Custom fields found:', customFields);
    console.debug('[ADO API] Custom.InitialStep value:', workItem.fields['Custom.InitialStep']);
  }
}
```

**Purpose:** See what the API actually returns

### 2. At the Component Layer (TestCaseDetail.tsx)
```typescript
useEffect(() => {
  if (testCase && testCase.fields) {
    const customFields = Object.keys(testCase.fields).filter(k => k.startsWith('Custom.'));
    console.debug('[TestCaseDetail] Custom fields available:', customFields);
    console.debug('[TestCaseDetail] Custom.InitialStep value:', testCase.fields['Custom.InitialStep']);
    console.debug('[TestCaseDetail] Complete fields object:', testCase.fields);
  }
}, [testCase]);
```

**Purpose:** See what the component receives after the API response is processed

## Three Possible Outcomes

### Scenario 1: API Fix Works ✅
**Console shows:**
```
[ADO API] Custom fields found: ["Custom.InitialStep", "Custom.TestingMethod", ...]
[ADO API] Custom.InitialStep value: "LoginAsAdmin,GoToCensusSchoolPage,..."
```

**Next step:** Field should now display in UI. If it doesn't, there's a UI/rendering issue.

### Scenario 2: Custom Field Not Returned by API ❌
**Console shows:**
```
[ADO API] Custom fields found: ["Custom.TestingMethod", "Custom.ApplicableRegions", ...]
// Custom.InitialStep is NOT in this list
```

**Analysis:** The API isn't returning the custom field at all
- Could be a field permission issue
- Could be a field that doesn't exist in the project
- Could be that the API needs a different parameter

**Next steps:**
- Check if field exists in ADO Project Settings
- Verify user permissions
- Try alternative API endpoints or parameters

### Scenario 3: Field Value is Null/Empty ❌
**Console shows:**
```
[ADO API] Custom fields found: ["Custom.InitialStep", ...]
[ADO API] Custom.InitialStep value: null
```

**Analysis:** The field exists in the response but has no data
- The test case doesn't have data in this field
- The field is empty in Azure DevOps

**Next steps:**
- Verify the test case in ADO has data in this field
- Check if data was properly saved to ADO

## How the Fix Will Help

1. **Removes an invalid parameter** that might be interfering with API response
2. **Adds visibility** into what's actually happening at each layer
3. **Provides diagnostic information** to pinpoint the exact issue

## What Happens If the Fix Works

If removing `$expand=fields` fixes the issue:
1. Console logs will show the field is in the API response ✅
2. Field value will be non-empty ✅
3. Component will receive the data ✅
4. **Step 0: Initial Steps** will appear in the view ✅
5. Edit form will be populated with the field value ✅

## What Happens If It Doesn't Work

The debug logs will tell us exactly why:
- **If field is missing:** ADO API configuration issue
- **If field is empty:** Data issue (not saved to ADO)
- **If field exists but doesn't display:** UI/rendering issue

This information will guide the next fix.

## Code Changes Summary

### File: adoApi.ts (lines 648-651)
```diff
- candidateUrls.push(`${baseApi}/wit/workitems/${encodedCaseId}?$expand=fields&api-version=${encodedApiVersion}`);
- candidateUrls.push(`${baseApi}/wit/workItems/${encodedCaseId}?$expand=fields&api-version=${encodedApiVersion}`);
+ // Try both with and without expand parameter - custom fields should be included by default
+ candidateUrls.push(`${baseApi}/wit/workitems/${encodedCaseId}?api-version=${encodedApiVersion}`);
+ candidateUrls.push(`${baseApi}/wit/workItems/${encodedCaseId}?api-version=${encodedApiVersion}`);
```

### File: adoApi.ts (lines 661-668)
```typescript
+ // Debug: Log what fields are actually in the response
+ if (workItem.fields) {
+   const customFields = Object.keys(workItem.fields).filter(k => k.startsWith('Custom.'));
+   if (customFields.length > 0) {
+     console.debug('[ADO API] Custom fields found:', customFields);
+     console.debug('[ADO API] Custom.InitialStep value:', workItem.fields['Custom.InitialStep']);
+   }
+ }
```

### File: TestCaseDetail.tsx (lines 422-431)
```typescript
+ // Debug: Log all available fields when test case loads
+ useEffect(() => {
+   if (testCase && testCase.fields) {
+     const customFields = Object.keys(testCase.fields).filter(k => k.startsWith('Custom.'));
+     console.debug('[TestCaseDetail] Custom fields available:', customFields);
+     console.debug('[TestCaseDetail] All field keys:', Object.keys(testCase.fields));
+     console.debug('[TestCaseDetail] Custom.InitialStep value:', testCase.fields['Custom.InitialStep']);
+     console.debug('[TestCaseDetail] Complete fields object:', testCase.fields);
+   }
+ }, [testCase]);
```

## Verification Method

The console logs are designed to answer these questions in order:

1. **Q: Is the API returning custom fields?**
   - A: Check `[ADO API] Custom fields found:` message

2. **Q: Is Custom.InitialStep specifically included?**
   - A: Check if it's in the array from step 1

3. **Q: Does the field have a value?**
   - A: Check `[ADO API] Custom.InitialStep value:` message

4. **Q: Did the component receive it?**
   - A: Check `[TestCaseDetail] Custom fields available:` message

5. **Q: What's the actual value the component sees?**
   - A: Check `[TestCaseDetail] Custom.InitialStep value:` message

If each step succeeds, the UI should display the field. If any step fails, we know where the problem is.

## Confidence Level

**Confidence in this fix: 65%**

The removal of the invalid `$expand=fields` parameter has a reasonable chance of fixing the issue, as it's the most likely culprit for why custom fields aren't being returned. However, without seeing the actual API response, we can't be 100% certain.

The debug logs will provide definitive proof and guide us to the real issue if this isn't the solution.

## Next Actions

1. ✅ Apply the changes (done)
2. 🔍 Run the app and check console logs (your turn)
3. 📋 Share what the console shows
4. 🔧 Apply targeted fix based on debugging output
5. ✅ Verify field appears in view and edit modes

---

**Ready to debug?** Start with `npm run dev` and open the browser console! 🚀
