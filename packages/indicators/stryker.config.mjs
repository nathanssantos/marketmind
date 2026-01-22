/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress', 'json'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.bench.ts',
    '!src/**/index.ts',
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  concurrency: 4,
  timeoutMS: 10000,
  incremental: true,
  incrementalFile: '.stryker-incremental.json',
  htmlReporter: {
    fileName: 'mutation-report.html',
  },
  jsonReporter: {
    fileName: 'mutation-report.json',
  },
  mutator: {
    excludedMutations: [
      'StringLiteral',
    ],
  },
};

export default config;
