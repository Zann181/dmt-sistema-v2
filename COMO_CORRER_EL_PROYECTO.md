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

### 2. Configurar la Base de Datos (Neon)
La app ya no tiene base simulada en memoria: sin `DATABASE_URL` las consultas fallan.

- **Base de producción (Neon, vía Vercel):** se descarga una vez:
  ```bash
  npx vercel login
  npx vercel link --project dmt69
  npx vercel env pull .env.local --environment=production
  ```
  Cuidado: todo lo que hagas en local modifica los datos reales.
- **Postgres local** (para probar sin tocar producción): `docker compose up -d` y en `.env.local` pon `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dmt_sistema_db`.

### 3. Crear las tablas
Solo en una base nueva o vacía:
```bash
npm run db:migrate
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
  - Contraseña: vacía en el evento; se toma de la variable de entorno `SMTP_PASSWORD` (Contraseña de aplicación de Gmail)
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
