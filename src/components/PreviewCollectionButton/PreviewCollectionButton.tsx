import { forwardRef, useState } from 'react'
import { Button, type ButtonSize } from '~/components/Button'
import { JumpInIcon } from '~/components/Icons'
import { useTranslation } from '~/intl'
import { previewCollection } from '~/lib/explorer'

type Props = {
  collectionId: string
  disabled?: boolean
  size?: ButtonSize
  className?: string
  /** Called once the launch settles: `true` when the desktop explorer opened, `false` when sent to the download page. */
  onLaunch?: (launched: boolean) => void
  'data-testid'?: string
  'data-desktop-only'?: boolean
}

/** Opens the collection in the desktop explorer's preview world. Forwards its ref so a tooltip can anchor to it. */
export const PreviewCollectionButton = forwardRef<Element, Props>(function PreviewCollectionButton(
  { collectionId, disabled, size, onLaunch, ...rest },
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
      size={size}
      disabled={disabled}
      loading={isLaunching}
      onClick={() => {
        setLaunching(true)
        void previewCollection(collectionId)
          .then(launched => onLaunch?.(launched))
          .finally(() => setLaunching(false))
      }}
    >
      {label}
      <JumpInIcon />
    </Button>
  )
})
