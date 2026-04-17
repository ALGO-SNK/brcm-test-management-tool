# Quick Start: Version Management

## View App Version (Users)

1. Open Bromcom Test Builder
2. Click Settings (⚙️ icon)
3. Click "About" tab
4. See current version and system info

---

## Build for Distribution (Developers)

### Windows
```bash
npm run dist:win
```
Output: `Bromcom Test Builder-{VERSION}-win-x64.exe`

### Linux
```bash
npm run dist:linux
```
Output: `Bromcom Test Builder-{VERSION}-linux-x64.AppImage`

### macOS
```bash
npm run dist:mac
```
Output: `Bromcom Test Builder-{VERSION}-darwin-x64.dmg`

### All Platforms
```bash
npm run dist
```

**Note:** Version automatically bumps (e.g., 2026.4.1 → 2026.4.2)

---

## Manually Bump Version (Optional)

### Patch Version (Bugfixes)
```bash
npm run bump-version
# 2026.4.1 → 2026.4.2
```

### Minor Version (New Features)
```bash
npm run bump-version:minor
# 2026.4.1 → 2026.5.0
```

### Major Version (Breaking Changes)
```bash
npm run bump-version:major
# 2026.4.1 → 2027.0.0
```

---

## Development (No Version Bump)

```bash
npm run dev
# Use this for testing - version stays the same
```

---

## Check Current Version

### From Command Line
```bash
grep '"version"' package.json
```

### From App
Settings → About tab

---

## Commit Version Changes

```bash
git add package.json
git commit -m "Bump version to 2026.4.2"
git tag v2026.4.2
git push origin v2026.4.2
```

---

## Cheat Sheet

| Task | Command |
|------|---------|
| View version in app | Settings → About |
| Check version in CLI | `grep '"version"' package.json` |
| Build for Windows | `npm run dist:win` |
| Build for Linux | `npm run dist:linux` |
| Build for macOS | `npm run dist:mac` |
| Bump patch version | `npm run bump-version` |
| Bump minor version | `npm run bump-version:minor` |
| Bump major version | `npm run bump-version:major` |
| Dev mode (no bump) | `npm run dev` |

---

## Common Scenarios

### Scenario 1: Release Bug Fix
```bash
npm run dist:win      # Bumps to 2026.4.2, builds
# Creates: Bromcom Test Builder-2026.4.2-win-x64.exe
```

### Scenario 2: Release New Feature
```bash
npm run bump-version:minor     # 2026.4.2 → 2026.5.0
npm run build                  # Rebuild
npm run dist:win               # Won't bump again (already done)
```

### Scenario 3: Test Before Release
```bash
npm run dev                    # No version changes
# Test the app...
npm run dist:win               # When ready, will bump & build
```

### Scenario 4: Multiple Platforms
```bash
npm run dist                   # Builds all platforms, bumps once
# Creates:
#   - Bromcom Test Builder-2026.4.2-win-x64.exe
#   - Bromcom Test Builder-2026.4.2-linux-x64.AppImage
#   - Bromcom Test Builder-2026.4.2-darwin-x64.dmg
```

---

## Troubleshooting

### Version not showing in About section
- Rebuild: `npm run build`
- Restart the app
- Check package.json version: `grep '"version"' package.json`

### Version didn't bump when building
- The dist command includes bump-version
- Check if package.json changed: `git diff package.json`
- Run manually: `npm run bump-version`

### Wrong version in installer filename
- Version is read from package.json
- Check: `grep '"version"' package.json`
- Should match filename

---

## Key Points

✅ **Always use `npm run dist:*` to build** - includes automatic version bump
✅ **Never manually edit version in package.json** - use scripts instead
✅ **Version appears in installer filename** - helps track releases
✅ **Development with `npm run dev` never bumps version**
✅ **Commit version changes to git** - track release history

---

For detailed information, see `VERSION_MANAGEMENT.md`
