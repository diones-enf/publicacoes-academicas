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

node scripts\iniciar.mjs
if errorlevel 1 (
  echo.
  echo  Algo deu errado. Tire um print desta janela e envie para o Claude.
  pause
)
