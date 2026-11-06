export interface UnitPriceTerms {
  retailPriceCents: number;
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number | null;
}

/** Selects a catalog tier after its amounts and requested quantity have been validated. */
export function selectUnitPriceCents(terms: UnitPriceTerms, quantity: number): number {
  const wholesale = terms.wholesalePriceCents;
  const minimum = terms.wholesaleMinQuantity;
  return wholesale !== null &&
    minimum !== null &&
    wholesale > 0 &&
    minimum >= 1 &&
    quantity >= minimum
    ? wholesale
    : terms.retailPriceCents;
}
