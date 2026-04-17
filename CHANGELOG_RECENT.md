# Recent Changes - Version Management & About Section

## What's New

### 1. **About Section in Settings**
Users can now view app information including version numbers directly in the application:
- Click the **Settings** icon
- Navigate to the **About** tab (in the "Other" section)
- View app version, Electron version, Node.js version, Chromium version
- See app information including developer name and application ID

### 2. **Automatic Version Bumping on Builds**
When creating distribution builds (.exe, .AppImage, .dmg), the app version automatically increments:
- Use `npm run dist:win` for Windows builds
- Use `npm run dist:linux` for Linux builds
- Use `npm run dist:mac` for macOS builds
- The patch version increments automatically (e.g., 2026.4.1 → 2026.4.2)

### 3. **Manual Version Bump Commands**
New npm scripts for controlling version increments:
```bash
npm run bump-version          # Bump patch (default)
npm run bump-version:minor    # Bump minor version
npm run bump-version:major    # Bump major version
```

## Files Changed

### New Files
- `src/utils/appVersion.ts` - Utility for accessing app version information
- `scripts/bump-version.js` - Script to increment version in package.json
- `VERSION_MANAGEMENT.md` - Complete version management guide

### Modified Files
- `package.json`
  - Added `bump-version` scripts
  - Updated `dist`, `dist:win`, `dist:linux`, `dist:mac` scripts to include automatic versioning
  
- `src/components/pages/WorkspaceSettings.tsx`
  - Added "About" tab to settings navigation
  - Added About section display with version information
  - Imported `getAppVersions` utility

- `src/styles/style.css`
  - Added `.settings-info-row` styles
  - Added `.settings-info-label` styles  
  - Added `.settings-info-value` styles

## How It Works

### Version Exposure
The app version flows from `package.json` through the Electron main process:
1. **package.json** stores the source version (e.g., "2026.4.1")
2. **Electron main process** reads it via `app.getVersion()`
3. **Preload script** exposes it as `window.desktop.versions.version`
4. **React components** access it via `getAppVersions()` utility

### Automatic Version Bumping Workflow
```
npm run dist:win
  ↓
npm run typecheck          (validate TypeScript)
  ↓
npm run bump-version       (increment patch version)
  ↓
npm run build              (build web assets)
  ↓
electron-builder --win     (create Windows installer)
  ↓
Output: Bromcom Test Builder-2026.4.2-win-x64.exe
```

## Usage Examples

### Check Current Version
1. Open the app
2. Click Settings (gear icon)
3. Select "About" tab
4. View version information

### Build With Version Bump
```bash
# Windows
npm run dist:win

# Linux
npm run dist:linux

# macOS
npm run dist:mac

# All platforms
npm run dist
```

### Manually Bump Version Before Release
```bash
# If you want to release multiple times without building:
npm run bump-version  # 2026.4.1 → 2026.4.2
npm run bump-version:minor  # 2026.4.2 → 2026.5.0
npm run bump-version:major  # 2026.5.0 → 2027.0.0
```

## Design Considerations

### About Section Design
- Consistent with Settings UI/UX
- Information organized in clear groups:
  - Version info (Version, Electron, Node, Chromium)
  - App metadata (Developer, App ID, Description)
- Uses design tokens for colors and spacing
- Accessible on all platforms (Windows, Linux, macOS)

### Version Display
- Shows in About section of Settings
- Shown on splash screen during startup
- Included in installer filenames (e.g., `...-2026.4.2-win-x64.exe`)
- Accessible programmatically via `window.desktop.versions`

## Testing

To test the version display:
1. Run `npm run dev`
2. Open Settings → About
3. Verify version displays correctly (2026.4.1 or current version)
4. Verify other version numbers display (Electron, Node, Chromium)

To test version bumping:
1. Run `npm run bump-version`
2. Check `package.json` - version should increment
3. Run `npm run dev` and check About section shows new version
4. Run `npm run dist:win` - will bump version again

## Package Structure

After distribution build, the generated installer includes the bumped version:
- Filename: `Bromcom Test Builder-{VERSION}-{OS}-{ARCH}.{EXT}`
- Version in app: Settings → About shows matching version number
- Splash screen: Shows matching version on startup

## Related Documentation

See `VERSION_MANAGEMENT.md` for:
- Detailed version management workflow
- Troubleshooting tips
- Best practices for version control
- Git tagging recommendations
