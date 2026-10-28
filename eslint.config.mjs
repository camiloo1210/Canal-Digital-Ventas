import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.json', './packages/*/tsconfig.json'],
        },
      },
      'boundaries/elements': [
        { type: 'domain', pattern: '**/domain/**/*' },
        { type: 'application', pattern: '**/application/**/*' },
        { type: 'infrastructure', pattern: '**/infrastructure/**/*' },
        { type: 'shared', pattern: '**/features/shared/**/*' },
        { type: 'feature', pattern: '**/features/*/**/*', capture: ['featureName'] },
      ],
      'boundaries/include': ['packages/core/src/features/**/*'],
    },
    rules: {
      '@next/next/no-html-link-for-pages': ['error', 'apps/web/app'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./**', '../**', '.', '..'],
              message: 'Use an @/ alias or the public package name instead of relative imports.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^\\./]',
          message: 'Use an @/ alias or the public package name for dynamic imports.',
        },
        {
          selector: 'CallExpression[callee.name="require"] > Literal.arguments[value=/^\\./]',
          message: 'Use an @/ alias or the public package name instead of relative paths.',
        },
      ],
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'domain' } },
              disallow: [
                { to: { element: { type: 'application' } } },
                { to: { element: { type: 'infrastructure' } } },
              ],
              message: 'Domain code must not depend on Application or Infrastructure.',
            },
            {
              from: { element: { type: 'application' } },
              disallow: [{ to: { element: { type: 'infrastructure' } } }],
              message:
                'Application use cases must depend on ports instead of Infrastructure implementations.',
            },
            {
              from: { element: { type: 'feature' } },
              disallow: [
                {
                  to: {
                    element: {
                      type: 'feature',
                      captured: { featureName: '!{{from.featureName}}' },
                    },
                  },
                },
              ],
              message:
                'Features must communicate through shared contracts or events instead of direct feature imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'packages/core/src/features/kivi/**/*.ts',
      'packages/core/src/features/dashboard/domain/**/*.ts',
      'packages/core/src/features/dashboard/infrastructure/*business-intelligence*.ts',
      'apps/web/features/kivi/**/*.{ts,tsx}',
      'apps/web/features/dashboard/**/*business-intelligence*.{ts,tsx}',
      'apps/web/tests/*business-intelligence*.{ts,tsx}',
      'apps/web/tests/kivi*.ts',
      'apps/worker/src/kivi-sync.ts',
      'apps/worker/docker/verify.mjs',
    ],
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: false,
          allowHigherOrderFunctions: false,
          allowDirectConstAssertionInArrowFunctions: false,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/^\\./]',
          message: 'Use an absolute alias for dynamic imports.',
        },
        {
          selector: 'CallExpression[callee.name="require"] > Literal.arguments[value=/^\\./]',
          message: 'Use an absolute alias for module imports.',
        },
        {
          selector:
            'ThrowStatement > NewExpression[callee.name=/^(Error|TypeError|RangeError|SyntaxError|ReferenceError|EvalError|URIError|AggregateError)$/]',
          message: 'Throw a custom exception instead of a generic built-in error.',
        },
      ],
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    files: ['apps/web/components/ui/**/*.tsx', 'apps/web/components/ui/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'apps/web/.next/**',
    'out/**',
    'build/**',
    '.local/**',
    '**/next-env.d.ts',
  ]),
]);

export default eslintConfig;
