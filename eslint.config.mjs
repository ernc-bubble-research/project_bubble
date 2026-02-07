import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
      "ignores": [
        "**/dist",
        "**/out-tsc",
        "**/vitest.config.*.timestamp*"
      ]
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:db'],
            },
            {
              sourceTag: 'scope:worker',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:db'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'scope:db',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:e2e',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:db'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
