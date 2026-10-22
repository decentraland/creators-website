import { forwardRef, useState } from 'react'
import { Button, type ButtonSize } from '~/components/Button'
import { JumpInIcon } from '~/components/Icons'
import { useTranslation } from '~/intl'
import { previewCollection } from '~/lib/explorer'

type Props = {
  collectionId: string
  disabled?: boolean
  size?: ButtonSize
  /** A square glyph-only button carrying the label as `aria-label`. */
  iconOnly?: boolean
  /** Shorter visible text for tight spots; the full label stays as `aria-label`. */
  label?: string
  className?: string
  /** Called once the launch settles: `true` when the desktop explorer opened, `false` when sent to the download page. */
  onLaunch?: (launched: boolean) => void
  'data-testid'?: string
  'data-desktop-only'?: boolean
}

/** Opens the collection in the desktop explorer's preview world. Forwards its ref so a tooltip can anchor to it. */
export const PreviewCollectionButton = forwardRef<Element, Props>(function PreviewCollectionButton(
  { collectionId, disabled, size, iconOnly, label: shortLabel, onLaunch, ...rest },
  ref
) {
  const { t } = useTranslation()
  const [isLaunching, setLaunching] = useState(false)
  const label = t('preview_collection_button.label')

  return (
    <Button
      {...rest}
      ref={ref}
      type="button"
      variant="dark"
      size={iconOnly ? 'icon' : size}
      disabled={disabled}
      loading={isLaunching}
      aria-label={iconOnly || shortLabel ? label : undefined}
      onClick={() => {
        setLaunching(true)
        void previewCollection(collectionId)
          .then(launched => onLaunch?.(launched))
          .finally(() => setLaunching(false))
      }}
    >
      {!iconOnly && (shortLabel ?? label)}
      <JumpInIcon />
    </Button>
  )
})
