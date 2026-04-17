#!/usr/bin/env node

/**
 * Automatic Version Bumper
 * Increments the patch version in package.json
 * Usage: node scripts/bump-version.js [major|minor|patch|prerelease]
 */

const fs = require('node:fs');
const path = require('node:path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const versionString = packageJson.version;
const parts = versionString.split('.');
const major = parseInt(parts[0], 10);
const minor = parseInt(parts[1], 10);
const patch = parseInt(parts[2], 10);

const bumpType = process.argv[2] || 'patch';

let newVersion;

switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case 'prerelease':
    newVersion = `${major}.${minor}.${patch + 1}-pre`;
    break;
}

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✓ Version bumped: ${versionString} → ${newVersion}`);
process.exit(0);
