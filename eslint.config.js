import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import importX from 'eslint-plugin-import-x'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

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
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/auth/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
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
      ]
    }
  },

  // Mocks and fixtures legitimately traffic in `any` and unbound methods, so the
  // no-unsafe-* family is high-noise here — real source stays strict.
  {
    files: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}'],
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
