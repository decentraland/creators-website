import { lazy, Suspense, type ComponentProps } from 'react'
import type { EmoteControls as EmoteControlsComponent } from 'decentraland-ui2/dist/components/WearablePreview/EmoteControls'
import type { ZoomControls as ZoomControlsComponent } from 'decentraland-ui2/dist/components/WearablePreview/ZoomControls'

// ui2's preview controls are MUI components: their styles read `theme.spacing()` and the Button
// reads `palette.mode`, and this app mounts no MUI theme. ui2's theme is a CSS-vars theme, so it
// has to go through CssVarsProvider, scoped to these subtrees so ui2's global resets stay out.
const loadTheme = () =>
  Promise.all([import('@mui/material/styles'), import('decentraland-ui2/dist/theme')]).then(
    ([{ Experimental_CssVarsProvider }, { light }]) => ({ CssVarsProvider: Experimental_CssVarsProvider, theme: light })
  )

const EmoteControlsLazy = lazy(async () => {
  const [{ EmoteControls }, { CssVarsProvider, theme }] = await Promise.all([
    import('decentraland-ui2/dist/components/WearablePreview/EmoteControls'),
    loadTheme()
  ])
  return {
    default: (props: ComponentProps<typeof EmoteControlsComponent>) => (
      <CssVarsProvider theme={theme}>
        <EmoteControls {...props} />
      </CssVarsProvider>
    )
  }
})

const ZoomControlsLazy = lazy(async () => {
  const [{ ZoomControls }, { CssVarsProvider, theme }] = await Promise.all([
    import('decentraland-ui2/dist/components/WearablePreview/ZoomControls'),
    loadTheme()
  ])
  return {
    default: (props: ComponentProps<typeof ZoomControlsComponent>) => (
      <CssVarsProvider theme={theme}>
        <ZoomControls {...props} />
      </CssVarsProvider>
    )
  }
})

export function EmoteControls(props: ComponentProps<typeof EmoteControlsComponent>) {
  return (
    <Suspense fallback={null}>
      <EmoteControlsLazy {...props} />
    </Suspense>
  )
}

export function ZoomControls(props: ComponentProps<typeof ZoomControlsComponent>) {
  return (
    <Suspense fallback={null}>
      <ZoomControlsLazy {...props} />
    </Suspense>
  )
}
