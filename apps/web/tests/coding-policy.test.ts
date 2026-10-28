import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint();
const filePath = 'packages/core/src/features/kivi/application/kivi-backoff.ts';

async function rulesFor(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.flatMap((message): string[] => (message.ruleId ? [message.ruleId] : []));
}

describe('audited feature coding policy', (): void => {
  beforeAll(async (): Promise<void> => {
    await rulesFor('export const initialized = true;');
  }, 20000);
  it('requires explicit return annotations on expression callbacks', async (): Promise<void> => {
    expect(await rulesFor('export const values = [1].map((value) => value + 1);')).toContain(
      '@typescript-eslint/explicit-function-return-type',
    );
  });

  it('rejects generic throw-new shortcuts', async (): Promise<void> => {
    expect(
      await rulesFor("export function fail(): never { throw new Error('failure'); }"),
    ).toContain('no-restricted-syntax');
  });

  it('rejects relative module imports', async (): Promise<void> => {
    expect(await rulesFor("export { value } from './value';")).toContain('no-restricted-imports');
  });

  it('permits a custom failure and an annotated callback', async (): Promise<void> => {
    const rules = await rulesFor(
      "class FixtureFailure extends Error {} export function fail(): never { throw new FixtureFailure('failure'); } export const values = [1].map((value): number => value + 1);",
    );
    expect(rules).not.toContain('no-restricted-syntax');
    expect(rules).not.toContain('@typescript-eslint/explicit-function-return-type');
  });
});
