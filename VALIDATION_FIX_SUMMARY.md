# Step Validation Fix Summary

## Problem
The validation was too strict and required a "Locator" field for ALL actions, even though some actions don't use locators. For example:
- `DELAY` action doesn't need a locator
- `REFRESH_PAGE` action doesn't need a locator
- `MAXIMIZE_WINDOW` action doesn't need a locator

This caused validation errors like:
```
Step 1: Locator is required
Step 4: Locator is required
Step 6: Locator is required
```

Even when the steps had valid actions that don't require locators.

## Solution
Made the validation **action-aware** by checking the ACTION_REGISTRY to determine which fields are actually required for each action.

### Changes Made

**File:** `src/components/pages/TestCaseDetail.tsx`

1. **Added import** for ACTION_REGISTRY:
```typescript
import { ACTION_REGISTRY } from '../../utils/actionRegistry';
```

2. **Updated validation logic** to check action contracts:

**Before:**
```typescript
editSteps.forEach((step, idx) => {
  if (!step.action.trim()) errors.push(`Step ${idx + 1}: Action is required`);
  if (!step.element?.trim()) errors.push(`Step ${idx + 1}: Locator is required`);
  if (!step.description?.trim()) errors.push(`Step ${idx + 1}: Step Summary is required`);
});
```

**After:**
```typescript
editSteps.forEach((step, idx) => {
  if (!step.action.trim()) {
    errors.push(`Step ${idx + 1}: Action is required`);
    return;
  }

  // Get the action definition to check which fields are required
  const actionDef = ACTION_REGISTRY[step.action];

  // Only require Locator if the action actually uses elements
  if (actionDef?.contract.element === 'required' && !step.element?.trim()) {
    errors.push(`Step ${idx + 1}: Locator is required`);
  }

  if (!step.description?.trim()) {
    errors.push(`Step ${idx + 1}: Step Summary is required`);
  }
});
```

## How It Works

Each action in the ACTION_REGISTRY has a `contract` that specifies which parameters it needs:

```typescript
// Example: DELAY action contract
{
  element: 'not-used',
  value: 'required',  // DELAY requires a Value (the delay duration)
  description: 'optional',
  // ... other fields
}
```

The validation now:
1. ✅ Always requires: **Action** and **Step Summary (Description)**
2. ✅ Only requires **Locator** if the action's contract says `element: 'required'`
3. ✅ Skips locator validation for actions where `element: 'not-used'` or `element: 'optional'`

## Examples

### Actions That Require Locator ✅
- `CLICK` - needs to know what to click
- `TYPE` - needs to know which element to type into
- `HOVER` - needs to know what to hover over
- `VERIFY_TEXT` - needs to know which element's text to verify

### Actions That DON'T Require Locator ✅
- `DELAY` - just waits for a time period (uses Value field)
- `REFRESH_PAGE` - refreshes the current page
- `MAXIMIZE_WINDOW` - maximizes the browser window
- `GO_BACK` - navigates back in browser history
- `OPEN_NEW_TAB` - opens a new tab
- `FETCH_SHARED_STEPS` - fetches steps from another test case (uses Value)

## Testing the Fix

1. **In Edit Mode**, try this scenario:
   - Add a `DELAY` step (or any action that doesn't require a locator)
   - Leave the Locator field empty
   - Add a Step Summary/Description
   - Click Save
   
   **Result:** Should save successfully ✅ (no "Locator is required" error)

2. **Compare with action that requires locator:**
   - Add a `CLICK` step
   - Leave the Locator field empty
   - Add a Step Summary
   - Click Save
   
   **Result:** Should show "Locator is required" error ❌ (as expected)

## Validation Logic Flow

```
For each step:
  1. Check if Action is provided
     - If no action → Error "Action is required"
     - If action provided → Continue
  
  2. Look up the action in ACTION_REGISTRY
     - Get the contract/requirements for this action
  
  3. Check if Locator is required
     - If action.contract.element === 'required' AND no locator → Error "Locator is required"
     - Otherwise → No error (action doesn't need a locator)
  
  4. Check if Description is provided
     - If no description → Error "Step Summary is required"

Save step if no errors
```

## Result

✅ **Smart Validation**
- Only validates fields that are actually needed for the action
- Prevents unnecessary error messages
- Allows steps with actions like DELAY without requiring locators
- Still maintains validation for required fields

✅ **Better User Experience**
- Users don't see confusing validation errors for fields their action doesn't use
- Cleaner error messages focused on truly required fields
- Faster workflow since unnecessary fields don't need to be filled

## Configuration Details

The ACTION_REGISTRY defines each action's parameter contract with these statuses:
- `'required'` - Field must be filled
- `'optional'` - Field can be empty
- `'not-used'` - Field is irrelevant for this action

The validation now respects these contracts, only enforcing requirements for fields that are actually needed.

## Files Modified

1. **src/components/pages/TestCaseDetail.tsx**
   - Added ACTION_REGISTRY import
   - Updated step validation logic to check action contracts

No other files were modified. The ACTION_REGISTRY already existed with all the contract information - we just needed to use it in validation.
