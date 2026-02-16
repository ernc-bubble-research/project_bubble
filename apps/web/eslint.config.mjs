import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';
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
    // Ban runtime imports from @project-bubble/shared in browser code.
    // Only @project-bubble/shared/web (runtime) or `import type` (type-only) are safe.
    // Runtime barrel imports pull class-transformer → Reflect.getMetadata crash in browser.
    // Spec files excluded: they run in Node/Jest where reflect-metadata is available.
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@project-bubble/shared',
              message:
                'Use @project-bubble/shared/web for runtime imports, or `import type` for type-only imports. Runtime imports pull class-transformer into the browser bundle (Reflect.getMetadata crash).',
              allowTypeImports: true,
            },
          ],
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
