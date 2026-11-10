import { InvalidShippingOriginException } from '@/tenants/domain/exceptions/invalid-shipping-origin.exception';

export interface ShippingOriginProps {
  contactName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

const MAX_LENGTH = 120;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
type TextField = 'contactName' | 'phone' | 'street' | 'city' | 'state' | 'zipCode';

export class ShippingOrigin {
  private constructor(private readonly props: ShippingOriginProps) {}

  public static create(input: ShippingOriginProps): ShippingOrigin {
    const text = (field: TextField): string => {
      const value = input[field].trim();
      if (value.length === 0) {
        throw new InvalidShippingOriginException(`${field} cannot be empty.`);
      }
      if (value.length > MAX_LENGTH) {
        throw new InvalidShippingOriginException(
          `${field} must not exceed ${MAX_LENGTH} characters.`,
        );
      }
      return value;
    };
    const country = input.country.trim();
    if (!COUNTRY_PATTERN.test(country)) {
      throw new InvalidShippingOriginException(
        'country must be an uppercase ISO 3166-1 alpha-2 code.',
      );
    }
    return new ShippingOrigin({
      contactName: text('contactName'),
      phone: text('phone'),
      street: text('street'),
      city: text('city'),
      state: text('state'),
      zipCode: text('zipCode'),
      country,
    });
  }

  public toProps(): ShippingOriginProps {
    return { ...this.props };
  }
}
