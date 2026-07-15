import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AuthFormClient } from "./AuthFormClient"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  let session = null
  try {
    session = await auth()
  } catch (err) {
    if (err instanceof Error && (err.message.includes("Dynamic server usage") || (err as any).digest === "DYNAMIC_SERVER_USAGE")) {
      throw err;
    }
    console.warn("[AUTH SESSION ERROR] Unable to retrieve session on login page:", err)
  }

  if (session?.user) {
    redirect("/")
  }

  const { error } = await searchParams

  return <AuthFormClient initialError={error} />
}
