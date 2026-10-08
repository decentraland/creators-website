import { useMemo, useState } from 'react'
import { Button } from '~/components/Button'
import { ChevronDownIcon } from '~/components/Icons'
import { useAfterLoadIdle } from '~/hooks/useAfterLoadIdle'
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

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const prefersSavingData = () =>
  (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true

const Hero = () => {
  const { t } = useTranslation()
  const mobile = useMediaQuery(OVERVIEW_MOBILE_QUERY)
  const words = useMemo(() => heroData.words.map(word => t(`overview.hero.words.${word}`)), [t])
  const currentWord = useTypingListEffect(words)
  const poster = mobile ? heroData.portrait.poster : heroData.landscape.poster
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const idle = useAfterLoadIdle()
  const [videoPlaying, setVideoPlaying] = useState(false)
  // The poster is the first paint and the LCP; the video only joins once the page is idle, and only on
  // desktop, where its weight is affordable.
  const showVideo = !mobile && idle && !reducedMotion && !prefersSavingData()

  return (
    <>
      <S.Hero data-testid="overview-hero">
        <S.Background>
          <img
            key={poster.url}
            src={poster.url}
            alt=""
            width={poster.width}
            height={poster.height}
            data-testid="overview-hero-poster"
          />
          {showVideo && (
            <video
              autoPlay
              loop
              muted
              playsInline
              width={heroData.landscape.video.width}
              height={heroData.landscape.video.height}
              aria-hidden
              data-testid="overview-hero-video"
              data-playing={videoPlaying || undefined}
              onPlaying={() => setVideoPlaying(true)}
            >
              <source src={heroData.landscape.video.url} type="video/mp4" />
            </video>
          )}
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
