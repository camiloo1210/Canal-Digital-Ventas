import type { AuthPort } from '@/iam/application/ports/out/auth.port';
import type { AdminAuthPort } from '@/iam/application/ports/out/admin-auth.port';
import type { StaffEmailGenerator } from '@/iam/domain/services/staff-email-generator';
import { EmailAlreadyRegisteredException } from '@/iam/application/exceptions/email-already-registered.exception';
import { AdminAuthUnavailableException } from '@/iam/application/exceptions/admin-auth-unavailable.exception';
import { StaffEmailGenerationExhaustedException } from '@/iam/application/exceptions/staff-email-generation-exhausted.exception';

export interface CreateStaffAccountDto {
  firstName: string;
  lastName: string;
  tenantSlug: string;
  /** Recorded as app_metadata.managed_by_tenant: the business that owns the account. */
  tenantId: string;
  password: string;
}

export interface CreateStaffAccountResult {
  userId: string;
  /** The generated login address (never deliverable). */
  email: string;
}

export const STAFF_EMAIL_MAX_ATTEMPTS = 100;

/**
 * Creates the Supabase Auth user for a GENERATED_EMAIL invitation. It REQUIRES the admin port: the
 * user is created already confirmed (the address cannot receive mail) and tagged as managed by the
 * tenant in app_metadata, which end users cannot forge. There is no anonymous sign up fallback.
 */
export class CreateStaffAccountUseCase {
  public constructor(
    private readonly auth: AuthPort,
    private readonly admin: AdminAuthPort | null,
    private readonly emails: StaffEmailGenerator,
    private readonly maxAttempts: number = STAFF_EMAIL_MAX_ATTEMPTS,
  ) {}

  public async execute(dto: CreateStaffAccountDto): Promise<CreateStaffAccountResult> {
    const admin = this.admin;
    if (!admin) throw new AdminAuthUnavailableException();
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const email = this.emails.generate(
        {
          firstName: dto.firstName,
          lastName: dto.lastName,
          tenantSlug: dto.tenantSlug,
        },
        attempt,
      );
      try {
        const userId = await this.createUser(admin, email, dto.password, dto.tenantId);
        return { userId, email };
      } catch (error: unknown) {
        if (error instanceof EmailAlreadyRegisteredException) continue;
        throw error;
      }
    }
    throw new StaffEmailGenerationExhaustedException();
  }

  /** Compensation after a later step failed. Only the admin key can delete auth users; returns whether the user was deleted. */
  public async rollback(userId: string): Promise<boolean> {
    if (!this.admin) return false;
    await this.admin.deleteUser(userId);
    return true;
  }

  private async createUser(
    admin: AdminAuthPort,
    email: string,
    password: string,
    tenantId: string,
  ): Promise<string> {
    const userId = await admin.createConfirmedUser(email, password, tenantId);
    try {
      await this.auth.signInWithEmail(email, password);
    } catch (error: unknown) {
      await admin.deleteUser(userId);
      throw error;
    }
    return userId;
  }
}
