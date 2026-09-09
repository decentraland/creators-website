import { InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { COLLECTION_NAME_MAX_LENGTH } from '~/lib/collections'
import * as S from './CollectionNameInput.styles'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Friendly error copy; replaces the uniqueness hint while set. */
  error?: string | null
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  /** Prefix for the `-input`, `-count`, `-error` and `-hint` test ids. */
  testId: string
}

/** Labeled, length-capped collection name field with the uniqueness hint or an error below it. */
export function CollectionNameInput({ value, onChange, error, disabled, autoFocus, placeholder, testId }: Props) {
  const { t } = useTranslation()
  return (
    <S.Field>
      <S.Label>
        {t('collection_name_input.label')}
        <S.Box data-invalid={error ? true : undefined}>
          <input
            value={value}
            placeholder={placeholder}
            maxLength={COLLECTION_NAME_MAX_LENGTH}
            disabled={disabled}
            autoFocus={autoFocus}
            data-testid={`${testId}-input`}
            onChange={event => onChange(event.target.value)}
          />
          <S.CharCount data-testid={`${testId}-count`}>
            {t('collection_name_input.char_count', { count: value.length, max: COLLECTION_NAME_MAX_LENGTH })}
          </S.CharCount>
        </S.Box>
      </S.Label>
      {error ? (
        <S.ErrorText data-testid={`${testId}-error`}>{error}</S.ErrorText>
      ) : (
        <S.HintText data-testid={`${testId}-hint`}>
          <InfoOutlinedIcon fontSize="inherit" aria-hidden />
          {t('collection_name_input.unique_hint')}
        </S.HintText>
      )}
    </S.Field>
  )
}
