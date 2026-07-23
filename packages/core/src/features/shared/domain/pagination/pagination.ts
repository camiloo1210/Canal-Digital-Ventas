
export interface PaginationOptions {
    page: number;
    limit: number;
}

export interface PaginatedResult<T> {
    items: T[];
    totalItems: number;
    totalPages: number;
    currentPage: number;
}