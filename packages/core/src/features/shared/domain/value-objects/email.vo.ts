import { InvalidEmailException } from '@/shared/domain/exceptions/invalid-email.exception';

export class Email {
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  private constructor(private readonly value: string) {}

  public static create(value: string): Email {
    if (!value || value.trim().length === 0) {
      throw new InvalidEmailException();
    }

    const trimmedValue = value.trim().toLowerCase();

    if (!Email.EMAIL_REGEX.test(trimmedValue)) {
      throw new InvalidEmailException();
    }

    return new Email(trimmedValue);
  }

  public getValue(): string {
    return this.value;
  }
}
