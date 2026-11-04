import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const featuresRoot = path.resolve(__dirname, '..', '..');

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (/\.ts$/.test(entry) && !/\.(test|spec)\.ts$/.test(entry)) found.push(full);
  }
  return found;
}

describe('SQL authorisation follows permissions, not hard-coded roles', (): void => {
  it('no adapter authorises with a fixed OWNER/ADMIN list (use core.member_has_permission)', (): void => {
    const offenders = walk(featuresRoot)
      .filter((file): boolean =>
        /role\s+IN\s*\(\s*'OWNER'\s*,\s*'ADMIN'\s*\)/i.test(readFileSync(file, 'utf8')),
      )
      .map((file): string => path.relative(featuresRoot, file));
    expect(offenders).toEqual([]);
  });
});
