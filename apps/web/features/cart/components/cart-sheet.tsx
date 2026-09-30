'use client';

import * as React from 'react';
import { useCartStore } from '../store/cart.store';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { formatMoney } from '@/lib/money';

interface CartSheetProps {
  labels: {
    title: string;
    empty: string;
    checkout: string;
    subtotal: string;
    taxesNote: string;
  };
}

export function CartSheet({ labels }: CartSheetProps): React.JSX.Element | null {
  const cartStore = useCartStore();
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);

  // Hydration safety for Zustand
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect((): void => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const totalItems = cartStore.items.reduce((sum, item) => sum + item.quantity, 0);
  const informationalSubtotal = cartStore.items.reduce(
    (sum, item) => sum + (item.price * 100) * item.quantity, // Convert decimal price to cents
    0
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 px-1 min-w-[1.25rem] h-5 flex items-center justify-center text-xs"
            >
              {totalItems}
            </Badge>
          )}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-6 py-6 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {labels.title}
            <Badge variant="secondary" className="ml-2 rounded-full px-2 py-0.5 text-xs font-normal">
              {totalItems}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {cartStore.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="h-10 w-10 opacity-30" />
              </div>
              <p className="text-sm">{labels.empty}</p>
            </div>
          ) : (
            <ul className="space-y-6">
              {cartStore.items.map((item) => (
                <li key={item.productId} className="flex gap-4 group">
                  <div className="w-20 h-20 bg-muted/50 rounded-xl relative overflow-hidden flex-shrink-0 border border-border/50">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="h-6 w-6 opacity-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm leading-none line-clamp-2">{item.name}</h4>
                        <p className="text-sm font-semibold text-foreground">
                          {formatMoney(item.price * 100)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2"
                        onClick={() => cartStore.removeItem(item.productId)}
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-lg border border-border bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-none rounded-l-md hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={() => cartStore.updateQuantity(item.productId, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-medium w-6 text-center">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-none rounded-r-md hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={() => cartStore.updateQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxStock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      {item.quantity >= item.maxStock && (
                        <span className="text-[10px] text-destructive font-medium uppercase tracking-wider">
                          Max
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cartStore.items.length > 0 && cartStore.tenantSlug && (
          <SheetFooter className="px-6 py-6 border-t bg-muted/20 flex flex-col gap-4">
            <div className="space-y-1.5 w-full">
              <div className="flex items-center justify-between w-full font-semibold text-base">
                <span>{labels.subtotal}</span>
                <span>{formatMoney(informationalSubtotal)}</span>
              </div>
              <p className="text-[0.8rem] text-muted-foreground text-center">
                {labels.taxesNote}
              </p>
            </div>
            <Button
              className="w-full h-12 text-base font-medium rounded-xl shadow-sm"
              onClick={() => {
                setIsOpen(false);
                router.push(`/store/${cartStore.tenantSlug}/checkout`);
              }}
            >
              {labels.checkout}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
