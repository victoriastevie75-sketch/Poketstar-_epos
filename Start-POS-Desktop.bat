@echo off
title Poket Star EPOS — Retail Terminal Launcher
echo ========================================================
echo             POKET STAR EPOS SYSTEM
echo      Standalone Windows Retail Management Terminal
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking system architecture and environment...
IF "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    echo Detected 64-bit Windows Operating System.
    IF EXIST "PoketStar-POS-64bit.exe" (
        echo Starting 64-bit High-Performance POS engine...
        start "" "PoketStar-POS-64bit.exe"
        goto :launched
    )
) ELSE (
    echo Detected 32-bit Windows Operating System.
)

IF EXIST "PoketStar-POS-32bit.exe" (
    echo Starting 32-bit Universal POS engine...
    start "" "PoketStar-POS-32bit.exe"
    goto :launched
)

IF EXIST "PoketStar-POS.exe" (
    echo Starting POS engine...
    start "" "PoketStar-POS.exe"
    goto :launched
)

echo.
echo [2/2] Opening POS Interface in Web App Standalone Mode...
IF EXIST "index.html" (
    start msedge.exe --app="%CD%\index.html" --window-size=1280,840 2>nul || start chrome.exe --app="%CD%\index.html" --window-size=1280,840 2>nul || start "" "%CD%\index.html"
    goto :launched
)

echo ERROR: Could not locate Poket Star POS application files in this folder.
pause
exit /b 1

:launched
echo.
echo ========================================================
echo   Poket Star POS is now running!
echo   You can minimize this window.
echo ========================================================
exit /b 0
