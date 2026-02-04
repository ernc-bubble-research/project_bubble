import nx from '@nx/eslint-plugin';
import rxjsAngularX from 'eslint-plugin-rxjs-angular-x';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    plugins: {
      'rxjs-angular-x': rxjsAngularX,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      'rxjs-angular-x/prefer-takeuntil': [
        'error',
        {
          alias: ['takeUntilDestroyed'],
          checkDecorators: ['Component', 'Directive', 'Pipe'],
          checkDestroy: false,
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
