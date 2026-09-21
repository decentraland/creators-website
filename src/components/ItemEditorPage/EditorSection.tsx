import { useState, type ReactNode } from 'react'
import { ExpandMore as ChevronIcon } from '@mui/icons-material'
import { Tooltip } from '~/components/Tooltip'
import * as S from './ItemEditorPage.styles'

type Props = {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  /** Glyph drawn before the title. */
  icon?: ReactNode
  /** Header shows only the glyph (collapsed sidebar); the title stays as its accessible name. */
  iconOnly?: boolean
  testId: string
}

/** A collapsible surface with an uppercase title, the inspector's container format. */
export function EditorSection({ title, children, defaultOpen = true, icon, iconOnly = false, testId }: Props) {
  const [isOpen, setOpen] = useState(defaultOpen)
  const header = (
    <S.SectionHeader
      type="button"
      aria-expanded={isOpen}
      aria-label={iconOnly ? title : undefined}
      data-icon-only={iconOnly || undefined}
      data-testid={`${testId}-toggle`}
      onClick={() => setOpen(open => !open)}
    >
      {icon && <S.SectionIcon aria-hidden>{icon}</S.SectionIcon>}
      {!iconOnly && <S.SectionTitle>{title}</S.SectionTitle>}
      {!iconOnly && <ChevronIcon data-chevron fontSize="small" />}
    </S.SectionHeader>
  )
  return (
    <S.Section data-testid={testId} data-open={isOpen || undefined}>
      {iconOnly ? (
        <Tooltip content={title} placement="right" asChild testId={`${testId}-tooltip`}>
          {header}
        </Tooltip>
      ) : (
        header
      )}
      {isOpen && <S.SectionBody data-testid={`${testId}-body`}>{children}</S.SectionBody>}
    </S.Section>
  )
}
