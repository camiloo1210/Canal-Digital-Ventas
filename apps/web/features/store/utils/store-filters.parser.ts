import { z } from 'zod';

export interface StoreFilters {
  readonly q?: string;
  readonly category?: string;
  readonly page: number;
}

const PAGE_SIZE = 24;
const MAX_PAGE = 1000; // Hard limit to prevent OFFSET abuse

const storeFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Search query is too long')
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  category: z
    .string()
    .max(100, 'Category slug is too long')
    .regex(/^[a-z0-9](-?[a-z0-9])*$/, 'Invalid category slug format')
    .optional(),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE)
    .default(1)
    .catch(1), // If page parsing fails (e.g. string), fallback to 1
});

export function parseStoreFilters(searchParams: { [key: string]: string | string[] | undefined }): StoreFilters {
  // Normalize params
  const rawData = {
    q: Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q,
    category: Array.isArray(searchParams.category)
      ? searchParams.category[0]
      : searchParams.category,
    page: Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page,
  };

  const parsed = storeFiltersSchema.safeParse(rawData);

  if (!parsed.success) {
    // If validation fails aggressively, we just return defaults instead of breaking the public storefront.
    return {
      page: 1,
    };
  }

  return parsed.data;
}

export { PAGE_SIZE };
