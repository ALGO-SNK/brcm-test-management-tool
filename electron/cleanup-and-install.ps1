<#
Interactive PowerShell helper to safely stop processes, detect file locks (icudtl.dat), delete node_modules with robust fallbacks, and reinstall dependencies.

Usage:
  1) Open PowerShell as Administrator (recommended) or normal PowerShell for non-admin portions.
  2) cd 'C:\Users\snkjh\Downloads\Brcm - desktop\scripts'
  3) .\cleanup-and-install.ps1

The script is interactive and will prompt before destructive operations. It does NOT run anything without confirmation.
#>

param(
    [string] $RepoRoot = 'C:\Users\snkjh\Downloads\Brcm - desktop'
)

function Confirm-YesNo([string] $message, [bool] $defaultYes = $false) {
    $yn = Read-Host "$message`nType Y to confirm or N to cancel"
    if ([string]::IsNullOrWhiteSpace($yn)) { return $defaultYes }
    return $yn.Trim().ToUpper().StartsWith('Y')
}

function Pause-Continue() {
    Read-Host "Press Enter to continue..."
}

Write-Host "Repository root: $RepoRoot" -ForegroundColor Cyan

# 1) Show git status / stash
Write-Host "\nStep 1: Git status and optionally stash uncommitted changes" -ForegroundColor Yellow
Set-Location -LiteralPath $RepoRoot
Write-Host "Running: git status --porcelain" -ForegroundColor DarkGray
git status --porcelain

if (Confirm-YesNo "Would you like to create a stash of uncommitted changes now? (recommended)") {
    Write-Host "Stashing changes..." -ForegroundColor Green
    git stash push -m "pre-node_modules-cleanup-$(Get-Date -Format o)" | Out-Null
    Write-Host "Stash created. Run 'git stash list' if you want to verify." -ForegroundColor Green
} else {
    Write-Host "Skipping stash step. Continue with caution if you have uncommitted changes." -ForegroundColor Yellow
}

# 2) Stop common processes (electron/node/vite)
Write-Host "\nStep 2: Attempt to stop common processes (electron, node, vite, npm, yarn)." -ForegroundColor Yellow
if (Confirm-YesNo "Stop running electron/node/vite processes now? (will use Stop-Process -Force)") {
    Write-Host "Listing candidate processes..." -ForegroundColor DarkGray
    Get-Process | Where-Object { $_.ProcessName -match 'electron|node|vite|npm|pnpm|yarn' } | Format-Table Id,ProcessName,Path -AutoSize

    if (Confirm-YesNo "Execute Stop-Process on electron and node processes now? This will forcibly terminate them.") {
        Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "Requested stop for electron/node processes." -ForegroundColor Green
    } else {
        Write-Host "Skipped stopping processes." -ForegroundColor Yellow
    }
} else {
    Write-Host "Skipping process stop step." -ForegroundColor Yellow
}

# 3) Download and run handle.exe to find locks
Write-Host "\nStep 3: Use Sysinternals handle.exe to find processes holding icudtl.dat (optional but recommended)." -ForegroundColor Yellow
$handleDir = "$env:USERPROFILE\Downloads\handle"
$handleExe = Join-Path $handleDir 'handle.exe'

if (!(Test-Path $handleExe)) {
    if (Confirm-YesNo "handle.exe not found at $handleExe. Download and extract it to $handleDir now? (requires internet)") {
        try {
            $tmp = Join-Path $env:USERPROFILE 'Downloads\Handle.zip'
            Write-Host "Downloading Handle.zip to $tmp ..." -ForegroundColor DarkGray
            Invoke-WebRequest -Uri 'https://download.sysinternals.com/files/Handle.zip' -OutFile $tmp -UseBasicParsing
            Expand-Archive -Path $tmp -DestinationPath $handleDir -Force
            Write-Host "Downloaded and extracted handle.exe to $handleDir" -ForegroundColor Green
        } catch {
            Write-Host "Failed to download or extract handle.exe. Error: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "Skipping handle.exe download. You can run it manually later." -ForegroundColor Yellow
    }
}

if (Test-Path $handleExe) {
    Write-Host "Running handle.exe to search for 'icudtl.dat' handles..." -ForegroundColor DarkGray
    & $handleExe -a icudtl.dat | Out-String | Write-Host

        if (Confirm-YesNo "If the output above shows PIDs holding icudtl.dat, do you want to attempt to stop those processes now?") {
        $out = & $handleExe -a icudtl.dat | Out-String
        $pids = @()
        foreach ($line in $out -split '\n') {
            if ($line -match 'pid: (\d+)') { $pids += [int]$Matches[1] }
        }
        $pids = $pids | Sort-Object -Unique
        foreach ($pid in $pids) {
            if ($pid) {
                Write-Host ("Stopping process PID {0} ..." -f $pid) -ForegroundColor DarkGray
                try {
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host ("Stopped {0}" -f $pid) -ForegroundColor Green
                } catch {
                    Write-Host ("Failed to stop {0}: {1}" -f $pid, $_) -ForegroundColor Red
                }
            }
        }
        Write-Host "Re-run handle.exe if you want to confirm locks are gone." -ForegroundColor DarkGray
    }
} else {
    Write-Host "handle.exe not available. You can install Sysinternals Handle.exe and rerun this script or continue with manual deletion steps." -ForegroundColor Yellow
}

Pause-Continue

# 4) Attempt to delete node_modules normally
Write-Host "\nStep 4: Attempt to remove node_modules normally." -ForegroundColor Yellow
$nm = Join-Path $RepoRoot 'node_modules'
if (Test-Path $nm) {
    Write-Host "node_modules exists at: $nm" -ForegroundColor DarkGray
    if (Confirm-YesNo "Attempt to delete node_modules now? This action is destructive.") {
        try {
            Remove-Item -LiteralPath $nm -Recurse -Force -ErrorAction Stop
            Write-Host "Removed node_modules successfully." -ForegroundColor Green
        } catch {
            Write-Host "Remove-Item failed: $_" -ForegroundColor Red
            Write-Host "Will attempt fallback deletion methods." -ForegroundColor Yellow

            # 4a) Attempt takeown/icacls (admin required)
            if (Confirm-YesNo "Try takeown/icacls (requires elevation) to take ownership and retry deletion?") {
                Write-Host "Requesting elevation to run takeown/icacls and remove node_modules..." -ForegroundColor DarkGray
                # Create a temporary elevated script to avoid complex escaping in ArgumentList
                $tempScript = Join-Path $env:TEMP "takeown_and_delete_$([guid]::NewGuid().ToString()).ps1"
                $scriptContent = @"
$ErrorActionPreference = 'Stop'
takeown /F "$nm" /R /D Y
icacls "$nm" /grant Administrators:F /T
Remove-Item -LiteralPath "$nm" -Recurse -Force
"@
                Set-Content -Path $tempScript -Value $scriptContent -Force -Encoding UTF8
                Start-Process powershell -Verb runAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$tempScript`"" -Wait
                # Cleanup the temporary script (attempt; may require elevation as well)
                try { Remove-Item -LiteralPath $tempScript -Force -ErrorAction SilentlyContinue } catch {}
            }

            # 4b) robocopy mirror trick
            if (Test-Path $nm) {
                if (Confirm-YesNo "If deletion still fails, use robocopy mirror trick to wipe node_modules? (creates temporary folder C:\empty_for_delete)") {
                    try {
                        $empty = 'C:\empty_for_delete'
                        New-Item -ItemType Directory -Path $empty -Force | Out-Null
                        robocopy $empty $nm /MIR | Out-Null
                        Remove-Item -LiteralPath $nm -Recurse -Force
                        Remove-Item -LiteralPath $empty -Recurse -Force
                        Write-Host "Robocopy mirror deletion completed." -ForegroundColor Green
                    } catch {
                        Write-Host "Robocopy deletion failed: $_" -ForegroundColor Red
                        Write-Host "If this still fails, reboot into Safe Mode and delete the folder manually." -ForegroundColor Yellow
                    }
                }
            }
        }
    } else {
        Write-Host "Skipping deletion of node_modules. You can delete it later and rerun this script." -ForegroundColor Yellow
    }
} else {
    Write-Host "No node_modules folder found; skipping deletion." -ForegroundColor Green
}

Pause-Continue

# 5) Reinstall dependencies (npm ci preferred)
Write-Host "\nStep 5: Reinstall dependencies" -ForegroundColor Yellow
Set-Location -LiteralPath $RepoRoot
Write-Host "Recommended: ensure package.json has React pinned to 18.2.0. Inspecting package.json react version..." -ForegroundColor DarkGray
Select-String -Path (Join-Path $RepoRoot 'package.json') -Pattern '"react"' -Context 0,1 | ForEach-Object { $_.Line }

if (Confirm-YesNo "Do you want to explicitly install react@18.2.0 and react-dom@18.2.0 now? (recommended if you had React 19 previously)") {
    Write-Host "Installing react/react-dom@18.2.0..." -ForegroundColor DarkGray
    npm install react@18.2.0 react-dom@18.2.0 --save-exact
}

# Use npm ci if lockfile exists; else npm install
if (Test-Path (Join-Path $RepoRoot 'package-lock.json')) {
    if (Confirm-YesNo "package-lock.json found. Run 'npm ci' for deterministic install? (recommended)" ) {
        npm ci
    } else {
        npm install
    }
} else {
    npm install
}

Write-Host "Dependency installation finished (watch the output for errors)." -ForegroundColor Green

# 6) Verify installed versions
Write-Host "\nStep 6: Verify versions (react, react-dom, @chakra-ui/react)" -ForegroundColor Yellow
npm ls react --depth=0
npm ls react-dom --depth=0
npm ls @chakra-ui/react --depth=0

# 7) Run typecheck/build (if present)
Write-Host "\nStep 7: Run typecheck and build (if available)" -ForegroundColor Yellow
if (Get-Command npm -ErrorAction SilentlyContinue) {
    if (Confirm-YesNo "Run 'npm run typecheck' now?") { npm run typecheck }
    if (Confirm-YesNo "Run 'npm run build' now?") { npm run build }
    if (Confirm-YesNo "Start dev server now ('npm run dev')? (This will run in foreground, run in a separate terminal if you want to keep this script interactive)") {
        Write-Host "Starting 'npm run dev' (you can cancel the script to close it)." -ForegroundColor DarkGray
        npm run dev
    }
} else {
    Write-Host "npm not found in PATH; cannot run npm scripts." -ForegroundColor Red
}

Write-Host "\nScript completed. If you ran into errors during install (peer deps or EBUSY), read the script output and try the suggested fallback steps (handle.exe, takeown/icacls, robocopy mirror)." -ForegroundColor Cyan
Write-Host "After a successful 'npm install' and 'npm run typecheck' I can draft the final Chakra theme consolidation patches. Reply 'please draft theme patches' to continue." -ForegroundColor Cyan

