@echo off
title Publicacoes Academicas - preparar de novo
cd /d "%~dp0"
echo  Apagando a montagem antiga para montar de novo na proxima abertura...
if exist ".next" rmdir /s /q ".next"
echo  Pronto. Agora clique duas vezes em INICIAR.
pause
