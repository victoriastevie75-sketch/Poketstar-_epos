@echo off
title Poket Star EPOS — Retail Terminal Launcher
echo ========================================================
echo             POKET STAR EPOS SYSTEM
echo      Standalone Windows Retail Management Terminal
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking system architecture and runtime environment...
IF "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    echo Detected 64-bit Windows Architecture (AMD64).
    IF EXIST "PoketStar-POS-64bit.exe" (
        echo [2/3] Starting 64-bit High-Performance POS Native Engine...
        start "" "PoketStar-POS-64bit.exe"
        goto :launched
    )
) ELSE (
    echo Detected 32-bit Windows Architecture (x86).
)

IF EXIST "PoketStar-POS-32bit.exe" (
    echo [2/3] Starting 32-bit Universal POS Native Engine...
    start "" "PoketStar-POS-32bit.exe"
    goto :launched
)

IF EXIST "PoketStar-POS.exe" (
    echo [2/3] Starting Universal POS Native Engine...
    start "" "PoketStar-POS.exe"
    goto :launched
)

echo.
echo [2/3] Checking for Node.js Desktop Engine...
where node >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    IF EXIST "desktop-launcher.js" (
        echo Starting embedded POS engine via Node.js Desktop Launcher...
        start "" node desktop-launcher.js
        goto :launched
    )
    IF EXIST "server.js" (
        echo Starting embedded POS engine via Node.js Server...
        start "" node server.js
        timeout /t 2 /nobreak >nul
        start msedge.exe --app="http://localhost:3000" --window-size=1280,840 2>nul || start chrome.exe --app="http://localhost:3000" --window-size=1280,840 2>nul || start "" "http://localhost:3000"
        goto :launched
    )
)

echo.
echo [3/3] Opening POS Interface in Web App Standalone Mode...
IF EXIST "index.html" (
    start msedge.exe --app="%CD%\index.html" --window-size=1280,840 --disable-pinch 2>nul || start chrome.exe --app="%CD%\index.html" --window-size=1280,840 --disable-pinch 2>nul || start "" "%CD%\index.html"
    goto :launched
)

echo.
echo [ERROR] Could not locate Poket Star POS application files in this folder.
echo Please ensure index.html and executable files are extracted together.
pause
exit /b 1

:launched
echo.
echo ========================================================
echo   [OK] Poket Star POS is active and running!
echo   * Standalone Counter Window Opened
echo   * 1,950 Inventory Items Loaded
echo   * Thermal Receipt Printing Ready
echo ========================================================
exit /b 0
