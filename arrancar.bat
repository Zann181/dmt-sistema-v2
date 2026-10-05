@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title DMT Sistema v2

:: Un solo .bat para abrir Y cerrar la app:
::   - Si el servidor NO esta corriendo -> lo inicia y abre el navegador.
::   - Si el servidor YA esta corriendo -> lo cierra.
:: La app no se inicia sola con Windows; solo corre cuando se usa este archivo.

set "PORT=3000"
set "SERVER_TITLE=DMT Sistema v2 - Servidor"

:: ─── ¿Ya esta corriendo? Entonces cerrar ───────────────────────────────
set "PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set "PID=%%p"
if defined PID goto :cerrar

:: ─── Iniciar ───────────────────────────────────────────────────────────
echo ========================================
echo       Arrancando DMT Sistema v2
echo ========================================
echo.

:: Obtener la IP local de la red (normalmente 192.168.x.x)
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"Direcci.n IPv4" /C:"IPv4 Address" ^| findstr "192.168 10."') do (
    set "LOCAL_IP=%%a"
)
:: Limpiar espacios en blanco
if defined LOCAL_IP set "LOCAL_IP=!LOCAL_IP: =!"

if not defined LOCAL_IP (
    set "LOCAL_IP=localhost"
    echo [!] No se detecto IP de red local, usando localhost.
) else (
    echo [*] IP local detectada: !LOCAL_IP!
)

echo [*] Configurando entorno para permitir acceso desde celulares...
:: Las URLs con la IP detectada van en .env.development.local (pisa a .env.local en dev).
:: .env.local queda para DATABASE_URL de Neon, que este .bat nunca toca.
:: HTTPS es obligatorio para que la camara (escaner QR) funcione en el celular
echo NEXTAUTH_URL=https://%LOCAL_IP%:%PORT%> .env.development.local
echo AUTH_URL=https://%LOCAL_IP%:%PORT%>> .env.development.local
echo NEXT_PUBLIC_APP_URL=https://%LOCAL_IP%:%PORT%>> .env.development.local
echo NEXT_PUBLIC_MEDIA_BASE_URL=https://%LOCAL_IP%:%PORT%>> .env.development.local

:: La base de datos es la de Neon (produccion). Se descarga una vez con:
::   npx vercel env pull .env.local --environment=production
findstr /B /C:"DATABASE_URL=" .env.local >nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] Falta DATABASE_URL en .env.local. Ejecuta una sola vez:
    echo     npx vercel login
    echo     npx vercel link --project dmt69
    echo     npx vercel env pull .env.local --environment=production
    pause
    exit /b 1
)

echo.
echo [*] Instalando dependencias (si es necesario)...
call npm install

echo.
echo [*] Iniciando el servidor con la base de datos de PRODUCCION (Neon)...
:: El servidor corre en su propia ventana minimizada; este .bat la cierra la proxima vez.
if exist .dmt-error.log del .dmt-error.log
start "%SERVER_TITLE%" /min cmd /c "title %SERVER_TITLE% && npx next dev --experimental-https --port %PORT% || echo [!] El servidor se detuvo con error> .dmt-error.log"

echo [*] Esperando a que el servidor responda...
for /l %%i in (1,1,90) do (
    netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul && goto :listo
    if exist .dmt-error.log goto :fallo
    timeout /t 2 /nobreak >nul
)
echo.
echo [!] El servidor no respondio en 3 minutos.
echo     Revisa la ventana "%SERVER_TITLE%" en la barra de tareas para ver el error.
pause
exit /b 1

:fallo
echo.
type .dmt-error.log
echo.
pause
exit /b 1

:listo
echo.
echo =======================================================
echo.
echo  APLICACION ABIERTA  -  conectada a la base de datos de PRODUCCION
echo  (todo lo que hagas aqui modifica los datos reales del servidor)
echo.
echo  📱 PARA ABRIR DESDE TU CELULAR:
echo  🌐 https://%LOCAL_IP%:%PORT%
echo     (el navegador va a mostrar advertencia de certificado -^> Avanzado -^> Continuar)
echo.
echo  💻 PARA ABRIR EN ESTA PC:
echo  🌐 https://localhost:%PORT%
echo.
echo  Para CERRAR la aplicacion: vuelve a ejecutar arrancar.bat
echo.
echo =======================================================
start "" "https://localhost:%PORT%"
timeout /t 15
exit /b 0

:: ─── Cerrar ────────────────────────────────────────────────────────────
:cerrar
echo ========================================
echo       Cerrando DMT Sistema v2
echo ========================================
echo.
echo [*] Deteniendo servidor (PID %PID%)...
taskkill /PID %PID% /T /F >nul 2>&1
:: Cerrar tambien la ventana del servidor (npx / cmd padre)
taskkill /FI "WINDOWTITLE eq %SERVER_TITLE%*" /T /F >nul 2>&1

set "PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do set "PID=%%p"
if defined PID (
    echo [!] No se pudo cerrar el proceso %PID% en el puerto %PORT%.
    pause
    exit /b 1
)
echo [OK] Aplicacion cerrada.
timeout /t 5
exit /b 0
