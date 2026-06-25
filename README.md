# DMT Sistema v2 🚀

Sistema de gestión integral para el control de accesos, venta en barra (POS), administración de inventario y flujos de caja de las sucursales y eventos de **DMT**. 

Este proyecto representa una reescritura completa del sistema de gestión anterior (originalmente desarrollado en un monolito Django) hacia una arquitectura moderna, escalable y reactiva basada en **Next.js 16 (App Router)**, **React 19**, **Prisma 6** y **Tailwind CSS v4**, diseñada para ser desplegada en **Vercel** de manera gratuita combinada con **Neon PostgreSQL** o **Supabase**.

---

## 🏗️ Arquitectura del Sistema

El sistema está estructurado siguiendo los principios de **Domain-Driven Design (DDD)** (Diseño Guiado por el Dominio) y está dividido por dominios autónomos (Bounded Contexts) en lugar de capas técnicas tradicionales.

### Dominios del Negocio (Bounded Contexts)
1. **Identity (`identity`):** Control de usuarios, autenticación via Auth.js (NextAuth) y listas de control de acceso (ACL).
2. **Branch (`branch`):** Administración de locales físicos (sucursales), configuración dinámica de temas visuales por sucursal y gestión de personal asignado (staff).
3. **Event (`event`):** Configuración de eventos por sucursal, control de políticas de acceso, parametrización de servidores de correo SMTP independientes y edición dinámica de plantillas de email.
4. **Attendee (`attendee`):** Registro de asistentes, control de categorías de acceso (VIP, General, etc.), check-in en tiempo real en puerta y exportación de datos.
5. **Catalog (`catalog`):** Inventario global de productos y bebidas de cada sucursal.
6. **Sales (`sales`):** Módulo de Punto de Venta (POS) rápido para bar, con soporte de pagos combinados (efectivo, transferencia, tarjeta, QR) y canjeo de saldo incluido en las entradas de los asistentes.
7. **Inventory (`inventory`):** Auditoría y control de movimientos de stock físicos (entradas, salidas, mermas, ventas automáticas).

### Diagrama de Flujo de la Arquitectura
El siguiente diagrama describe cómo se procesan las peticiones y fluyen los datos desde la interfaz de usuario hasta la capa de almacenamiento persistente e infraestructura externa:

```mermaid
graph TD
    Client["Cliente (Navegador / Tablet)<br>React 19 + Zustand (POS Cart)<br>+ TanStack Query (Server Cache)"] 
    
    NextServer["Servidor Next.js (Edge-Ready)<br>App Router & Server Actions / Route Handlers"]
    
    AuthCheck["Validación e Identidad<br>Zod Schema + Auth.js v5 Middleware"]
    
    Domain["Capa de Dominio (DDD)<br>src/domains/[nombre]/<br>(Entities, Value Objects, Services, Repos)"]
    
    InfraPrisma["Infraestructura: ORM Prisma 6"]
    DB[(Base de Datos Persistente<br>PostgreSQL en Neon / Supabase)]
    
    InfraBlob["Infraestructura: Vercel Blob Storage<br>(Logotipos, Flyers, Multimedia)"]
    InfraMail["Infraestructura: SMTP / Resend<br>(Confirmación & Envío de QRs)"]
    InfraQR["Infraestructura: Sharp / Node-QRCode<br>(Generador Server-side de Accesos)"]

    %% Conexiones
    Client -- "Peticiones HTTP / Streams en tiempo real (SSE)" --> NextServer
    NextServer --> AuthCheck
    AuthCheck --> Domain
    Domain --> InfraPrisma
    InfraPrisma --> DB
    Domain --> InfraBlob
    Domain --> InfraMail
    Domain --> InfraQR
```

---

## 🗄️ Modelo de Base de Datos (ERD)

La base de datos utiliza **PostgreSQL** y es gestionada con **Prisma ORM**. A continuación se muestra la estructura y relaciones de las tablas principales que componen el sistema:

```mermaid
erDiagram
    users {
        String id PK
        String username UK
        String email UK
        String firstName
        String lastName
        String passwordHash
        Boolean isActive
        Boolean isSuperuser
        Boolean isGlobalAdmin
        DateTime createdAt
        DateTime updatedAt
    }

    branches {
        String id PK
        String name
        String slug UK
        String codePrefix
        String primaryColor
        String secondaryColor
        String pageBackgroundColor
        String surfaceColor
        String panelColor
        String textColor
        String titleColor
        String contactEmail
        String contactPhone
        String logoUrl
        String logoBgColor
        Int logoSize
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    events {
        String id PK
        String branchId FK
        String name
        String slug
        String description
        DateTime startsAt
        DateTime endsAt
        EventStatus status
        String qrPrefix
        String qrFillColor
        String qrBackgroundColor
        String qrLogoBackgroundColor
        Int qrLogoScale
        String logoUrl
        String qrLogoUrl
        String flyerUrl
        String accessPolicy
        String venueName
        String mapsUrl
        String dressCode
        String emailHost
        Int emailPort
        Boolean emailSecure
        String emailUser
        String emailPassword
        String emailFrom
        String emailSubject
        String emailPreheader
        String emailHeading
        String emailIntro
        String emailMessageTitle
        String emailBody
        String emailWarningTitle
        String emailWarningText
        String emailDetailsTitle
        String emailDateText
        String emailTimeText
        String emailQrTitle
        String emailQrNote
        String emailFooter
        String emailClosingText
        String emailTeamSignature
        String emailLegalNote
        Int emailLogoSize
        String emailBackgroundColor
        String emailCardColor
        String emailHeaderBackgroundColor
        String emailTextColor
        String emailTitleColor
        String emailMutedTextColor
        String emailAccentColor
        String emailBorderColor
        String emailSectionBackgroundColor
        String emailWarningBackgroundColor
        DateTime createdAt
        DateTime updatedAt
    }

    branch_memberships {
        String id PK
        String userId FK
        String branchId FK
        BranchRole role
        Boolean isActive
        DateTime createdAt
    }

    event_assignments {
        String id PK
        String userId FK
        String branchId FK
        String eventId FK
        BranchRole role
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    attendee_categories {
        String id PK
        String branchId FK
        String name
        Int includedConsumptions
        Decimal price
        String description
        Boolean isActive
    }

    attendees {
        String id PK
        String branchId FK
        String eventId FK
        String categoryId FK
        String createdById FK
        String checkedInById FK
        String name
        String cc
        String phone
        String email
        AttendeeOrigin origin
        Decimal paidAmount
        String qrCode UK
        String qrImageUrl
        Boolean hasCheckedIn
        DateTime checkedInAt
        Int includedBalance
        DateTime createdAt
    }

    products {
        String id PK
        String branchId FK
        String createdById FK
        String name
        String description
        String imageUrl
        Decimal price
        Boolean isActive
        DateTime createdAt
        DateTime updatedAt
    }

    event_products {
        String id PK
        String branchId FK
        String eventId FK
        String productId FK
        String updatedById FK
        Boolean isEnabled
        Decimal eventPrice
        DateTime updatedAt
    }

    bar_sales {
        String id PK
        String branchId FK
        String eventId FK
        String attendeeId FK
        String productId FK
        String soldById FK
        Uuid saleGroup
        Int quantity
        Decimal unitPrice
        Decimal total
        Boolean usedIncludedConsumption
        DateTime createdAt
    }

    bar_sale_payments {
        String id PK
        String saleId FK
        PaymentMethod method
        Decimal amount
        String reference
        String transferProofUrl
    }

    cash_movements {
        String id PK
        String branchId FK
        String eventId FK
        String createdById FK
        String createdRole
        CashModule module
        MovementType movementType
        String description
        Int attendeeQuantity
        Decimal unitAmount
        Decimal totalAmount
        DateTime createdAt
    }

    cash_movement_payments {
        String id PK
        String movementId FK
        PaymentMethod method
        Decimal amount
        String reference
        String transferProofUrl
    }

    stock_movements {
        String id PK
        String branchId FK
        String eventId FK
        String productId FK
        String createdById FK
        StockMovementType movementType
        Int quantity
        Int stockBefore
        Int stockAfter
        String note
        DateTime createdAt
    }

    users ||--o{ branch_memberships : "pertenece"
    branches ||--o{ branch_memberships : "tiene"
    users ||--o{ event_assignments : "asignado"
    branches ||--o{ event_assignments : "tiene"
    events ||--o{ event_assignments : "tiene"
    branches ||--o{ events : "alberga"
    branches ||--o{ attendee_categories : "define"
    branches ||--o{ attendees : "registra"
    events ||--o{ attendees : "tiene"
    attendee_categories ||--o{ attendees : "clasifica"
    users ||--o{ attendees : "crea"
    users ||--o{ attendees : "marca check-in"
    branches ||--o{ products : "ofrece"
    users ||--o{ products : "crea"
    branches ||--o{ event_products : "asigna"
    events ||--o{ event_products : "incluye"
    products ||--o{ event_products : "asociado"
    users ||--o{ event_products : "modifica"
    branches ||--o{ bar_sales : "registra"
    events ||--o{ bar_sales : "registra"
    attendees ||--o{ bar_sales : "compra"
    products ||--o{ bar_sales : "vendido"
    users ||--o{ bar_sales : "vende"
    bar_sales ||--o{ bar_sale_payments : "cobra"
    branches ||--o{ cash_movements : "audita"
    events ||--o{ cash_movements : "audita"
    users ||--o{ cash_movements : "crea"
    cash_movements ||--o{ cash_movement_payments : "asociado"
    branches ||--o{ stock_movements : "contabiliza"
    events ||--o{ stock_movements : "relaciona"
    products ||--o{ stock_movements : "mueve"
    users ||--o{ stock_movements : "registra"
```

### Roles y Permisos (`BranchRole`)
Las acciones en la aplicación están condicionadas por los siguientes perfiles de usuario:
*   **GLOBAL_ADMIN (Administrador Global):** Acceso total sin restricción de sucursal. Configura las sucursales del sistema.
*   **BRANCH_ADMIN (Administrador de Sucursal):** Gestiona la sucursal, crea y edita staff, configura catálogos base e inventario y audita cajas del local asignado.
*   **EVENT_ADMIN (Administrador de Evento):** Gestiona los eventos específicos de la sucursal, activa productos e ingresa plantillas SMTP para invitaciones.
*   **ENTRANCE (Staff de Entrada):** Acceso exclusivo al panel de registro de asistentes, escaneo de códigos QR y control de accesos del día del evento, así como la caja del módulo de entrada.
*   **BAR (Staff de Barra):** Acceso exclusivo al Punto de Venta (POS) para despachar tragos y productos, debitar saldos incluidos y administrar la caja del módulo de bar.

---

## 🚀 Guía de Instalación Paso a Paso

Sigue estas instrucciones detalladas para levantar el entorno de desarrollo local en tu computadora:

### 📋 Requisitos Previos
Asegúrate de contar con los siguientes elementos instalados:
*   **Node.js** (Versión 18 o superior recomendada, se prefiere v22). Descárgalo de [nodejs.org](https://nodejs.org/).
*   **PostgreSQL** de forma local o una cuenta en un proveedor en la nube como [Neon.tech](https://neon.tech/) o [Supabase](https://supabase.com/).

---

### Paso 1: Descargar el Código e Instalar Dependencias
Abre tu terminal en la carpeta raíz del proyecto y ejecuta el instalador de paquetes:
```bash
npm install
```

### Paso 2: Configurar las Variables de Entorno
Copia el archivo `.env.example` en la raíz y renombralo como `.env`:
```bash
cp .env.example .env
```
Abre el archivo `.env` configurado e introduce los valores reales requeridos:
*   **`AUTH_SECRET`**: Clave de encriptación para las cookies de sesión de Auth.js. Genera una cadena segura ejecutando en tu terminal:
    ```bash
    openssl rand -base64 32
    ```
*   **`DATABASE_URL`**: Tu cadena de conexión PostgreSQL.
    *   *Ejemplo Neon/Supabase:* `postgresql://usuario:contraseña@ep-pool-name.us-east-2.aws.neon.tech/neondb?sslmode=require`
    *   *Ejemplo local:* `postgresql://postgres:contraseña@localhost:5432/dmt_db`
    *   *Nota:* Si dejas la cadena con la palabra clave `dummy` por defecto, el sistema usará un almacenamiento simulado en memoria no persistente.
*   **`DATABASE_DIRECT_URL`**: Conexión directa a la base de datos (requerido por Neon para ejecutar migraciones directas).
*   **`BLOB_READ_WRITE_TOKEN`**: Token de Vercel Blob para subir imágenes (logos y flyers). Puedes obtenerlo desde la consola de Vercel Storage.
*   **`RESEND_API_KEY`** & **`RESEND_FROM_EMAIL`**: API key de Resend para el envío masivo de invitaciones y correos de soporte técnico de QR. En desarrollo puedes usar `onboarding@resend.dev`.

### Paso 3: Sincronizar el Esquema de la Base de Datos
Crea las tablas en tu base de datos de PostgreSQL usando Prisma:
```bash
npm run db:push
```

### Paso 4: Poblar la Base de Datos con Datos de Prueba (Seed)
Para comenzar a interactuar de inmediato con el sistema, ejecuta el script de semillas para crear una sucursal base, categorías de precios, productos e identidades de prueba:
```bash
npm run db:seed
```

### Paso 5: Iniciar el Servidor de Desarrollo
Corre el servidor Next.js de desarrollo local:
```bash
npm run dev
```
La aplicación estará disponible para su uso en [http://localhost:3000](http://localhost:3000).

---

### 🔑 Credenciales de Prueba por Defecto
El script de semillas (`db:seed`) crea los siguientes usuarios con la contraseña común: `CambiarEstaContraseña123!`

| Nombre de Usuario | Rol del Usuario | Módulos Sugeridos / Propósito |
| :--- | :--- | :--- |
| **`admin`** | Administrador Global | Configurar sucursales y ver estadísticas completas. |
| **`branch_admin`** | Administrador de Sucursal | Configuración del local Norte, staff e inventario. |
| **`event_admin`** | Administrador de Evento | Crear eventos, habilitar licores de barra y plantillas. |
| **`entrance_staff`** | Personal de Entrada | Panel de check-in, lector QR en tiempo real y taquilla. |
| **`bar_staff`** | Personal de Barra | Panel del Punto de Venta (POS) rápido para tablet. |

---

## 🛠️ Comandos Útiles de Desarrollo

| Comando | Descripción |
| :--- | :--- |
| **`npm run dev`** | Inicia el servidor de desarrollo local con recarga rápida de Turbopack. |
| **`npm run build`** | Compila la aplicación, genera los tipos de Prisma y valida TypeScript. |
| **`npm run start`** | Levanta la aplicación compilada en producción localmente. |
| **`npm run db:push`** | Sincroniza los cambios locales de `prisma/schema.prisma` a la base de datos real. |
| **`npm run db:seed`** | Inyecta las sucursales, productos y credenciales por defecto. |
| **`npx prisma studio`** | Abre una interfaz web de administración para visualizar y modificar las tablas directamente. |

---

## 🎨 Temas Visuales y Personalización de Sucursales

Cada sucursal creada en el sistema puede personalizar su estética para adaptarse al ambiente físico o logotipo del local:
*   **Configuración en BD:** Las variables de estilo de colores (`primaryColor`, `pageBackgroundColor`, `textColor`, etc.) se guardan por sucursal en la tabla `branches`.
*   **Verne Neon Dark:** El sistema implementa por defecto un tema oscuro premium diseñado específicamente para discotecas ("Verne Neon Dark") que utiliza tonos negros ahumados, desenfoques de backdrop (blur), acentos de colores verdes neón brillantes y tipografía limpia.
*   **Inyección Dinámica:** El componente `BranchThemeProvider` encapsula la interfaz de usuario en el frontend e inyecta dinámicamente las propiedades de estilo CSS basándose en la configuración activa en la base de datos de la sucursal seleccionada.
*   **Forzar Estilo Reset:** En caso de que se configuren combinaciones de colores ilegibles, el panel de sucursales ofrece un botón rápido de "Forzar Estilo" para reestablecer los parámetros de color a los valores estéticos predeterminados de DMT.

---

## 📧 Configuración de Plantilla de Email por Evento
Al registrar un asistente, el sistema genera automáticamente un código QR único (`qrCode`) e inicia un flujo de envío de correo electrónico a través de SMTP configurado dinámicamente **por evento**:
*   **SMTP Dinámico:** Cada evento almacena sus credenciales SMTP en la tabla `events` (Host, Puerto, TLS/SSL, Usuario y Contraseña). Esto evita bloqueos de correo global y permite enviar accesos desde cuentas dedicadas (ej. `popayan@dmt.com`).
*   **Editor de Plantilla:** Los administradores pueden redactar el asunto, preheader, cuerpo y firmas directamente en una interfaz visual interactiva. El servidor procesa variables en tiempo real como `{nombre_evento}`, `{nombre_asistente}`, `{nombre_categoria}` y `{codigo_qr}`.
*   **Generador QR Seguro:** Para garantizar la compatibilidad con dispositivos móviles y clientes de correo estrictos (como Gmail u Outlook), las imágenes QR se generan en el servidor Next.js y se adjuntan en los emails de forma segura, reduciendo las posibilidades de ser marcadas como spam.
