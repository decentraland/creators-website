// "Download item": every stored file of an item, zipped with its original paths.
import JSZip from 'jszip'
import { fetchItemContents } from '~/lib/builder'
import { type Item } from './items'
import { downloadBlob } from './navigation'

export async function buildItemZip(contents: Record<string, Blob>): Promise<Blob> {
  const zip = new JSZip()
  for (const [path, blob] of Object.entries(contents)) zip.file(path, blob)
  return zip.generateAsync({ type: 'blob' })
}

/** "My Hat!" → "my-hat.zip"; falls back to the id when the name has no usable characters. */
export function getItemZipName(item: Item): string {
  const slug = item.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || item.id}.zip`
}

/** Downloads a saved item's files as the zip the importer accepts back. */
export async function downloadItem(item: Item): Promise<void> {
  downloadBlob(await buildItemZip(await fetchItemContents(item)), getItemZipName(item))
}
