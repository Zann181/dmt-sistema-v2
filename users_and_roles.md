# Usuarios y Roles Predeterminados

Para facilitar el desarrollo, pruebas y control de acceso en producción, se han configurado los siguientes usuarios con sus respectivos roles y credenciales predeterminadas:

## 🔑 Credenciales Predeterminadas (Desarrollo y Demo)

La contraseña para **todos** los usuarios de prueba es: **`CambiarEstaContraseña123!`**

| Usuario | Email | Rol del Sistema | Alcance / Permisos principales |
|---------|-------|-----------------|---------------------------------|
| **`admin`** | `admin@dmt.com` | **Admin Global** | Acceso a todas las sucursales, catálogos, configuraciones globales y auditorías. |
| **`branch_admin`** | `branch@dmt.com` | **Admin Sucursal** | Administrador de la sucursal activa. Administra eventos, productos de catálogo y personal. |
| **`event_admin`** | `event@dmt.com` | **Admin Evento** | Administra la planeación del evento activo. Asigna personal y configura detalles del evento. |
| **`entrance_staff`** | `entrance@dmt.com` | **Personal de Entrada** | Acceso exclusivo al módulo `/entrada` para búsqueda, registro e ingreso de asistentes (check-in). |
| **`bar_staff`** | `bar@dmt.com` | **Personal de Barra** | Acceso exclusivo a la interfaz POS `/barra` para registrar ventas, gestionar carrito y cobros. |

---

## 🛠️ Cómo Asignar Roles desde la Aplicación

Los administradores pueden gestionar y asignar roles al personal a través del flujo integrado en el sistema:

1. **Gestión de Sucursales:** 
   - Ve a la sección **Sucursales** desde el panel lateral.
   - Presiona el botón **Staff** en la tarjeta de la sucursal correspondiente.
2. **Asignación de Roles:**
   - Podrás ver el personal actual y agregar nuevos usuarios ingresando su nombre de usuario, contraseña y asignándoles un rol específico de sucursal (`BRANCH_ADMIN`, `BAR`, `ENTRANCE`, etc.).
3. **Control de Eventos:**
   - Desde la pestaña de personal de la sucursal, puedes asociar o desasociar a un usuario staff a un evento específico para limitar su visibilidad de trabajo al día del evento.
