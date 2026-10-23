import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { WearableCategory } from '@dcl/schemas'
import { ItemType } from '~/lib/items'
import { createDraft, type ItemDraft } from './AddItemsModal.state'

type PreviewProps = { id: string; onLoad?: () => void; onUpdate?: () => void }
const previewProps: PreviewProps[] = []
const getMetrics = vi.fn()
const getScreenshot = vi.fn()
const renderPosedThumbnail = vi.fn()
const controller = {
  scene: { getMetrics, getScreenshot },
  emote: { getLength: vi.fn(async () => 0), goTo: vi.fn() }
}
const SCREENSHOT = 'data:image/png;base64,iVBORw0KGgo='

vi.mock('decentraland-ui2', () => {
  function WearablePreview(props: PreviewProps) {
    previewProps.push(props)
    return <iframe id={props.id} title="preview" />
  }
  WearablePreview.createController = vi.fn(() => controller)
  return { WearablePreview }
})
vi.mock('~/lib/renderPosedThumbnail', () => ({
  renderPosedThumbnail: (...args: unknown[]) => renderPosedThumbnail(...args)
}))

const { DraftProcessor } = await import('./DraftProcessor')

const REAL_METRICS = { triangles: 708, materials: 3, meshes: 5, textures: 4, bodies: 5, entities: 1 }
const EMPTY_SCENE_METRICS = { triangles: 0, materials: 0, meshes: 0, textures: 0, bodies: 0, entities: 1 }

function wearableDraft(overrides: Partial<ItemDraft> = {}): ItemDraft {
  const file = new File([new Blob(['glb'])], 'hat.glb')
  return {
    ...createDraft(file),
    type: ItemType.WEARABLE,
    status: 'ready',
    model: 'hat.glb',
    contents: { 'hat.glb': file },
    ...overrides
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}

/** Plays the iframe's side of the handshake: the UPDATE with the model goes out, then a LOAD comes back. */
async function iframeLoads() {
  const props = previewProps[previewProps.length - 1]
  await act(async () => {
    props.onUpdate?.()
    props.onLoad?.()
  })
}

async function elapse(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  previewProps.length = 0
  getMetrics.mockReset()
  getScreenshot.mockReset().mockResolvedValue(SCREENSHOT)
  renderPosedThumbnail.mockReset().mockResolvedValue(SCREENSHOT)
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
    await elapse(10_000)
    expect(onError).not.toHaveBeenCalled()

    await iframeLoads()
    expect(onResult.mock.calls[0][1].metrics).toEqual(REAL_METRICS)
  })

  it('still reads the metrics when the real LOAD arrives while the empty-scene read is in flight', async () => {
    const firstRead = deferred<typeof EMPTY_SCENE_METRICS>()
    getMetrics.mockReturnValueOnce(firstRead.promise).mockResolvedValue(REAL_METRICS)
    const onResult = vi.fn()
    render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={vi.fn()} />)

    await iframeLoads()
    await iframeLoads()
    await act(async () => firstRead.resolve(EMPTY_SCENE_METRICS))

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][1].metrics).toEqual(REAL_METRICS)
  })

  it('gives the preview app its boot time: the clock only starts once the model has been sent', async () => {
    getMetrics.mockResolvedValue(REAL_METRICS)
    const onResult = vi.fn()
    const onError = vi.fn()
    render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={onError} />)

    await elapse(40_000)
    expect(onError).not.toHaveBeenCalled()

    await iframeLoads()
    expect(onResult).toHaveBeenCalledTimes(1)
  })

  it('fails the draft once when the preview never gets the model in, and ignores anything after that', async () => {
    getMetrics.mockResolvedValue(EMPTY_SCENE_METRICS)
    const onResult = vi.fn()
    const onError = vi.fn()
    render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={onError} />)

    await iframeLoads()
    await elapse(30_000)
    expect(onError).toHaveBeenCalledTimes(1)

    getMetrics.mockResolvedValue(REAL_METRICS)
    await iframeLoads()
    expect(onResult).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('does not resurrect a failed draft with a result that lands after the time ran out', async () => {
    getMetrics.mockResolvedValue(REAL_METRICS)
    const screenshot = deferred<string>()
    getScreenshot.mockReturnValue(screenshot.promise)
    const onResult = vi.fn()
    const onError = vi.fn()
    const { unmount } = render(<DraftProcessor draft={wearableDraft()} onResult={onResult} onError={onError} />)

    await iframeLoads()
    await elapse(30_000)
    expect(onError).toHaveBeenCalledTimes(1)

    unmount()
    await act(async () => screenshot.resolve(SCREENSHOT))
    expect(onResult).not.toHaveBeenCalled()
  })

  it('keeps the data a processed draft already has when re-rendering its thumbnail for a new pose hangs', async () => {
    getMetrics.mockResolvedValue(REAL_METRICS)
    const onResult = vi.fn()
    const onError = vi.fn()
    const draft = wearableDraft({ category: WearableCategory.HAT })
    const { rerender } = render(<DraftProcessor draft={draft} onResult={onResult} onError={onError} />)
    await iframeLoads()
    expect(onResult).toHaveBeenCalledTimes(1)

    renderPosedThumbnail.mockReturnValue(new Promise(() => {}))
    const processed: ItemDraft = { ...draft, ...onResult.mock.calls[0][1], category: WearableCategory.UPPER_BODY }
    rerender(<DraftProcessor draft={processed} onResult={onResult} onError={onError} />)
    await elapse(30_000)

    expect(onError).not.toHaveBeenCalled()
    expect(onResult).toHaveBeenCalledTimes(2)
    expect(onResult.mock.calls[1][1]).toEqual({ autoThumbnailCategory: WearableCategory.UPPER_BODY })
  })
})
