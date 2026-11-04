import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const SERVICE_ROLE_VARIABLE = 'SUPABASE_SERVICE_ROLE_KEY';
/** Reading the variable from the environment. Doc comments that merely name it are harmless. */
const ENV_READ = new RegExp(
  String.raw`env\.${SERVICE_ROLE_VARIABLE}|env\[['"]${SERVICE_ROLE_VARIABLE}`,
);
/** The only runtime module allowed to read the service role key (server-only DI). */
const ALLOWED_READER = path.join('apps', 'web', 'features', 'iam', 'di', 'iam.di.ts');

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full, found);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) found.push(full);
  }
  return found;
}

function relative(file: string): string {
  return path.relative(repoRoot, file);
}

function isTestFile(file: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(file) || relative(file).split(path.sep).includes('tests');
}

const runtimeSources = [
  ...walk(path.join(repoRoot, 'apps', 'web')),
  ...walk(path.join(repoRoot, 'packages', 'core', 'src')),
].filter((file): boolean => !isTestFile(file));

// Scans every tracked file; the default 5 s is too tight when the whole suite runs in parallel.
describe('service role key never leaks', { timeout: 30_000 }, (): void => {
  it('is read only by the server-only IAM DI module', (): void => {
    const unexpected = runtimeSources
      .filter((file): boolean => ENV_READ.test(readFileSync(file, 'utf8')))
      .map(relative)
      .filter((file): boolean => file !== ALLOWED_READER);
    expect(unexpected).toEqual([]);
    const reader = readFileSync(path.join(repoRoot, ALLOWED_READER), 'utf8');
    expect(reader).toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(reader.split(/\r?\n/).slice(0, 3).join('\n')).toContain("import 'server-only';");
  });

  it('never exposes the key through a NEXT_PUBLIC variable or the Next.js env config', (): void => {
    const offenders = [
      ...runtimeSources,
      path.join(repoRoot, 'apps', 'web', 'next.config.ts'),
      path.join(repoRoot, 'apps', 'web', '.env.example'),
    ].filter((file): boolean =>
      /NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE|NEXT_PUBLIC_[A-Z_]*SECRET_KEY/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(offenders.map(relative)).toEqual([]);
    const nextConfig = readFileSync(path.join(repoRoot, 'apps', 'web', 'next.config.ts'), 'utf8');
    expect(nextConfig).not.toContain(SERVICE_ROLE_VARIABLE);
  });

  it('is never referenced from a client component', (): void => {
    const clientFiles = runtimeSources.filter((file): boolean =>
      /^\s*(['"])use client\1/m.test(readFileSync(file, 'utf8').slice(0, 400)),
    );
    const offenders = clientFiles.filter((file): boolean => {
      const source = readFileSync(file, 'utf8');
      return (
        ENV_READ.test(source) ||
        /iam\/di\/iam\.di|users\/di\/users\.di|business-account\.di/.test(source)
      );
    });
    expect(offenders.map(relative)).toEqual([]);
  });

  it('ships an empty placeholder, never a value, in .env.example', (): void => {
    const example = readFileSync(path.join(repoRoot, 'apps', 'web', '.env.example'), 'utf8');
    const line = example
      .split(/\r?\n/)
      .find((entry): boolean => entry.startsWith(`${SERVICE_ROLE_VARIABLE}=`));
    expect(line).toBeDefined();
    expect((line ?? '').slice(SERVICE_ROLE_VARIABLE.length + 1).trim()).toBe('');
  });

  it('keeps real secrets out of git: no tracked env files and no key-shaped literals', (): void => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    const envFiles = tracked.filter((file): boolean => {
      const base = path.basename(file);
      return /^\.env(\..+)?$/.test(base) && !base.endsWith('.example');
    });
    expect(envFiles).toEqual([]);

    // Supabase secret keys (sb_secret_...) and service-role JWTs must never be committed.
    const keyShaped =
      /sb_secret_[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/;
    const textFiles = tracked.filter((file): boolean =>
      /\.(ts|tsx|js|mjs|json|md|sql|toml|yml|yaml|env|example)$/.test(file),
    );
    const leaks = textFiles.filter((file): boolean => {
      try {
        return keyShaped.test(readFileSync(path.join(repoRoot, file), 'utf8'));
      } catch {
        return false;
      }
    });
    expect(leaks).toEqual([]);
  });
});
