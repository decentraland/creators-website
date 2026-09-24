import { useMemo } from 'react'
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material'
import { useHotScenes } from '~/hooks/useHotScenes'
import { useTranslation } from '~/intl'
import { placeUrl, placesUrl, sceneCoordinates, selectLiveScenes } from '~/lib/hotScenes'
import { OverviewSection, trackClick } from '~/lib/overviewAnalytics'
import { AnimatedSection } from '../AnimatedSection'
import * as S from './LiveScenes.styles'

const LiveScenes = () => {
  const { t } = useTranslation()
  const { data } = useHotScenes()
  const scenes = useMemo(() => selectLiveScenes(data ?? []), [data])

  // Nothing to show while loading, when the feed fails or when the world is empty.
  if (scenes.length === 0) return null

  return (
    <AnimatedSection section={OverviewSection.LIVE_SCENES}>
      <S.Section data-testid="overview-live-scenes">
        <S.Title>
          <span>{t('overview.live_scenes.title_highlight')}</span> {t('overview.live_scenes.title')}
        </S.Title>
        <S.Rail>
          {scenes.map(scene => (
            <S.SceneCard
              key={scene.id}
              href={placeUrl(scene)}
              data-testid="overview-scene-card"
              data-place={OverviewSection.LIVE_SCENES}
              data-title={scene.name}
              onClick={trackClick}
            >
              <S.SceneImage>
                <img src={scene.thumbnail} alt="" loading="lazy" />
                <S.OnlineBadge>{t('overview.live_scenes.online', { count: scene.usersTotalCount })}</S.OnlineBadge>
              </S.SceneImage>
              <S.SceneInfo>
                <S.SceneName>{scene.name}</S.SceneName>
                <S.SceneCoords>{sceneCoordinates(scene)}</S.SceneCoords>
              </S.SceneInfo>
            </S.SceneCard>
          ))}
        </S.Rail>
        <S.Centered>
          <S.ViewAllLink
            href={placesUrl()}
            data-testid="overview-live-scenes-all"
            data-place={OverviewSection.LIVE_SCENES}
            data-title="view-all"
            onClick={trackClick}
          >
            {t('overview.live_scenes.view_all')}
            <ChevronRightIcon />
          </S.ViewAllLink>
        </S.Centered>
      </S.Section>
    </AnimatedSection>
  )
}

export { LiveScenes }
