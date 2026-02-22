# patch_build_gradle.ps1
# Patches android/build.gradle after expo prebuild to:
#   1. Remove the unreachable dl.notifee.app remote maven repo
#   2. Add the local Notifee maven repo from node_modules
#
# Uses $PSScriptRoot for reliable absolute path resolution — no $rootDir guessing.

$buildGradle = Join-Path $PSScriptRoot "android\build.gradle"

if (-not (Test-Path $buildGradle)) {
    Write-Error "android\build.gradle not found at: $buildGradle"
    exit 1
}

# Build the absolute path to the local Notifee maven libs
$notifeeLibs = Join-Path $PSScriptRoot "node_modules\@notifee\react-native\android\libs"
# Gradle on Windows accepts forward slashes
$notifeeLibsForwardSlash = $notifeeLibs.Replace('\', '/')

Write-Host "  Notifee local libs: $notifeeLibsForwardSlash"

$content = Get-Content $buildGradle -Raw

# ── Step 1: Remove the unreachable dl.notifee.app line ──────────────────────
$content = $content -replace "(?m)[ \t]*maven\s*\{\s*url\s*[`"']https://dl\.notifee\.app/[`"']\s*\}[ \t]*(\r?\n|\n)?", ""
Write-Host "  Removed dl.notifee.app entry (if present)."

# ── Step 2: Add local Notifee repo if not already there ─────────────────────
if ($content -match [regex]::Escape($notifeeLibsForwardSlash)) {
    Write-Host "  Local Notifee repo already present, skipping."
} else {
    # Insert after the jitpack maven line
    $jitpackPattern = "(maven\s*\{\s*url\s*'https://www\.jitpack\.io'\s*\})"
    $notifeeEntry   = "    maven { url '$notifeeLibsForwardSlash' }"
    $content = $content -replace $jitpackPattern, "`$1`n$notifeeEntry"
    Write-Host "  Added local Notifee maven repo."
}

# Write back (preserve line endings)
[System.IO.File]::WriteAllText($buildGradle, $content)
Write-Host "  Done patching android\build.gradle"
