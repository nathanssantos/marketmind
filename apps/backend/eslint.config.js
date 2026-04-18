import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import baseConfig from '../../eslint.config.js';

export default [
    ...baseConfig,
    {
        ignores: ['scripts/**', 'types.ts', 'dist/**', 'node_modules/**'],
    },
    {
        files: ['src/cli/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
        },
    },
    {
        files: ['src/**/*.{ts,mts}'],
        ignores: ['**/*.test.ts', 'src/__tests__/**/*.ts', 'src/cli/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: './tsconfig.json',
            },
            globals: {
                ...globals.node,
                ...globals.es2021,
                NodeJS: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-misused-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
            '@typescript-eslint/prefer-nullish-coalescing': 'warn',
            '@typescript-eslint/prefer-optional-chain': 'warn',
            'no-console': 'off',
        },
    },
    {
        files: ['**/*.test.ts', 'src/__tests__/**/*.ts', 'test-*.mjs', '**/*.mjs'],
        languageOptions: {
            parser: tsParser,
            globals: {
                ...globals.node,
                ...globals.es2021,
                ...globals.vitest,
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                vi: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
            'no-console': 'off',
            'no-magic-numbers': 'off',
            'no-constant-binary-expression': 'off',
            'no-empty': 'off',
            'prefer-const': 'warn',
        },
    },
];
