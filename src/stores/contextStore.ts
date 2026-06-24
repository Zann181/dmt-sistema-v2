import { create } from "zustand"
import { persist } from "zustand/middleware"

interface ContextStore {
  activeBranchId: string | null
  activeBranchName: string | null
  activeEventId: string | null
  activeEventName: string | null
  setActiveBranch: (id: string, name: string) => void
  setActiveEvent: (id: string, name: string) => void
}

export const useContextStore = create<ContextStore>()(
  persist(
    (set) => ({
      activeBranchId: null,
      activeBranchName: null,
      activeEventId: null,
      activeEventName: null,
      setActiveBranch: (id, name) => set({ activeBranchId: id, activeBranchName: name, activeEventId: null, activeEventName: null }),
      setActiveEvent: (id, name) => set({ activeEventId: id, activeEventName: name }),
    }),
    {
      name: "dmt-context-storage",
    }
  )
)
