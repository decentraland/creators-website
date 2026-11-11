// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { breakpoints } from './theme'

// Widths a module's media query may use besides the canonical breakpoints, keyed by file, each with its reason.
const ALLOWED: Record<string, number[]> = {}

const CANONICAL = new Set<number>(Object.values(breakpoints))

const modules = (readdirSync('src', { recursive: true }) as string[])
  .map(path => `src/${path.replace(/\\/g, '/')}`)
  .filter(path => path.endsWith('.module.css'))

function mediaWidths(css: string): number[] {
  const queries = [...css.matchAll(/@media([^{]*)\{/g)].map(match => match[1])
  return queries.flatMap(query => [...query.matchAll(/(?:max|min)-width\s*:\s*([\d.]+)px/g)].map(m => Number(m[1])))
}

describe('media query breakpoints', () => {
  it('uses only the canonical breakpoints in CSS Modules', () => {
    const offenders = modules.flatMap(path =>
      mediaWidths(readFileSync(path, 'utf8'))
        .filter(width => !CANONICAL.has(width) && !ALLOWED[path]?.includes(width))
        .map(width => `${path}: ${width}px`)
    )
    expect(offenders, 'Use a breakpoint from theme.ts, or allowlist a genuinely non-canonical width').toEqual([])
  })

  it('reads the widths of both query forms', () => {
    const css = '@media (max-width: 768px) {} @media not all and (max-width: 1200px) {} .a { max-width: 640px; }'
    expect(mediaWidths(css)).toEqual([768, 1200])
  })
})
