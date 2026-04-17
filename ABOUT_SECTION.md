# About Section - Simplified Design

## Location
**Settings → About**

## Display Format

```
Information

Version
v2026.4.1

Developer
Bromcom

Application ID
com.bromcom.testbuilder

Description
Test case and plan management for Azure DevOps. Create, edit, and organize 
test cases with full XML step support.
```

## Design Details

### Layout
- Clean, minimal information panel
- Single column layout
- Generous spacing between items
- Consistent typography

### Version Display
- Prefix: `v` (e.g., `v2026.4.1`)
- Monospace font for clarity
- Larger font size (15px)
- Bold weight

### Labels
- Uppercase style
- Small font (12px)
- 0.05em letter spacing
- Muted color (opacity 0.7)
- Bold weight (600)

### Values
- Standard text color
- Regular font weight (500) for short items
- Description uses proper line height (1.5)

## What's Removed
- ❌ System version info (Electron, Node.js, Chromium)
- ❌ Redundant "Bromcom Test Builder" title
- ❌ Unused system information

## What's Kept
- ✅ Version with `v` prefix
- ✅ Developer name
- ✅ Application ID
- ✅ Description

## Benefits
- Cleaner, less cluttered UI
- Focus on essential information
- Professional appearance
- Consistent with app design language
- Fast to scan and understand

## CSS Classes Used
- `.settings-panel` - Container
- `.settings-panel__head` - Header section
- `.settings-panel__title` - Title styling
- Inline styles for specific formatting

## Version Format Examples
- Current: `v2026.4.1`
- After patch bump: `v2026.4.2`
- After minor bump: `v2026.5.0`
- After major bump: `v2027.0.0`

## Implementation Notes
- Version pulled from `getAppVersions().app`
- All info in single Information section
- No external API calls needed
- Uses CSS variables for colors and spacing
- Dark/light theme support via CSS variables
