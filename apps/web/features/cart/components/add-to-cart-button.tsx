'use client';

import * as React from 'react';
import { useState } from 'react';
import { useCartStore } from '../store/cart.store';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import {
  Dialog,
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
  maxStock: number;
  tenantSlug: string;
  labels: {
    add: string;
    outOfStock: string;
    differentStoreTitle: string;
    differentStoreDesc: string;
    cancel: string;
    clearAndContinue: string;
  };
}

export function AddToCartButton({
  productId,
  name,
  price,
  imageUrl,
  maxStock,
  tenantSlug,
  labels,
}: AddToCartButtonProps): React.JSX.Element {
  const cartStore = useCartStore();
  const [showDialog, setShowDialog] = useState(false);

  const handleAdd = (): void => {
    if (cartStore.tenantSlug && cartStore.tenantSlug !== tenantSlug && cartStore.items.length > 0) {
      setShowDialog(true);
      return;
    }
    cartStore.addItem({ productId, name, price, imageUrl, quantity: 1, maxStock }, tenantSlug);
  };

  const handleClearAndContinue = (): void => {
    cartStore.clearCart();
    cartStore.addItem({ productId, name, price, imageUrl, quantity: 1, maxStock }, tenantSlug);
    setShowDialog(false);
  };

  if (maxStock <= 0) {
    return (
      <Button disabled variant="secondary" className="w-full">
        {labels.outOfStock}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={handleAdd} className="w-full">
        <ShoppingCart className="mr-2 h-4 w-4" />
        {labels.add}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{labels.differentStoreTitle}</DialogTitle>
            <DialogDescription>{labels.differentStoreDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {labels.cancel}
            </Button>
            <Button variant="destructive" onClick={handleClearAndContinue}>
              {labels.clearAndContinue}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
