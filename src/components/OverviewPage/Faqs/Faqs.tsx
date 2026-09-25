import { useState, type KeyboardEvent, type SyntheticEvent } from 'react'
import { useInView } from 'react-intersection-observer'
import { Button } from '~/components/Button'
import { CircleAndArrowIcon } from '~/components/Icons'
import { useSectionViewed } from '~/hooks/useSectionViewed'
import { useTranslation } from '~/intl'
import { OverviewSection, trackClick } from '~/lib/overviewAnalytics'
import { FAQS_URL, faqIds } from '../data'
import * as S from './Faqs.styles'

type FaqRowProps = { id: string; open: boolean; onToggle: () => void }

const FaqRow = ({ id, open, onToggle }: FaqRowProps) => {
  const { t } = useTranslation()
  const question = t(`overview.faqs.items.${id}.question`)

  const toggle = (event: SyntheticEvent<HTMLElement>) => {
    // Only the expand is an engagement signal.
    if (!open) trackClick(event)
    onToggle()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle(event)
    }
  }

  return (
    <S.Row
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-controls={`faq-answer-${id}`}
      data-testid="overview-faq"
      data-open={open || undefined}
      data-place={OverviewSection.FAQS}
      data-title={question}
      onClick={toggle}
      onKeyDown={onKeyDown}
    >
      <S.Question>
        <S.QuestionText id={`faq-question-${id}`}>{question}</S.QuestionText>
        <CircleAndArrowIcon />
      </S.Question>
      <S.Answer id={`faq-answer-${id}`} role="region" aria-labelledby={`faq-question-${id}`} aria-hidden={!open}>
        <S.AnswerText>{t(`overview.faqs.items.${id}.answer`)}</S.AnswerText>
      </S.Answer>
    </S.Row>
  )
}

const Faqs = () => {
  const { t } = useTranslation()
  const [openId, setOpenId] = useState<string | null>(null)
  // No reveal animation here, so the section observes the viewport itself for `Section Viewed`.
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  useSectionViewed(OverviewSection.FAQS, inView)

  return (
    <S.Section ref={ref} aria-label={t('overview.faqs.aria_label')} data-testid="overview-faqs">
      <S.Frame>
        <S.Container>
          <S.Subtitle>{t('overview.faqs.subtitle')}</S.Subtitle>
          <S.Title>{t('overview.faqs.title')}</S.Title>
          {faqIds.map(id => (
            <FaqRow key={id} id={id} open={openId === id} onToggle={() => setOpenId(openId === id ? null : id)} />
          ))}
          <S.Cta>
            <Button
              as="a"
              variant="ghost"
              size="lg"
              href={FAQS_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="overview-faqs-cta"
              data-place={OverviewSection.FAQS}
              data-title="faqs-cta"
              onClick={trackClick}
            >
              {t('overview.faqs.cta')}
            </Button>
          </S.Cta>
        </S.Container>
      </S.Frame>
    </S.Section>
  )
}

export { Faqs }
