# Version Management Guide

## Overview

This document explains how version management works in Bromcom Test Builder and how versions are automatically bumped during the build process.

## Current Version

The current app version is **2026.4.1** and is defined in `package.json`.

## Version Format

The app uses semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes or major feature releases
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes and incremental updates

## Automatic Version Bumping

### For Development Builds
Development builds do **not** automatically bump the version. Use the dev server for testing:
```bash
npm run dev
```

### For Distribution Builds

When building for distribution (Windows, Linux, macOS), the version **automatically bumps the patch version**:

```bash
# Builds for Windows (.exe installer)
npm run dist:win

# Builds for Linux (AppImage)
npm run dist:linux

# Builds for macOS (DMG)
npm run dist:mac

# Builds for all platforms
npm run dist
```

Each command will:
1. Typecheck the project
2. Bump the patch version (e.g., 2026.4.1 → 2026.4.2)
3. Build the web assets
4. Build the installers

### Manual Version Bumping

If you need to manually control the version:

```bash
# Bump patch version (default)
npm run bump-version
# 2026.4.1 → 2026.4.2

# Bump minor version
npm run bump-version:minor
# 2026.4.1 → 2026.5.0

# Bump major version
npm run bump-version:major
# 2026.4.1 → 2027.0.0
```

## About Section

Users can view the app version and system information from within the app:

1. **Settings** (click the settings icon)
2. Navigate to **About** tab (under "Other" section in the left sidebar)
3. See:
   - **Version**: Current app version
   - **Electron**: Electron framework version
   - **Node.js**: Node.js runtime version
   - **Chromium**: Browser engine version
   - **Application ID**: Unique app identifier (com.bromcom.testbuilder)
   - **Developer**: Bromcom
   - **Description**: App description

## How Version is Exposed

The version is accessible in several ways:

### In the Frontend (React)
```typescript
import { getAppVersion, getAppVersions } from './utils/appVersion';

// Get just the app version
const version = getAppVersion(); // '2026.4.2'

// Get all versions (app, electron, node, chrome)
const versions = getAppVersions();
// { app: '2026.4.2', electron: '41.2.0', node: '20.x', chrome: '131' }
```

### Direct Browser Access
```javascript
window.desktop.versions.version; // '2026.4.2'
```

### In Electron Main Process
The version comes from `app.getVersion()` which reads from `package.json`.

## Build Output

After running a distribution build, the version appears in the generated installer filename:

```
Bromcom Test Builder-2026.4.2-win-x64.exe    (Windows)
Bromcom Test Builder-2026.4.2-linux-x64.AppImage  (Linux)
Bromcom Test Builder-2026.4.2-darwin-x64.dmg      (macOS)
```

## Splash Screen

The app displays the version on the splash screen when starting up. The splash HTML receives the version via URL query parameter from the main process.

## Version History

Previous versions are typically tracked in git commits and tags. To view the version progression:

```bash
git log --oneline | grep -i version
git tag  # List all version tags
```

## Troubleshooting

### Version Not Updating

If the version doesn't appear to update after a build:

1. Check that `package.json` was actually modified:
   ```bash
   git diff package.json
   ```

2. Clear the build cache:
   ```bash
   rm -rf dist .tsbuildinfo
   npm run build
   ```

3. Verify the version script executed:
   ```bash
   npm run bump-version
   ```

### Checking Current Version

```bash
# From command line
grep '"version"' package.json

# From app
# Open Settings → About tab
```

## Best Practices

1. **Don't manually edit the version in package.json** - Use the npm scripts instead
2. **Bump version before distribution builds** - The dist commands handle this automatically
3. **Document significant changes** - Add release notes when major/minor versions change
4. **Test before releasing** - Always test with dev server first
5. **Use git tags** - Tag releases in git for easier version tracking:
   ```bash
   git tag v2026.4.2
   git push origin v2026.4.2
   ```

## Distribution Notes

When distributing a new version:

1. Run the appropriate `npm run dist:*` command
2. The version bumps automatically
3. Commit the version change to git:
   ```bash
   git add package.json
   git commit -m "Bump version to 2026.4.2"
   ```
4. Tag the release:
   ```bash
   git tag v2026.4.2
   ```
5. Upload the installer from the `releases/` directory

## Environment Variables

Version information is also available via environment variables during the build:

- `VITE_APP_VERSION` - Set during build for version display in UI
- Configured in Vite config if needed for build-time version embedding
