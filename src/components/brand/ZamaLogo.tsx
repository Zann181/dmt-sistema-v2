/* eslint-disable @next/next/no-img-element */
// Logo ZAMA (negro sobre blanco): en tema oscuro se invierte y el fondo se funde con la pantalla.
export function ZamaLogo({ className = "", alt = "ZAMA Solutions" }: { className?: string; alt?: string }) {
  return (
    <img
      src="/zama-logo.webp"
      alt={alt}
      draggable={false}
      className={`select-none pointer-events-none mix-blend-multiply dark:invert dark:mix-blend-screen ${className}`}
    />
  )
}
