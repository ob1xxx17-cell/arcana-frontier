@echo off
chcp 65001 > nul
title Arcana Frontier - Online Game Server
cd /d "%~dp0"
echo ====================================================
echo   🌐 กำลังเริ่มเซิร์ฟเวอร์ Arcana Frontier Online...
echo ====================================================
start http://localhost:3000
node server/server.js
pause
