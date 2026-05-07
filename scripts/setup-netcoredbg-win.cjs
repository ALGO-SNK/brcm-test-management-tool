#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET_ROOT = path.join(REPO_ROOT, 'tools', 'netcoredbg', 'win-x64');
const TARGET_EXE = path.join(TARGET_ROOT, 'netcoredbg', 'netcoredbg.exe');

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function removeDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'bcm-testbuilder-netcoredbg-setup',
        Accept: 'application/vnd.github+json',
      },
    }, (response) => {
      const statusCode = Number(response.statusCode || 0);
      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`GitHub API request failed (${statusCode}).`));
        response.resume();
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Failed to parse GitHub API response: ${error.message}`));
        }
      });
    });

    request.on('error', reject);
  });
}

function downloadFile(url, targetFilePath, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 8) {
      reject(new Error('Too many redirects while downloading netcoredbg.'));
      return;
    }

    const file = fs.createWriteStream(targetFilePath);
    const request = https.get(url, {
      headers: {
        'User-Agent': 'bcm-testbuilder-netcoredbg-setup',
      },
    }, (response) => {
      const statusCode = Number(response.statusCode || 0);
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        file.close();
        fs.unlinkSync(targetFilePath);
        downloadFile(location, targetFilePath, redirectDepth + 1).then(resolve).catch(reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        file.close();
        fs.unlinkSync(targetFilePath);
        reject(new Error(`Download failed (${statusCode}).`));
        response.resume();
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    });

    request.on('error', (error) => {
      file.close();
      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
      }
      reject(error);
    });
  });
}

function expandZip(zipPath, destinationPath) {
  const escapedZip = zipPath.replace(/'/g, "''");
  const escapedDestination = destinationPath.replace(/'/g, "''");
  const command = `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDestination}' -Force`;
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command,
  ], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Failed to extract netcoredbg archive (exit ${result.status ?? -1}).`);
  }
}

async function main() {
  if (process.platform !== 'win32') {
    console.log('Skipping netcoredbg setup: only required for Windows packaging.');
    return;
  }

  if (fs.existsSync(TARGET_EXE)) {
    console.log(`netcoredbg already present at ${TARGET_EXE}`);
    return;
  }

  console.log('Fetching latest netcoredbg release metadata...');
  const release = await requestJson('https://api.github.com/repos/Samsung/netcoredbg/releases/latest');
  const asset = Array.isArray(release.assets)
    ? release.assets.find((entry) => String(entry.name || '').toLowerCase() === 'netcoredbg-win64.zip')
    : null;

  if (!asset?.browser_download_url) {
    throw new Error(`netcoredbg-win64.zip asset was not found in release ${release.tag_name || '(unknown tag)'}.`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bcm-netcoredbg-'));
  const zipPath = path.join(tempDir, 'netcoredbg-win64.zip');
  try {
    console.log(`Downloading ${asset.browser_download_url}`);
    await downloadFile(asset.browser_download_url, zipPath);

    removeDirectory(TARGET_ROOT);
    ensureDirectory(TARGET_ROOT);
    expandZip(zipPath, TARGET_ROOT);

    if (!fs.existsSync(TARGET_EXE)) {
      throw new Error(`netcoredbg.exe was not found after extraction at ${TARGET_EXE}`);
    }

    const metadataPath = path.join(TARGET_ROOT, 'release.json');
    fs.writeFileSync(metadataPath, JSON.stringify({
      downloadedAtUtc: new Date().toISOString(),
      tag: release.tag_name || '',
      asset: asset.name,
      url: asset.browser_download_url,
    }, null, 2), 'utf8');

    console.log(`netcoredbg ready at ${TARGET_EXE}`);
  } finally {
    removeDirectory(tempDir);
  }
}

main().catch((error) => {
  console.error(`netcoredbg setup failed: ${error.message}`);
  process.exitCode = 1;
});
