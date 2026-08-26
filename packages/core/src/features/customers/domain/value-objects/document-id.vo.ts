import { InvalidCustomerAttributeException } from '@/customers/domain/exceptions/invalid-customer-attribute.exception';

export class DocumentId {
  private constructor(private readonly value: string) {}

  public static from(documentId: string): DocumentId {
    if (!documentId || documentId.trim().length === 0) {
      throw new InvalidCustomerAttributeException('Document ID is required and cannot be empty.');
    }

    const cleaned = documentId.trim().toUpperCase();

    if (cleaned.length < 5 || cleaned.length > 20) {
      throw new InvalidCustomerAttributeException(
        'Document ID length must be between 5 and 20 characters.',
      );
    }

    return new DocumentId(cleaned);
  }

  public getValue(): string {
    return this.value;
  }
}
