import { InvalidPersonNameException } from '@/shared/domain/exceptions/invalid-person-name.exception';

export class PersonName {
  private static readonly MAX_LENGTH = 100;
  // Allows letters, spaces, hyphens, and apostrophes. Protects against XSS/scripts.
  private static readonly NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-\']+$/;

  private constructor(private readonly value: string) {}

  public static create(value: string): PersonName {
    if (!value || value.trim().length === 0) {
      throw new InvalidPersonNameException('Person name cannot be empty');
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length > PersonName.MAX_LENGTH) {
      throw new InvalidPersonNameException(
        `Person name exceeds maximum length of ${PersonName.MAX_LENGTH} characters`,
      );
    }

    if (!PersonName.NAME_REGEX.test(trimmedValue)) {
      throw new InvalidPersonNameException('Person name contains invalid characters');
    }

    return new PersonName(trimmedValue);
  }

  public static reconstitute(value: string): PersonName {
    return new PersonName(value);
  }

  public getValue(): string {
    return this.value;
  }
}
