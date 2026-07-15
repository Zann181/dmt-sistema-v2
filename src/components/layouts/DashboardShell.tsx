"use client"

import React, { useEffect, useState } from "react"
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
  PanelLeftOpen
} from "lucide-react"
import { useUIStore } from "@/stores/uiStore"
import { BranchSwitcher } from "@/components/features/branches/BranchSwitcher"
import { EventSwitcher } from "@/components/features/branches/EventSwitcher"
import { BranchLogoHeader } from "@/components/features/branches/BranchLogoHeader"

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
  const [mounted, setMounted] = useState(false)
  const [isMobileSubmenuOpen, setIsMobileSubmenuOpen] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

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
    return `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 relative group/item cursor-pointer ${
      active 
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm border-l-2 border-primary" 
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    }`
  }

  const collapsed = mounted ? isSidebarCollapsed : false

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground relative">
      {/* Mobile Floating Menu Button (only visible when mobile menu is closed) */}
      {!isSidebarOpenMobile && (
        <button
          onClick={toggleSidebarMobile}
          className="md:hidden fixed bottom-4 right-4 p-3.5 bg-zinc-900 border border-zinc-800 text-white rounded-full shadow-2xl z-50 hover:bg-zinc-800 transition-transform active:scale-95 cursor-pointer"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Mobile Sidebar Backdrop */}
      {mounted && isSidebarOpenMobile && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-30 transition-opacity backdrop-blur-sm"
          onClick={() => setSidebarMobile(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:relative top-0 bottom-0 left-0 z-40 
          flex flex-col bg-sidebar border-r border-border overflow-y-visible shrink-0 h-full
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-16" : "w-64"}
          ${mounted && isSidebarOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
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
        <nav className="p-3 flex-1 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <Link href="/entrada" className={linkClass("/entrada")} title={collapsed ? "Dashboard" : undefined}>
            <LayoutDashboard size={18} className="shrink-0" />
            <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
              Dashboard
            </span>
          </Link>
          {/* Sucursales */}
          {p.manageBranchConfig && (
            <Link href="/sucursales" className={linkClass("/sucursales")} title={collapsed ? "Sucursales" : undefined}>
              <Store size={18} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
                Sucursales
              </span>
            </Link>
          )}

          {/* Usuarios */}
          {(session.user.isSuperuser || session.user.isGlobalAdmin || p.accessAttendees) && (
            <Link href="/usuarios" className={linkClass("/usuarios")} title={collapsed ? "Usuarios" : undefined}>
              <Users size={18} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
                Usuarios
              </span>
            </Link>
          )}
          
          {/* Eventos */}
          {(p.manageEventsConfig || p.accessAttendees) && (
            <Link href="/eventos" className={linkClass("/eventos")} title={collapsed ? "Eventos" : undefined}>
              <Calendar size={18} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
                Eventos
              </span>
            </Link>
          )}

          {/* Entrada Dropdown */}
          {p.accessAttendees && (
            <div className="group relative">
              <div 
                onClick={() => setIsMobileSubmenuOpen(!isMobileSubmenuOpen)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer select-none ${
                  isActive("/entrada") 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-primary" 
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
                title={collapsed ? "Entrada" : undefined}
              >
                <div className="flex items-center gap-3">
                  <Users size={18} className="shrink-0" />
                  <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
                    Entrada
                  </span>
                </div>
                {!collapsed && (
                  <span className={`text-[10px] text-emerald-500/80 transition-transform select-none ${isMobileSubmenuOpen ? "rotate-180" : "md:group-hover:rotate-180"}`}>▼</span>
                )}
              </div>

              {/* Submenu for Expanded Sidebar */}
              {!collapsed && (
                <div className={`pl-6 mt-1 space-y-1 ${isMobileSubmenuOpen ? "block" : "hidden md:group-hover:block"}`}>
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
              )}

              {/* Floating Popover Submenu for Collapsed Sidebar */}
              {collapsed && (
                <div className="absolute left-14 top-0 ml-1 hidden group-hover:flex flex-col bg-sidebar border border-border rounded-md shadow-lg py-1.5 min-w-[160px] z-50 animate-in fade-in slide-in-from-left-2 duration-150">
                  <div className="px-3 py-1 text-xs font-bold text-emerald-500/80 border-b border-border mb-1">
                    Entrada
                  </div>
                  <Link href="/entrada?mode=scan&fullscreen=true" target="_blank" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                    <QrCode size={12} /> Escáner QR
                  </Link>
                  <Link href="/entrada?mode=search" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                    <Search size={12} /> Búsqueda Manual
                  </Link>
                  <Link href="/entrada?mode=add" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                    <UserPlus size={12} /> Agregar Asistente
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Catálogo */}
          {p.accessCatalog && (
            <Link href="/catalogo" className={linkClass("/catalogo")} title={collapsed ? "Catálogo" : undefined}>
              <ShoppingCart size={18} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
                Catálogo
              </span>
            </Link>
          )}

          {/* Barra */}
          {p.accessSales && (
            <Link href="/barra" className={linkClass("/barra")} title={collapsed ? "Barra" : undefined}>
              <Beer size={18} className="shrink-0" />
              <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 hidden" : "opacity-100"}`}>
                Barra
              </span>
            </Link>
          )}
        </nav>

        {/* Docked bottom switcher/user panel */}
        <div className="p-3 border-t border-border bg-black/20 font-mono shrink-0">
          {!collapsed ? (
            <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* User row */}
              <div className="flex items-center justify-between text-[11px] border-b border-zinc-900 pb-1.5 mb-1">
                <span className="text-emerald-500 font-bold uppercase tracking-wider">Usuario:</span>
                <span className="font-bold text-white bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded text-[10px] shadow-sm">
                  {userName}
                </span>
              </div>
              
              {/* Branch switcher row */}
              <div className="space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Sucursal Activa</div>
                <div className="scale-95 origin-left">
                  <BranchSwitcher />
                </div>
              </div>
              
              {/* Event switcher row */}
              <div className="space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Evento Activo</div>
                <div className="scale-95 origin-left">
                  <EventSwitcher />
                </div>
              </div>

              {/* Bottom footer with DMT Logo and Exit Button */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-900 mt-1">
                <div className="scale-85 origin-left">
                  <BranchLogoHeader />
                </div>
                <button 
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-1 px-2 py-1 bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  title="Cerrar Sesión"
                >
                  <LogOut size={10} />
                  <span>Salir</span>
                </button>
              </div>
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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background text-foreground transition-all duration-300">
        <div className="mx-auto max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  )
}



