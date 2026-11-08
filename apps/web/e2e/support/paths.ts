import path from 'node:path';

export const SELLER_STATE = 'e2e/.auth/seller.json';
export const BUYER_STATE = 'e2e/.auth/buyer.json';
export const RUN_FILE = 'e2e/.auth/run.json';

const WEB_ROOT = path.resolve(__dirname, '..', '..');

/** Absolute path of a project-relative E2E artifact, independent of the process cwd. */
export function absolutePath(relativePath: string): string {
  return path.resolve(WEB_ROOT, relativePath);
}
