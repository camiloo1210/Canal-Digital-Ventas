import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class ProductNotFoundException extends DomainException {
    constructor(id: string) {
        super(`Product with ID '${id}' was not found.`);
    }
}