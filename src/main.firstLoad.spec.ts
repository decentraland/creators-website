// @vitest-environment node
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// What ships to every visitor of the overview: the modules src/main.tsx reaches without an import() boundary.
const ROOT = process.cwd()
const SRC = resolve(ROOT, 'src')
const ENTRY = resolve(SRC, 'main.tsx')

const FORBIDDEN_PACKAGES = [/^viem(\/|$)/, /^@dcl\/crypto(\/|$)/, /^decentraland-connect(\/|$)/, /^jszip(\/|$)/]
const FORBIDDEN_FILES = [/^src\/lib\/chain\//]

function resolveLocal(from: string, specifier: string): string {
  const path = specifier.replace(/\?.*$/, '')
  const base = path.startsWith('~/') ? resolve(SRC, path.slice(2)) : resolve(dirname(from), path)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  throw new Error(`Cannot resolve ${specifier} from ${relative(ROOT, from)}`)
}

// Type-only imports and re-exports are erased before bundling, so they load nothing.
function isTypeOnly(statement: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause
    if (!clause) return false
    if (clause.isTypeOnly) return true
    const bindings = clause.namedBindings
    return (
      !clause.name &&
      !!bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.length > 0 &&
      bindings.elements.every(element => element.isTypeOnly)
    )
  }
  if (statement.isTypeOnly) return true
  const clause = statement.exportClause
  return !!clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every(e => e.isTypeOnly)
}

function staticImports(file: string): string[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, kind)
  return source.statements.flatMap(statement =>
    (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
    statement.moduleSpecifier &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    !isTypeOnly(statement)
      ? [statement.moduleSpecifier.text]
      : []
  )
}

/** Every module reachable from the entry, with the chain of importers that reaches it first. */
function firstLoadGraph() {
  const paths = new Map<string, string[]>([[relative(ROOT, ENTRY), [relative(ROOT, ENTRY)]]])
  const queue = [ENTRY]
  while (queue.length) {
    const file = queue.shift()!
    const path = paths.get(relative(ROOT, file))!
    if (!/\.tsx?$/.test(file)) continue
    for (const specifier of staticImports(file)) {
      const local = specifier.startsWith('.') || specifier.startsWith('~/')
      const target = local ? resolveLocal(file, specifier) : specifier
      const key = local ? relative(ROOT, target) : specifier
      if (paths.has(key)) continue
      paths.set(key, [...path, key])
      if (local) queue.push(target)
    }
  }
  return paths
}

describe("the overview's first load", () => {
  const graph = firstLoadGraph()

  it('follows the shell down to the navbar and the session restore', () => {
    expect(graph.has('src/components/NavBar/NavBar.tsx')).toBe(true)
    expect(graph.has('src/lib/auth/auth.ts')).toBe(true)
    expect(graph.has('@dcl/single-sign-on-client')).toBe(true)
  })

  it('loads no wallet client, signing, curve or chain code', () => {
    const leaks = [...graph.entries()]
      .filter(([key]) => [...FORBIDDEN_PACKAGES, ...FORBIDDEN_FILES].some(pattern => pattern.test(key)))
      .map(([, path]) => path.join(' > '))
    expect(leaks).toEqual([])
  })
})
