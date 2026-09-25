import { Suspense, lazy, useState } from 'react'
import * as S from './Confetti.styles'

// The shop's purchase burst, played once. lottie-web and the animation are loaded on demand: both only
// matter on the one dialog that celebrates a purchase.
const LottieBurst = lazy(async () => {
  const [{ default: Lottie }, { default: animationData }] = await Promise.all([
    import('lottie-react'),
    import('./confettiAnimation.json')
  ])
  return { default: () => <Lottie animationData={animationData} loop={1} /> }
})

export function Confetti() {
  // Decided once at mount, before anything is fetched: a burst of motion is what prefers-reduced-motion
  // exists for, and CSS cannot stop a JS-driven animation.
  const [play] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  if (!play) return null

  return (
    <S.Layer aria-hidden data-testid="confetti">
      <Suspense fallback={null}>
        <LottieBurst />
      </Suspense>
    </S.Layer>
  )
}
