import { describe, expect, it } from 'vitest';
import { Invitation } from '@/iam/domain/entities/invitation.entity';
import { InvalidInvitationException } from '@/iam/domain/exceptions/invalid-invitation.exception';
import { InvitationNotUsableException } from '@/iam/domain/exceptions/invitation-not-usable.exception';

const NOW = new Date('2026-11-03T10:00:00Z');
const HASH = 'a'.repeat(64);
const base = { id: 'i1', tenantId: 't1', roleId: 'r1', tokenHash: HASH, createdBy: 'u1', now: NOW };
const DAY = 24 * 60 * 60 * 1000;

describe('Invitation', () => {
  it('defaults to 7 days and a single use', () => {
    const snap = Invitation.create(base).toSnapshot();
    expect(snap.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY);
    expect(snap.maxUses).toBe(1);
    expect(snap.useCount).toBe(0);
    expect(snap.revokedAt).toBeNull();
  });

  it('validates expiry (1..30 days), max uses (1..100) and hash format', () => {
    expect(() => Invitation.create({ ...base, expiresInDays: 0 })).toThrow(
      InvalidInvitationException,
    );
    expect(() => Invitation.create({ ...base, expiresInDays: 31 })).toThrow(
      InvalidInvitationException,
    );
    expect(() => Invitation.create({ ...base, expiresInDays: 30 })).not.toThrow();
    expect(() => Invitation.create({ ...base, maxUses: 0 })).toThrow(InvalidInvitationException);
    expect(() => Invitation.create({ ...base, maxUses: 101 })).toThrow(InvalidInvitationException);
    expect(() => Invitation.create({ ...base, maxUses: 100 })).not.toThrow();
    expect(() => Invitation.create({ ...base, tokenHash: 'raw-token' })).toThrow(
      InvalidInvitationException,
    );
  });

  it('consumes up to max uses then refuses', () => {
    const inv = Invitation.create({ ...base, maxUses: 2 });
    inv.consume(NOW);
    expect(inv.isUsable(NOW)).toBe(true);
    inv.consume(NOW);
    expect(inv.isUsable(NOW)).toBe(false);
    expect(() => inv.consume(NOW)).toThrow(InvitationNotUsableException);
  });

  it('is unusable once expired', () => {
    const inv = Invitation.create(base);
    const later = new Date(NOW.getTime() + 7 * DAY);
    expect(inv.isUsable(later)).toBe(false);
    expect(() => inv.consume(later)).toThrow(InvitationNotUsableException);
  });

  it('is unusable once revoked and revoke is idempotent', () => {
    const inv = Invitation.create(base);
    inv.revoke(NOW);
    const first = inv.toSnapshot().revokedAt;
    inv.revoke(new Date(NOW.getTime() + 1000));
    expect(inv.toSnapshot().revokedAt).toEqual(first);
    expect(inv.isUsable(NOW)).toBe(false);
    expect(() => inv.consume(NOW)).toThrow(InvitationNotUsableException);
  });
});

describe('Invitation account mode', () => {
  it('defaults to a generated email account', () => {
    expect(Invitation.create(base).toSnapshot().accountMode).toBe('GENERATED_EMAIL');
  });
  it('keeps the mode chosen by the owner and survives reconstitution', () => {
    const inv = Invitation.create({ ...base, accountMode: 'GOOGLE' });
    expect(inv.toSnapshot().accountMode).toBe('GOOGLE');
    expect(Invitation.reconstitute(inv.toSnapshot()).toSnapshot().accountMode).toBe('GOOGLE');
  });
  it('rejects an unknown mode', () => {
    expect(() => Invitation.create({ ...base, accountMode: 'SMS' as never })).toThrow(
      InvalidInvitationException,
    );
  });
});
