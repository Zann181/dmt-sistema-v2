"use client"

import { useQuery } from "@tanstack/react-query"
import { useContextStore } from "@/stores/contextStore"
import { useEffect, useState } from "react"

export function BranchThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const { activeBranchId } = useContextStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (activeBranchId) {
      document.cookie = `activeBranchId=${activeBranchId}; path=/; max-age=31536000; SameSite=Lax`
    }
  }, [activeBranchId])

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.data as {
        id: string
        name: string
        primaryColor: string
        secondaryColor: string
        pageBackgroundColor: string
        surfaceColor: string
        panelColor: string
        textColor: string
        titleColor: string
      }[]
    },
    enabled: mounted
  })

  const activeBranch = branches?.find(b => b.id === activeBranchId)

  useEffect(() => {
    if (!mounted || !activeBranch) return

    const bg = activeBranch.pageBackgroundColor || "#f8f9fa"
    
    // Check if luma is dark
    const r = parseInt(bg.slice(1, 3), 16)
    const g = parseInt(bg.slice(3, 5), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const isDark = luma < 140

    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [mounted, activeBranch])

  if (!mounted || !activeBranch) {
    return <>{children}</>
  }

  const primaryColorRaw = activeBranch.primaryColor || "#39ff14"
  const secondaryColorRaw = activeBranch.secondaryColor || "#e9ffe9"
  const backgroundColorRaw = activeBranch.pageBackgroundColor || "#000000"
  const surfaceColorRaw = activeBranch.surfaceColor || "#050505"
  const panelColorRaw = activeBranch.panelColor || "#000000"
  const textColorRaw = activeBranch.textColor || "#ffffff"
  const titleColorRaw = activeBranch.titleColor || "#ffffff"

  const primary = primaryColorRaw === "#102542" ? "#39ff14" : primaryColorRaw
  const secondary = secondaryColorRaw === "#ffffff" ? "#39ff14" : secondaryColorRaw
  const background = backgroundColorRaw === "#f8f9fa" ? "#000000" : backgroundColorRaw
  const surface = surfaceColorRaw === "#ffffff" ? "#050505" : surfaceColorRaw
  const panel = panelColorRaw === "#f0f0f0" ? "#000000" : panelColorRaw
  const textClr = textColorRaw
  const titleClr = titleColorRaw

  // Standard foreground is white/near-white for dark background, zinc-950 for light background
  const isBgDark = (() => {
    if (!background || background.length < 7) return false
    const r = parseInt(background.slice(1, 3), 16)
    const g = parseInt(background.slice(3, 5), 16)
    const b = parseInt(background.slice(5, 7), 16)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 140
  })()

  const foreground = isBgDark ? textClr : "#09090b"
  const cardForeground = isBgDark ? textClr : "#09090b"
  const mutedForeground = isBgDark ? `#a1a1aa` : "#71717a"
  const border = isBgDark ? `${primary}33` : "rgba(0, 0, 0, 0.08)"
  const input = isBgDark ? `${primary}1a` : "rgba(0, 0, 0, 0.04)"
  
  // Custom styling rules to override theme variables
  const cssVariables = `
    :root, .dark {
      --background: ${background} !important;
      --foreground: ${foreground} !important;
      
      --card: ${surface} !important;
      --card-foreground: ${cardForeground} !important;
      
      --popover: ${surface} !important;
      --popover-foreground: ${cardForeground} !important;
      
      --primary: ${primary} !important;
      --primary-foreground: ${isBgDark ? "#000000" : "#ffffff"} !important;
      
      --secondary: ${panel} !important;
      --secondary-foreground: ${foreground} !important;
      
      --muted: ${panel} !important;
      --muted-foreground: ${mutedForeground} !important;
      
      --accent: ${panel} !important;
      --accent-foreground: ${foreground} !important;
      
      --border: ${border} !important;
      --input: ${input} !important;
      --ring: ${primary} !important;
      
      --sidebar: ${surface} !important;
      --sidebar-foreground: ${foreground} !important;
      --sidebar-primary: ${primary} !important;
      --sidebar-primary-foreground: ${isBgDark ? "#000000" : "#ffffff"} !important;
      --sidebar-accent: ${panel} !important;
      --sidebar-accent-foreground: ${foreground} !important;
      --sidebar-border: ${border} !important;
      --sidebar-ring: ${primary} !important;

      /* Overrides for Tailwind classes using indigo to match the active branch theme */
      --color-indigo-50: ${isBgDark ? `${primary}14` : `${primary}08`} !important;
      --color-indigo-100: ${primary}1e !important;
      --color-indigo-200: ${primary}33 !important;
      --color-indigo-300: ${primary}55 !important;
      --color-indigo-400: ${primary} !important;
      --color-indigo-500: ${primary} !important;
      --color-indigo-600: ${primary} !important;
      --color-indigo-650: ${primary} !important;
      --color-indigo-700: ${primary} !important;
      --color-indigo-800: ${primary} !important;
      --color-indigo-900: ${primary} !important;
      --color-indigo-950: ${isBgDark ? `#0a0d0a` : `#f2fcf2`} !important;

      /* Replace tailwind zinc colors with standard neutral values to prevent primary color bleeding */
      --color-zinc-400: ${isBgDark ? `#a1a1aa` : `#a1a1aa`} !important;
      --color-zinc-500: ${isBgDark ? `#71717a` : `#71717a`} !important;
      --color-zinc-600: ${isBgDark ? `#52525b` : `#52525b`} !important;
    }

    h1, h2, h3, h4, h5, h6, .title-text {
      color: ${titleClr} !important;
    }

    ${isBgDark ? `
      body {
        background-attachment: fixed !important;
        background-color: #000000 !important;
        background-image: 
          radial-gradient(ellipse at top, ${primary}20, transparent 60%),
          radial-gradient(ellipse at bottom left, ${panel}80, transparent 60%) !important;
      }

      /* Make layout containers transparent to reveal the blurred background */
      .bg-background, main.bg-background, div.bg-background {
        background-color: transparent !important;
        background-image: none !important;
      }
      
      header.bg-card, header, [class*="bg-card/"] {
        background-color: ${surface}b5 !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
      }
      
      aside.bg-sidebar, aside, [class*="bg-sidebar/"] {
        background-color: ${surface}77 !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
      }
      
      .bg-card, [class*="bg-card"] {
        background-color: ${surface}c8 !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid ${border} !important;
      }
    ` : ""}
  `

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />
      {children}
    </>
  )
}
