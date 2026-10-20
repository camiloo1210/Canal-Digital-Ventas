'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function SellerOrderDetailsDialog({
  orderId,
  title,
  closeHref,
  children,
}: {
  orderId: string;
  title: string;
  closeHref: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const t = useTranslations('AdminOrders');
  return (
    <Dialog
      open={open}
      onOpenChange={(value): void => {
        setOpen(value);
        if (!value) router.push(closeHref, { scroll: false });
      }}
    >
      <DialogContent
        closeLabel={t('close')}
        className="sm:max-w-2xl"
        finalFocus={(): HTMLElement | null => {
          const desktop = document.getElementById('order-link-' + orderId);
          return desktop?.offsetParent
            ? desktop
            : (document.getElementById('order-mobile-link-' + orderId) ??
                document.getElementById('orders-heading'));
        }}
      >
        <DialogHeader className="pr-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('detailsDescription')}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
