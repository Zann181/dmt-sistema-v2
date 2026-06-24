# Guía de Configuración y Ejecución del Proyecto — DMT Sistema v2

Esta guía contiene los pasos necesarios para configurar y correr el proyecto de forma correcta utilizando una base de datos persistente (PostgreSQL), evitando que los datos creados en el navegador se eliminen cuando el servidor se reinicie o recargue.

---

## 📋 Requisitos Previos

Asegúrate de tener instalados los siguientes componentes en tu sistema:
- **Node.js** (Versión 18 o superior recomendada). Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
- **PostgreSQL** (ya sea de forma local o un servicio en la nube como [Neon.tech](https://neon.tech/)).

---

## 🚀 Paso a Paso para la Configuración

### 1. Clonar e Instalar Dependencias
Abre tu terminal en la carpeta del proyecto `dmt-sistema-v2` e instala los paquetes necesarios:
```bash
npm install
```

### 2. Configurar la Base de Datos Persistente
Para evitar el uso del almacenamiento simulado en memoria (el cual borra los datos cada vez que editas código), debes conectar una base de datos real.

1. Abre el archivo `.env` en la raíz del proyecto.
2. Localiza la sección de base de datos:
   ```env
   # ─── Base de Datos (Neon PostgreSQL) ───────────────────
   DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
   ```
3. Cambia la URL por tu cadena de conexión real de PostgreSQL.
   - **Si usas Neon.tech** (Recomendado): Copia la connection string de tu dashboard (ej. `postgresql://usuario:contraseña@ep-pool-name.us-east-2.aws.neon.tech/neondb?sslmode=require`).
   - **Si usas PostgreSQL local**: Configura los datos locales (ej. `postgresql://postgres:tu_contraseña@localhost:5432/dmt_db`).
4. (Opcional) Configura `DATABASE_DIRECT_URL` si tu proveedor lo requiere para migraciones directas.

> [!IMPORTANT]  
> Al remover la palabra `dummy` de la URL, el sistema automáticamente desactivará la base de datos simulada en memoria y guardará toda la información de forma permanente.

### 3. Sincronizar el Esquema de la Base de Datos
Una vez configurada la URL real en el `.env`, ejecuta el siguiente comando para crear las tablas en tu base de datos PostgreSQL:
```bash
npm run db:push
```

### 4. Poblar la Base de Datos con Datos de Prueba (Seed)
Para tener usuarios administradores y configuraciones por defecto listos para usar, ejecuta el seed:
```bash
npm run db:seed
```
*Esto creará los roles por defecto y los usuarios de prueba con la contraseña inicial:* `CambiarEstaContraseña123!`

---

## 💻 Ejecución en Desarrollo

Para iniciar el servidor de desarrollo local, ejecuta:
```bash
npm run dev
```
El proyecto estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 📧 Configuración de Correo y SMTP

Cuando creas un nuevo evento, el sistema viene pre-rellenado con datos de ejemplo extraídos del proyecto original.

- **Servidor SMTP (Gmail por defecto)**:
  - Servidor: `smtp.gmail.com`
  - Puerto: `587` (con TLS)
  - Usuario: `zamamotas@gmail.com`
  - Contraseña: `uxxg iyhg rgsb xbmw` (Contraseña de aplicación de Gmail)
- **Modificación**: Puedes alterar estas credenciales directamente al crear el evento (sección avanzada colapsable) o editarlas más tarde en **Eventos** ➔ **Configurar** ➔ pestaña **Plantilla Email**.
- **Flyer y QR**:
  - Los correos enviarán el código QR del asistente automáticamente como imagen inline referenciando `cid:acceso_qr.png`.
  - El Flyer se cargará mediante la URL provista (o base64 en su defecto) y se mostrará en el cuerpo del correo.

---

## 🛠️ Comandos Útiles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo con recarga rápida. |
| `npm run build` | Compila la aplicación y valida tipos de TypeScript para producción. |
| `npm run db:push` | Sincroniza el archivo `schema.prisma` con tu base de datos PostgreSQL. |
| `npm run db:seed` | Llena la base de datos con usuarios y datos iniciales de prueba. |
| `npx prisma studio`| Abre una consola visual en tu navegador para ver y editar registros de tu base de datos. |
