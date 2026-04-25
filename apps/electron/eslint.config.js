import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import globals from 'globals';
import baseConfig from '../../eslint.config.js';

export default [
    ...baseConfig,
    {
        ignores: [
            'coverage/**',
            'scripts/**',
            'dist/**',
            'dist-web/**',
            'dist-electron/**',
            'build/**',
            'e2e/**',
            'playwright-report/**',
            'test-results/**',
            'public/**',
        ],
    },
    {
        files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
        ignores: [
            '**/*.test.{ts,tsx}',
            '**/*.browser.test.{ts,tsx}',
            'src/tests/**',
            'e2e/**',
            'electron-builder.js',
        ],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: tsParser,
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.node.json'],
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooksPlugin,
            'react-refresh': reactRefreshPlugin,
        },
        rules: {
            'no-undef': 'off',
            // TypeScript specific rules
            '@typescript-eslint/no-explicit-any': 'error',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            // Kept at 'warn' for now — relaxed-mode promotion to error surfaced
            // ~218 .ts violations (event handlers + useEffect callbacks needing
            // explicit `: void`). Tracked as Wave 3b follow-up: bulk-add inferred
            // return types via ts-morph or manual annotation.
            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                    allowHigherOrderFunctions: true,
                    allowIIFEs: true,
                    allowDirectConstAssertionInArrowFunctions: true,
                },
            ],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': 'error',
            '@typescript-eslint/prefer-optional-chain': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': ['error', {
                considerDefaultExhaustiveForUnions: true,
            }],
            '@typescript-eslint/no-base-to-string': 'error',
            '@typescript-eslint/no-unsafe-enum-comparison': 'error',
            '@typescript-eslint/only-throw-error': 'error',
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                },
            ],

            // React-hooks rules
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react-refresh/only-export-components': [
                'warn',
                {
                    allowConstantExport: true,
                },
            ],

            // General rules
            'no-undef': 'off',
            'no-console': [
                'warn',
                {
                    allow: ['warn', 'error', 'log'],
                },
            ],
            'prefer-const': 'error',
            'no-var': 'error',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'curly': ['error', 'multi-line'],
            'prefer-arrow-callback': 'warn',
            'prefer-template': 'warn',
            'no-magic-numbers': [
                'warn',
                {
                    ignore: [0, 1, -1],
                    ignoreArrayIndexes: true,
                    ignoreDefaultValues: true,
                    enforceConst: true,
                },
            ],
            'max-lines-per-function': 'off',
            'complexity': ['warn', 15],
            'max-depth': ['warn', 4],
        },
    },
    {
        // React components: their return type is always JSX.Element / ReactNode,
        // adding explicit annotations is pure noise. The rule provides almost zero
        // signal for .tsx files. Disable here so it stays valuable for utility .ts.
        files: ['**/*.tsx'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off',
        },
    },
    {
        files: [
            '**/*.test.{ts,tsx}',
            '**/*.browser.test.{ts,tsx}',
            'src/tests/**',
            'e2e/**/*.{ts,tsx}',
            'electron-builder.js',
        ],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
            'react-hooks': reactHooksPlugin,
        },
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/consistent-type-imports': 'off',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-console': 'off',
        },
    },
];
