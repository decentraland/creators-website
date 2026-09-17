// Reads the node tree straight out of a GLB/glTF's JSON chunk (no Three.js): spring bones are named
// `*springbone*` and the physics editor only needs names and parent/child links.
import { isSpringBoneName } from '../glbValidation/constants'

const GLB_MAGIC = 0x46546c67 // 'glTF'
const JSON_CHUNK_TYPE = 0x4e4f534a // 'JSON'
const GLB_HEADER_SIZE = 12
const CHUNK_HEADER_SIZE = 8

export type BoneNode = {
  name: string
  nodeId: number
  type: 'spring' | 'avatar'
  children: number[]
}

type GltfNode = { name?: string; children?: number[] }

/** The glTF JSON of a binary GLB, or of a plain .gltf; null when the bytes are neither. */
export function extractGltfJson(buffer: ArrayBuffer): Record<string, unknown> | null {
  if (buffer.byteLength >= GLB_HEADER_SIZE + CHUNK_HEADER_SIZE) {
    const view = new DataView(buffer)
    if (view.getUint32(0, true) === GLB_MAGIC) {
      const jsonLength = view.getUint32(GLB_HEADER_SIZE, true)
      const chunkType = view.getUint32(GLB_HEADER_SIZE + 4, true)
      const offset = GLB_HEADER_SIZE + CHUNK_HEADER_SIZE
      if (chunkType !== JSON_CHUNK_TYPE || offset + jsonLength > buffer.byteLength) return null
      return parseJson(new Uint8Array(buffer, offset, jsonLength))
    }
  }
  return parseJson(new Uint8Array(buffer))
}

function parseJson(bytes: Uint8Array): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Every node of the model as a bone entry, spring bones flagged by name. */
export function parseSpringBones(buffer: ArrayBuffer): BoneNode[] {
  const json = extractGltfJson(buffer)
  const nodes = json?.nodes
  if (!Array.isArray(nodes)) return []
  return (nodes as GltfNode[]).map((node, index) => {
    const name = node.name ?? `node_${index}`
    return {
      name,
      nodeId: index,
      type: node.name && isSpringBoneName(node.name) ? 'spring' : 'avatar',
      children: node.children ?? []
    }
  })
}
