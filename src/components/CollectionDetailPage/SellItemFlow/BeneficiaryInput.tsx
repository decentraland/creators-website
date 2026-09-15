import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { Close as CloseIcon, ExpandMore as ChevronIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { useProfile } from '~/hooks/useProfile'
import { type Friend } from '~/lib/friends'
import { isValidAddress } from '~/lib/sales'
import * as S from './SellItemModal.styles'

type Props = {
  /** The chosen address (lowercased), or '' while none is chosen. */
  value: string
  onChange: (address: string) => void
  /** The creator's friends; `undefined` while they load or when they couldn't be loaded. */
  friends: Friend[] | undefined
  isLoadingFriends: boolean
  disabled?: boolean
  placeholder?: string
  /** Rejects an address already used, with this copy under the field. */
  duplicateError?: (address: string) => string | null
  /** Accessible name of the chip's ✕; "Clear beneficiary" unless the chip stands for something else. */
  clearLabel?: string
  testId?: string
}

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/**
 * Pick a payout address: a friend from the list, or any wallet address pasted in. A valid address is
 * taken as soon as it is typed; the chosen one shows as a chip with its avatar and name, if known.
 */
export function BeneficiaryInput({
  value,
  onChange,
  friends,
  isLoadingFriends,
  disabled,
  placeholder,
  duplicateError,
  clearLabel,
  testId = 'beneficiary'
}: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [touched, setTouched] = useState(false)

  const selectedFriend = useMemo(() => friends?.find(friend => friend.address === value), [friends, value])
  // A pasted address that isn't a friend still gets a name and avatar from its profile, when it has one.
  const profile = useProfile(value && !selectedFriend ? value : undefined)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = friends ?? []
    if (!needle) return list
    return list.filter(friend => friend.name.toLowerCase().includes(needle) || friend.address.includes(needle))
  }, [friends, query])

  const trimmed = query.trim()
  const duplicate = isValidAddress(trimmed) ? duplicateError?.(trimmed.toLowerCase()) : null
  const invalid = touched && trimmed !== '' && !isValidAddress(trimmed)
  // Without friends to pick from the field is a plain address input.
  const withFriends = isLoadingFriends || (friends?.length ?? 0) > 0

  function commit(address: string) {
    if (duplicateError?.(address.toLowerCase())) return
    onChange(address.toLowerCase())
    setQuery('')
    setOpen(false)
    setTouched(false)
  }

  function handleInput(next: string) {
    setQuery(next)
    setActive(0)
    setOpen(true)
    if (isValidAddress(next.trim())) commit(next.trim())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      // Keep the dialog open; only the list closes.
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (matches.length === 0) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive(current => (current + delta + matches.length) % matches.length)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const match = open ? matches[active] : undefined
      if (match) commit(match.address)
      else setTouched(true)
    }
  }

  if (value) {
    const name = selectedFriend?.name ?? profile.data?.name ?? shorten(value)
    const avatar = selectedFriend?.avatarUrl ?? profile.data?.avatar?.snapshots?.face256
    return (
      <S.Box data-testid={`${testId}-selected`} data-disabled={disabled || undefined}>
        {avatar ? <S.Avatar src={avatar} alt="" /> : <S.AvatarFallback aria-hidden />}
        <S.ChipName data-testid={`${testId}-name`}>{name}</S.ChipName>
        <S.ChipAddress title={value}>({value})</S.ChipAddress>
        <S.ChipClear
          type="button"
          aria-label={clearLabel ?? t('sell_item_modal.beneficiary.clear')}
          disabled={disabled}
          data-testid={`${testId}-clear`}
          onClick={() => onChange('')}
        >
          <CloseIcon fontSize="small" />
        </S.ChipClear>
      </S.Box>
    )
  }

  return (
    <S.Combo>
      <S.Box data-invalid={invalid || !!duplicate || undefined} data-disabled={disabled || undefined}>
        <input
          type="text"
          role={withFriends ? 'combobox' : undefined}
          aria-expanded={withFriends ? open : undefined}
          aria-controls={withFriends ? listId : undefined}
          aria-autocomplete={withFriends ? 'list' : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder ?? t('sell_item_modal.beneficiary.placeholder')}
          value={query}
          disabled={disabled}
          data-testid={`${testId}-input`}
          onChange={event => handleInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setOpen(false)
            setTouched(true)
          }}
        />
        {withFriends && (
          <S.ComboToggle
            type="button"
            aria-label={t('sell_item_modal.beneficiary.open')}
            aria-expanded={open}
            aria-controls={listId}
            disabled={disabled}
            data-open={open || undefined}
            data-testid={`${testId}-toggle`}
            // Keep the input's focus so the blur doesn't close the list we're opening.
            onMouseDown={event => event.preventDefault()}
            onClick={() => setOpen(current => !current)}
          >
            <ChevronIcon />
          </S.ComboToggle>
        )}
        {withFriends && open && (
          <S.Options role="listbox" id={listId} data-testid={`${testId}-options`}>
            {isLoadingFriends ? (
              <S.OptionNote>
                <S.Spinner aria-hidden />
                {t('sell_item_modal.beneficiary.friends_loading')}
              </S.OptionNote>
            ) : matches.length === 0 ? (
              <S.OptionNote data-testid={`${testId}-no-matches`}>
                {t('sell_item_modal.beneficiary.no_matches')}
              </S.OptionNote>
            ) : (
              matches.map((friend, index) => (
                <S.Option
                  key={friend.address}
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active || undefined}
                  data-testid={`${testId}-option`}
                  onMouseDown={event => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(friend.address)}
                >
                  {friend.avatarUrl ? <S.Avatar src={friend.avatarUrl} alt="" /> : <S.AvatarFallback aria-hidden />}
                  <span>{friend.name}</span>
                  <S.OptionAddress>{shorten(friend.address)}</S.OptionAddress>
                </S.Option>
              ))
            )}
          </S.Options>
        )}
      </S.Box>
      {invalid && <S.ErrorText data-testid={`${testId}-error`}>{t('sell_item_modal.beneficiary.invalid')}</S.ErrorText>}
      {duplicate && <S.ErrorText data-testid={`${testId}-error`}>{duplicate}</S.ErrorText>}
    </S.Combo>
  )
}
