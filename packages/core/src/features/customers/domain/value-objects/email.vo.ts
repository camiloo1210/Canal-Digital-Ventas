import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

export class Email {
  private constructor(private readonly value: string) {}

  public static from(email: string): Email {
    if (!email || email.trim().length === 0) {
      throw new InvalidCustomerAttributeException('Email is required and cannot be empty.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new InvalidCustomerAttributeException('Email format is invalid.');
    }

    return new Email(email.trim().toLowerCase());
  }

  public getValue(): string {
    return this.value;
  }
}
