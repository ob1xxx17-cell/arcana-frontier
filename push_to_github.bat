@echo off
cd /d "%~dp0"

echo ====================================================
echo   Uploading Arcana Frontier to GitHub...
echo ====================================================
echo.

echo [1/3] Setting repository URL...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/ob1xxx17-cell/arcana-frontier.git
git branch -M main

echo [2/3] Sending code to GitHub...
git push -u origin main --force

echo.
if %ERRORLEVEL% equ 0 (
    echo ====================================================
    echo   [SUCCESS] Uploaded to GitHub successfully!
    echo ====================================================
) else (
    echo ====================================================
    echo   [FAILED] Could not push to GitHub.
    echo ====================================================
)
pause
