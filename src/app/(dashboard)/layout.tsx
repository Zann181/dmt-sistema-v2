import { requireAuth } from "@/shared/guards/requireAuth"
import { redirect } from "next/navigation"
import { BranchSwitcher } from "@/components/features/branches/BranchSwitcher"
import { EventSwitcher } from "@/components/features/branches/EventSwitcher"
import { BranchLogoHeader } from "@/components/features/branches/BranchLogoHeader"
import { LayoutDashboard, Store, Calendar, Users, ShoppingCart, Beer, LogOut, QrCode, Search, UserPlus } from "lucide-react"
import Link from "next/link"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, response } = await requireAuth()
  if (response || !session) {
    redirect("/login")
  }

  const p = session.user.permissions

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <header className="h-16 border-b bg-card border-border flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-6">
          <BranchLogoHeader />
          <div className="flex items-center gap-2">
            <BranchSwitcher />
            <EventSwitcher />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{session.user.firstName || session.user.username}</span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-sidebar border-r border-border overflow-y-auto shrink-0 flex flex-col">
          <nav className="p-4 flex-1 space-y-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
              <LayoutDashboard size={18} /> Inicio
            </Link>
            
            {p.manageBranchConfig && (
              <Link href="/sucursales" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <Store size={18} /> Sucursales
              </Link>
            )}

            {(session.user.isSuperuser || session.user.isGlobalAdmin) && (
              <Link href="/usuarios" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <Users size={18} /> Usuarios
              </Link>
            )}
            
            {p.manageEventsConfig && (
              <Link href="/eventos" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <Calendar size={18} /> Eventos
              </Link>
            )}

            {p.accessAttendees && (
              <div className="group relative">
                <Link href="/entrada?mode=search" className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                  <div className="flex items-center gap-3">
                    <Users size={18} /> Entrada
                  </div>
                  <span className="text-[10px] text-muted-foreground group-hover:rotate-180 transition-transform select-none">▼</span>
                </Link>
                <div className="hidden group-hover:block pl-6 mt-1 space-y-1">
                  <Link href="/entrada?mode=scan&fullscreen=true" target="_blank" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                    <QrCode size={12} /> Escáner QR
                  </Link>
                  <Link href="/entrada?mode=search" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                    <Search size={12} /> Búsqueda Manual
                  </Link>
                  <Link href="/entrada?mode=add" className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                    <UserPlus size={12} /> Agregar Asistente
                  </Link>
                </div>
              </div>
            )}

            {p.accessCatalog && (
              <Link href="/catalogo" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <ShoppingCart size={18} /> Catálogo
              </Link>
            )}

            {p.accessSales && (
              <Link href="/barra" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
                <Beer size={18} /> Barra
              </Link>
            )}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-8 bg-background text-foreground">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
