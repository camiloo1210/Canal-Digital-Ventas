export type CatalogStatus = 'active' | 'inactive' | 'archived' | 'out_of_stock';

export interface AdminCatalogQuery {
  q: string;
  status: CatalogStatus | 'all';
  page: number;
  limit: number;
}

export interface AdminProductCatalogItem {
  id: string;
  name: string;
  sku: string;
  categoryName: string;
  priceCents: number;
  currency: string;
  stock: number;
  status: CatalogStatus;
  imageUrl: string | null;
}

export interface AdminCategoryCatalogItem {
  id: string;
  name: string;
  description: string | null;
  status: CatalogStatus;
  productCount: number;
}

export interface AdminCatalogPage<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

export interface ProductFormContextReadModel {
  currency: string;
  categories: { id: string; name: string; status: CatalogStatus }[];
}

export interface AdminCatalogReadPort {
  findProductFormContextForManager(
    userId: string,
    tenantId: string,
    currentCategoryId?: string,
  ): Promise<ProductFormContextReadModel | null>;
  findProductsForManager(
    userId: string,
    tenantId: string,
    query: AdminCatalogQuery,
  ): Promise<AdminCatalogPage<AdminProductCatalogItem> | null>;
  findCategoriesForManager(
    userId: string,
    tenantId: string,
    query: AdminCatalogQuery,
  ): Promise<AdminCatalogPage<AdminCategoryCatalogItem> | null>;
}
