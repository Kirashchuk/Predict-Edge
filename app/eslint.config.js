// ESLint 9 flat config: prettier owns formatting,
// react-hooks enforced, and an architecture guard that forbids deprecated
// import roots so every module lives under app/, features/<x>/, shared/, styles/.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'dev-dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],

      // Architecture guard: concrete modules live under app/, features/<x>/,
      // shared/, or styles/ - not deprecated roots.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/components/*'], message: 'Move into features/<x>/ or shared/ui/.' },
            { group: ['@/hooks/*'], message: 'Move domain hooks to features/<x>/hooks/, generic to shared/hooks/.' },
            { group: ['@/modules/*'], message: 'Move into features/<x>/.' },
            { group: ['@/pages/*'], message: 'Pages live under features/<x>/; route table in app/App.tsx.' },
            { group: ['@/lib', '@/lib/*'], message: 'lib/ was removed. Import from shared/ or the feature barrel.' },
          ],
        },
      ],
    },
  },
  prettier,
);
