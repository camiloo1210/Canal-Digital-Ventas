'use client';

import * as React from 'react';
import { useCartStore } from '@/features/cart/store/cart.store';
import { MAX_LINE_QUANTITY } from '@canaldigital/packages/core/cart-pricing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, Minus, Plus, ShoppingCart } from 'lucide-react';
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
  retailPriceCents: number;
  currency: string;
  wholesalePriceCents: number | null;
  wholesaleMinQuantity: number | null;
  imageUrl?: string;
  inStock: boolean;
  maxQuantity: number;
  showExactStock: boolean;
  hasVariants: boolean;
  tenantSlug: string;
}

export function AddToCartButton({
  productId,
  name,
  retailPriceCents,
  currency,
  wholesalePriceCents,
  wholesaleMinQuantity,
  imageUrl,
  inStock,
  maxQuantity,
  showExactStock,
  hasVariants,
  tenantSlug,
}: AddToCartButtonProps): React.JSX.Element {
  const cartStore = useCartStore();
  const t = useTranslations('Storefront');
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const [quantityInput, setQuantityInput] = React.useState('1');
  const quantityId = React.useId();
  const item = cartStore.items.find((entry): boolean => entry.productId === productId);
  const confirmed = added && cartStore.tenantSlug === tenantSlug && Boolean(item);
  const inCartQuantity = cartStore.tenantSlug === tenantSlug ? (item?.quantity ?? 0) : 0;
  const allowedTotal = Math.min(maxQuantity, MAX_LINE_QUANTITY);
  const remaining = Math.max(0, allowedTotal - inCartQuantity);
  const limitReached = remaining === 0;
  const quantity = Number(quantityInput);
  const quantityValid =
    /^\d+$/.test(quantityInput) &&
    Number.isSafeInteger(quantity) &&
    quantity >= 1 &&
    quantity <= remaining;
  const quantityInvalid = !limitReached && quantityInput.length > 0 && !quantityValid;
  const add = (): void => {
    cartStore.addItem(
      {
        productId,
        name,
        retailPriceCents,
        unitPriceCents: retailPriceCents,
        currency,
        wholesalePriceCents,
        wholesaleMinQuantity,
        imageUrl,
        quantity,
        maxQuantity,
      },
      tenantSlug,
    );
    setAdded(true);
    setQuantityInput('1');
  };
  const handleAdd = (): void => {
    if (!quantityValid) return;
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
      <div className="space-y-2">
        <Label htmlFor={quantityId}>{t('purchase.quantity')}</Label>
        <div className="flex w-fit items-center rounded-lg border bg-background">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={t('purchase.decreaseQuantity')}
            disabled={limitReached || !quantityValid || quantity <= 1}
            onClick={(): void => setQuantityInput(String(quantity - 1))}
          >
            <Minus aria-hidden="true" className="size-4" />
          </Button>
          <Input
            id={quantityId}
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(1, remaining)}
            step={1}
            value={quantityInput}
            onChange={(event): void => {
              setQuantityInput(event.target.value);
              setAdded(false);
            }}
            aria-invalid={quantityInvalid}
            aria-describedby={quantityInvalid ? `${quantityId}-error` : undefined}
            disabled={limitReached}
            className="h-11 w-20 rounded-none border-0 text-center tabular-nums shadow-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={t('purchase.increaseQuantity')}
            disabled={limitReached || !quantityValid || quantity >= remaining}
            onClick={(): void => setQuantityInput(String(quantity + 1))}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>
        {quantityInvalid && (
          <p id={`${quantityId}-error`} role="alert" className="text-sm text-destructive">
            {t('purchase.invalidQuantity')}
          </p>
        )}
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <Button
          ref={addButtonRef}
          className="min-h-11 w-full"
          onClick={handleAdd}
          disabled={limitReached || !quantityValid}
        >
          <ShoppingCart aria-hidden="true" />
          {t(limitReached ? 'cartMaxReached' : 'cartAdd')}
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
        {limitReached && inCartQuantity > 0
          ? t(
              showExactStock && allowedTotal === maxQuantity
                ? 'purchase.maxReached'
                : 'purchase.maxReachedPublic',
              {
                count: allowedTotal,
              },
            )
          : confirmed && (
              <>
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {t('purchase.added', { name, count: item?.quantity ?? 0 })}
              </>
            )}
      </p>
    </div>
  );
}
