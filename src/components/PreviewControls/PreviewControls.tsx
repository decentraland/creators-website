import { lazy, Suspense, type ComponentProps } from 'react'
import type { EmoteControls as EmoteControlsComponent } from 'decentraland-ui2/dist/components/WearablePreview/EmoteControls'
import type { TranslationControls as TranslationControlsComponent } from 'decentraland-ui2/dist/components/WearablePreview/TranslationControls'

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

const TranslationControlsLazy = lazy(async () => {
  const [{ TranslationControls }, { CssVarsProvider, theme }] = await Promise.all([
    import('decentraland-ui2/dist/components/WearablePreview/TranslationControls'),
    loadTheme()
  ])
  return {
    default: (props: ComponentProps<typeof TranslationControlsComponent>) => (
      <CssVarsProvider theme={theme}>
        <TranslationControls {...props} />
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

export function TranslationControls(props: ComponentProps<typeof TranslationControlsComponent>) {
  return (
    <Suspense fallback={null}>
      <TranslationControlsLazy {...props} />
    </Suspense>
  )
}
