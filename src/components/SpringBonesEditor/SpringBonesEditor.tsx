import { useMemo, type CSSProperties } from 'react'
import { BodyShape, type SpringBoneParams } from '@dcl/schemas'
import { Close as RemoveIcon } from '@mui/icons-material'
import { Select } from '~/components/Select'
import { useTranslation } from '~/intl'
import {
  MAX_SPRING_BONES,
  SPRING_BONE_DRAG_MAX,
  SPRING_BONE_DRAG_MIN,
  SPRING_BONE_GRAVITY_DIR_MAX,
  SPRING_BONE_GRAVITY_DIR_MIN,
  SPRING_BONE_GRAVITY_POWER_MAX,
  SPRING_BONE_GRAVITY_POWER_MIN,
  SPRING_BONE_STIFFNESS_MAX,
  SPRING_BONE_STIFFNESS_MIN
} from '~/lib/glbValidation/constants'
import {
  buildSubtreeSizes,
  getChainRoots,
  getDefaultSpringBoneParams,
  sortByHierarchy,
  sumConfiguredBones,
  type BoneNode,
  type SpringBoneParamsByName
} from '~/lib/springBones'
import * as S from './SpringBonesEditor.styles'

export type SpringBonesModel = {
  hash: string
  bodyShapes: string[]
  bones: BoneNode[]
}

type Props = {
  /** Models with spring bones; two entries give a body-shape tab pair. */
  models: SpringBonesModel[]
  activeHash: string
  onActiveHashChange: (hash: string) => void
  params: SpringBoneParamsByName
  onChange: (params: SpringBoneParamsByName) => void
  disabled?: boolean
  testId?: string
}

type NumericParam = 'stiffness' | 'gravityPower' | 'drag'

const SLIDERS: Array<{ field: NumericParam; min: number; max: number }> = [
  { field: 'stiffness', min: SPRING_BONE_STIFFNESS_MIN, max: SPRING_BONE_STIFFNESS_MAX },
  { field: 'gravityPower', min: SPRING_BONE_GRAVITY_POWER_MIN, max: SPRING_BONE_GRAVITY_POWER_MAX },
  { field: 'drag', min: SPRING_BONE_DRAG_MIN, max: SPRING_BONE_DRAG_MAX }
]

const AXES = ['x', 'y', 'z'] as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function shapeLabel(bodyShapes: string[]): 'male' | 'female' | 'both' {
  const male = bodyShapes.includes(BodyShape.MALE)
  const female = bodyShapes.includes(BodyShape.FEMALE)
  return male && female ? 'both' : female ? 'female' : 'male'
}

/** Per-chain physics params for a wearable's spring bones (legacy SpringBonesSection). */
export function SpringBonesEditor({
  models,
  activeHash,
  onActiveHashChange,
  params,
  onChange,
  disabled = false,
  testId = 'spring-bones'
}: Props) {
  const { t } = useTranslation()
  const model = useMemo(
    () => models.find(candidate => candidate.hash === activeHash) ?? models[0],
    [models, activeHash]
  )
  const bones = useMemo(() => model?.bones ?? [], [model])
  const subtreeSizes = useMemo(() => buildSubtreeSizes(bones), [bones])
  const configured = useMemo(() => sumConfiguredBones(subtreeSizes, params), [subtreeSizes, params])
  const names = useMemo(() => sortByHierarchy(bones, Object.keys(params)), [bones, params])
  const addable = useMemo(
    () =>
      getChainRoots(bones)
        .filter(root => !(root.name in params) && configured + (subtreeSizes.get(root.name) ?? 1) <= MAX_SPRING_BONES)
        .map(root => ({
          value: root.name,
          label: root.name,
          trailing: t('item_editor.spring_bones.bones', { count: subtreeSizes.get(root.name) ?? 1 })
        })),
    [bones, params, configured, subtreeSizes, t]
  )

  if (!model) return null

  function update(name: string, patch: Partial<SpringBoneParams>) {
    onChange({ ...params, [name]: { ...params[name], ...patch } })
  }

  function remove(name: string) {
    const next = { ...params }
    delete next[name]
    onChange(next)
  }

  return (
    <S.Wrap data-testid={testId}>
      {models.length > 1 && (
        <S.Tabs role="tablist" aria-label={t('item_editor.spring_bones.body_shape')}>
          {models.map(candidate => (
            <S.Tab
              key={candidate.hash}
              type="button"
              role="tab"
              aria-selected={candidate.hash === model.hash}
              data-testid={`${testId}-tab-${shapeLabel(candidate.bodyShapes)}`}
              onClick={() => onActiveHashChange(candidate.hash)}
            >
              {t(`item_editor.customizer.shape.${shapeLabel(candidate.bodyShapes)}`)}
            </S.Tab>
          ))}
        </S.Tabs>
      )}
      <S.Counter data-over={configured > MAX_SPRING_BONES || undefined} data-testid={`${testId}-counter`}>
        {t('item_editor.spring_bones.counter', { count: configured, max: MAX_SPRING_BONES })}
      </S.Counter>
      {names.map(name => {
        const bone = params[name]
        return (
          <S.Card key={name} data-testid={`${testId}-bone-${name}`}>
            <S.CardHeader>
              <span title={name}>{name}</span>
              <S.Counter>{t('item_editor.spring_bones.bones', { count: subtreeSizes.get(name) ?? 1 })}</S.Counter>
              <S.IconButton
                type="button"
                aria-label={t('item_editor.spring_bones.remove')}
                disabled={disabled}
                data-testid={`${testId}-remove-${name}`}
                onClick={() => remove(name)}
              >
                <RemoveIcon fontSize="small" />
              </S.IconButton>
            </S.CardHeader>
            {SLIDERS.map(({ field, min, max }) => (
              <S.Param key={field}>
                <span>{t(`item_editor.spring_bones.${field}`)}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={0.01}
                  value={bone[field]}
                  disabled={disabled}
                  style={{ '--fill': `${((bone[field] - min) / (max - min)) * 100}%` } as CSSProperties}
                  aria-label={t(`item_editor.spring_bones.${field}`)}
                  data-testid={`${testId}-${name}-${field}`}
                  onChange={event => update(name, { [field]: Number(event.target.value) })}
                />
                <S.NumberInput
                  type="number"
                  min={min}
                  max={max}
                  step={0.01}
                  value={bone[field]}
                  disabled={disabled}
                  aria-label={t(`item_editor.spring_bones.${field}`)}
                  onChange={event => update(name, { [field]: clamp(Number(event.target.value) || 0, min, max) })}
                />
              </S.Param>
            ))}
            <S.Param as="div">
              <span>{t('item_editor.spring_bones.gravityDir')}</span>
              <S.Vector style={{ gridColumn: '1 / -1' }}>
                {AXES.map((axis, index) => (
                  <label key={axis}>
                    {axis.toUpperCase()}
                    <S.NumberInput
                      type="number"
                      min={SPRING_BONE_GRAVITY_DIR_MIN}
                      max={SPRING_BONE_GRAVITY_DIR_MAX}
                      step={0.1}
                      value={bone.gravityDir[index]}
                      disabled={disabled}
                      aria-label={`${t('item_editor.spring_bones.gravityDir')} ${axis.toUpperCase()}`}
                      data-testid={`${testId}-${name}-gravity-${axis}`}
                      onChange={event => {
                        const next = [...bone.gravityDir] as [number, number, number]
                        next[index] = clamp(
                          Number(event.target.value) || 0,
                          SPRING_BONE_GRAVITY_DIR_MIN,
                          SPRING_BONE_GRAVITY_DIR_MAX
                        )
                        update(name, { gravityDir: next })
                      }}
                    />
                  </label>
                ))}
              </S.Vector>
            </S.Param>
          </S.Card>
        )
      })}
      {!disabled && addable.length > 0 && (
        <S.AddRow>
          <Select
            value={null}
            options={addable}
            placeholder={t('item_editor.spring_bones.add')}
            tone="dark"
            ariaLabel={t('item_editor.spring_bones.add')}
            testId={`${testId}-add`}
            onChange={name => onChange({ ...params, [name]: getDefaultSpringBoneParams() })}
          />
        </S.AddRow>
      )}
    </S.Wrap>
  )
}
