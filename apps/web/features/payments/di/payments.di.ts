import 'server-only';

import postgres from 'postgres';
import { resolveCheckoutReturnUrl } from '@/features/payments/config/checkout-return-url';
import {
  IngestPaymentWebhookUseCase,
  LemonSqueezyCheckoutAdapter,
  PaymentCheckoutException,
  PostgresPaymentCheckoutRepository,
  PostgresPaymentWebhookInboxAdapter,
  StartPaymentCheckoutUseCase,
  type PaymentEnvironment,
} from '@canaldigital/packages/core';

class PaymentsDIContainer {
  private checkout: StartPaymentCheckoutUseCase | undefined;
  private ingestion: IngestPaymentWebhookUseCase | undefined;

  private environment(): PaymentEnvironment {
    const environment = process.env.PAYMENTS_ENVIRONMENT ?? 'test';
    if (environment !== 'test' && environment !== 'production')
      throw new PaymentCheckoutException('NOT_CONFIGURED');
    return environment;
  }

  private connection(value: string | undefined): postgres.Sql<Record<string, unknown>> {
    if (!value) throw new PaymentCheckoutException('NOT_CONFIGURED');
    let username: string;
    try {
      username = decodeURIComponent(new URL(value).username).split('.')[0];
    } catch {
      throw new PaymentCheckoutException('NOT_CONFIGURED');
    }
    if (!username || ['postgres', 'service_role', 'authenticator'].includes(username)) {
      throw new PaymentCheckoutException('NOT_CONFIGURED');
    }
    return postgres(value, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 20 });
  }

  public resolveStartCheckout(): StartPaymentCheckoutUseCase {
    if (!this.checkout) {
      const key = process.env.LEMON_SQUEEZY_API_KEY;
      const variant = process.env.LEMON_SQUEEZY_VARIANT_ID;
      if (!key || !variant) throw new PaymentCheckoutException('NOT_CONFIGURED');
      this.checkout = new StartPaymentCheckoutUseCase(
        new PostgresPaymentCheckoutRepository(
          this.connection(process.env.PAYMENT_CHECKOUT_DATABASE_URL),
        ),
        new LemonSqueezyCheckoutAdapter(key, variant, resolveCheckoutReturnUrl(process.env)),
        this.environment(),
      );
    }
    return this.checkout;
  }

  public resolveIngestWebhook(): IngestPaymentWebhookUseCase {
    if (!this.ingestion) {
      this.ingestion = new IngestPaymentWebhookUseCase(
        new PostgresPaymentWebhookInboxAdapter(
          this.connection(process.env.PAYMENT_INGESTION_DATABASE_URL),
        ),
        this.environment(),
      );
    }
    return this.ingestion;
  }
}

export const paymentsDi = new PaymentsDIContainer();
