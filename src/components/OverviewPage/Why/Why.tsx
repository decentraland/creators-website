import { useTranslation } from '~/intl'
import { OverviewSection, trackClick } from '~/lib/overviewAnalytics'
import { AnimatedSection } from '../AnimatedSection'
import { whyCards } from '../data'
import * as S from './Why.styles'

const Why = () => {
  const { t } = useTranslation()
  return (
    <AnimatedSection section={OverviewSection.WHY}>
      <S.Section data-testid="overview-why">
        <S.Title>
          <span>{t('overview.why.title_highlight')}</span> {t('overview.why.title')}
        </S.Title>
        <S.Grid>
          {whyCards.map(card => {
            const title = t(`overview.why.cards.${card.id}.title`)
            return (
              <S.Card
                key={card.id}
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="overview-why-card"
                data-gradient={card.gradient}
                data-place={OverviewSection.WHY}
                data-title={title}
                onClick={trackClick}
              >
                <S.CardInner>
                  <S.CardImage>
                    <img src={card.image} alt="" loading="lazy" />
                  </S.CardImage>
                  <S.CardText>
                    <S.CardTitle>{title}</S.CardTitle>
                    <S.CardDescription>{t(`overview.why.cards.${card.id}.description`)}</S.CardDescription>
                    <S.CardCta>{t(`overview.why.cards.${card.id}.cta`)}</S.CardCta>
                  </S.CardText>
                </S.CardInner>
              </S.Card>
            )
          })}
        </S.Grid>
      </S.Section>
    </AnimatedSection>
  )
}

export { Why }
