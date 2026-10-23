import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { ItemType } from '~/lib/items'
import { createDraft, type ItemDraft } from './AddItemsModal.state'

type PreviewProps = { id: string; onLoad?: () => void; onUpdate?: () => void }
const previewProps: PreviewProps[] = []
const getMetrics = vi.fn()
const controller = {
  scene: { getMetrics, getScreenshot: vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo=') },
  emote: { getLength: vi.fn(async () => 0), goTo: vi.fn() }
}

vi.mock('decentraland-ui2', () => {
  function WearablePreview(props: PreviewProps) {
    previewProps.push(props)
    return <iframe id={props.id} title="preview" />
  }
  WearablePreview.createController = vi.fn(() => controller)
  return { WearablePreview }
})

const { DraftProcessor } = await import('./DraftProcessor')

const REAL_METRICS = { triangles: 708, materials: 3, meshes: 5, textures: 4, bodies: 5, entities: 1 }
const EMPTY_SCENE_METRICS = { triangles: 0, materials: 0, meshes: 0, textures: 0, bodies: 0, entities: 1 }

function wearableDraft(): ItemDraft {
  const file = new File([new Blob(['glb'])], 'hat.glb')
  return {
    ...createDraft(file),
    type: ItemType.WEARABLE,
    status: 'ready',
    model: 'hat.glb',
    contents: { 'hat.glb': file }
  }
}

/** Plays the iframe's side of the handshake: the UPDATE with the model goes out, then a LOAD comes back. */
async function iframeLoads() {
  const props = previewProps[previewProps.length - 1]
  await act(async () => {
    props.onUpdate?.()
    props.onLoad?.()
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  previewProps.length = 0
  getMetrics.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('DraftProcessor', () => {
  it('fills the draft with the metrics the preview reports once it has loaded the model', async () => {
    getMetrics.mockResolvedValue(REAL_METRICS)
    const onResult = vi.fn()
    render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={vi.fn()} />)

    await iframeLoads()

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][1]).toMatchObject({ metrics: REAL_METRICS, isAutoThumbnail: true })
  })

  it('ignores a LOAD announced for the empty scene and reads the metrics off the render that follows', async () => {
    getMetrics.mockResolvedValueOnce(EMPTY_SCENE_METRICS).mockResolvedValue(REAL_METRICS)
    const onResult = vi.fn()
    const onError = vi.fn()
    render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={onError} />)

    await iframeLoads()
    expect(onResult).not.toHaveBeenCalled()

    await iframeLoads()
    expect(onError).not.toHaveBeenCalled()
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][1].metrics).toEqual(REAL_METRICS)
  })

  it('does not give up on a model that takes a while to show up in the preview', async () => {
    getMetrics.mockResolvedValueOnce(EMPTY_SCENE_METRICS).mockResolvedValue(REAL_METRICS)
    const onResult = vi.fn()
    const onError = vi.fn()
    render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={onError} />)

    await iframeLoads()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(onError).not.toHaveBeenCalled()

    await iframeLoads()
    expect(onResult.mock.calls[0][1].metrics).toEqual(REAL_METRICS)
  })

  it('fails the draft once when the preview never gets the model in, and ignores anything after that', async () => {
    getMetrics.mockResolvedValue(EMPTY_SCENE_METRICS)
    const onResult = vi.fn()
    const onError = vi.fn()
    render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={onError} />)

    await iframeLoads()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(onError).toHaveBeenCalledTimes(1)

    getMetrics.mockResolvedValue(REAL_METRICS)
    await iframeLoads()
    expect(onResult).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
  })
})
