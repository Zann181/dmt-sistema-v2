import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UIStore {
  isSidebarCollapsed: boolean
  isSidebarOpenMobile: boolean
  toggleSidebarCollapsed: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarMobile: () => void
  setSidebarMobile: (open: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      isSidebarOpenMobile: false,
      toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      toggleSidebarMobile: () => set((state) => ({ isSidebarOpenMobile: !state.isSidebarOpenMobile })),
      setSidebarMobile: (open) => set({ isSidebarOpenMobile: open }),
    }),
    {
      name: "dmt-ui-storage",
      partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed }), // only persist desktop collapsed state
    }
  )
)
