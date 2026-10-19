'use client';

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { submitCheckoutAction } from '@/features/checkout/actions/checkout.actions';
import {
  checkoutFields,
  type CheckoutActionState,
  type CheckoutFieldName,
} from '@/features/checkout/schemas/checkout.schema';
import { useCartStore } from '@/features/cart/store/cart.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const initialState: CheckoutActionState = { success: false, errorCode: null };

function CheckoutFields({ state }: { state: CheckoutActionState }): React.JSX.Element {
  const t = useTranslations('Storefront.checkout');
  const summaryRef = useRef<HTMLDivElement>(null);
  const [edited, setEdited] = useState<Set<CheckoutFieldName>>(new Set());
  useEffect((): void => {
    if (state.errorCode) summaryRef.current?.focus();
  }, [state.errorCode, state.submissionId]);
  const errors = checkoutFields.filter(
    (field): boolean => Boolean(state.fieldErrors?.[field.name]) && !edited.has(field.name),
  );
  return (
    <>
      {state.errorCode && (
        <Alert
          ref={summaryRef}
          tabIndex={-1}
          variant="destructive"
          aria-labelledby="checkout-error-title"
          className="scroll-mt-24 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AlertTitle id="checkout-error-title">{t('errorTitle')}</AlertTitle>
          <AlertDescription>
            <p>{state.message || t('genericError')}</p>
            {errors.length > 0 && (
              <ul className="list-disc pl-5">
                {errors.map((field): React.JSX.Element => (
                  <li key={field.name}>
                    <a
                      className="underline"
                      href={`#checkout-${field.label}`}
                      onClick={(event: React.MouseEvent<HTMLAnchorElement>): void => {
                        event.preventDefault();
                        document.getElementById(`checkout-${field.label}`)?.focus();
                      }}
                    >
                      {t(`fields.${field.label}`)}: {state.fieldErrors?.[field.name]}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
      {(['customer', 'shipping'] as const).map((section): React.JSX.Element => (
        <FieldSet key={section}>
          <FieldLegend>
            {t(section === 'customer' ? 'customerDetails' : 'shippingDetails')}
          </FieldLegend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {checkoutFields
              .filter((field): boolean => field.section === section)
              .map((field): React.JSX.Element => {
                const error = !edited.has(field.name) ? state.fieldErrors?.[field.name] : undefined;
                return (
                  <Field key={field.name} data-invalid={Boolean(error)}>
                    <FieldLabel htmlFor={`checkout-${field.label}`}>
                      {t(`fields.${field.label}`)}
                    </FieldLabel>
                    <Input
                      id={`checkout-${field.label}`}
                      name={field.name}
                      type={field.type}
                      autoComplete={field.autoComplete}
                      required={field.name !== 'shipping.reference'}
                      maxLength={field.name === 'customer.email' ? 254 : 500}
                      defaultValue={state.values?.[field.name] ?? ''}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `checkout-${field.label}-error` : undefined}
                      className="min-h-11 scroll-mt-24"
                      onChange={(): void =>
                        setEdited((previous): Set<CheckoutFieldName> =>
                          new Set(previous).add(field.name),
                        )
                      }
                    />
                    {error && (
                      <p id={`checkout-${field.label}-error`} className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                  </Field>
                );
              })}
          </div>
        </FieldSet>
      ))}
    </>
  );
}

export function CheckoutForm({ tenantSlug }: { tenantSlug: string }): React.JSX.Element {
  const locale = useLocale();
  const t = useTranslations('Storefront.checkout');
  const cartStore = useCartStore();
  const clearCart = useCartStore((store): (() => void) => store.clearCart);
  const [state, formAction, isPending] = useActionState(
    submitCheckoutAction.bind(null, tenantSlug),
    initialState,
  );
  useEffect((): void => {
    if (state.success) clearCart();
  }, [state.success, clearCart]);
  if (state.success)
    return (
      <div className="flex flex-col items-center p-8 text-center space-y-4" role="status">
        <CheckCircle2 aria-hidden="true" className="size-16 text-primary" />
        <h2 className="text-2xl font-bold">{t('successTitle')}</h2>
        <p className="text-muted-foreground">{t('successMessage')}</p>
        <Button nativeButton={false} render={<Link href={`/store/${tenantSlug}`} />}>
          {t('continueShopping')}
        </Button>
      </div>
    );
  const totalItems = cartStore.items.reduce((sum, item): number => sum + item.quantity, 0);
  const subtotal = cartStore.items.reduce(
    (sum, item): number => sum + Math.round(item.price * 100) * item.quantity,
    0,
  );
  const cartPayload = cartStore.items.map((item): { productId: string; quantity: number } => ({
    productId: item.productId,
    quantity: item.quantity,
  }));
  return (
    <form
      action={formAction}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8"
      aria-busy={isPending}
    >
      <input type="hidden" name="cartItems" value={JSON.stringify(cartPayload)} />
      <div className="min-w-0 space-y-6">
        <CheckoutFields key={state.submissionId ?? 'initial'} state={state} />
      </div>
      <Card className="lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>
            <h2>{t('orderSummary')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{t('items', { count: totalItems })}</p>
          <ul className="space-y-3 text-sm">
            {cartStore.items.map((item): React.JSX.Element => (
              <li key={item.productId} className="flex justify-between gap-4">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {item.name}
                  <span className="block text-muted-foreground">
                    {t('lineQuantity', { count: item.quantity })}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(Math.round(item.price * 100) * item.quantity, 'USD', locale)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-medium text-lg border-t pt-4">
            <span>{t('subtotal')}</span>
            <span>{formatMoney(subtotal, 'USD', locale)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('totalsWarning')}</p>
          <Button
            type="submit"
            className="w-full min-h-11"
            disabled={isPending || cartStore.items.length === 0}
          >
            {isPending ? t('processing') : t('submit')}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
