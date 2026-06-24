import { requireAuth } from "@/shared/guards/requireAuth"
import { redirect } from "next/navigation"
import { BranchSwitcher } from "@/components/features/branches/BranchSwitcher"
import { EventSwitcher } from "@/components/features/branches/EventSwitcher"
import { BranchLogoHeader } from "@/components/features/branches/BranchLogoHeader"
import { LayoutDashboard, Store, Calendar, Users, ShoppingCart, Beer, LogOut } from "lucide-react"
import Link from "next/link"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, response } = await requireAuth()
  if (response || !session) {
    redirect("/login")
  }

  const p = session.user.permissions

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <header className="h-16 border-b bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-6">
          <BranchLogoHeader />
          <div className="flex items-center gap-2">
            <BranchSwitcher />
            <EventSwitcher />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{session.user.firstName || session.user.username}</span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto shrink-0 flex flex-col">
          <nav className="p-4 flex-1 space-y-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <LayoutDashboard size={18} /> Inicio
            </Link>
            
            {p.manageBranchConfig && (
              <Link href="/sucursales" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <Store size={18} /> Sucursales
              </Link>
            )}

            {(session.user.isSuperuser || session.user.isGlobalAdmin) && (
              <Link href="/usuarios" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <Users size={18} /> Usuarios
              </Link>
            )}
            
            {p.manageEventsConfig && (
              <Link href="/eventos" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <Calendar size={18} /> Eventos
              </Link>
            )}

            {p.accessAttendees && (
              <Link href="/entrada" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <Users size={18} /> Entrada
              </Link>
            )}

            {p.accessCatalog && (
              <Link href="/catalogo" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <ShoppingCart size={18} /> Catálogo
              </Link>
            )}

            {p.accessSales && (
              <Link href="/barra" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <Beer size={18} /> Barra
              </Link>
            )}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-8 bg-zinc-50 dark:bg-zinc-950">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
