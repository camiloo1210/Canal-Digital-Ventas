import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');
const e2eDir = path.join(webRoot, 'e2e');

function walk(dir: string, found: string[] = []): string[] {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

describe('E2E harness conventions', (): void => {
  it('stores every Playwright test as *.e2e.ts', (): void => {
    const offenders = walk(e2eDir).filter((file): boolean => /\.(spec|test)\.ts$/.test(file));
    expect(offenders).toEqual([]);
    expect(existsSync(e2eDir)).toBe(true);
  });

  it('matches only *.e2e.ts files', (): void => {
    const config = readFileSync(path.join(webRoot, 'playwright.config.ts'), 'utf8');
    expect(config).toContain(String.raw`testMatch: /.*\.e2e\.ts$/`);
  });

  it('never imports the core package', (): void => {
    const offenders = walk(e2eDir).filter(
      (file): boolean =>
        /\.(ts|tsx)$/.test(file) &&
        readFileSync(file, 'utf8').includes('@canaldigital/packages/core'),
    );
    expect(offenders).toEqual([]);
  });

  it('ignores generated Playwright output in git', (): void => {
    const gitignore = readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    expect(gitignore).toContain('apps/web/e2e/.auth/');
    expect(gitignore).toContain('apps/web/test-results/');
    expect(gitignore).toContain('apps/web/playwright-report/');
  });
});
