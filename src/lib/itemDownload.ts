// "Download item": every stored file of an item, zipped the way the importer accepts it back.
import JSZip from 'jszip'
import { fetchItemContents } from '~/lib/builder'
import { THUMBNAIL_PATH, getModelFileNameFromSubfolder, isImageFile, isModelFile } from './itemFiles'
import { BodyShapeType, IMAGE_PATH, VIDEO_PATH, type Item } from './items'
import { downloadBlob } from './navigation'

const MALE_FOLDER = `${BodyShapeType.MALE}/`
const FEMALE_FOLDER = `${BodyShapeType.FEMALE}/`
const ITEM_FILES = [THUMBNAIL_PATH, IMAGE_PATH, VIDEO_PATH]

/** The name the importer gives a root-level file: it flattens the models and images of a zip without body shape folders. */
function getImportedName(path: string): string {
  return (isModelFile(path) || isImageFile(path) ? getModelFileNameFromSubfolder(path) : path).toLowerCase()
}

/**
 * Maps each stored path to its path in the zip: when both body shapes hold the same files, they fold into the root
 * instead of shipping twice. `contents` is the item's path → hash map.
 */
function getItemZipPaths(contents: Record<string, string>): Record<string, string> {
  const paths = Object.keys(contents)
  const male = paths.filter(path => path.startsWith(MALE_FOLDER)).map(path => path.slice(MALE_FOLDER.length))
  const femaleCount = paths.filter(path => path.startsWith(FEMALE_FOLDER)).length
  // Names are compared the way a case-insensitive file system and the importer see them, so no folded file lands
  // on the item's own files or on another folded one.
  const taken = new Set([...ITEM_FILES, ...paths.filter(path => !path.includes('/')).map(path => path.toLowerCase())])
  const fold =
    male.length > 0 &&
    male.length === femaleCount &&
    male.every(path => {
      const name = getImportedName(path)
      if (taken.has(name) || contents[MALE_FOLDER + path] !== contents[FEMALE_FOLDER + path]) return false
      taken.add(name)
      return true
    })
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
