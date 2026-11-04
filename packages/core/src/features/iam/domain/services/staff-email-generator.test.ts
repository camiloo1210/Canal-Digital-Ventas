import { describe, expect, it } from 'vitest';
import {
  STAFF_EMAIL_DOMAIN_SUFFIX,
  StaffEmailGenerator,
  isGeneratedStaffEmailOf,
  slugifyPersonName,
} from '@/iam/domain/services/staff-email-generator';
import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';

function fixedBytes(bytes: number[]): (length: number) => Uint8Array {
  return (length: number): Uint8Array => Uint8Array.from(bytes.slice(0, length));
}

describe('slugifyPersonName', (): void => {
  it('strips accents, lowercases and keeps only ascii letters and digits', (): void => {
    expect(slugifyPersonName('María José', 'Peña-Núñez')).toBe('maria-jose-pena-nunez');
  });
  it('drops symbols, emoji and collapses separators', (): void => {
    expect(slugifyPersonName("  O'Brien  ", '(Jr.)')).toBe('o-brien-jr');
    expect(slugifyPersonName('Ana 😀', 'Pérez')).toBe('ana-perez');
  });
  it('caps the slug at 30 characters without a trailing dash', (): void => {
    const slug = slugifyPersonName('a'.repeat(20), 'b'.repeat(20));
    expect(slug.length).toBeLessThanOrEqual(30);
    expect(slug.endsWith('-')).toBe(false);
  });
  it('falls back to a neutral label when nothing ascii survives', (): void => {
    expect(slugifyPersonName('李', '王')).toBe('staff');
  });
});

describe('StaffEmailGenerator', (): void => {
  it('builds <slug>.<6 base32 chars>@<tenant>.staff.invalid from injected randomness', (): void => {
    const generator = new StaffEmailGenerator(fixedBytes([0, 1, 2, 25, 26, 31]));
    const email = generator.generate({
      firstName: 'Ana',
      lastName: 'Pérez',
      tenantSlug: 'mi-tienda',
    });
    expect(email).toBe('ana-perez.abcz27@mi-tienda.staff.invalid');
    expect(email.endsWith(STAFF_EMAIL_DOMAIN_SUFFIX)).toBe(true);
  });
  it('only emits lowercase base32 for any byte value', (): void => {
    const all = Array.from({ length: 256 }, (_, index: number): number => index);
    for (let offset = 0; offset < 250; offset += 6) {
      const generator = new StaffEmailGenerator(fixedBytes(all.slice(offset, offset + 6)));
      const email = generator.generate({ firstName: 'A', lastName: 'B', tenantSlug: 't' });
      expect(email).toMatch(/^a-b\.[a-z2-7]{6}@t\.staff\.invalid$/);
    }
  });
  it('produces different addresses for different random draws', (): void => {
    const a = new StaffEmailGenerator(fixedBytes([1, 1, 1, 1, 1, 1])).generate({
      firstName: 'Ana',
      lastName: 'Ruiz',
      tenantSlug: 't',
    });
    const b = new StaffEmailGenerator(fixedBytes([2, 2, 2, 2, 2, 2])).generate({
      firstName: 'Ana',
      lastName: 'Ruiz',
      tenantSlug: 't',
    });
    expect(a).not.toBe(b);
  });
  it('rejects a tenant slug that is not a valid dns label', (): void => {
    const generator = new StaffEmailGenerator(fixedBytes([0, 0, 0, 0, 0, 0]));
    for (const tenantSlug of ['', 'Has Space', 'a@b', '-lead', 'x'.repeat(64)]) {
      expect(() => generator.generate({ firstName: 'A', lastName: 'B', tenantSlug })).toThrow(
        InvalidInvitationException,
      );
    }
  });
  it('rejects a random source that returns too few bytes', (): void => {
    const generator = new StaffEmailGenerator(fixedBytes([1, 2]));
    expect(() => generator.generate({ firstName: 'A', lastName: 'B', tenantSlug: 't' })).toThrow(
      InvalidInvitationException,
    );
  });
});

describe('isGeneratedStaffEmailOf', (): void => {
  it('recognises generated addresses of the same tenant only', (): void => {
    expect(isGeneratedStaffEmailOf('ana-perez.abcz27@tienda.staff.invalid', 'tienda')).toBe(true);
    expect(isGeneratedStaffEmailOf('ANA.abcz27@Tienda.staff.invalid', 'tienda')).toBe(true);
    expect(isGeneratedStaffEmailOf('ana.abcz27@otra.staff.invalid', 'tienda')).toBe(false);
    expect(isGeneratedStaffEmailOf('ana@tienda.com', 'tienda')).toBe(false);
    expect(isGeneratedStaffEmailOf('x@evil.tienda.staff.invalid', 'tienda')).toBe(false);
    expect(isGeneratedStaffEmailOf('', 'tienda')).toBe(false);
  });
});
