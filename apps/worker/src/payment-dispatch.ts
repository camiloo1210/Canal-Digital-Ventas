import {
  loadPaymentWorkerConfig,
  runPaymentRefundDispatchWorker,
} from '@canaldigital/packages/core';
import { runPaymentProcess, paymentSetting } from '@/worker/payment-process';

void runPaymentProcess('dispatch', 8086, async (signal, setReady): Promise<void> => {
  const config = loadPaymentWorkerConfig(process.env);
  await runPaymentRefundDispatchWorker(
    { ...config, apiKey: paymentSetting('LEMON_SQUEEZY_API_KEY') },
    signal,
    console,
    setReady,
  );
}).catch((): void => {
  console.error('Refund dispatch startup failed; verify isolated configuration');
  process.exitCode = 1;
});
