@echo off
title portal-client - Launcher
echo ============================================
echo   portal-client-nextlevelgarage (SvelteKit)
echo ============================================
echo.
rem NU forta portul aici. Se ia din vite.config.ts (5176), care e exact
rem portul spre care face ProxyPass 21-nlg-portal.test.conf.
rem Vechiul "--port 5174" pornea pe portul lui nlg: domeniul nlg-portal.test
rem ramanea 503, iar acum s-ar ciocni cu serverul nlg care ruleaza permanent
rem pe 5174 (strictPort => crapa in loc sa sara pe alt port).

echo Pornesc serverul de dezvoltare (Vite, port 5176)...
start "portal - Vite" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 5 >nul
start http://nlg-portal.test/
echo.
echo Portal: http://nlg-portal.test/
echo Pentru a opri: inchide fereastra neagra.
