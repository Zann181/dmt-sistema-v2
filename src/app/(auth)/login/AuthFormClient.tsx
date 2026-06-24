"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { ShieldAlert, KeyRound, Sparkles, User, Mail, Lock, ArrowRight, UserPlus, CheckCircle } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Usuario o contraseña incorrectos. Por favor, intenta de nuevo.",
  SessionRequired: "Debes iniciar sesión para acceder a esta sección.",
  Configuration: "Error de configuración de autenticación en el servidor.",
  AccessDenied: "Acceso denegado. Asegúrate de iniciar sesión con una cuenta válida.",
}

export function AuthFormClient({ initialError }: { initialError?: string }) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")
  const [errorMsg, setErrorMsg] = useState(initialError ? (ERROR_MESSAGES[initialError] || "Ocurrió un error. Reintenta.") : null)
  const [successMsg, setSuccessMsg] = useState("")
  const [isPending, setIsPending] = useState(false)

  // Login Form State
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  })

  // Register Form State
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  })

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg("")
    setIsPending(true)

    try {
      const result = await signIn("credentials", {
        username: loginForm.username,
        password: loginForm.password,
        redirect: false,
      })

      if (result?.error) {
        setErrorMsg(ERROR_MESSAGES[result.error] || "Usuario o contraseña incorrectos.")
        setIsPending(false)
      } else if (result?.ok) {
        window.location.href = "/dashboard"
      }
    } catch (err: any) {
      setErrorMsg("Ocurrió un error durante el inicio de sesión.")
      setIsPending(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg("")

    if (registerForm.password !== registerForm.confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.")
      return
    }

    setIsPending(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          firstName: registerForm.firstName,
          lastName: registerForm.lastName,
          password: registerForm.password,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Error al registrar la cuenta.")
      }

      setSuccessMsg("¡Cuenta registrada con éxito! Ya puedes iniciar sesión.")
      
      // Auto-prellenar login y cambiar de pestaña
      setLoginForm({
        username: registerForm.username,
        password: "",
      })
      setActiveTab("login")
      
      // Limpiar formulario de registro
      setRegisterForm({
        username: "",
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        confirmPassword: "",
      })
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor.")
    } finally {
      setIsPending(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setErrorMsg(null)
    setSuccessMsg("")
    setIsPending(true)
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch (err) {
      setErrorMsg("Error al iniciar sesión con Google.")
      setIsPending(false)
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-zinc-950 overflow-hidden font-sans text-zinc-100 px-4 py-8">
      {/* Background Decorative Glowing Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md p-1">
        {/* Glow border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur-md opacity-30" />
        
        <div className="relative bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
              {activeTab === "login" ? (
                <KeyRound size={24} className="animate-pulse" />
              ) : (
                <UserPlus size={24} className="animate-pulse" />
              )}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              DMT Sistema v2
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm">
              {activeTab === "login"
                ? "Ingresa tus credenciales para acceder al panel administrativo"
                : "Crea tu cuenta de acceso rápido y seguro"}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-zinc-950/80 p-1 border border-zinc-850 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("login")
                setErrorMsg(null)
                setSuccessMsg("")
              }}
              className={`flex-1 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === "login"
                  ? "bg-zinc-800 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setActiveTab("register")
                setErrorMsg(null)
                setSuccessMsg("")
              }}
              className={`flex-1 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === "register"
                  ? "bg-zinc-800 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Registrarse
            </button>
          </div>

          {/* Success message */}
          {successMsg && (
            <div className="p-3.5 bg-green-500/10 border border-green-500/25 rounded-xl flex items-start gap-2 text-green-400 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle className="shrink-0 mt-0.5" size={16} />
              <div className="text-xs font-semibold leading-relaxed">
                {successMsg}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl flex items-start gap-2 text-red-400 animate-in fade-in slide-in-from-top-2 duration-300">
              <ShieldAlert className="shrink-0 mt-0.5" size={16} />
              <div className="text-xs font-semibold leading-relaxed">
                {errorMsg}
              </div>
            </div>
          )}

          {/* LOGIN TAB */}
          {activeTab === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <User size={12} className="text-indigo-400" /> Usuario
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium text-sm"
                  placeholder="Nombre de usuario"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Lock size={12} className="text-indigo-400" /> Contraseña
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium text-sm"
                  placeholder="••••••••"
                  required
                  disabled={isPending}
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="relative w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-bold text-sm transition-all duration-250 shadow-lg shadow-indigo-900/30 hover:shadow-indigo-900/50 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{isPending ? "Iniciando..." : "Iniciar Sesión"}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            /* REGISTER TAB */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={registerForm.firstName}
                    onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm font-medium"
                    placeholder="Tu nombre"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={registerForm.lastName}
                    onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm font-medium"
                    placeholder="Tu apellido"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <User size={12} className="text-indigo-400" /> Usuario
                </label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm font-medium"
                  placeholder="Nombre de usuario único"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Mail size={12} className="text-indigo-400" /> Correo Electrónico
                </label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm font-medium"
                  placeholder="correo@ejemplo.com"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Lock size={11} className="text-indigo-400" /> Contraseña
                  </label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm font-medium"
                    placeholder="Min 6 carac."
                    required
                    minLength={6}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Lock size={11} className="text-indigo-400" /> Confirmar
                  </label>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-800 focus:border-indigo-500 rounded-lg text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm font-medium"
                    placeholder="Min 6 carac."
                    required
                    minLength={6}
                    disabled={isPending}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="relative w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg font-bold text-sm transition-all duration-250 shadow-lg shadow-purple-900/30 hover:shadow-purple-900/50 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span>{isPending ? "Registrando..." : "Crear Cuenta"}</span>
                <UserPlus size={14} />
              </button>
            </form>
          )}

          {/* SOCIAL SIGN IN DIVIDER */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-zinc-800/80"></div>
            <span className="flex-shrink mx-4 text-zinc-550 text-[10px] uppercase font-bold tracking-widest">O continúa con</span>
            <div className="flex-grow border-t border-zinc-800/80"></div>
          </div>

          {/* GOOGLE SIGN IN BUTTON */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-750 text-zinc-200 hover:text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.45 15.01.75 12 .75c-4.64 0-8.62 2.67-10.53 6.55l3.96 3.07C6.35 7.42 8.95 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.67 2.84c2.14-1.97 3.38-4.88 3.38-8.49z"
              />
              <path
                fill="#FBBC05"
                d="M5.43 14.73c-.22-.66-.35-1.37-.35-2.1s.13-1.44.35-2.1l-3.96-3.07C.54 9.17 0 10.53 0 12s.54 2.83 1.47 4.57l3.96-3.07z"
              />
              <path
                fill="#34A853"
                d="M12 23.25c3.24 0 5.95-1.08 7.93-2.91l-3.67-2.84c-1.02.68-2.33 1.09-3.93 1.09-3.05 0-5.65-2.38-6.57-5.33l-3.96 3.07c1.91 3.88 5.89 6.55 10.53 6.55z"
              />
            </svg>
            <span>Continuar con Google</span>
          </button>

          <div className="text-center text-[10px] text-zinc-500 border-t border-zinc-800/60 pt-4 flex justify-center items-center gap-1.5">
            <Sparkles size={11} className="text-indigo-400" />
            <span>Autenticación de Alta Seguridad (OAuth 2.0 + PKCE)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
