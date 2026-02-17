@echo off
echo ==========================================
echo      Munawwara Care Build Script
echo ==========================================

echo [1/5] Cleaning Android Project...
cd android
call gradlew.bat clean
if %ERRORLEVEL% NEQ 0 (
    echo Error: Gradle clean failed.
    echo Trying to continue...
)
cd ..

echo [2/5] Regenerating Native Android Project...
call npx expo prebuild --platform android --clean
if %ERRORLEVEL% NEQ 0 (
    echo Error: Prebuild failed.
    exit /b %ERRORLEVEL%
)

echo [3/5] Configuring local.properties...
echo sdk.dir=C\:\\Users\\usef\\AppData\\Local\\Android\\Sdk> android\local.properties
echo cmake.dir=C\:\\Users\\usef\\AppData\\Local\\Android\\Sdk\\cmake\\4.1.2>> android\local.properties

echo [4/5] Configuration Complete.
type android\local.properties

echo [5/5] Building and Running App...
call npx expo run:android --device

echo ==========================================
echo           Build Process Finished
echo ==========================================
pause
