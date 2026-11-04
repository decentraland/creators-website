import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import importX from 'eslint-plugin-import-x'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

const AUTH = {
  paths: ['decentraland-connect', '@dcl/crypto', '@dcl/single-sign-on-client'].map(name => ({
    name,
    message: `Import ${name} only inside src/lib/auth; consume the wallet store or ~/lib/auth helpers instead.`,
    allowTypeImports: true
  })),
  patterns: [
    {
      group: ['decentraland-connect/*', '@dcl/crypto/*', '@dcl/single-sign-on-client/*'],
      message: 'Import auth libraries only inside src/lib/auth.',
      allowTypeImports: true
    }
  ]
}

const UI2_MESSAGE =
  'The monorepo has no decentraland-ui2; add no new runtime usage. See docs/DECISIONS.md (Pre-monorepo refactor).'
const UI2 = {
  paths: [{ name: 'decentraland-ui2', message: UI2_MESSAGE, allowTypeImports: true }],
  patterns: [{ group: ['decentraland-ui2/*'], message: UI2_MESSAGE, allowTypeImports: true }]
}
const UI2_ALLOWED = [
  'src/components/AvatarPreview/**/*.{ts,tsx}',
  'src/components/PreviewControls/**/*.{ts,tsx}',
  'src/components/ThumbnailModal/**/*.{ts,tsx}',
  'src/components/ItemDraftModal/DraftProcessor.tsx',
  'src/components/Tooltip/**/*.{ts,tsx}',
  'src/components/TopNav/**/*.{ts,tsx}'
]

const STYLES_FILES = ['src/**/*.styles.ts', 'src/styles/**/*.{ts,tsx}']
const EMOTION_ALL = {
  regex: '^@emotion/',
  message: 'Styling is migrating to CSS Modules; add no new Emotion. See docs/DECISIONS.md (Pre-monorepo refactor).'
}
const EMOTION_EXCEPT_STYLED = {
  regex: '^@emotion/(?!styled(/|$))',
  message: 'Only @emotion/styled is allowed, and only in *.styles.ts. See docs/DECISIONS.md (Pre-monorepo refactor).'
}
const MUI = {
  regex: '^@mui/(?!icons-material(/|$))',
  message:
    'The monorepo has no MUI; only @mui/icons-material is allowed. See docs/DECISIONS.md (Pre-monorepo refactor).'
}
const SEAM_5 = 'See CONVENTIONS.md seam 5.'
const BUILDER_TRANSPORT = {
  group: ['~/lib/builder/transport'],
  message: `Only src/lib/builder imports its transport; call the endpoint functions from ~/lib/builder. ${SEAM_5}`
}
const BUILDER_IN_COMPONENTS_MESSAGE = `Components get builder-server data through hooks and import only URL helpers, error classification and types from ~/lib/builder. ${SEAM_5}`
const BUILDER_IN_COMPONENTS = {
  paths: [
    {
      name: '~/lib/builder',
      allowImportNames: [
        'getContentsStorageUrl',
        'isRefusedRequest',
        'BuilderServerError',
        'COLLECTION_LOCKED_STATUS',
        'ALREADY_PUBLISHED_STATUS',
        'SlotsCheque',
        'CollectionItemPreview'
      ],
      message: BUILDER_IN_COMPONENTS_MESSAGE
    }
  ],
  patterns: [{ group: ['~/lib/builder/*'], message: BUILDER_IN_COMPONENTS_MESSAGE }]
}
const SPEC_FILES = ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}']

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      import: importX
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'import/first': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'function',
          format: ['PascalCase', 'camelCase']
        }
      ]
    }
  },

  // Auth is a sealed module (CONVENTIONS.md): only src/lib/auth may touch the wallet and identity
  // libraries. Types are fine anywhere; a provider or identity instance is not.
  // The pre-monorepo fence (docs/DECISIONS.md, "Pre-monorepo refactor") shares this rule: decentraland-ui2
  // runs only in UI2_ALLOWED. Flat config replaces a rule's options per file, so each block lists every
  // restriction for its files.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/auth/**', ...UI2_ALLOWED],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [...AUTH.paths, ...UI2.paths], patterns: [...AUTH.patterns, ...UI2.patterns] }
      ]
    }
  },
  {
    files: UI2_ALLOWED,
    rules: { '@typescript-eslint/no-restricted-imports': ['error', AUTH] }
  },
  {
    files: ['src/lib/auth/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-restricted-imports': ['error', UI2] }
  },

  // Pre-monorepo fence (docs/DECISIONS.md, "Pre-monorepo refactor"): the monorepo has no Emotion or MUI,
  // so no new usage; @emotion/styled stays in *.styles.ts and src/styles until the CSS Modules migration.
  // The same rule keeps the builder-server transport inside src/lib/builder and components off its endpoints
  // (CONVENTIONS.md seam 5); component specs import endpoints to mock them, so they stay out of that block.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...STYLES_FILES, 'src/lib/builder/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [EMOTION_ALL, MUI, BUILDER_TRANSPORT] }] }
  },
  {
    files: ['src/lib/builder/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [EMOTION_ALL, MUI] }] }
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: [...STYLES_FILES, ...SPEC_FILES],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: BUILDER_IN_COMPONENTS.paths,
          patterns: [EMOTION_ALL, MUI, ...BUILDER_IN_COMPONENTS.patterns]
        }
      ]
    }
  },
  {
    files: STYLES_FILES,
    rules: { 'no-restricted-imports': ['error', { patterns: [EMOTION_EXCEPT_STYLED, MUI, BUILDER_TRANSPORT] }] }
  },

  // Mocks and fixtures legitimately traffic in `any` and unbound methods, so the
  // no-unsafe-* family is high-noise here — real source stays strict.
  {
    files: SPEC_FILES,
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'import/first': 'off'
    }
  },

  // Must come last: turn off rules that conflict with Prettier formatting.
  prettier
)
