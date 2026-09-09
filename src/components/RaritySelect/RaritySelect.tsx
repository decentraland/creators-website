import { Select } from '~/components/Select'
import { useTranslation } from '~/intl'
import { RARITIES, RARITY_MAX_SUPPLY, type RarityName } from '~/lib/rarities'

type Props = {
  value: string
  onChange: (rarity: RarityName) => void
  testId?: string
}

/** Rarity picker: each option pairs the rarity name with its max supply, like the legacy builder. */
export function RaritySelect({ value, onChange, testId = 'rarity-select' }: Props) {
  const { t } = useTranslation()
  const options = RARITIES.map(rarity => {
    const label = t(`collection_detail_page.rarity.${rarity}`)
    const count = RARITY_MAX_SUPPLY[rarity]
    return {
      value: rarity,
      label,
      trailing: t('rarity_select.units', { count }),
      triggerLabel: t('rarity_select.with_supply', { label, count })
    }
  })
  return <Select value={value as RarityName} options={options} onChange={onChange} testId={testId} />
}
