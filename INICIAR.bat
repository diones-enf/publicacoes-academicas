@echo off
title Publicacoes Academicas
cd /d "%~dp0"
echo.
echo  ===========================================
echo    PUBLICACOES ACADEMICAS
echo  ===========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  O Node.js ainda nao esta instalado neste computador.
  echo.
  echo  Vou abrir a pagina de download agora.
  echo  1. Baixe a versao "LTS" e instale clicando em Avancar ate o fim.
  echo  2. Depois, clique de novo duas vezes no arquivo INICIAR.
  echo.
  start "" "https://nodejs.org/pt"
  pause
  exit /b
)

if not exist "node_modules\" (
  echo  Primeira vez: preparando o sistema. Isso leva de 1 a 3 minutos...
  echo.
  call npm.cmd install --no-fund --no-audit
  if errorlevel 1 goto erro
)

if not exist ".next\BUILD_ID" (
  echo.
  echo  Montando o sistema. Isso leva cerca de 1 minuto...
  echo.
  call npm.cmd run build
  if errorlevel 1 goto erro
)

echo.
echo  Sistema ligado! O navegador vai abrir em alguns segundos.
echo  Endereco: http://localhost:3000
echo.
echo  NAO FECHE ESTA JANELA enquanto estiver usando o sistema.
echo  Para desligar, e so fechar esta janela.
echo.
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call npm.cmd start
goto fim

:erro
echo.
echo  Algo deu errado. Tire um print desta janela e envie para o Claude.
pause

:fim
