// Host-facing side effects (see CONVENTIONS.md): the one place the app opens URLs outside the SPA.

/** Opens an external site in a new tab. */
export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Hands a custom-scheme URL (e.g. `decentraland://`) to the OS in the current tab. */
export function openProtocolLink(url: string): void {
  window.location.assign(url)
}

/** How long the blob URL outlives the click; some browsers start the download asynchronously. */
const DOWNLOAD_URL_TTL_MS = 60_000

/** Saves a blob to the user's downloads. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_TTL_MS)
}
