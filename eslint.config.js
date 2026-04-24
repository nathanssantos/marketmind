import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
    {
        ignores: [
            '**/dist/**',
            '**/dist-electron/**',
            '**/dist-web/**',
            '**/node_modules/**',
            '**/build/**',
            '**/coverage/**',
            '**/*.config.js',
            '**/*.config.ts',
            '.eslintrc.cjs',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: tsParser,
            globals: {
                ...globals.es2021,
                ...globals.node,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            'no-undef': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                },
            ],
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
            'complexity': ['warn', 15],
            'max-depth': ['warn', 4],
        },
    },
];
