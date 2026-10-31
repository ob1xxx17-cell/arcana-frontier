@echo off
chcp 65001 > nul
title Arcana Frontier - Push to GitHub
cd /d "%~dp0"

echo ====================================================
echo   🚀 นำโค้ดขึ้น GitHub เพื่อเปิดเซิร์ฟเวอร์ 24 ชม. บน Render
echo ====================================================
echo.
echo กรุณาวางลิงก์ GitHub Repository ของคุณ (ตัวอย่าง: https://github.com/username/arcana-frontier.git)
set /p REPO_URL="วาง URL ที่นี่ แล้วกด Enter: "

if "%REPO_URL%"=="" (
    echo [ERROR] ไม่ได้ใส่ URL กรุณาลองใหม่อีกครั้ง
    pause
    exit /b
)

git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git branch -M main
echo.
echo กำลังอัปโหลดโค้ดขึ้น GitHub...
git push -u origin main

echo.
echo ====================================================
echo  ✅ อัปโหลดโค้ดขึ้น GitHub สำเร็จเรียบร้อย!
echo ====================================================
pause
