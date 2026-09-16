import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HistoryToggleOff as HistoryIcon, PersonOutline as PersonOutlineIcon } from '@mui/icons-material'
import { useTranslation } from '~/intl'
import { mergeActivity } from '~/lib/activity'
import { pageRangeLabel } from '~/lib/pagination'
import { useWallet } from '~/store/wallet'
import { useActivityStore } from '~/store/activity'
import { ACTIVITY_PAGE_SIZE, useActivity } from '~/hooks/useActivity'
import { Button } from '~/components/Button'
import { Pagination } from '~/components/Pagination'
import { ActivityRow } from './ActivityRow'
import * as S from './ActivityPage.styles'

const ActivityPage = () => {
  const { t } = useTranslation()
  const { session, restored, signIn } = useWallet()
  const address = session?.address
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const activity = useActivity(address, page)
  const local = useActivityStore(state => state.local)
  const data = activity.data
  // Transactions sent from this tab join the newest page until the server lists them.
  const events = useMemo(
    () => (page === 1 ? mergeActivity(local, data?.results ?? []) : (data?.results ?? [])),
    [local, data, page]
  )

  const total = data?.total ?? 0
  const pages = data?.pages ?? 0
  const isLoading = !restored || (!!address && (activity.isLoading || (activity.isFetching && !data)))
  const isEmpty = !!data && events.length === 0

  function goToPage(next: number) {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        if (next > 1) params.set('page', String(next))
        else params.delete('page')
        return params
      },
      { replace: true }
    )
    window.scrollTo({ top: 0 })
  }

  return (
    <S.Page data-testid="activity-page">
      <S.Header>
        <S.Title>{t('activity_page.title')}</S.Title>
        <S.Subtitle>{t('activity_page.subtitle')}</S.Subtitle>
      </S.Header>

      {restored && !session ? (
        <S.Panel data-testid="sign-in-panel">
          <S.PanelIcon aria-hidden>
            <PersonOutlineIcon />
          </S.PanelIcon>
          <S.PanelTitle>{t('activity_page.sign_in.title')}</S.PanelTitle>
          <Button type="button" variant="primary" data-testid="sign-in" onClick={() => signIn()}>
            {t('activity_page.sign_in.action')}
          </Button>
        </S.Panel>
      ) : isLoading ? (
        <S.List data-testid="activity-loading" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <S.SkeletonRow key={i} className="skeleton" />
          ))}
        </S.List>
      ) : activity.isError ? (
        <S.Panel data-testid="activity-error">
          <S.PanelTitle>{t('activity_page.error.title')}</S.PanelTitle>
          <S.PanelText>{t('activity_page.error.description')}</S.PanelText>
          <Button type="button" variant="secondary" onClick={() => void activity.refetch()}>
            {t('activity_page.error.retry')}
          </Button>
        </S.Panel>
      ) : isEmpty ? (
        <S.Panel data-testid="activity-empty">
          <S.PanelIcon aria-hidden>
            <HistoryIcon />
          </S.PanelIcon>
          <S.PanelTitle>{t('activity_page.empty.title')}</S.PanelTitle>
          <S.PanelText>{t('activity_page.empty.description')}</S.PanelText>
        </S.Panel>
      ) : (
        <>
          <S.List data-testid="activity-list">
            {events.map(event => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </S.List>
          {total > 0 && (
            <S.FooterRow>
              <S.ShowingCount data-testid="activity-count">
                {t('activity_page.showing', {
                  range: pageRangeLabel(page, ACTIVITY_PAGE_SIZE, data?.results.length ?? 0),
                  total
                })}
              </S.ShowingCount>
              {pages > 1 && <Pagination page={page} pages={pages} onPageChange={goToPage} />}
            </S.FooterRow>
          )}
        </>
      )}
    </S.Page>
  )
}

export { ActivityPage }
