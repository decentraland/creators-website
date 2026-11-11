import { hasEmptyModelMetrics, type ItemMetrics } from './items'

type Primitive = { indices?: number; attributes?: { POSITION?: number } }
type Gltf = {
  nodes?: { mesh?: number; name?: string }[]
  meshes?: { name?: string; primitives?: Primitive[] }[]
  accessors?: { count?: number }[]
  materials?: unknown[]
  textures?: unknown[]
}

const GLB_MAGIC = 0x46546c67
const isCollider = (name?: string) => !!name && name.toLowerCase().includes('collider')

async function readGltf(file: Blob): Promise<Gltf> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const isGlb = bytes.byteLength >= 20 && view.getUint32(0, true) === GLB_MAGIC
  const json = isGlb ? bytes.subarray(20, 20 + view.getUint32(12, true)) : bytes
  return JSON.parse(new TextDecoder().decode(json)) as Gltf
}

/**
 * Counts a model's render metrics from its glTF JSON, without rendering it; colliders are left out, as the preview
 * does. Null when the file can't be read or has no geometry.
 */
export async function countModelMetrics(file: Blob): Promise<ItemMetrics | null> {
  let gltf: Gltf
  try {
    gltf = await readGltf(file)
  } catch {
    return null
  }
  if (!gltf || typeof gltf !== 'object') return null

  let triangles = 0
  let meshes = 0
  for (const node of gltf.nodes ?? []) {
    if (node.mesh === undefined) continue
    const mesh = gltf.meshes?.[node.mesh]
    if (!mesh || isCollider(node.name) || isCollider(mesh.name)) continue
    for (const primitive of mesh.primitives ?? []) {
      const accessor = primitive.indices ?? primitive.attributes?.POSITION
      triangles += Math.floor((accessor === undefined ? 0 : (gltf.accessors?.[accessor]?.count ?? 0)) / 3)
      meshes++
    }
  }

  const metrics: ItemMetrics = {
    triangles,
    materials: gltf.materials?.length ?? 0,
    textures: gltf.textures?.length ?? 0,
    meshes,
    bodies: meshes,
    entities: 1
  }
  return hasEmptyModelMetrics(metrics) ? null : metrics
}
