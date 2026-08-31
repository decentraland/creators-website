/** Up to 5 page numbers centred on the current page. */
export function pageWindow(current: number, pages: number): number[] {
  const size = Math.min(5, pages)
  const start = Math.min(Math.max(1, current - 2), pages - size + 1)
  return Array.from({ length: size }, (_, i) => start + i)
}
