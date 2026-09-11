import { useTranslation } from '~/intl'
import * as S from './RequiredPermissions.styles'

type Props = {
  permissions: string[]
  testId?: string
}

const DOCS_URL =
  'https://docs.decentraland.org/creator/scenes-sdk7/kinds-of-projects/scene-metadata#required-permissions'

/** Read-only list of the scene permissions a smart wearable declares (legacy ItemRequiredPermission). */
export function RequiredPermissions({ permissions, testId = 'required-permissions' }: Props) {
  const { t } = useTranslation()
  return (
    <S.Wrap data-testid={testId}>
      <S.Title>
        {t('required_permissions.title')}
        <S.DocsLink href={DOCS_URL} target="_blank" rel="noreferrer">
          {t('required_permissions.learn_more')}
        </S.DocsLink>
      </S.Title>
      {permissions.length === 0 ? (
        <S.Empty>{t('required_permissions.none')}</S.Empty>
      ) : (
        <S.List>
          {permissions.map(permission => (
            <S.Chip key={permission} data-testid={`${testId}-${permission}`}>
              {permission.replace(/_/g, ' ').toLowerCase()}
            </S.Chip>
          ))}
        </S.List>
      )}
    </S.Wrap>
  )
}
