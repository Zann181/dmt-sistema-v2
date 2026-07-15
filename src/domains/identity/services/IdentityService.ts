import { BranchRole } from "@prisma/client"
import { PermissionFlags } from "@/types/next-auth"

const ALL_PERMISSIONS_TRUE: PermissionFlags = {
  manageBranchConfig: true,
  manageEventsConfig: true,
  manageCategories: true,
  accessAttendees: true,
  accessSales: true,
  accessCatalog: true,
  switchContext: true,
}

const ALL_PERMISSIONS_FALSE: PermissionFlags = {
  manageBranchConfig: false,
  manageEventsConfig: false,
  manageCategories: false,
  accessAttendees: false,
  accessSales: false,
  accessCatalog: false,
  switchContext: false,
}

export class IdentityService {
  static buildPermissionFlags(
    role: BranchRole | null,
    isGlobal: boolean,
  ): PermissionFlags {
    if (isGlobal) return ALL_PERMISSIONS_TRUE
    switch (role) {
      case "BRANCH_ADMIN":
        return { manageBranchConfig: true, manageEventsConfig: true, manageCategories: true, accessAttendees: true, accessSales: true, accessCatalog: true, switchContext: true }
      case "EVENT_ADMIN":
        return { manageBranchConfig: false, manageEventsConfig: true, manageCategories: true, accessAttendees: true, accessSales: true, accessCatalog: false, switchContext: true }
      case "ENTRANCE":
        return { manageBranchConfig: false, manageEventsConfig: false, manageCategories: true, accessAttendees: true, accessSales: false, accessCatalog: false, switchContext: true }
      case "BAR":
        return { manageBranchConfig: false, manageEventsConfig: false, manageCategories: false, accessAttendees: false, accessSales: true, accessCatalog: false, switchContext: true }
      default:
        return ALL_PERMISSIONS_FALSE
    }
  }
}
