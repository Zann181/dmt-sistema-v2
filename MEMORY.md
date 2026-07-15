# SEMANTIC GRAPH
[F:prisma/schema.prisma]->[M:User]:defines
[F:prisma/schema.prisma]->[M:Branch]:defines
[F:prisma/schema.prisma]->[M:Event]:defines
[F:prisma/schema.prisma]->[M:Attendee]:defines
[F:prisma/schema.prisma]->[M:Product]:defines
[F:prisma/schema.prisma]->[M:BarSale]:defines
[F:prisma/schema.prisma]->[M:CashMovement]:defines
[F:prisma/schema.prisma]->[M:StockMovement]:defines
[F:src/infrastructure/database/prisma.ts]->[R:PrismaClient]:imports
[F:src/infrastructure/database/prisma.ts]->[F:prisma/schema.prisma]:queries
[F:src/lib/auth.ts]->[R:PrismaClient]:queries

## TODO/STATE
- Config local DB on localhost:1605/DMT.
- Modify prisma.ts disable SSL for localhost/127.0.0.1.
- Push schema to local DB.
- Seed DB with test users + branch.
- Remove hardcoded cloud Supabase string from fix-db.js, use env var.
- Wrap auth() calls in try-catch in requireAuth guard and LoginPage to gracefully catch JWTSessionError.
- Redesign login form to a minimalist neon-green cyberpunk theme and remove Google provider options.
- Adjusted BranchThemeProvider and layout.tsx to use white text for titles and standard neutral colors, leaving green only for accents/buttons.
- Repositioned theme restore card in SucursalesClient modal to solve horizontal button squishing/overlap, styling buttons with high contrast bold text.
- Relocated session details (BranchSwitcher, EventSwitcher, User info) to the bottom of the sidebar, styling them to be very compact and hidden on collapse.
- Removed the top header bar completely to maximize vertical space. Integrated expand/collapse controls inside the sidebar header, added a mobile floating toggle button, and docked the DMT logo alongside the Logout ("Salir") button at the very bottom of the sidebar.
- Added inline "+ Nueva Categoría" creation button and modal directly in the "Registrar Nuevo Asistente" and "Editar Asistente" forms in the Entrance (`/entrada`) panel, enabling administrators to easily add and auto-select new categories on the fly.
- Fixed mobile branch logo rendering in BranchLogoHeader.tsx by refining the SVG detection regex to support prologues/comments, and using a descendant selector with forced dimensions to ensure correct scaling.
- Formatted the active user's name in DashboardShell.tsx to start with a capital letter (Title Case) and configured attendee names to be saved in Title Case when created or edited in the entrance panel.
- Refactored the Check-In API and page.tsx to detect duplicate scans (already checked in status), pausing the camera scanner and displaying a locked modal warning showing entry date/time and attendee details. The modal requires clicking "Aceptar" to resume scanner and continue.
- Increased the inline QR code dimensions in ticket email templates from 160px to 260px inside EmailService.ts, making the ticket QR code significantly larger and easier to scan from screen/paper.
- Fixed input backgrounds in the Edit Attendee form by correcting an invalid Tailwind class (bg-zinc-955) to bg-zinc-950, restoring a solid black background. Added onBlur events to format attendee names to Title Case instantly as the user finishes typing.
- Implemented a client-side image compression and SVG wrapping utility in src/shared/utils/image.ts. When uploading any image type (PNG, JPG, WebP, SVG) for branch logos or event flyers, it resizes the image (max 150px for logos, 600px for flyers), compresses it to WebP format (which preserves transparency and is extremely light), and wraps it inside an SVG container. This ensures no raw PNGs are saved to the database, resulting in a dramatic size reduction of database entries and instant web loading times.
- Completely removed the RealtimeIndicator component ("Desconectado" red dot) from the entrance scan page at the user's request.
- Fixed broken email template logo, watermark, and flyer rendering on mobile devices by making EmailService.compileTemplate asynchronous and parsing SVGs at compile-time: if the SVG wraps an image, it extracts the raw WebP/PNG buffer directly; if it is a pure vector SVG, it renders it to PNG on-the-fly via sharp. This guarantees correct image display on all email clients.
- Created a dynamic flyer PNG downloader route at /api/events/[id]/flyer.png that parses the database flyer (SVG wrapper, dataUri, or URL) and serves it directly as a high-quality PNG download file.
- Updated handleWhatsAppShare in entrada/page.tsx to remove the unnecessary "🔑 Código QR: ..." text line and added dedicated download links for both the attendee QR code (PNG) and the event flyer (PNG document).
- Added a gorgeous live WhatsApp Message Preview mockup card below the Email Template Preview inside the Eventos configuration page, showing how the WhatsApp message bubble will render for attendees in real-time.
- Designed a complete tickets entry dashboard in /entrada containing cyberpunk metric cards (Total Income, Today's Income, Total Registered, Checked-In vs Pending progress bar) and an interactive categories details table displaying registrations, check-ins, remaining, check-in percentage, and total money entered per category in real-time.
- Added a `stats=true` filter to the `/api/attendees` route to compute aggregated tickets data in the database and server for the entries dashboard.
- Integrated inline category editing: added a `✏️ Modificar` button next to `+ Nueva Categoría` in both Add/Edit attendee forms (visible only when a category is selected), allowing managers to update category name, price, consumptions, and description, updating all dropdown values and dashboard numbers instantly on save via a new PATCH endpoint.
- Fixed a security UI leak in `DashboardOverview.tsx` where users assigned only the ENTRANCE role (accessAttendees=true, accessSales=false) could still click the "Barra & POS" and "Vista General" tabs and view financial bar sales data. Tabs are now conditionally rendered based on `permissions.accessSales` and `permissions.accessAttendees`, defaulting securely to the allowed tab.
