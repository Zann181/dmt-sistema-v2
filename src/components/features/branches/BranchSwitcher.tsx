"use client"

import { useQuery } from "@tanstack/react-query"
import { useContextStore } from "@/stores/contextStore"
import { useEffect, useState } from "react"
import { Store, ChevronDown } from "lucide-react"
import { useDropdown } from "./useDropdown"

export function BranchSwitcher() {
  const [mounted, setMounted] = useState(false)
  const { activeBranchId, activeBranchName, setActiveBranch } = useContextStore()
  const { open, setOpen, ref, toggle } = useDropdown()

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.data as { id: string; name: string; logoUrl?: string | null; logoBgColor?: string | null }[]
    },
    enabled: mounted
  })

  const activeBranch = branches?.find(b => b.id === activeBranchId)

  useEffect(() => {
    if (!mounted || !branches || branches.length === 0) return
    // Sin sucursal, o la guardada ya no es visible para este usuario: tomar la primera
    if (!branches.some((b) => b.id === activeBranchId)) {
      setActiveBranch(branches[0].id, branches[0].name)
    }
  }, [mounted, branches, activeBranchId, setActiveBranch])

  if (!mounted || isLoading) return <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded" />

  const getCleanSvg = (logoStr: string) => {
    return logoStr.trim().replace(/^<\?xml[^>]*\?>/i, "").trim()
  }

  const renderLogo = (logoStr: string | null | undefined, logoBg: string | null | undefined, sizeClass: string) => {
    if (!logoStr) return <Store className="text-emerald-500" size={sizeClass === "w-5 h-5" ? 16 : 14} />
    const cleanLogo = getCleanSvg(logoStr)
    const isSvg = cleanLogo.startsWith("<svg")
    const isImg = cleanLogo.startsWith("data:") || cleanLogo.startsWith("http") || cleanLogo.startsWith("/")

    if (!isSvg && !isImg) return <Store className="text-emerald-500" size={sizeClass === "w-5 h-5" ? 16 : 14} />

    return (
      <div 
        className={`${sizeClass} rounded flex items-center justify-center overflow-hidden shrink-0 p-0.5 border border-zinc-200/30`}
        style={{ backgroundColor: logoBg || "#f4f4f5" }}
      >
        {isSvg ? (
          <div 
            className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
            dangerouslySetInnerHTML={{ __html: cleanLogo }}
          />
        ) : (
          <img src={logoStr} alt="Logo" className="max-w-full max-h-full object-contain" />
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-2 max-w-full px-3 py-2 border rounded-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
        {renderLogo(activeBranch?.logoUrl, activeBranch?.logoBgColor, "w-5 h-5")}
        <span className="text-sm font-medium truncate">{activeBranch?.name || activeBranchName || "Seleccionar Sucursal"}</span>
        <ChevronDown size={14} className={`text-emerald-500 ml-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
      <div className="mt-1 w-56 max-w-full max-h-64 overflow-y-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg">
        <div className="py-1">
          {branches?.map((branch) => (
            <button
              key={branch.id}
              type="button"
              onClick={() => {
                if (branch.id !== activeBranchId) setActiveBranch(branch.id, branch.name)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-2 ${activeBranchId === branch.id ? "bg-zinc-50 dark:bg-zinc-900 font-medium" : ""}`}
            >
              {renderLogo(branch.logoUrl, branch.logoBgColor, "w-4 h-4")}
              <span>{branch.name}</span>
            </button>
          ))}
          {(!branches || branches.length === 0) && (
            <div className="px-4 py-2 text-sm text-emerald-500">No hay sucursales</div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}




