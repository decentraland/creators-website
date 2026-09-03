// Host-facing side effects (see CONVENTIONS.md): the one place the app opens URLs outside the SPA.

/** Opens an external site in a new tab. */
export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Hands a custom-scheme URL (e.g. `decentraland://`) to the OS in the current tab. */
export function openProtocolLink(url: string): void {
  window.location.assign(url)
}
