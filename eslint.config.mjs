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
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
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
              message:
                'El dominio es el core puro del negocio. No puede depender de Application ni de Infrastructure.',
            },
            {
              from: { element: { type: 'application' } },
              disallow: [{ to: { element: { type: 'infrastructure' } } }],
              message:
                'Los Casos de Uso (Application) no pueden depender de la implementación técnica (Infrastructure).',
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
                'Un feature no puede importar directamente nada de otro feature. Utiliza shared o Eventos.',
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
