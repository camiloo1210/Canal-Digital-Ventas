import { runPaymentRetentionWorker } from '@canaldigital/packages/core';
import { runPaymentProcess, paymentSetting } from '@/worker/payment-process';

void runPaymentProcess('retention', 8089, async (signal, setReady): Promise<void> => {
  await runPaymentRetentionWorker(
    paymentSetting('PAYMENT_RETENTION_DATABASE_URL'),
    signal,
    console,
    setReady,
  );
}).catch((): void => {
  console.error('Payment retention startup failed; verify isolated configuration');
  process.exitCode = 1;
});
