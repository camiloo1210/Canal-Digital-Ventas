import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

export class CustomerName {
  private constructor(private readonly value: string) {}
  public static from(name: string): CustomerName {
    if (!name || name.trim().length === 0) {
      throw new InvalidCustomerAttributeException('Customer name is required and cannot be empty.');
    }

    if (name.trim().length > 100) {
      throw new InvalidCustomerAttributeException('Customer name cannot exceed 100 characters.');
    }

    return new CustomerName(name.trim());
  }

  public getValue(): string {
    return this.value;
  }
}
