'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  cancelOrderAction,
  CancelOrderActionState,
} from '@/features/orders/actions/cancel-order.actions';
import { Ban, Loader2, AlertCircle } from 'lucide-react';

interface CancelOrderDialogProps {
  orderId: string;
  orderNumber: string;
}

const initialState: CancelOrderActionState = {
  success: false,
  errorCode: null,
};

export function CancelOrderDialog({
  orderId,
  orderNumber,
}: CancelOrderDialogProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = useActionState(cancelOrderAction, initialState);
  const t = useTranslations('Orders.dialog');

  React.useEffect(() => {
    if (state.success) {
      toast.success(t('success'));
      const timer = setTimeout((): void => {
        setOpen(false);
      }, 0);
      return (): void => clearTimeout(timer);
    }
  }, [state.success, t]);

  const handleOpenChange = (newOpen: boolean): void => {
    if (!isPending) {
      setOpen(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 gap-1.5 transition-colors"
          />
        }
      >
        <Ban className="w-3.5 h-3.5" />
        <span>{t('trigger')}</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form action={formAction}>
          <input type="hidden" name="orderId" value={orderId} />

          <DialogHeader className="gap-2">
            <div className="flex items-center gap-2 text-destructive">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <Ban className="w-4 h-4" />
              </div>
              <DialogTitle>{t('title')}</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground pt-1">
              {t('description', { orderNumber })}
            </DialogDescription>
          </DialogHeader>

          {state.errorCode && !state.success && (
            <div className="my-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={(): void => setOpen(false)}
            >
              {t('cancelButton')}
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('cancelling')}</span>
                </>
              ) : (
                <span>{t('confirmButton')}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
