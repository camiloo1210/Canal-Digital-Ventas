import { DomainException } from '@/shared/domain/exceptions/domain.exception';

export class InvalidCategoryStatusException extends DomainException {
    constructor(reason: string) {
        super(`Invalid category status: ${reason}`);
    }
}
