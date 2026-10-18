import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

/** Resolve from this module, not from pnpm/Node's initial Windows working directory. */
export function loadWorkerEnvironment(): void {
  try {
    loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')
      return;
    throw error;
  }
}
