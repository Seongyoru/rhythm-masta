@echo off
chcp 65001 >nul
title RHYTHM MASTA
echo.
echo   RHYTHM MASTA 를 실행해요. 브라우저가 자동으로 열려요.
echo   게임하는 동안 이 창은 닫지 마세요. (닫으면 게임 서버가 꺼져요)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
