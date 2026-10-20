import { InfrastructureException } from '@/shared/application/exceptions/infrastructure.exception';

export class DashboardOverviewReadException extends InfrastructureException {
  constructor(cause: unknown) {
    super('Unable to read the dashboard overview', cause);
    this.name = 'DashboardOverviewReadException';
  }
}
