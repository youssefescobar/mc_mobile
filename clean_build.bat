@echo off
echo ==========================================
echo      Munawwara Care Build Script
echo ==========================================

echo [0/6] Stopping any running Gradle daemons...
cd android
call gradlew.bat --stop
cd ..

echo [1/6] Removing existing app from device (ensures clean slate)...
adb uninstall com.munawwaracare.mcmobile
if %ERRORLEVEL% NEQ 0 (
    echo Note: App not found or device not connected. Skipping uninstall.
)

echo [2/6] Regenerating Native Android Project (Prebuild)...
call npx expo prebuild --platform android --clean
if %ERRORLEVEL% NEQ 0 (
    echo Error: Prebuild failed.
    exit /b %ERRORLEVEL%
)

echo [3/6] Patching AndroidManifest.xml (fullScreenIntent + call permissions)...
rem
rem  expo prebuild regenerates android/app/src/main/AndroidManifest.xml from
rem  app.config.ts, which does NOT include our hand-added manifest entries.
rem  This step re-applies them every time so a clean build still works.
rem
powershell -Command ^
  "$f = 'android\app\src\main\AndroidManifest.xml';" ^
  "$xml = Get-Content $f -Raw;" ^
  "" ^
  "# 1. Add USE_FULL_SCREEN_INTENT permission (required for lock-screen call UI)" ^
  "if ($xml -notmatch 'USE_FULL_SCREEN_INTENT') {" ^
  "    $xml = $xml -replace '(<uses-permission android:name=""android.permission.WAKE_LOCK""/>)', '$1`n  <uses-permission android:name=""android.permission.USE_FULL_SCREEN_INTENT""/>';" ^
  "    Write-Host '  + Added USE_FULL_SCREEN_INTENT';" ^
  "} else { Write-Host '  = USE_FULL_SCREEN_INTENT already present'; }" ^
  "" ^
  "# 2. Add RECEIVE_BOOT_COMPLETED permission" ^
  "if ($xml -notmatch 'RECEIVE_BOOT_COMPLETED') {" ^
  "    $xml = $xml -replace '(<uses-permission android:name=""android.permission.USE_FULL_SCREEN_INTENT""/>)', '$1`n  <uses-permission android:name=""android.permission.RECEIVE_BOOT_COMPLETED""/>';" ^
  "    Write-Host '  + Added RECEIVE_BOOT_COMPLETED';" ^
  "} else { Write-Host '  = RECEIVE_BOOT_COMPLETED already present'; }" ^
  "" ^
  "# 3. Add showWhenLocked and turnScreenOn to MainActivity" ^
  "#    These two flags allow the activity to display on the lock screen" ^
  "#    and wake the screen when a fullScreenIntent notification fires." ^
  "#    Without them, fullScreenIntent is silently ignored on a locked phone." ^
  "if ($xml -notmatch 'showWhenLocked') {" ^
  "    $xml = $xml -replace 'android:screenOrientation=""portrait""', 'android:screenOrientation=""portrait"" android:showWhenLocked=""true"" android:turnScreenOn=""true""';" ^
  "    Write-Host '  + Added showWhenLocked + turnScreenOn to MainActivity';" ^
  "} else { Write-Host '  = showWhenLocked already present'; }" ^
  "" ^
  "Set-Content $f $xml -NoNewline;" ^
  "Write-Host '  Done patching AndroidManifest.xml';"

if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to patch AndroidManifest.xml.
    exit /b %ERRORLEVEL%
)

echo [4/6] Patching android/build.gradle (Notifee local repo + remove dl.notifee.app)...
powershell -ExecutionPolicy Bypass -File patch_build_gradle.ps1
if %ERRORLEVEL% NEQ 0 (
    echo Error: patch_build_gradle.ps1 failed.
    exit /b %ERRORLEVEL%
)

echo [5/6] Configuring local.properties...
echo sdk.dir=C\:\\Users\\usef\\AppData\\Local\\Android\\Sdk> android\local.properties
echo cmake.dir=C\:\\Users\\usef\\AppData\\Local\\Android\\Sdk\\cmake\\4.1.2>> android\local.properties

echo [6/6] Building and Running App...
call npx expo run:android --device
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    echo ERROR: Build or Installation failed.
    echo If you see 'INSTALL_FAILED_USER_RESTRICTED', please enable 
    echo 'Install via USB' in your device's Developer Options.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    echo.
    goto :end
)

echo ==========================================
echo           Build Process Finished Successfully
echo ==========================================

:end
pause
