import { hasEmptyModelMetrics, type ItemMetrics } from './items'

type Primitive = { indices?: number; mode?: number; attributes?: { POSITION?: number } }
type Gltf = {
  nodes?: { mesh?: number; name?: string }[]
  meshes?: { name?: string; primitives?: Primitive[] }[]
  accessors?: { count?: number }[]
  materials?: unknown[]
  textures?: unknown[]
}

const GLB_MAGIC = 0x46546c67
const isCollider = (name?: string) => !!name && name.toLowerCase().includes('collider')

const TRIANGLES = 4
const TRIANGLE_STRIP = 5
const TRIANGLE_FAN = 6

/** Points and lines draw no triangles; a strip or a fan shares vertices between them. */
function countTriangles(mode: number, vertices: number): number {
  if (mode === TRIANGLES) return Math.floor(vertices / 3)
  if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) return Math.max(vertices - 2, 0)
  return 0
}

async function readGltf(file: Blob): Promise<Gltf> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const isGlb = bytes.byteLength >= 20 && view.getUint32(0, true) === GLB_MAGIC
  const json = isGlb ? bytes.subarray(20, 20 + view.getUint32(12, true)) : bytes
  return JSON.parse(new TextDecoder().decode(json)) as Gltf
}

/**
 * Counts a model's render metrics from its glTF JSON, without rendering it; colliders are left out, as the preview
 * does, and materials and textures are the ones the file declares, used or not. Null when the file can't be read or
 * has no geometry.
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
      const vertices = accessor === undefined ? 0 : (gltf.accessors?.[accessor]?.count ?? 0)
      triangles += countTriangles(primitive.mode ?? TRIANGLES, vertices)
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
