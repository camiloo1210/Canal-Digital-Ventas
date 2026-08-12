export class Address {
  private constructor(
    private readonly street: string,
    private readonly city: string,
    private readonly state: string,
    private readonly zipCode: string,
    private readonly country: string,
    private readonly reference: string | null,
  ) {}

  public static create(
    street: string,
    city: string,
    state: string,
    zipCode: string,
    country: string,
    reference?: string,
  ): Address {
    if (!street || !city || !state || !country) {
      throw new Error('Street, city, state, and country are required.');
    }
    return new Address(
      street.trim(),
      city.trim(),
      state.trim(),
      zipCode.trim(),
      country.trim(),
      reference?.trim() || null,
    );
  }

  public equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.city === other.city &&
      this.state === other.state &&
      this.zipCode === other.zipCode &&
      this.country === other.country &&
      this.reference === other.reference
    );
  }

  //Getters

  public getReference(): string | null {
    return this.reference;
  }

  public getStreet(): string {
    return this.street;
  }

  public getCity(): string {
    return this.city;
  }

  public getState(): string {
    return this.state;
  }

  public getZipCode(): string {
    return this.zipCode;
  }

  public getCountry(): string {
    return this.country;
  }
}
