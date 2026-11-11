// "Download item": every stored file of an item, zipped the way the importer accepts it back.
import JSZip from 'jszip'
import { fetchItemContents } from '~/lib/builder'
import { type Item } from './items'
import { downloadBlob } from './navigation'

const MALE_FOLDER = 'male/'
const FEMALE_FOLDER = 'female/'

/**
 * Maps each stored path to its path in the zip: when both body shapes hold the same files, they fold into the root
 * instead of shipping twice. `contents` is the item's path → hash map.
 */
export function getItemZipPaths(contents: Record<string, string>): Record<string, string> {
  const paths = Object.keys(contents)
  const male = paths.filter(path => path.startsWith(MALE_FOLDER)).map(path => path.slice(MALE_FOLDER.length))
  const femaleCount = paths.filter(path => path.startsWith(FEMALE_FOLDER)).length
  const fold =
    male.length > 0 &&
    male.length === femaleCount &&
    male.every(
      // A root file of the same name (the thumbnail, the video) must not be overwritten.
      path => !(path in contents) && contents[MALE_FOLDER + path] === contents[FEMALE_FOLDER + path]
    )
  return Object.fromEntries(
    paths.map(path => {
      const folder = fold && [MALE_FOLDER, FEMALE_FOLDER].find(prefix => path.startsWith(prefix))
      return [path, folder ? path.slice(folder.length) : path]
    })
  )
}

export async function buildItemZip(item: Pick<Item, 'contents'>, files: Record<string, Blob>): Promise<Blob> {
  const zipPaths = getItemZipPaths(item.contents)
  const zip = new JSZip()
  for (const [path, blob] of Object.entries(files)) zip.file(zipPaths[path] ?? path, blob)
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
  downloadBlob(await buildItemZip(item, await fetchItemContents(item)), getItemZipName(item))
}
