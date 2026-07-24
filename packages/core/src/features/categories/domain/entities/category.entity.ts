import { CategoryStatus } from "@/categories/domain/enums/category-status.enum";

export interface CategoryProps {
    id: string;
    name: string;
    tenantId: number;
    description: string;
    status: CategoryStatus;
}

export class Category {
    private constructor(
        private readonly id: string,
        private name: string,
        private tenantId: number,
        private description: string,
        private status: CategoryStatus
    ) {
    }

    public static create(
        id: string,
        name: string,
        tenantId: number,
        description: string,
        status: CategoryStatus
    ): Category {

        Category.validateId(id);
        Category.validateDescription(description);
        Category.validateName(name);
        Category.validateTenantId(tenantId);
        Category.validateStatus(status);
        return new Category(
            id,
            name,
            tenantId,
            description,
            status
        );
    }

    // Reconstitute
    public static reconstitute(props: CategoryProps): Category {
        return new Category(
            props.id,
            props.name,
            props.tenantId,
            props.description,
            props.status
        );
    }

    // Validations
    private static validateDescription(description: string): void {
        if (description && description.length > 200) {
            throw new Error('Description must not exceed 200 characters.');
        }
    }

    private static validateName(name: string): void {
        if (!name || name.trim().length === 0 || name.length > 100) {
            throw new Error('Name is required and must not exceed 100 characters.');
        }
    }

    private static validateTenantId(tenantId: number): void {
        if (tenantId === undefined || tenantId === null) {
            throw new Error('Tenant ID is required.');
        }
    }

    private static validateStatus(status: CategoryStatus): void {
        if (!status || !Object.values(CategoryStatus).includes(status)) {
            throw new Error('Status is required and must be a valid category status.');
        }
    }

    private static validateId(id: string): void {
        if (!id) {
            throw new Error('ID is required.');
        }
    }

    // Actions
    public archive(): void {
        if (this.status === CategoryStatus.ARCHIVED) {
            throw new Error('Category is already archived.');
        }
        this.status = CategoryStatus.ARCHIVED;
    }



    //Updates
    public updateStatus(newStatus: CategoryStatus): void {
        this.status = newStatus;
    }

    public updateName(newName: string): void {
        Category.validateName(newName);
        this.name = newName;
    }

    public updateDescription(newDescription: string): void {
        Category.validateDescription(newDescription);
        this.description = newDescription;
    }



    // Getters
    public getId(): string {
        return this.id;
    }

    public getName(): string {
        return this.name;
    }

    public getTenantId(): number {
        return this.tenantId;
    }

    public getDescription(): string {
        return this.description;
    }

    public getStatus(): CategoryStatus {
        return this.status;
    }

}