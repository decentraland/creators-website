import { useEffect, useMemo, useState } from 'react'
import { Button } from '~/components/Button'
import { ChevronDownIcon } from '~/components/Icons'
import { useAfterLoadIdle } from '~/hooks/useAfterLoadIdle'
import { useCreatorHubDownload } from '~/hooks/useCreatorHubDownload'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { useTypingListEffect } from '~/hooks/useTypingListEffect'
import { useTranslation } from '~/intl'
import { cancelCreatorHubRedirect, startCreatorHubDownload } from '~/lib/creatorHubDownload'
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

/** Its own component so the fade-in state starts over on every mount. */
const HeroVideo = () => {
  const [playing, setPlaying] = useState(false)
  const { url, width, height } = heroData.video
  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      width={width}
      height={height}
      aria-hidden
      data-testid="overview-hero-video"
      data-playing={playing || undefined}
      onPlaying={() => setPlaying(true)}
    >
      <source src={url} type="video/mp4" />
    </video>
  )
}

const Hero = () => {
  const { t } = useTranslation()
  const mobile = useMediaQuery(OVERVIEW_MOBILE_QUERY)
  const words = useMemo(() => heroData.words.map(word => t(`overview.hero.words.${word}`)), [t])
  const currentWord = useTypingListEffect(words)
  const { poster } = heroData
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const idle = useAfterLoadIdle()
  // After the first paint, and never on phones: they get the docs, and the GitHub API is rate limited per IP.
  const { download, fallback } = useCreatorHubDownload(!mobile && idle)
  useEffect(() => cancelCreatorHubRedirect, [])
  const [posterFailed, setPosterFailed] = useState(false)
  // The poster is the first paint and the LCP; the video only joins once the page is idle, and only on
  // desktop, where its weight is affordable.
  const showVideo = !mobile && idle && !reducedMotion && !prefersSavingData()

  return (
    <>
      <S.Hero data-testid="overview-hero">
        <S.Background>
          {!posterFailed && (
            <img
              src={poster.url}
              srcSet={poster.srcSet}
              sizes="100vw"
              alt=""
              width={poster.width}
              height={poster.height}
              data-testid="overview-hero-poster"
              onError={() => setPosterFailed(true)}
            />
          )}
          {showVideo && <HeroVideo />}
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
              // Until the release resolves, or when no installer fits this OS, the download page offers them all.
              href={download?.href ?? CREATOR_HUB_DOWNLOAD_URL}
              onClick={event => {
                trackClick(event)
                // A modifier click opens the installer elsewhere, so this tab stays put.
                const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
                if (download && !modified && !startCreatorHubDownload(download)) event.preventDefault()
              }}
              data-testid="overview-hero-cta"
              data-place={OverviewSection.HERO}
              data-event={DOWNLOAD_CLICK}
              data-download-target={CREATOR_HUB_TARGET}
              data-download-mode={download ? 'direct' : fallback}
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
