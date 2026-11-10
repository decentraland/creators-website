import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import importX, { createNodeResolver } from 'eslint-plugin-import-x'
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
  'src/components/AvatarPreview/AvatarPreview.tsx',
  'src/components/ItemDraftModal/DraftProcessor.tsx',
  'src/components/ThumbnailModal/ThumbnailModal.tsx',
  'src/components/Tooltip/Tooltip.styles.ts'
]
const UI2_STYLING = {
  name: 'decentraland-ui2',
  importNames: ['styled', 'keyframes', 'GlobalStyles'],
  message:
    'Styled defs live only in *.styles.ts, through @emotion/styled. See docs/DECISIONS.md (Pre-monorepo refactor).'
}

const STYLES_FILES = ['src/**/*.styles.ts', 'src/styles/**/*.ts']
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

const ETHERS = {
  regex: '^(ethers(/|$)|@ethersproject/)',
  message: 'Chain code uses viem; ethers is only installed as a dependency of other packages.'
}

// no-restricted-imports does not see import(), so lazy-loaded usage needs its own rule.
const DYNAMIC_EMOTION_MUI = {
  selector: 'ImportExpression[source.value=/^(@emotion\\/|@mui\\/(?!icons-material(\\/|$)))/]',
  message: 'No new Emotion or MUI, lazy-loaded included. See docs/DECISIONS.md (Pre-monorepo refactor).'
}
const DYNAMIC_UI2 = {
  selector: 'ImportExpression[source.value=/^decentraland-ui2(\\/|$)/]',
  message: UI2_MESSAGE
}
const DYNAMIC_ETHERS = {
  selector: 'ImportExpression[source.value=/^(ethers(\\/|$)|@ethersproject\\/)/]',
  message: ETHERS.message
}
const DYNAMIC_UI2_ALLOWED = ['src/components/TopNav/TopNav.tsx']
const DYNAMIC_ALL_ALLOWED = ['src/components/PreviewControls/PreviewControls.tsx']

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
      allowImportNames: ['getContentsStorageUrl', 'isRefusedRequest', 'BuilderServerError', 'COLLECTION_LOCKED_STATUS'],
      allowTypeImports: true,
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

  // The e2e harness (fake wallet key, fake back ends) is test-only: nothing under src may pull it into the bundle.
  {
    files: ['src/**/*.{ts,tsx}'],
    // The rule only sees imports it can resolve, and the default resolver skips .ts files.
    settings: { 'import-x/resolver-next': [createNodeResolver({ extensions: ['.ts', '.tsx', '.js'] })] },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: './src', from: './e2e', message: 'The e2e harness is test-only; never import it from src.' }
          ]
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
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [...AUTH.paths, UI2_STYLING], patterns: AUTH.patterns }
      ]
    }
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
    rules: { 'no-restricted-imports': ['error', { patterns: [EMOTION_ALL, MUI, BUILDER_TRANSPORT, ETHERS] }] }
  },
  {
    files: ['src/lib/builder/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [EMOTION_ALL, MUI, ETHERS] }] }
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: [...STYLES_FILES, ...SPEC_FILES],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: BUILDER_IN_COMPONENTS.paths,
          patterns: [EMOTION_ALL, MUI, ETHERS, ...BUILDER_IN_COMPONENTS.patterns]
        }
      ]
    }
  },
  {
    files: STYLES_FILES,
    rules: {
      'no-restricted-imports': ['error', { patterns: [EMOTION_EXCEPT_STYLED, MUI, BUILDER_TRANSPORT, ETHERS] }]
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...DYNAMIC_UI2_ALLOWED, ...DYNAMIC_ALL_ALLOWED],
    rules: { 'no-restricted-syntax': ['error', DYNAMIC_EMOTION_MUI, DYNAMIC_UI2, DYNAMIC_ETHERS] }
  },
  {
    files: DYNAMIC_UI2_ALLOWED,
    rules: { 'no-restricted-syntax': ['error', DYNAMIC_EMOTION_MUI, DYNAMIC_ETHERS] }
  },
  {
    files: DYNAMIC_ALL_ALLOWED,
    rules: { 'no-restricted-syntax': ['error', DYNAMIC_ETHERS] }
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [ETHERS] }],
      'no-restricted-syntax': ['error', DYNAMIC_ETHERS]
    }
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
