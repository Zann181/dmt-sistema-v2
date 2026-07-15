import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { prisma } from "@/infrastructure/database/prisma"
import { verifyPassword } from "@/infrastructure/crypto"
import { IdentityService } from "@/domains/identity/services/IdentityService"

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || "development-fallback-secret-at-least-32-characters-long-key-dmt",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          console.warn("[AUTH] Intento de ingreso con credenciales vacías o incompletas.")
          return null
        }
        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
          include: { branchMemberships: true, eventAssignments: true },
        })
        if (!user) {
          console.warn(`[AUTH ERROR] Usuario no encontrado: '${credentials.username}'`)
          return null
        }
        if (!user.isActive) {
          console.warn(`[AUTH ERROR] Intento de acceso para usuario inactivo: '${credentials.username}'`)
          return null
        }
        const valid = await verifyPassword(credentials.password as string, user.passwordHash)
        if (!valid) {
          console.warn(`[AUTH ERROR] Contraseña incorrecta para el usuario: '${credentials.username}'`)
          return null
        }
        console.log(`[AUTH SUCCESS] Usuario autenticado con éxito: '${user.username}' (ID: ${user.id})`)
        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isSuperuser: user.isSuperuser,
          isGlobalAdmin: user.isGlobalAdmin,
        } as any
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        if (!profile?.email || !profile?.email_verified) {
          console.warn("[AUTH ERROR] Intento de ingreso con cuenta de Google no verificada o sin correo.")
          return false
        }
        
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
        })
        
        if (!existingUser) {
          // Generar un nombre de usuario único basado en el correo
          const baseUsername = profile.email.split("@")[0].substring(0, 30)
          let username = baseUsername
          let counter = 1
          
          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}${counter}`
            counter++
          }
          
          console.log(`[AUTH REGISTRATION] Auto-registrando nuevo usuario de Google: ${profile.email}`)
          await prisma.user.create({
            data: {
              username,
              email: profile.email,
              firstName: profile.given_name || "",
              lastName: profile.family_name || "",
              passwordHash: "oauth-managed-account",
              isActive: true,
              isSuperuser: false,
              isGlobalAdmin: false,
            },
          })
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = user.email
          ? await prisma.user.findUnique({ where: { email: user.email } })
          : await prisma.user.findUnique({ where: { id: user.id } })

        if (dbUser) {
          token.userId = dbUser.id
          token.username = dbUser.username
          token.isSuperuser = dbUser.isSuperuser
          token.isGlobalAdmin = dbUser.isGlobalAdmin
          
          const firstBranch = await prisma.branchMembership.findFirst({
            where: { userId: dbUser.id, isActive: true },
            orderBy: { createdAt: "asc" },
          })
          token.activeBranchId = firstBranch?.branchId ?? null
          token.activeBranchRole = firstBranch?.role ?? null
          token.activeEventId = null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const t = token as any
        
        // Fetch fresh user data from DB to prevent stale JWT permissions
        const dbUser = await prisma.user.findUnique({
          where: { id: t.userId as string },
          include: { 
            branchMemberships: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
            eventAssignments: { where: { isActive: true }, orderBy: { createdAt: "asc" } }
          }
        })

        if (!dbUser || !dbUser.isActive) {
          // Si el usuario fue eliminado o desactivado
          session.user.permissions = IdentityService.buildPermissionFlags(null, false)
          return session
        }

        const firstBranch = dbUser.branchMemberships[0]
        const firstEvent = dbUser.eventAssignments[0]
        
        session.user.id = dbUser.id
        session.user.username = dbUser.username
        session.user.isSuperuser = dbUser.isSuperuser
        session.user.isGlobalAdmin = dbUser.isGlobalAdmin
        session.user.activeBranchId = firstBranch?.branchId ?? firstEvent?.branchId ?? null
        session.user.activeBranchRole = firstBranch?.role ?? firstEvent?.role ?? null
        session.user.activeEventId = null
        
        session.user.permissions = IdentityService.buildPermissionFlags(
          session.user.activeBranchRole,
          dbUser.isSuperuser || dbUser.isGlobalAdmin
        )
      }
      return session
    },
  },
  cookies: {
    sessionToken: {
      name: "dmt-session",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
