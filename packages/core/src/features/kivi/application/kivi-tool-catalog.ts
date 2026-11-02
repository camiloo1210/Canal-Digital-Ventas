export type KiviToolParameterType = 'string' | 'integer' | 'number' | 'boolean';

export interface KiviToolParameter {
  type: KiviToolParameterType;
  description: string;
  required: boolean;
  /** Strings only. */
  max_length?: number;
  enum?: readonly string[];
}

export interface KiviToolDefinition {
  name: string;
  description: string;
  parameters: Readonly<Record<string, KiviToolParameter>>;
  include_contact_phone: boolean;
  cache_seconds: number;
}

export const KIVI_TOOLS_PATH = '/api/kivi/tools';

export const GET_PRODUCT_DETAILS_TOOL = 'get_product_details';

/** Read-only lookup tools Canal registers with Kivi. Never expose stock numbers, costs or ids. */
export const KIVI_TOOL_CATALOG: readonly KiviToolDefinition[] = [
  {
    name: GET_PRODUCT_DETAILS_TOOL,
    description:
      'Busca un producto del catálogo por nombre o SKU y devuelve SKU, categoría, precio, precio al por mayor con su cantidad mínima y la disponibilidad.',
    parameters: {
      query: {
        type: 'string',
        description: 'Nombre o SKU del producto a buscar.',
        required: true,
        max_length: 100,
      },
    },
    include_contact_phone: false,
    cache_seconds: 30,
  },
];
