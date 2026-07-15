/**
 * Compresses any image (PNG, JPG, WebP, SVG) and outputs a lightweight SVG string wrapper.
 * If the image is not an SVG, it is resized and compressed to WebP (preserving transparency) before wrapping,
 * ensuring database records stay extremely light.
 */
export function processImageToSvg(file: File, maxDim: number = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const isSvg = file.type === "image/svg+xml" || file.name.endsWith(".svg")
    const reader = new FileReader()

    if (isSvg) {
      reader.onload = (event) => {
        const text = event.target?.result as string
        // Clean XML prologues and comments
        const cleanSvg = text.trim().replace(/^<\?xml[^>]*\?>/i, "").trim()
        resolve(cleanSvg)
      }
      reader.onerror = () => reject(new Error("Error al leer el archivo SVG"))
      reader.readAsText(file)
    } else {
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        const img = new Image()
        img.onload = () => {
          // Calculate new dimensions preserving aspect ratio
          let w = img.width
          let h = img.height
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w)
              w = maxDim
            } else {
              w = Math.round((w * maxDim) / h)
              h = maxDim
            }
          }

          const canvas = document.createElement("canvas")
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("No se pudo obtener el contexto del canvas"))
            return
          }

          // Draw the image onto the canvas
          ctx.drawImage(img, 0, 0, w, h)

          // Export as compressed WebP (supports transparency, lightweight, no PNG)
          const compressedDataUrl = canvas.toDataURL("image/webp", 0.7)

          // Wrap inside a lightweight SVG string
          const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">
  <image href="${compressedDataUrl}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>
</svg>`
          resolve(svgWrapper)
        }
        img.onerror = () => reject(new Error("Error al procesar la imagen"))
        img.src = dataUrl
      }
      reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"))
      reader.readAsDataURL(file)
    }
  })
}
