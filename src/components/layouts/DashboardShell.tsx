"use client"

import React, { useEffect, useState, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { 
  LayoutDashboard, 
  Store, 
  Calendar, 
  Users, 
  ShoppingCart, 
  Beer, 
  LogOut, 
  QrCode, 
  Search, 
  UserPlus, 
  UserCog, 
  Menu, 
  X, 
  ChevronLeft, 
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useUIStore } from "@/stores/uiStore"
import { useContextStore } from "@/stores/contextStore"
import { BranchSwitcher } from "@/components/features/branches/BranchSwitcher"
import { EventSwitcher } from "@/components/features/branches/EventSwitcher"
import { AppShaderBackground } from "@/components/brand/AppShaderBackground"
import { ZamaLogo } from "@/components/brand/ZamaLogo"
import { BranchLogoHeader } from "@/components/features/branches/BranchLogoHeader"
import { useHasMounted } from "@/shared/hooks/useHasMounted"

// Preferencia del panel de usuario/sucursal/evento. Se guarda en localStorage, y en
// memoria para que el botón siga funcionando si el navegador bloquea el almacenamiento.
const PANEL_STORAGE_KEY = "dmt-sidebar-panel"
const panelListeners = new Set<() => void>()
let panelInMemory: boolean | null = null

function subscribePanel(listener: () => void) {
  panelListeners.add(listener)
  return () => {
    panelListeners.delete(listener)
  }
}

function readPanelOpen() {
  if (panelInMemory !== null) return panelInMemory
  try {
    return localStorage.getItem(PANEL_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function writePanelOpen(open: boolean) {
  panelInMemory = open
  try {
    localStorage.setItem(PANEL_STORAGE_KEY, open ? "1" : "0")
  } catch {}
  panelListeners.forEach((listener) => listener())
}

interface DashboardShellProps {
  children: React.ReactNode
  session: {
    user: {
      username: string
      firstName?: string
      lastName?: string
      isSuperuser: boolean
      isGlobalAdmin: boolean
      permissions: {
        manageBranchConfig: boolean
        manageEventsConfig: boolean
        accessAttendees: boolean
        accessCatalog: boolean
        accessSales: boolean
      }
    }
  }
}

export function DashboardShell({ children, session }: DashboardShellProps) {
  const pathname = usePathname()
  const { 
    isSidebarCollapsed, 
    isSidebarOpenMobile, 
    toggleSidebarCollapsed, 
    toggleSidebarMobile,
    setSidebarMobile
  } = useUIStore()

  // Prevent hydration mismatch for client-persisted state
  const mounted = useHasMounted()
  const [isMobileSubmenuOpen, setIsMobileSubmenuOpen] = useState(false)
  // Panel de usuario/sucursal/evento: plegable (por defecto oculto en PC para ganar espacio)
  const { activeBranchName, activeEventName } = useContextStore()
  const panelOpen = useSyncExternalStore(subscribePanel, readPanelOpen, () => false)
  const togglePanel = () => writePanelOpen(!panelOpen)

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarMobile(false)
  }, [pathname, setSidebarMobile])

  const p = session.user.permissions
  const capitalize = (str: string) => {
    if (!str) return ""
    return str.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  const userName = capitalize(session.user.firstName || session.user.username)

  // Helper to determine if a link is active
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  // Active link classes
  const linkClass = (href: string) => {
    const active = isActive(href)
    return `flex items-center gap-3 px-3 py-2 md:py-1.5 xl:py-2 rounded-md text-sm font-medium transition-colors duration-200 relative group/item cursor-pointer ${
      active 
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm border-l-2 border-primary" 
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    }`
  }

  const collapsed = mounted ? isSidebarCollapsed : false

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground relative">
      <AppShaderBackground />
      {/* Mobile Sidebar Backdrop */}
      {mounted && isSidebarOpenMobile && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="md:hidden fixed inset-0 bg-black/60 z-[45] transition-opacity backdrop-blur-sm"
          onClick={() => setSidebarMobile(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative top-0 bottom-0 left-0 z-50 md:z-40 
          flex flex-col bg-sidebar border-r border-border overflow-y-auto md:overflow-y-visible shrink-0 h-full
          transition-[width,translate] duration-300 ease-in-out
          ${collapsed ? "md:w-16" : "md:w-60 xl:w-64"} w-[82vw] max-w-72
          ${mounted && isSidebarOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Fondo shader muy sutil en el menú */}
        <AppShaderBackground scope="panel" />
        {/* Sidebar Header with Toggle/Collapse Button */}
        <div className="p-3.5 border-b border-border flex items-center justify-between font-mono shrink-0">
          {!collapsed ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
              Menú Principal
            </span>
          ) : (
            <div className="w-1" /> /* Spacer when collapsed */
          )}
          
          {/* Desktop toggle (hidden on mobile) */}
          <button 
            onClick={toggleSidebarCollapsed} 
            className="hidden md:flex p-1.5 rounded-md hover:bg-muted text-emerald-500/80 hover:text-foreground transition-colors cursor-pointer"
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>

          {/* Mobile close button (only visible on mobile) */}
          <button 
            onClick={() => setSidebarMobile(false)} 
            className="md:hidden p-1.5 rounded-md hover:bg-muted text-emerald-500/80 hover:text-foreground transition-colors cursor-pointer"
            title="Cerrar menú"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sidebar Main Navigation Links */}
        <SidebarNav linkClass={linkClass} collapsed={collapsed} p={p} session={session} isMobileSubmenuOpen={isMobileSubmenuOpen} setIsMobileSubmenuOpen={setIsMobileSubmenuOpen} isActive={isActive} />

        {/* Docked bottom switcher/user panel */}
        <SidebarFooter collapsed={collapsed} togglePanel={togglePanel} panelOpen={panelOpen} activeEventName={activeEventName} activeBranchName={activeBranchName} userName={userName} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Marca de agua ZAMA (PC): franja propia arriba, nunca encima de los botones */}
        <div className="hidden md:flex shrink-0 h-7 items-center justify-center pointer-events-none">
          <ZamaLogo className="h-5 w-auto opacity-25" />
        </div>
        {/* Barra superior móvil: menú a la mano, sin botón flotante tapando la barra inferior */}
        <header
          className="md:hidden relative shrink-0 flex items-center gap-3 px-3 h-14 border-b border-border bg-background/90 backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <button
            onClick={toggleSidebarMobile}
            className="h-11 w-11 -ml-1 flex items-center justify-center rounded-full hover:bg-muted active:scale-95 transition cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <ZamaLogo className="absolute left-1/2 -translate-x-1/2 h-7 w-auto opacity-80" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 bg-background text-foreground">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function SidebarLink({ href, label, icon: Icon, collapsed, linkClass }: { href: string; label: string; icon: LucideIcon; collapsed: boolean; linkClass: (href: string) => string }) {
  return (
    <Link href={href} className={linkClass(href)} title={collapsed ? label : undefined}>
      <Icon size={18} className="shrink-0" />
      <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
        {label}
      </span>
    </Link>
  )
}

function SidebarNav({ linkClass, collapsed, p, session, isMobileSubmenuOpen, setIsMobileSubmenuOpen, isActive }: { linkClass: (href: string) => string; collapsed: boolean; p: { manageBranchConfig: boolean; manageEventsConfig: boolean; accessAttendees: boolean; accessCatalog: boolean; accessSales: boolean; }; session: any; isMobileSubmenuOpen: boolean; setIsMobileSubmenuOpen: React.Dispatch<React.SetStateAction<boolean>>; isActive: (href: string) => boolean }) {
  const linkProps = { collapsed, linkClass }

  return (
    <nav className="p-3 flex-1 min-h-[10rem] md:min-h-0 space-y-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(63_63_70)_transparent]">
      <SidebarLink href="/entrada" label="Dashboard" icon={LayoutDashboard} {...linkProps} />
      {p.manageBranchConfig && <SidebarLink href="/sucursales" label="Sucursales" icon={Store} {...linkProps} />}
      {(session.user.isSuperuser || session.user.isGlobalAdmin) && <SidebarLink href="/usuarios" label="Usuarios" icon={Users} {...linkProps} />}
      {(p.manageEventsConfig || p.accessAttendees) && <SidebarLink href="/eventos" label="Eventos" icon={Calendar} {...linkProps} />}
      {p.accessAttendees && <EntradaMenu collapsed={collapsed} isMobileSubmenuOpen={isMobileSubmenuOpen} setIsMobileSubmenuOpen={setIsMobileSubmenuOpen} isActive={isActive} />}
      {p.accessCatalog && <SidebarLink href="/catalogo" label="Catálogo" icon={ShoppingCart} {...linkProps} />}
      {p.accessSales && <SidebarLink href="/barra" label="Barra" icon={Beer} {...linkProps} />}
    </nav>
  )
}

const ENTRADA_LINKS: { href: string; label: string; icon: LucideIcon; target?: string }[] = [
  { href: "/entrada?mode=scan&fullscreen=true", label: "Escáner QR", icon: QrCode, target: "_blank" },
  { href: "/entrada?mode=search", label: "Búsqueda Manual", icon: Search },
  { href: "/entrada?mode=add", label: "Agregar Asistente", icon: UserPlus },
]

function EntradaMenu({ collapsed, isMobileSubmenuOpen, setIsMobileSubmenuOpen, isActive }: { collapsed: boolean; isMobileSubmenuOpen: boolean; setIsMobileSubmenuOpen: React.Dispatch<React.SetStateAction<boolean>>; isActive: (href: string) => boolean }) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-expanded={isMobileSubmenuOpen}
        aria-label={collapsed ? "Entrada" : undefined}
        onClick={() => setIsMobileSubmenuOpen(!isMobileSubmenuOpen)}
        className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2 md:py-1.5 xl:py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer select-none ${
          isActive("/entrada")
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-primary"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        }`}
        title={collapsed ? "Entrada" : undefined}
      >
        <span className="flex items-center gap-3">
          <Users size={18} className="shrink-0" />
          <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
            Entrada
          </span>
        </span>
        {!collapsed && (
          <span aria-hidden="true" className={`text-[10px] text-emerald-500/80 transition-transform select-none ${isMobileSubmenuOpen ? "rotate-180" : "md:group-hover:rotate-180"}`}>▼</span>
        )}
      </button>

      {/* Submenu for Expanded Sidebar */}
      {!collapsed && (
        <div className={`pl-6 mt-1 space-y-1 ${isMobileSubmenuOpen ? "block" : "hidden md:group-hover:block"}`}>
          {ENTRADA_LINKS.map(({ href, label, icon: Icon, target }) => (
            <Link key={href} href={href} target={target} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Icon size={12} /> {label}
            </Link>
          ))}
        </div>
      )}

      {/* Floating Popover Submenu for Collapsed Sidebar */}
      {collapsed && (
        <div className="absolute left-14 top-0 ml-1 hidden group-hover:flex flex-col bg-sidebar border border-border rounded-md shadow-lg py-1.5 min-w-[160px] z-50 animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="px-3 py-1 text-xs font-bold text-emerald-500/80 border-b border-border mb-1">
            Entrada
          </div>
          {ENTRADA_LINKS.map(({ href, label, icon: Icon, target }) => (
            <Link key={href} href={href} target={target} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
              <Icon size={12} /> {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarFooter({ collapsed, togglePanel, panelOpen, activeEventName, activeBranchName, userName }: { collapsed: boolean; togglePanel: () => void; panelOpen: boolean; activeEventName: string | null; activeBranchName: string | null; userName: string }) {
  return (
    <div className="p-3 border-t border-border bg-black/20 font-mono shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!collapsed ? (
            <div className="space-y-2">
              {/* Resumen siempre visible: sucursal · evento + plegar/desplegar + salir */}
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePanel}
                  aria-expanded={panelOpen}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-900 text-left cursor-pointer"
                  title={panelOpen ? "Ocultar panel" : "Ver usuario, sucursal y evento"}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-bold text-white">{activeEventName || "Sin evento"}</span>
                    <span className="block truncate text-[9px] uppercase tracking-wider text-emerald-500">{activeBranchName || userName}</span>
                  </span>
                  {panelOpen ? <ChevronDown size={14} className="shrink-0 text-emerald-500" /> : <ChevronUp size={14} className="shrink-0 text-emerald-500" />}
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="h-8 w-8 shrink-0 flex items-center justify-center bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-md transition-colors cursor-pointer"
                  title="Cerrar Sesión"
                  aria-label="Cerrar Sesión"
                >
                  <LogOut size={13} />
                </button>
              </div>

              {panelOpen && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between text-xs border-b border-zinc-900 pb-1.5">
                    <span className="text-emerald-500 font-bold uppercase tracking-wider">Usuario:</span>
                    <span className="font-bold text-white bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded text-[10px] shadow-sm">
                      {userName}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Sucursal Activa</div>
                    <div className="w-full [&>div>button]:w-full">
                      <BranchSwitcher />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Evento Activo</div>
                    <div className="w-full [&>div>button]:w-full">
                      <EventSwitcher />
                    </div>
                  </div>

                  <p className="text-center text-[9px] text-zinc-600 uppercase tracking-wider font-semibold pt-1">
                    Desarrollado por ZAMA Soluciones
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Collapsed Bottom Options: small logo / exit */
            <div className="flex flex-col items-center gap-3 py-1">
              <div className="scale-75">
                <BranchLogoHeader />
              </div>
              <button 
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-2 bg-red-950/20 border border-red-500/20 hover:bg-red-950/40 text-red-400 rounded-md transition-colors cursor-pointer"
                title="Cerrar Sesión"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
  )
}
