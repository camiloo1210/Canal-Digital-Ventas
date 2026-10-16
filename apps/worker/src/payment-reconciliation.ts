import {
  loadPaymentWorkerConfig,
  runPaymentReconciliationWorker,
} from '@canaldigital/packages/core';
import { runPaymentProcess, paymentSetting } from '@/worker/payment-process';

void runPaymentProcess('reconciliation', 8087, async (signal, setReady): Promise<void> => {
  const config = loadPaymentWorkerConfig({
    ...process.env,
    PAYMENT_WORKER_DATABASE_URL: paymentSetting('PAYMENT_RECONCILIATION_DATABASE_URL'),
  });
  await runPaymentReconciliationWorker(
    {
      ...config,
      egressPort: Number(paymentSetting('PAYMENT_EGRESS_PORT')),
      egressToken: paymentSetting('PAYMENT_EGRESS_TOKEN'),
    },
    signal,
    console,
    setReady,
  );
}).catch((): void => {
  console.error('Payment reconciliation startup failed; verify isolated configuration');
  process.exitCode = 1;
});
