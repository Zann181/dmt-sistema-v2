import "next-auth"
import { BranchRole } from "@prisma/client"

export interface PermissionFlags {
  manageBranchConfig: boolean
  manageEventsConfig: boolean
  manageCategories: boolean
  accessAttendees: boolean
  accessSales: boolean
  accessCatalog: boolean
  switchContext: boolean
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      firstName: string
      lastName: string
      isSuperuser: boolean
      isGlobalAdmin: boolean
      activeBranchId: string | null
      activeBranchRole: BranchRole | null
      activeEventId: string | null
      permissions: PermissionFlags
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
    username: string
    isSuperuser: boolean
    isGlobalAdmin: boolean
    activeBranchId: string | null
    activeBranchRole: BranchRole | null
    activeEventId: string | null
  }
}
