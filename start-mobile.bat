@echo off
chcp 65001 >nul
title RHYTHM MASTA (모바일)
echo.
echo   휴대폰에서도 접속할 수 있게 RHYTHM MASTA 를 실행해요.
echo   아래에 나오는 "On your phone" 주소를 휴대폰 브라우저에 입력하세요.
echo   (휴대폰과 PC가 같은 와이파이에 연결돼 있어야 해요)
echo   처음 실행할 때 Windows 방화벽 창이 뜨면 "개인 네트워크" 허용을 눌러 주세요.
echo   게임하는 동안 이 창은 닫지 마세요.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve-lan.ps1"
