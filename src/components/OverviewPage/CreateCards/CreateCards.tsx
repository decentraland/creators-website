import { useCallback, useMemo, useState } from 'react'
import { useMediaQuery } from '~/hooks/useMediaQuery'
import { useTranslation } from '~/intl'
import { OverviewSection, trackClick } from '~/lib/overviewAnalytics'
import { theme } from '~/styles/theme'
import { AnimatedSection } from '../AnimatedSection'
import { Carousel } from '../Carousel'
import { createCards, type CreateCard as CreateCardData, type CreateTab } from '../data'
import * as S from './CreateCards.styles'

type TabContentProps = { card: CreateCardData; tab: CreateTab }

const TabContent = ({ card, tab }: TabContentProps) => {
  const { t } = useTranslation()
  const mobile = useMediaQuery(theme.media.maxWidth('mobile'))
  const links = useMemo(() => tab.links.filter(link => !mobile || !link.desktopOnly), [tab.links, mobile])
  const prefix = `overview.create.cards.${card.id}.tabs.${tab.id}`

  return (
    <S.TabPanel role="tabpanel" id={`create-panel-${card.id}-${tab.id}`} data-testid="overview-create-tab-panel">
      <S.InfoBlock>
        <S.InfoTitle>{t(`${prefix}.heading`)}</S.InfoTitle>
        <S.InfoBody>{t(`${prefix}.body`)}</S.InfoBody>
      </S.InfoBlock>
      <S.InfoBlock>
        <S.InfoTitle>{t('overview.create.required_skills')}</S.InfoTitle>
        <S.Skills>
          {tab.skills.map(skill => (
            <S.Skill key={skill}>{t(`overview.create.skills.${skill}`)}</S.Skill>
          ))}
        </S.Skills>
      </S.InfoBlock>
      <S.InfoBlock>
        <S.InfoTitle>{t('overview.create.useful_links')}</S.InfoTitle>
        <S.Links>
          {links.map(link => {
            const label = t(`${prefix}.links.${link.id}`)
            return (
              <S.Link
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="overview-create-link"
                data-place={OverviewSection.CREATE}
                data-card={card.id}
                data-tab={tab.id}
                data-title={label}
                onClick={trackClick}
              >
                {label}
              </S.Link>
            )
          })}
        </S.Links>
      </S.InfoBlock>
    </S.TabPanel>
  )
}

const CreateCard = ({ card }: { card: CreateCardData }) => {
  const { t } = useTranslation()
  const [activeTabId, setActiveTabId] = useState(card.tabs[0].id)
  const activeTab = useMemo(
    () => card.tabs.find(tab => tab.id === activeTabId) ?? card.tabs[0],
    [card.tabs, activeTabId]
  )
  const title = t(`overview.create.cards.${card.id}.title`)

  return (
    <S.Card data-testid="overview-create-card" data-card={card.id}>
      <S.Figure style={{ backgroundImage: `url(${card.background})` }}>
        <img src={card.image} alt="" loading="lazy" />
      </S.Figure>
      <S.Info>
        <S.CardTitle>{title}</S.CardTitle>
        <S.CardDescription>{t(`overview.create.cards.${card.id}.description`)}</S.CardDescription>
        {card.tabs.length > 1 && (
          <S.Tabs role="tablist" aria-label={title}>
            {card.tabs.map(tab => (
              <S.Tab
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === activeTabId}
                aria-controls={`create-panel-${card.id}-${tab.id}`}
                data-testid="overview-create-tab"
                data-selected={tab.id === activeTabId || undefined}
                data-place={OverviewSection.CREATE}
                data-card={card.id}
                data-tab={tab.id}
                onClick={event => {
                  trackClick(event)
                  setActiveTabId(tab.id)
                }}
              >
                {t(`overview.create.cards.${card.id}.tabs.${tab.id}.title`)}
              </S.Tab>
            ))}
          </S.Tabs>
        )}
        <TabContent card={card} tab={activeTab} />
      </S.Info>
    </S.Card>
  )
}

const keyExtractor = (card: CreateCardData) => card.id

const CreateCards = () => {
  const { t } = useTranslation()
  const renderCard = useCallback((card: CreateCardData) => <CreateCard card={card} />, [])
  return (
    <AnimatedSection section={OverviewSection.CREATE}>
      <S.Section data-testid="overview-create">
        <S.Title>
          {t('overview.create.title')}
          <span>{t('overview.create.title_highlight')}</span>
          {t('overview.create.title_second_part')}
        </S.Title>
        <Carousel
          items={createCards}
          renderItem={renderCard}
          keyExtractor={keyExtractor}
          label={t('overview.create.title_highlight')}
          slideWidth={1200}
        />
      </S.Section>
    </AnimatedSection>
  )
}

export { CreateCards }
