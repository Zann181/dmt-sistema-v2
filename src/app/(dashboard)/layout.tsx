import { requireAuth } from "@/shared/guards/requireAuth"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layouts/DashboardShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, response } = await requireAuth()
  if (response || !session) {
    redirect("/login")
  }

  // Cast and verify session/permissions types
  const typedSession = {
    user: {
      username: session.user.username,
      firstName: session.user.firstName || undefined,
      lastName: session.user.lastName || undefined,
      isSuperuser: session.user.isSuperuser || false,
      isGlobalAdmin: session.user.isGlobalAdmin || false,
      permissions: {
        manageBranchConfig: !!session.user.permissions?.manageBranchConfig,
        manageEventsConfig: !!session.user.permissions?.manageEventsConfig,
        accessAttendees: !!session.user.permissions?.accessAttendees,
        accessCatalog: !!session.user.permissions?.accessCatalog,
        accessSales: !!session.user.permissions?.accessSales,
      }
    }
  }

  return (
    <DashboardShell session={typedSession}>
      {children}
    </DashboardShell>
  )
}

