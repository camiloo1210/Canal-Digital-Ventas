'use client';

import * as React from 'react';
import { useCartStore } from '@/features/cart/store/cart.store';
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
import { useLocale, useTranslations } from 'next-intl';

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
  const t = useTranslations('Storefront.cartControls');
  const locale = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);

  // Hydration safety for Zustand
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect((): void => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) return <span aria-hidden="true" className="block size-11 shrink-0" />;

  const totalItems = cartStore.items.reduce((sum, item): number => sum + item.quantity, 0);
  const informationalSubtotal = cartStore.items.reduce(
    (sum, item): number => sum + Math.round(item.price * 100) * item.quantity, // Convert decimal price to cents
    0,
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        aria-label={t('open')}
        render={<Button variant="ghost" size="icon" className="relative size-11" />}
      >
        <ShoppingCart aria-hidden="true" className="h-5 w-5" />
        {totalItems > 0 && (
          <Badge
            variant="destructive"
            aria-hidden="true"
            className="absolute -top-2 -right-2 px-1 min-w-[1.25rem] h-5 flex items-center justify-center text-xs"
          >
            {totalItems}
          </Badge>
        )}
      </SheetTrigger>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {t('count', { count: totalItems })}
      </span>
      <SheetContent
        side="right"
        closeLabel={t('close')}
        className="flex min-h-0 flex-col gap-0 p-0 data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-6 pr-16">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            {labels.title}
            <Badge
              variant="secondary"
              className="ml-2 rounded-full px-2 py-0.5 text-xs font-normal"
            >
              {totalItems}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {cartStore.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="h-10 w-10 opacity-30" />
              </div>
              <p className="text-sm">{labels.empty}</p>
            </div>
          ) : (
            <ul className="space-y-6">
              {cartStore.items.map((item): React.JSX.Element => (
                <li key={item.productId} className="flex gap-4 group">
                  <div className="w-20 h-20 bg-muted/50 rounded-xl relative overflow-hidden flex-shrink-0 border border-border/50">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover transition-transform duration-300 motion-safe:group-hover:scale-105 motion-reduce:transition-none"
                        sizes="80px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="h-6 w-6 opacity-10" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-medium text-sm leading-snug line-clamp-2 [overflow-wrap:anywhere]">
                          {item.name}
                        </h4>
                        <p className="text-sm font-semibold text-foreground">
                          {formatMoney(Math.round(item.price * 100), 'USD', locale)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2"
                        onClick={(): void => cartStore.removeItem(item.productId)}
                        aria-label={t('remove', { name: item.name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center rounded-lg border border-border bg-background">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11 rounded-none rounded-l-md hover:bg-muted"
                          aria-label={t('decrease', { name: item.name })}
                          onClick={(): void =>
                            cartStore.updateQuantity(item.productId, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-medium w-6 text-center">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11 rounded-none rounded-r-md hover:bg-muted"
                          aria-label={t('increase', { name: item.name })}
                          onClick={(): void =>
                            cartStore.updateQuantity(item.productId, item.quantity + 1)
                          }
                          disabled={!Number.isSafeInteger(item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cartStore.items.length > 0 && cartStore.tenantSlug && (
          <SheetFooter className="shrink-0 border-t bg-muted/20 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4">
            <div className="space-y-1.5 w-full">
              <div className="flex items-center justify-between w-full font-semibold text-base">
                <span>{labels.subtotal}</span>
                <span>{formatMoney(informationalSubtotal, 'USD', locale)}</span>
              </div>
              <p className="text-[0.8rem] text-muted-foreground text-center">{labels.taxesNote}</p>
            </div>
            <Button
              className="w-full h-12 text-base font-medium rounded-xl shadow-sm"
              onClick={(): void => {
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
