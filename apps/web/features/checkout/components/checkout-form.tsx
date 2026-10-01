'use client';

import * as React from 'react';
import { useActionState, useEffect } from 'react';
import {
  submitCheckoutAction,
  CheckoutActionState,
} from '@/features/checkout/actions/checkout.actions';
import { useCartStore } from '@/features/cart/store/cart.store';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';

interface CheckoutFormProps {
  tenantSlug: string;
}

const initialState: CheckoutActionState = {
  success: false,
  errorCode: null,
};

export function CheckoutForm({ tenantSlug }: CheckoutFormProps): React.JSX.Element {
  const t = useTranslations('Storefront.checkout');
  const cartStore = useCartStore();
  const clearCart = useCartStore((state) => state.clearCart);
  const router = useRouter();

  const submitWithTenant = submitCheckoutAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(submitWithTenant, initialState);

  // Clear cart upon successful authoritative commit
  useEffect(() => {
    if (state.success) {
      clearCart();
    }
  }, [state.success, clearCart]);

  if (state.success) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold">{t('successTitle')}</h2>
        <p className="text-muted-foreground">{t('successMessage')}</p>
        <Button onClick={() => router.push(`/store/${tenantSlug}`)}>{t('continueShopping')}</Button>
      </div>
    );
  }

  // Derived totals for UX only
  const totalItems = cartStore.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartStore.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Zod compliant payload
  const cartPayload = cartStore.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));

  return (
    <form action={formAction} className="space-y-6">
      {state.errorCode && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription>{state.message || t('genericError')}</AlertDescription>
        </Alert>
      )}

      {/* Trust Boundary: Strictly controlled payload via hidden input */}
      <input type="hidden" name="cartItems" value={JSON.stringify(cartPayload)} />

      <div className="space-y-4">
        <h3 className="font-semibold text-lg">{t('customerDetails') || 'Datos del Cliente'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre completo</label>
            <input
              name="customer.name"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              name="customer.email"
              type="email"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Teléfono</label>
            <input
              name="customer.phone"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Documento de Identidad</label>
            <input
              name="customer.documentId"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <h3 className="font-semibold text-lg mt-6">{t('shippingDetails') || 'Datos de Envío'}</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Calle y número</label>
            <input
              name="shipping.street"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ciudad</label>
              <input
                name="shipping.city"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado / Provincia</label>
              <input
                name="shipping.state"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Código Postal</label>
              <input
                name="shipping.zipCode"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">País</label>
              <input
                name="shipping.country"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Referencia (Opcional)</label>
            <input
              name="shipping.reference"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg space-y-4">
        <h3 className="font-semibold text-lg">{t('orderSummary')}</h3>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('items', { count: totalItems })}</span>
        </div>
        <div className="flex justify-between font-medium text-lg border-t pt-4">
          <span>{t('subtotal')}</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <p className="text-xs text-muted-foreground italic">{t('totalsWarning')}</p>
      </div>

      <Button type="submit" className="w-full" disabled={isPending || cartStore.items.length === 0}>
        {isPending ? t('processing') : t('submit')}
      </Button>
    </form>
  );
}
