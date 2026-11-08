import { readFileSync } from 'node:fs';
import { absolutePath, RUN_FILE } from '@/e2e/support/paths';

export const runId: string = process.env.E2E_RUN_ID ?? Date.now().toString(36);

const PASSWORD = 'E2e-Passw0rd-Strong!';
const EMAIL_DOMAIN = 'e2e.canaldigital.test';

export interface E2eActors {
  seller: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    storeName: string;
    storeSlug: string;
  };
  buyer: { email: string; password: string };
}

export interface E2eCatalog {
  categoryName: string;
  productName: string;
  sku: string;
  priceText: string;
  stock: number;
}

/** Person names reject digits, so the run id is mapped to letters (0-9 -> a-j). */
function lettersOnly(id: string): string {
  return id.replace(/[0-9]/g, (digit): string => String.fromCharCode(97 + Number(digit)));
}

export function actors(id: string): E2eActors {
  return {
    seller: {
      email: `seller-${id}@${EMAIL_DOMAIN}`,
      password: PASSWORD,
      firstName: 'Vendedor',
      lastName: `Prueba ${lettersOnly(id)}`,
      storeName: `Tienda E2E ${id}`,
      storeSlug: `e2e-${id}`,
    },
    buyer: { email: `buyer-${id}@${EMAIL_DOMAIN}`, password: PASSWORD },
  };
}

export function catalog(id: string): E2eCatalog {
  return {
    categoryName: `Categoria E2E ${id}`,
    productName: `Producto E2E ${id}`,
    sku: `E2E-${id}`.toUpperCase(),
    priceText: '12.50',
    stock: 5,
  };
}

export function readRunId(): string {
  const parsed: unknown = JSON.parse(readFileSync(absolutePath(RUN_FILE), 'utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('runId' in parsed) ||
    typeof parsed.runId !== 'string' ||
    parsed.runId.length === 0
  ) {
    throw new Error('Invalid e2e/.auth/run.json: run the setup project first.');
  }
  return parsed.runId;
}
