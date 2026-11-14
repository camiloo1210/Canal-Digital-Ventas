import { describe, expect, it } from 'vitest';
import {
  StaffEmailGenerator,
  slugifyPersonName,
  isGeneratedStaffEmailOf,
  staffLoginIdentifier,
  resolveStaffLoginIdentifier,
} from '@/iam/domain/services/staff-email-generator';
import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';

describe('staff login identifiers', (): void => {
  it('normalizes names and handles unsupported characters', (): void => {
    expect(slugifyPersonName('María José', 'Peña-Núñez')).toBe('maria.jose.pena.nunez');
    expect(slugifyPersonName('李', '王')).toBe('staff');
    expect(slugifyPersonName('a'.repeat(20), 'b'.repeat(20)).length).toBeLessThanOrEqual(30);
  });

  it('generates a simple address and numbered candidates', (): void => {
    const generator = new StaffEmailGenerator();
    const input = { firstName: 'Juanda', lastName: 'Brazales', tenantSlug: 'tienda' };
    expect(generator.generate(input)).toBe('juanda.brazales@tienda.staff.invalid');
    expect(generator.generate(input, 1)).toBe('juanda.brazales2@tienda.staff.invalid');
    expect(generator.generate(input, 2)).toBe('juanda.brazales3@tienda.staff.invalid');
    expect(() => generator.generate({ ...input, tenantSlug: 'bad@store' })).toThrow(
      InvalidInvitationException,
    );
  });

  it('round trips both new and legacy identifiers without changing real emails', (): void => {
    for (const email of [
      'juanda.brazales@tienda.staff.invalid',
      'ana-perez.abcdef@tienda.staff.invalid',
    ]) {
      expect(resolveStaffLoginIdentifier(staffLoginIdentifier(email))).toBe(email);
      expect(isGeneratedStaffEmailOf(email, 'tienda')).toBe(true);
      expect(isGeneratedStaffEmailOf(email, 'other')).toBe(false);
    }
    expect(resolveStaffLoginIdentifier('ana@example.com')).toBe('ana@example.com');
    expect(staffLoginIdentifier('ana@example.com')).toBe('ana@example.com');
    expect(resolveStaffLoginIdentifier('bad@@tienda')).toBe('bad@@tienda');
  });
});
