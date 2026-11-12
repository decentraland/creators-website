// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { theme } from './theme'

describe('tokens.css', () => {
  it('is up to date with theme.ts', () => {
    expect(() => execFileSync(process.execPath, ['scripts/gen-tokens.mjs', '--check'], { stdio: 'pipe' })).not.toThrow()
  })

  it('declares the theme values as custom properties', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8')
    expect(css).toContain(`--color-dcl-red: ${theme.colors.dclRed};`)
    expect(css).toContain(`--radius-btn-sm: ${theme.radius.btnSm};`)
    expect(css).toContain(`--z-tooltip: ${theme.z.tooltip};`)
    expect(css).toContain(`--editor-surface-hover: ${theme.editor.surfaceHover};`)
  })
})
