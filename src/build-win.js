const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const productName = packageJson.build?.productName || packageJson.productName || packageJson.name;
const executableName = `${packageJson.build?.win?.executableName || productName}.exe`;
const iconPath = path.join(rootDir, packageJson.build?.win?.icon || packageJson.build?.icon || 'electron/assets/app-icon.ico');
const rceditPath = path.join(rootDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');
const outputDir = path.join(rootDir, packageJson.build?.directories?.output || 'dist');
const unpackedDir = path.join(outputDir, 'win-unpacked');
const packageLockPath = path.join(rootDir, 'package-lock.json');

function isValidSemver(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(version);
}

function updatePackageVersion(nextVersion) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (pkg.version === nextVersion) {
    updatePackageLockVersion(nextVersion);
    return nextVersion;
  }
  pkg.version = nextVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  updatePackageLockVersion(nextVersion);
  return nextVersion;
}

function updatePackageLockVersion(nextVersion) {
  if (!fs.existsSync(packageLockPath)) return;
  const lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  lock.version = nextVersion;
  if (lock.packages?.['']) lock.packages[''].version = nextVersion;
  fs.writeFileSync(packageLockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

function incrementPatchVersion(version) {
  const match = String(version || '').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    console.error(`Invalid version "${version}". Expected semver like 1.0.1`);
    process.exit(1);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}${match[4] || ''}`;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function electronBuilder(args) {
  if (process.platform === 'win32') {
    run('cmd.exe', ['/c', 'node_modules\\.bin\\electron-builder.cmd', ...args]);
    return;
  }
  run(path.join(rootDir, 'node_modules', '.bin', 'electron-builder'), args);
}

function cleanOutputDir() {
  if (!fs.existsSync(outputDir)) return;
  try {
    fs.rmSync(outputDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 500
    });
  } catch (error) {
    console.error(`Unable to clean build output at ${outputDir}`);
    console.error('Close any running app instances or Explorer windows pointing at the build folder, then retry.');
    console.error(error.message || error);
    process.exit(1);
  }
}

function patchExecutable(version) {
  const exePath = path.join(unpackedDir, executableName);
  if (!fs.existsSync(exePath)) {
    console.error(`Expected executable not found: ${exePath}`);
    process.exit(1);
  }
  if (!fs.existsSync(rceditPath)) {
    console.error(`rcedit not found: ${rceditPath}`);
    process.exit(1);
  }
  run(rceditPath, [
    exePath,
    '--set-icon', iconPath,
    '--set-file-version', version,
    '--set-product-version', version,
    '--set-version-string', 'FileDescription', packageJson.description || productName,
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'InternalName', executableName.replace(/\.exe$/i, ''),
    '--set-version-string', 'OriginalFilename', executableName,
    '--set-version-string', 'CompanyName', packageJson.author || 'BromCom',
    '--set-version-string', 'ProductVersion', version,
    '--set-version-string', 'FileVersion', version
  ]);
}

const requestedVersion = process.argv[2];
let buildVersion = requestedVersion;

if (requestedVersion) {
  if (!isValidSemver(requestedVersion)) {
    console.error(`Invalid version "${requestedVersion}". Expected semver like 1.0.1`);
    process.exit(1);
  }
  updatePackageVersion(requestedVersion);
  console.log(`Building version ${requestedVersion}`);
} else {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  buildVersion = incrementPatchVersion(pkg.version);
  updatePackageVersion(buildVersion);
  console.log(`Building version ${buildVersion}`);
}
if (!buildVersion) {
  buildVersion = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
}

cleanOutputDir();
electronBuilder(['--win', '--dir', `--config.directories.output=${outputDir}`]);
patchExecutable(buildVersion);
electronBuilder(['--win', 'nsis', '--prepackaged', unpackedDir, `--config.directories.output=${outputDir}`]);
