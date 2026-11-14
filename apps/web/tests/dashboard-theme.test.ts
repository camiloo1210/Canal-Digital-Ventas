import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve('apps/web/app/globals.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(selector + ' {');
  if (start === -1) return '';
  return css.slice(start, css.indexOf('\n}', start));
}

describe('dashboard theme tokens', () => {
  it('keeps the shared :root palette untouched for storefront and buyer areas', () => {
    expect(block(':root')).toContain('--primary: oklch(0.205 0 0);');
  });

  it('scopes a branded palette to documents that render the dashboard', () => {
    const light = block(':root:has(.admin-space)');
    for (const token of [
      '--primary',
      '--background',
      '--sidebar',
      '--sidebar-primary',
      '--chart-1',
      '--shadow-card',
    ])
      expect(light, token).toContain(token + ':');
  });

  it('ships a dark variant of the scoped palette', () => {
    const dark = block(':root.dark:has(.admin-space)');
    for (const token of ['--primary', '--background', '--sidebar', '--chart-1'])
      expect(dark, token).toContain(token + ':');
  });
});
