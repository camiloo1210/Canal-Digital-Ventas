import { InvalidDemographicBucketException } from '@/iam/domain/exceptions/invalid-demographic-bucket.exception';

/** The 24 provinces of Ecuador plus OTHER (abroad / not listed). */
export const PROVINCES = [
  'AZUAY',
  'BOLIVAR',
  'CANAR',
  'CARCHI',
  'CHIMBORAZO',
  'COTOPAXI',
  'EL_ORO',
  'ESMERALDAS',
  'GALAPAGOS',
  'GUAYAS',
  'IMBABURA',
  'LOJA',
  'LOS_RIOS',
  'MANABI',
  'MORONA_SANTIAGO',
  'NAPO',
  'ORELLANA',
  'PASTAZA',
  'PICHINCHA',
  'SANTA_ELENA',
  'SANTO_DOMINGO',
  'SUCUMBIOS',
  'TUNGURAHUA',
  'ZAMORA_CHINCHIPE',
  'OTHER',
] as const;
export type ProvinceValue = (typeof PROVINCES)[number];

export class Province {
  private constructor(private readonly value: ProvinceValue) {}

  public static create(raw: string): Province {
    const found = PROVINCES.find((candidate): boolean => candidate === raw);
    if (!found) throw new InvalidDemographicBucketException('province', String(raw));
    return new Province(found);
  }

  public getValue(): ProvinceValue {
    return this.value;
  }
}
