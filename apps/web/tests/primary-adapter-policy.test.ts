import { describe, expect, it } from 'vitest';
import { primaryAdapterViolations, restrictedCoreExports } from '@/tests/primary-adapter-policy';

const restricted = new Set(['PostgresProductRepository', 'CancelOrderUseCase', 'Product']);

describe('primary adapter architecture enforcement', (): void => {
  it.each(['PostgresEventBusAdapter', 'CategorySlug', 'SupabasePublicTenantDirectoryReadAdapter'])(
    'checks the actual wildcard export %s under an import alias',
    (exportName: string): void => {
      const actual = restrictedCoreExports();
      expect(actual.has(exportName)).toBe(true);
      expect(
        primaryAdapterViolations(
          'apps/web/components/card.tsx',
          `import { ${exportName} as Imported } from '@canaldigital/packages/core'; new Imported();`,
          actual,
        ),
      ).toContain('direct-construction');
    },
  );
  it('detects renamed constructors imported across multiple lines', (): void => {
    const code =
      "import {\n PostgresProductRepository as Repository\n} from '@canaldigital/packages/core';\nnew Repository();";
    expect(
      primaryAdapterViolations(
        'apps/web/features/products/actions/save.actions.ts',
        code,
        restricted,
      ),
    ).toContain('direct-construction');
  });

  it('detects namespace constructors', (): void => {
    expect(
      primaryAdapterViolations(
        'apps/web/app/page.tsx',
        "import * as core from '@canaldigital/packages/core'; new core.CancelOrderUseCase();",
        restricted,
      ),
    ).toContain('direct-construction');
  });

  it('normalizes Windows component paths', (): void => {
    expect(
      primaryAdapterViolations(
        'T:\\repo\\apps\\web\\features\\products\\components\\card.tsx',
        "import { Repository } from '@/products/infrastructure/repository';",
        restricted,
      ),
    ).toContain('technical-import');
  });

  it('rejects runtime domain objects passed through the public barrel', (): void => {
    expect(
      primaryAdapterViolations(
        'apps/web/components/card.tsx',
        "import { Product } from '@canaldigital/packages/core';",
        restricted,
      ),
    ).toContain('technical-import');
  });

  it('requires the server-only guard to be the first DI statement', (): void => {
    expect(
      primaryAdapterViolations(
        'apps/web/features/products/di/products.di.ts',
        "// import 'server-only';\nimport { Product } from '@canaldigital/packages/core';",
        restricted,
      ),
    ).toContain('server-only');
  });

  it('permits guarded DI and pure read-model type imports', (): void => {
    expect(
      primaryAdapterViolations(
        'apps/web/features/products/di/products.di.ts',
        "import 'server-only'; import { PostgresProductRepository } from '@canaldigital/packages/core'; new PostgresProductRepository();",
        restricted,
      ),
    ).toEqual([]);
    expect(
      primaryAdapterViolations(
        'apps/web/components/card.tsx',
        "import type { BusinessIntelligenceReport } from '@canaldigital/packages/core';",
        restricted,
      ),
    ).toEqual([]);
  });
});
