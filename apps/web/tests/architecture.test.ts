import { beforeAll, describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { primaryAdapterViolations, restrictedCoreExports } from '@/tests/primary-adapter-policy';

function webFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry): string[] => {
    if (['node_modules', '.next', 'tests'].includes(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? webFiles(fullPath) : /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('web delivery uses server-only DI and serializable presentation models', (): void => {
  let restricted: ReadonlySet<string>;

  beforeAll((): void => {
    restricted = restrictedCoreExports();
  }, 20000);

  test.each(webFiles(path.resolve(__dirname, '..')))('%s', (file: string): void => {
    expect(primaryAdapterViolations(file, readFileSync(file, 'utf8'), restricted)).toEqual([]);
  });
});
