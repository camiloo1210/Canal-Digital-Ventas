import { test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const serverFile = path.resolve(__dirname, '..', 'lib', 'postgres', 'server.ts');

test('El cliente postgres es server-only', () => {
  const content = fs.readFileSync(serverFile, 'utf-8');

  expect(content).toMatch(/^import 'server-only';/);
});

test('El cliente postgres desactiva prepared statements para el pooler en modo transaccion', () => {
  const content = fs.readFileSync(serverFile, 'utf-8');
  const options = content.match(/postgres\(connectionString,\s*\{([\s\S]*?)\}\)/);

  expect(options).not.toBeNull();
  expect(options?.[1]).toMatch(/\bprepare:\s*false\b/);
});
