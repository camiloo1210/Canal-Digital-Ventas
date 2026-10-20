'use client';

import * as React from 'react';
import { useCartStore } from '@/features/cart/store/cart.store';
import { Button } from '@/components/ui/button';
import { Check, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddToCartButtonProps {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  inStock: boolean;
  hasVariants: boolean;
  tenantSlug: string;
}

export function AddToCartButton({
  productId,
  name,
  price,
  imageUrl,
  inStock,
  hasVariants,
  tenantSlug,
}: AddToCartButtonProps): React.JSX.Element {
  const cartStore = useCartStore();
  const t = useTranslations('Storefront');
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const item = cartStore.items.find((entry): boolean => entry.productId === productId);
  const confirmed = added && cartStore.tenantSlug === tenantSlug && Boolean(item);
  const add = (): void => {
    cartStore.addItem({ productId, name, price, imageUrl, quantity: 1 }, tenantSlug);
    setAdded(true);
  };
  const handleAdd = (): void => {
    if (cartStore.tenantSlug && cartStore.tenantSlug !== tenantSlug && cartStore.items.length > 0) {
      setShowDialog(true);
      return;
    }
    add();
  };
  const handleClearAndContinue = (): void => {
    cartStore.clearCart();
    add();
    setShowDialog(false);
  };
  if (!inStock || hasVariants) {
    return (
      <div className="space-y-2">
        <Button disabled variant="secondary" className="min-h-11 w-full">
          {t(hasVariants ? 'purchase.chooseVariant' : 'cartOutOfStock')}
        </Button>
        {hasVariants && (
          <p className="text-sm text-muted-foreground">{t('purchase.variantHelp')}</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <Button ref={addButtonRef} className="min-h-11 w-full" onClick={handleAdd}>
          <ShoppingCart aria-hidden="true" />
          {t('cartAdd')}
        </Button>
        <DialogContent finalFocus={addButtonRef} closeLabel={t('purchase.close')}>
          <DialogHeader className="pr-10">
            <DialogTitle>{t('cartDifferentStoreTitle')}</DialogTitle>
            <DialogDescription>{t('cartDifferentStoreDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="min-h-11" />}>
              {t('cartCancel')}
            </DialogClose>
            <Button variant="destructive" className="min-h-11" onClick={handleClearAndContinue}>
              {t('cartClearAndContinue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex min-h-5 items-start gap-2 text-sm text-primary"
      >
        {confirmed && (
          <>
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t('purchase.added', { name, count: item?.quantity ?? 0 })}
          </>
        )}
      </p>
    </div>
  );
}
