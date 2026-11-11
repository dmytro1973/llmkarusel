@echo off
setlocal
set "ROOT=%~dp0..\..\.."
set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not exist "%BUN%" set "BUN=bun"
"%BUN%" "%ROOT%\packages\llmkarusel\bin\llmkarusel.mjs" %*
