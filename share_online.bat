@echo off
chcp 65001 > nul
title Arcana Frontier - แชร์ลิงก์ออนไลน์กับเพื่อน
cd /d "%~dp0"
node server/tunnel.js
pause
