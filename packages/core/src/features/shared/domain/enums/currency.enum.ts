import { InvalidMoneyException } from '@/shared/domain/exceptions/invalid-money.exception';

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  COP = 'COP',
  MXN = 'MXN',
  ARS = 'ARS',
  BRL = 'BRL',
  CLP = 'CLP',
  PEN = 'PEN',
}

export function parseCurrency(value: string): Currency {
  const values = Object.values(Currency) as string[];
  if (!values.includes(value)) {
    throw new InvalidMoneyException(`'${value}' is not a valid currency.`);
  }
  return value as Currency;
}
