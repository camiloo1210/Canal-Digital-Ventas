import { createHash, randomBytes } from 'node:crypto';
import type { TokenGeneratorPort } from '@/iam/application/ports/out/token-generator.port';

/** 32 random bytes (256 bits) as base64url; persisted only as a SHA-256 hex digest. */
export class NodeCryptoTokenGenerator implements TokenGeneratorPort {
  public generate(): string {
    return randomBytes(32).toString('base64url');
  }

  public hash(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }
}
