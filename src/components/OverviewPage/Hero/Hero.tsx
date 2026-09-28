import { useMemo } from 'react'
import { Button } from '~/components/Button'
import { ChevronDownIcon } from '~/components/Icons'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { useTypingListEffect } from '~/hooks/useTypingListEffect'
import { useTranslation } from '~/intl'
import {
  CREATOR_HUB_TARGET,
  DOWNLOAD_CLICK,
  OVERVIEW_MOBILE_QUERY,
  OverviewSection,
  trackClick
} from '~/lib/overviewAnalytics'
import { CREATOR_DOCS_URL, CREATOR_HUB_DOWNLOAD_URL, heroData } from '../data'
import * as S from './Hero.styles'

const Hero = () => {
  const { t } = useTranslation()
  const mobile = useMediaQuery(OVERVIEW_MOBILE_QUERY)
  const words = useMemo(() => heroData.words.map(word => t(`overview.hero.words.${word}`)), [t])
  const currentWord = useTypingListEffect(words)
  const media = mobile ? heroData.portrait : heroData.landscape

  return (
    <>
      <S.Hero data-testid="overview-hero">
        <S.Background>
          {/* Keyed so the orientation switch swaps the element instead of re-sourcing a playing video. */}
          <video
            key={mobile ? 'portrait' : 'landscape'}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={media.poster.url}
            width={media.video.width}
            height={media.video.height}
          >
            <source src={media.video.url} type="video/mp4" />
          </video>
        </S.Background>
        <S.Content>
          <S.Title>
            {t('overview.hero.title_first_line')}
            <br />
            <span data-testid="overview-hero-word">{currentWord}</span>
            <br />
            {t('overview.hero.title_last_line')}
          </S.Title>
          <S.Subtitle>{t('overview.hero.subtitle')}</S.Subtitle>
          {mobile ? (
            // The Creator Hub only ships desktop installers, so phones get the docs instead of a dead end.
            <Button
              as="a"
              size="hero"
              href={CREATOR_DOCS_URL}
              onClick={trackClick}
              data-testid="overview-hero-cta"
              data-place={OverviewSection.HERO}
            >
              {t('overview.hero.mobile_docs_cta')}
            </Button>
          ) : (
            <Button
              as="a"
              size="hero"
              href={CREATOR_HUB_DOWNLOAD_URL}
              onClick={trackClick}
              data-testid="overview-hero-cta"
              data-place={OverviewSection.HERO}
              data-event={DOWNLOAD_CLICK}
              data-download-target={CREATOR_HUB_TARGET}
            >
              {t('overview.hero.download_cta')}
            </Button>
          )}
        </S.Content>
      </S.Hero>
      <S.ScrollButton
        type="button"
        aria-label={t('overview.hero.scroll_label')}
        data-testid="overview-hero-scroll"
        data-place={OverviewSection.HERO}
        data-title="scroll-to-why"
        onClick={event => {
          trackClick(event)
          window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })
        }}
      >
        <ChevronDownIcon />
      </S.ScrollButton>
    </>
  )
}

export { Hero }
