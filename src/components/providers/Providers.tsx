"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useEffect, useState } from "react"
import { Toaster } from "sonner"
import { BranchThemeProvider } from "./BranchThemeProvider"
import { useContextStore } from "@/stores/contextStore"
import { useUIStore } from "@/stores/uiStore"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  // Los stores persistidos usan skipHydration para que el primer render del
  // cliente coincida con el del servidor (sin esto, localStorage se lee
  // antes de que React termine de hidratar y rompe la hidratación). Se
  // hidratan a mano una sola vez, ya montada la app.
  useEffect(() => {
    useContextStore.persist.rehydrate()
    useUIStore.persist.rehydrate()
  }, [])

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <BranchThemeProvider>
          {children}
        </BranchThemeProvider>
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </SessionProvider>
  )
}
