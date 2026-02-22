@echo off
echo ==========================================
echo      Munawwara Care Build Script
echo ==========================================

echo [0/5] Stopping any running Gradle daemons...
cd android
call gradlew.bat --stop
cd ..

echo [1/5] Removing existing app from device (ensures clean slate)...
adb uninstall com.munawwaracare.mcmobile
if %ERRORLEVEL% NEQ 0 (
    echo Note: App not found or device not connected. Skipping uninstall.
)

echo [2/5] Regenerating Native Android Project (Prebuild)...
call npx expo prebuild --platform android --clean
if %ERRORLEVEL% NEQ 0 (
    echo Error: Prebuild failed.
    exit /b %ERRORLEVEL%
)

echo [3/5] Patching android/build.gradle with Local Notifee repo...
echo        (Remote repo dl.notifee.app is currently unreachable)
powershell -Command "$g = Get-Content android\build.gradle; $g = $g -replace 'maven \{ url ''https://dl.notifee.app/'' \}', ''; $g = $g -replace 'maven \{ url ''https://www.jitpack.io'' \}', ('maven { url ''https://www.jitpack.io'' }' + [Environment]::NewLine + '    maven { url \"$rootDir/../node_modules/@notifee/react-native/android/libs\" }'); $g | Set-Content android\build.gradle"
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to patch build.gradle.
    exit /b %ERRORLEVEL%
)
echo        Done. Local Notifee repo added.

echo [4/5] Configuring local.properties...
echo sdk.dir=C\:\\Users\\usef\\AppData\\Local\\Android\\Sdk> android\local.properties
echo cmake.dir=C\:\\Users\\usef\\AppData\\Local\\Android\\Sdk\\cmake\\4.1.2>> android\local.properties

echo [5/5] Building and Running App...
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
