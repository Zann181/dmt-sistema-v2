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
        window.location.href = "/"
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
    <div className="relative flex items-center justify-center min-h-screen bg-black overflow-hidden font-mono text-white px-4 py-8">
      {/* Background Decorative Glowing Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-400/20 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md p-1">
        {/* Glow border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-500 to-lime-500 rounded-2xl blur-md opacity-25" />
        
        <div className="relative bg-black border border-emerald-500/30 backdrop-blur-xl rounded-2xl p-6 md:p-8 shadow-[0_0_40px_rgba(16,185,129,0.4)] space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1">
              {activeTab === "login" ? (
                <KeyRound size={24} className="animate-pulse" />
              ) : (
                <UserPlus size={24} className="animate-pulse" />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-widest text-emerald-400 uppercase drop-shadow-[0_0_15px_rgba(52,211,153,0.8)] text-emerald-300">
              DMT Sistema v2
            </h1>
            <p className="text-emerald-400 text-[10px] uppercase tracking-wider font-semibold">
              Ingresa tus credenciales de acceso
            </p>
          </div>

          {/* Tab Switcher (Hidden) */}

          {/* Success message */}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-start gap-2 text-xs font-black text-black  leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle className="shrink-0 mt-0.5" size={14} />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 rounded-lg flex items-start gap-2 text-xs font-semibold leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
              <ShieldAlert className="shrink-0 mt-0.5" size={14} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* LOGIN TAB */}
          {activeTab === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <User size={12} className="text-emerald-400" /> Usuario
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-800 focus:outline-none transition-all font-semibold text-xs"
                  placeholder="Nombre de usuario"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <Lock size={12} className="text-emerald-400" /> Contraseña
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-2 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-800 focus:outline-none transition-all font-semibold text-xs"
                  placeholder="••••••••"
                  required
                  disabled={isPending}
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="relative w-full py-2.5 bg-emerald-500 text-black font-black hover:bg-emerald-400 text-black rounded-lg font-black text-xs uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-300/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
              >
                <span>{isPending ? "Procesando..." : "Iniciar Sesión"}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            /* REGISTER TAB */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={registerForm.firstName}
                    onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-850 focus:outline-none transition-all text-xs font-semibold"
                    placeholder="Tu nombre"
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={registerForm.lastName}
                    onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-850 focus:outline-none transition-all text-xs font-semibold"
                    placeholder="Tu apellido"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <User size={12} className="text-emerald-400" /> Usuario
                </label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  className="w-full px-3 py-1.5 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-800 focus:outline-none transition-all text-xs font-semibold"
                  placeholder="Usuario único"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <Mail size={12} className="text-emerald-400" /> Correo Electrónico
                </label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="w-full px-3 py-1.5 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-800 focus:outline-none transition-all text-xs font-semibold"
                  placeholder="correo@ejemplo.com"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <Lock size={11} className="text-emerald-400" /> Contraseña
                  </label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full px-3 py-1.5 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-800 focus:outline-none transition-all text-xs font-semibold"
                    placeholder="Min 6 carac."
                    required
                    minLength={6}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <Lock size={11} className="text-emerald-400" /> Confirmar
                  </label>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-1.5 bg-black border border-zinc-900 focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/20 rounded-lg text-white placeholder-zinc-800 focus:outline-none transition-all text-xs font-semibold"
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
                className="relative w-full py-2.5 bg-emerald-500 text-black font-black hover:bg-emerald-400 text-black rounded-lg font-black text-xs uppercase tracking-widest transition-all duration-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-300/30 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer"
              >
                <span>{isPending ? "Registrando..." : "Crear Cuenta"}</span>
                <UserPlus size={14} />
              </button>
            </form>
          )}

          <div className="text-center text-[9px] text-zinc-600 border-t border-zinc-900 pt-4 flex justify-center items-center gap-1.5 uppercase tracking-widest font-bold">
            <ShieldAlert size={11} className="text-emerald-500 animate-pulse" />
            <span>ACCESO EXCLUSIVO PERSONAL AUTORIZADO</span>
          </div>
        </div>
      </div>
    </div>
  )
}


