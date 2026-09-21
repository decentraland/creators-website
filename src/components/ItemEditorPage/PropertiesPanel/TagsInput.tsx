import { useState, type KeyboardEvent } from 'react'
import { Close as RemoveIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import * as S from '../ItemEditorPage.styles'

type Props = {
  tags: string[]
  disabled?: boolean
  onChange: (tags: string[]) => void
  testId?: string
}

/** Chip list plus a text field: Enter or comma adds a tag, Backspace on an empty field removes the last. */
export function TagsInput({ tags, disabled = false, onChange, testId = 'tags-input' }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  function commit() {
    const next = value.trim()
    setValue('')
    if (next) onChange([...tags, next])
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && value === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <S.Field as="div">
      <S.Chips data-testid={testId}>
        {tags.map(tag => (
          <S.TagChip key={tag} data-testid={`${testId}-tag`}>
            {tag}
            <button
              type="button"
              aria-label={t('item_editor.tags.remove', { tag })}
              disabled={disabled}
              data-testid={`${testId}-remove-${tag}`}
              onClick={() => onChange(tags.filter(candidate => candidate !== tag))}
            >
              <RemoveIcon sx={{ fontSize: 14 }} />
            </button>
          </S.TagChip>
        ))}
      </S.Chips>
      <S.TextInput
        value={value}
        placeholder={t('item_editor.tags.placeholder')}
        maxLength={32}
        aria-label={t('item_editor.tags.title')}
        disabled={disabled}
        data-testid={`${testId}-field`}
        onChange={event => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
    </S.Field>
  )
}
