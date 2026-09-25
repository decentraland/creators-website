import { useMemo } from 'react'
import { Button } from '~/components/Button'
import { PlayIcon } from '~/components/Icons'
import { useTranslation } from '~/intl'
import { formatLongDate } from '~/lib/time'
import { OverviewSection, trackClick } from '~/lib/overviewAnalytics'
import { useLocale } from '~/store/locale'
import { AnimatedSection } from '../AnimatedSection'
import { SUBMIT_TUTORIAL_URL, YOUTUBE_CHANNEL_URL, learnCards, learnVideo } from '../data'
import * as S from './Learn.styles'

const Learn = () => {
  const { t } = useTranslation()
  const locale = useLocale(s => s.locale)
  const cards = useMemo(
    () =>
      learnCards.map(card => ({
        ...card,
        title: t(`overview.learn.cards.${card.id}`),
        date: formatLongDate(card.date, locale),
        ...learnVideo(card.videoId)
      })),
    [t, locale]
  )

  return (
    <AnimatedSection section={OverviewSection.LEARN}>
      <S.Section data-testid="overview-learn">
        <S.Title>
          <span>{t('overview.learn.title_highlight')}</span> {t('overview.learn.title')}
        </S.Title>
        <S.Rail>
          {cards.map(card => (
            <S.VideoCard
              key={card.id}
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="overview-learn-card"
              data-place={OverviewSection.LEARN}
              data-title={card.title}
              onClick={trackClick}
            >
              <S.Thumbnail>
                <img src={card.thumbnail} alt="" loading="lazy" />
                <PlayIcon />
              </S.Thumbnail>
              <S.VideoInfo>
                <S.VideoMeta>
                  <S.VideoAuthor>
                    <img src={card.authorImage} alt="" loading="lazy" />
                    <span>{card.author}</span>
                  </S.VideoAuthor>
                  <S.VideoDate>{card.date}</S.VideoDate>
                </S.VideoMeta>
                <S.VideoTitle>{card.title}</S.VideoTitle>
              </S.VideoInfo>
            </S.VideoCard>
          ))}
        </S.Rail>
        <S.Extras>
          <S.Extra>
            {t('overview.learn.watch_more')}
            <Button
              as="a"
              size="compact"
              href={YOUTUBE_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="overview-learn-youtube"
              data-place={OverviewSection.LEARN}
              data-title="watch-more"
              onClick={trackClick}
            >
              {t('overview.learn.watch_more_button')}
            </Button>
          </S.Extra>
          <S.Extra>
            {t('overview.learn.your_tutorial')}
            <Button
              as="a"
              variant="light"
              size="compact"
              href={SUBMIT_TUTORIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="overview-learn-submit"
              data-place={OverviewSection.LEARN}
              data-title="submit-tutorial"
              onClick={trackClick}
            >
              {t('overview.learn.your_tutorial_button')}
            </Button>
          </S.Extra>
        </S.Extras>
      </S.Section>
    </AnimatedSection>
  )
}

export { Learn }
