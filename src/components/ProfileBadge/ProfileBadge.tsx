import { useProfile } from '~/hooks/useProfile'
import { useTranslation } from '~/intl'
import * as S from './ProfileBadge.styles'

type Props = {
  address: string
  /** Appends "(you)" when this is the signed-in wallet. */
  self?: boolean
  testId?: string
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** A wallet as a face and its Decentraland name, the short address while (or when) there is no profile. */
export function ProfileBadge({ address, self = false, testId = 'profile-badge' }: Props) {
  const { t } = useTranslation()
  const { data: profile } = useProfile(address)
  const face = profile?.avatar?.snapshots?.face256
  const name = profile?.name || shortAddress(address)
  return (
    <S.Badge data-testid={testId} title={address}>
      {face ? <S.Face src={face} alt="" /> : <S.FaceFallback aria-hidden />}
      <S.Name>{name}</S.Name>
      {self && <S.You>{t('profile_badge.you')}</S.You>}
    </S.Badge>
  )
}
