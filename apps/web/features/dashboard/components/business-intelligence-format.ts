import { currencyExponent } from '@canaldigital/packages/core/money-format';
import { formatMoney } from '@/lib/money';

export function intelligenceMoney(value: number, currency: string, locale: string): string {
  return formatMoney(value, currency, locale);
}

export function intelligencePercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
    value / 10000,
  );
}

/**
 * Display-only scale for charts and compact axes: minor units divided by 10 ** exponent of the
 * currency (CLP 1, USD 100). It is a float and must never be used for stored or charged amounts.
 */
export function minorToChartScale(value: number, currency: string): number {
  return value / 10 ** currencyExponent(currency);
}
