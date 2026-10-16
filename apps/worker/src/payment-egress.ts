import { runPaymentEvidenceWorker } from '@canaldigital/packages/core';
import { runPaymentProcess, paymentSetting } from '@/worker/payment-process';

void runPaymentProcess('egress', 8088, async (signal, setReady): Promise<void> => {
  const environment = paymentSetting('PAYMENTS_ENVIRONMENT');
  if (environment !== 'test' && environment !== 'production')
    throw new Error('Invalid payment environment');
  await runPaymentEvidenceWorker(
    {
      databaseUrl: paymentSetting('PAYMENT_EGRESS_DATABASE_URL'),
      apiKey: paymentSetting('LEMON_SQUEEZY_API_KEY'),
      environment,
      port: Number(paymentSetting('PAYMENT_EGRESS_PORT')),
      token: paymentSetting('PAYMENT_EGRESS_TOKEN'),
    },
    signal,
    console,
    setReady,
  );
}).catch((): void => {
  console.error('Payment evidence service startup failed; verify isolated configuration');
  process.exitCode = 1;
});
