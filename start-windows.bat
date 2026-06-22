@echo off
echo ===================================================
echo   Invoice Contract OCR Manager - Starting...
echo ===================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_portable_python.ps1"
if %errorlevel% neq 0 (
    echo [ERROR] Application failed to start.
    pause
)
