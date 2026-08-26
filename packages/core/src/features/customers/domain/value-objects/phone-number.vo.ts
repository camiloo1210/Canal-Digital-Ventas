import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

export class PhoneNumber {
  private constructor(private readonly value: string) {}

  public static from(phoneNumber: string): PhoneNumber {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      throw new InvalidCustomerAttributeException('Phone number is required and cannot be empty.');
    }

    const cleaned = phoneNumber.trim();
    const phoneRegex = /^\+?[\d\s-]{7,20}$/;

    if (!phoneRegex.test(cleaned)) {
      throw new InvalidCustomerAttributeException('Phone number format is invalid.');
    }

    return new PhoneNumber(cleaned);
  }

  public getValue(): string {
    return this.value;
  }
}
