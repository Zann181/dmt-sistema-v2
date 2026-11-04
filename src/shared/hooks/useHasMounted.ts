"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * false durante el SSR y la hidratación, true después. Para contenido que depende de
 * estado solo disponible en el navegador, sin el render extra de un useEffect.
 */
export function useHasMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
