/**
 * Browser PNG export for a DOM node (cards grid or single card).
 * Uses Canvas + SVG foreignObject — no heavy deps.
 * Animated GIF/WebM is intentionally not supported (would need encoders).
 */

export const ANIMATED_EXPORT_NOTE =
  'PNG only in-browser (no GIF/WebM encoder). Use Copy as HTML for CSS keyframe animations.'

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/**
 * Rasterize an HTMLElement to a PNG blob via SVG foreignObject.
 */
export async function elementToPngBlob(
  element: HTMLElement,
  opts?: { scale?: number; background?: string }
): Promise<Blob> {
  const scale = opts?.scale ?? 2
  const background = opts?.background ?? '#f5f5f4'
  const width = Math.max(1, Math.ceil(element.scrollWidth))
  const height = Math.max(1, Math.ceil(element.scrollHeight))
  const clone = element.cloneNode(true) as HTMLElement
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  // Flatten absolute positioning quirks for rasterization
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.background = background

  const serialized = new XMLSerializer().serializeToString(clone)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="100%" height="100%">
    ${serialized}
  </foreignObject>
</svg>`

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to rasterize cards to PNG'))
      img.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D unavailable')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('PNG encoding failed'))
      }, 'image/png')
    })
    return blob
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export async function downloadElementPng(
  element: HTMLElement,
  filename: string,
  opts?: { scale?: number; background?: string }
): Promise<void> {
  const blob = await elementToPngBlob(element, opts)
  triggerDownload(blob, filename)
}
