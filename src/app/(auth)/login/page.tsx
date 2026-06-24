import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AuthFormClient } from "./AuthFormClient"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  const { error } = await searchParams

  return <AuthFormClient initialError={error} />
}
