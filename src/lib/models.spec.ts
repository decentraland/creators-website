import { describe, expect, it } from 'vitest'
import { getEmoteMetrics } from './models'

const gltf = (armatures: string[]) =>
  ({
    scene: { children: armatures.map(name => ({ name, children: [] })) },
    animations: [{ duration: 1, tracks: [] }]
  }) as unknown as Parameters<typeof getEmoteMetrics>[0]

describe('getEmoteMetrics', () => {
  it('rejects a social emote', () => {
    expect(() => getEmoteMetrics(gltf(['Armature', 'Armature_Other']))).toThrow(/emote_social_unsupported/)
  })

  it('reads a plain emote with a prop', () => {
    expect(getEmoteMetrics(gltf(['Armature', 'Armature_Prop']))).toMatchObject({ props: 1, additionalArmatures: 0 })
  })
})
