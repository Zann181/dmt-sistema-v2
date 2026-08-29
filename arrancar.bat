@echo off
setlocal enabledelayedexpansion
title DMT Sistema v2 - Servidor Local

echo ========================================
echo       Arrancando DMT Sistema v2
echo ========================================
echo.

:: Obtener la IP local de la red (normalmente 192.168.x.x)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"Direcci.n IPv4" /C:"IPv4 Address" ^| findstr "192.168 10."') do (
    set "LOCAL_IP=%%a"
)
:: Limpiar espacios en blanco
set "LOCAL_IP=%LOCAL_IP: =%"

if "%LOCAL_IP%"=="" (
    set "LOCAL_IP=localhost"
    echo [!] No se detecto IP de red local, usando localhost.
) else (
    echo [*] IP local detectada: %LOCAL_IP%
)

echo [*] Configurando entorno para permitir acceso desde celulares...
:: Actualizar .env.local con la IP detectada para que la sesion funcione en el celular
:: HTTPS es obligatorio para que la camara (escaner QR) funcione en el celular
echo NEXTAUTH_URL=https://%LOCAL_IP%:3000> .env.local
echo AUTH_URL=https://%LOCAL_IP%:3000>> .env.local
echo NEXT_PUBLIC_APP_URL=https://%LOCAL_IP%:3000>> .env.local
echo NEXT_PUBLIC_MEDIA_BASE_URL=https://%LOCAL_IP%:3000>> .env.local

echo.
echo [*] Instalando dependencias (si es necesario)...
call npm install

echo.
echo =======================================================
echo.
echo 📱 PARA ABRIR DESDE TU CELULAR:
echo 🌐 https://%LOCAL_IP%:3000
echo    (el navegador va a mostrar advertencia de certificado -^> Avanzado -^> Continuar)
echo.
echo 💻 PARA ABRIR EN ESTA PC:
echo 🌐 https://localhost:3000
echo.
echo =======================================================
echo.
echo [*] Iniciando el servidor (HTTPS local para permitir camara)...
call npx next dev --experimental-https

pause
