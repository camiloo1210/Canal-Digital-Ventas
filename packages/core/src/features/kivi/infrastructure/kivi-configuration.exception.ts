import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

/** Operator-level misconfiguration. Messages name the variable, never its value. */
export class KiviConfigurationException extends InfrastructureException {
  public constructor(message: string) {
    super(message);
    this.name = 'KiviConfigurationException';
  }
}
