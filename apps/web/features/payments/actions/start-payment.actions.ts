'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PaymentCheckoutException } from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { paymentsDi } from '@/features/payments/di/payments.di';
import { StartPaymentSchema } from '@/features/payments/schemas/start-payment.schema';

type PaymentActionError =
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'BUSY'
  | 'CREATION_UNAVAILABLE'
  | 'CHECKOUT_REJECTED'
  | 'NOT_FOUND'
  | 'NOT_CONFIGURED'
  | 'DISABLED'
  | 'UNEXPECTED';

export interface StartPaymentActionState {
  readonly errorCode: PaymentActionError | null;
  readonly orderId: string | null;
  readonly message?: string;
  readonly alreadyPaid?: boolean;
}

export async function startPaymentAction(
  _previous: StartPaymentActionState,
  formData: FormData,
): Promise<StartPaymentActionState> {
  const t = await getTranslations('Payments');
  const parsed = StartPaymentSchema.safeParse({ orderId: formData.get('orderId') });
  if (!parsed.success)
    return { errorCode: 'INVALID_INPUT', orderId: null, message: t('INVALID_INPUT') };
  const orderId = parsed.data.orderId;
  let checkoutUrl: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { errorCode: 'UNAUTHORIZED', orderId, message: t('UNAUTHORIZED') };
    const result = await paymentsDi
      .resolveStartCheckout()
      .execute({ orderId, authenticatedBuyerId: user.id });
    if (result.status === 'ALREADY_PAID') {
      return { errorCode: null, orderId, alreadyPaid: true, message: t('alreadyPaid') };
    }
    checkoutUrl = result.checkoutUrl;
    if (!checkoutUrl) return { errorCode: 'UNEXPECTED', orderId, message: t('UNEXPECTED') };
  } catch (error: unknown) {
    const code: PaymentActionError =
      error instanceof PaymentCheckoutException && error.code !== 'INVALID_RESERVATION'
        ? error.code
        : 'UNEXPECTED';
    return { errorCode: code, orderId, message: t(code) };
  }
  // Next.js redirect throws; it must never enter the payment error mapper.
  redirect(checkoutUrl);
}
