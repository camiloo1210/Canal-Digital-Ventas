import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidSkuException extends DomainException {
    constructor(sku: string) {
        super(`The SKU '${sku}' is invalid. It must be alphanumeric and 5-20 characters long.`);
    }
}