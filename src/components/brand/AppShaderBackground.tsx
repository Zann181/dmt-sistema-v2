"use client"

import { useEffect, useState } from "react"
import { SilkShaderBackground } from "./SilkShaderBackground"

// Fondo estático (un solo cuadro del shader Silk) para toda la app, con la paleta
// de la sucursal: negro -> tonos oscuros del color primario. No cambia colores ni estilo.
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function AppShaderBackground({ scope = "page" }: { scope?: "page" | "panel" }) {
  const [colors, setColors] = useState<number[] | null>(null)

  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary")
    const rgb = hexToRgb(raw) ?? [0.224, 1, 0.078] // #39ff14 por defecto
    const k = [0, 0.03, 0.08, 0.16]
    setColors(k.flatMap((f) => rgb.map((c) => c * f)))
  }, [])

  if (!colors) return null
  return (
    <div
      className={
        scope === "page"
          ? "fixed inset-0 -z-10 pointer-events-none"
          : "absolute inset-0 -z-10 pointer-events-none overflow-hidden opacity-60"
      }
      aria-hidden
    >
      <SilkShaderBackground animated={false} colors={colors} />
    </div>
  )
}
