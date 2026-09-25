import { useCallback } from 'react'
import { useTranslation } from '~/intl'
import { OverviewSection, trackClick } from '~/lib/overviewAnalytics'
import discordIcon from '~/assets/overview/discord.svg'
import { AnimatedSection } from '../AnimatedSection'
import { Carousel } from '../Carousel'
import { DISCORD_URL, testimonials, type Testimonial } from '../data'
import * as S from './Connect.styles'

const AUTOPLAY_MS = 5000

const keyExtractor = (card: Testimonial) => card.id

const Connect = () => {
  const { t } = useTranslation()
  const renderCard = useCallback(
    (card: Testimonial) => (
      <S.Card
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="overview-testimonial"
        data-place={OverviewSection.CONNECT}
        data-title={card.name}
        onClick={trackClick}
      >
        <S.Quote>&ldquo;{t(`overview.connect.cards.${card.id}`)}&rdquo;</S.Quote>
        <S.Author>
          <img src={card.image} alt="" loading="lazy" />
          <S.AuthorName>{card.name}</S.AuthorName>
        </S.Author>
      </S.Card>
    ),
    [t]
  )

  return (
    <AnimatedSection section={OverviewSection.CONNECT}>
      <S.Section data-testid="overview-connect">
        <S.Title>
          <span>{t('overview.connect.title_highlight')}</span> {t('overview.connect.title')}
        </S.Title>
        <Carousel
          items={testimonials}
          renderItem={renderCard}
          keyExtractor={keyExtractor}
          label={t('overview.connect.title')}
          slideWidth={500}
          autoplayMs={AUTOPLAY_MS}
          alignItems="center"
        />
        <S.Discord
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="overview-discord"
          data-place={OverviewSection.CONNECT}
          data-title="join-discord"
          onClick={trackClick}
        >
          <S.DiscordTitle>{t('overview.connect.join_the_community')}</S.DiscordTitle>
          <S.DiscordIcon>
            <img src={discordIcon} alt="" />
          </S.DiscordIcon>
        </S.Discord>
      </S.Section>
    </AnimatedSection>
  )
}

export { Connect }
