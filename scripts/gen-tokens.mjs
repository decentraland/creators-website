// Writes src/styles/tokens.css from the theme object; `--check` exits non-zero when the committed file differs.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { theme } from '../src/styles/theme.ts'

const OUT = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url))
const PREFIX = { colors: 'color', rarities: 'rarity', gradients: 'gradient' }

const kebab = key => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)

function render() {
  const lines = []
  for (const [group, values] of Object.entries(theme)) {
    const entries = Object.entries(values)
    // `media` holds query builders, which have no custom-property form.
    if (entries.some(([, value]) => typeof value !== 'string' && typeof value !== 'number')) continue
    const prefix = PREFIX[group] ?? kebab(group)
    // Lower-case hexes, as Prettier writes them, so the generated file passes the format check.
    for (const [key, value] of entries) {
      lines.push(`  --${prefix}-${kebab(key)}: ${String(value).replace(/#[0-9a-f]+\b/gi, hex => hex.toLowerCase())};`)
    }
  }
  return `/* Generated from src/styles/theme.ts by \`npm run tokens\`; edit the theme, not this file. */\n:root {\n${lines.join('\n')}\n}\n`
}

const css = render()
if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    // missing counts as stale
  }
  if (current !== css) {
    console.error('src/styles/tokens.css is out of date with src/styles/theme.ts. Run `npm run tokens`.')
    process.exit(1)
  }
} else {
  writeFileSync(OUT, css)
}
