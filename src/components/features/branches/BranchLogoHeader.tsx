"use client"

import { useQuery } from "@tanstack/react-query"
import { useContextStore } from "@/stores/contextStore"
import { useEffect, useState } from "react"

export function BranchLogoHeader() {
  const [mounted, setMounted] = useState(false)
  const { activeBranchId } = useContextStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.data as { id: string; name: string; logoUrl?: string | null; logoBgColor?: string | null }[]
    },
    enabled: mounted
  })

  if (!mounted) {
    return (
      <h1 className="text-xl font-black tracking-tight text-primary">
        DMT
      </h1>
    )
  }

  const activeBranch = branches?.find(b => b.id === activeBranchId)
  const logoUrl = activeBranch?.logoUrl

  if (logoUrl) {
    const cleanLogo = logoUrl.trim().replace(/^<\?xml[^>]*\?>/i, "").trim()
    const isSvg = /<svg/i.test(cleanLogo)
    const isImg = cleanLogo.startsWith("data:") || cleanLogo.startsWith("http") || cleanLogo.startsWith("/")

    if (isSvg || isImg) {
      return (
        <div 
          className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 p-1"
          style={{ backgroundColor: activeBranch?.logoBgColor || "#f4f4f5" }}
        >
          {isSvg ? (
            <div 
              className="w-full h-full flex items-center justify-center [&_svg]:!w-full [&_svg]:!h-full [&_svg]:!max-w-full [&_svg]:!max-h-full"
              dangerouslySetInnerHTML={{ __html: cleanLogo }}
            />
          ) : (
            <img 
              src={logoUrl} 
              alt={activeBranch.name} 
              className="max-w-full max-h-full object-contain" 
            />
          )}
        </div>
      )
    }
  }

  return (
    <h1 className="text-xl font-black tracking-tight text-primary">
      DMT
    </h1>
  )
}

