import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'inspiration', 'server/dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Enforce using StorageService instead of direct chrome.storage
      'no-restricted-syntax': [
        'warn',
        {
          selector: "MemberExpression[object.object.name='chrome'][object.property.name='storage']",
          message: 'Use StorageService from src/services/storage instead of chrome.storage directly.'
        }
      ],
      // Warn on dangerouslySetInnerHTML usage
      'react/no-danger': 'off', // Using custom rule instead
    },
  },
  // Allow chrome.storage in StorageService only
  {
    files: ['**/services/storage/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // Allow 'any' in utility files where it's intentional for generics
  {
    files: [
      '**/utils/logger.ts',
      '**/utils/encryption.ts',
      '**/utils/requestQueue.ts',
      '**/types/**/*.ts',
      '**/components/ui/**/*.tsx',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
