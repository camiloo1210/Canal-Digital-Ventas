'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface CatalogItemActionsProps {
  name: string;
  editHref: string;
  archived: boolean;
  archiveAction: () => Promise<{ success?: boolean; error?: string | null }>;
  restoreAction: () => Promise<{ success?: boolean; error?: string | null }>;
}

export function CatalogItemActions({
  name,
  editHref,
  archived,
  archiveAction,
  restoreAction,
}: CatalogItemActionsProps): React.JSX.Element {
  const t = useTranslations('AdminCatalog');
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmAction = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await (archived ? restoreAction() : archiveAction());
      if (!result.success) setError(result.error || t('actionError'));
      else {
        setOpen(false);
        toast.success(t(archived ? 'restored' : 'archivedSuccess'));
        router.refresh();
      }
    } catch {
      setError(t('actionError'));
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={t('itemActions', { name })}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={editHref} />}>
            <Pencil aria-hidden="true" className="size-4" />
            {t('edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(): void => {
              setError(null);
              setOpen(true);
            }}
          >
            {archived ? (
              <ArchiveRestore aria-hidden="true" className="size-4" />
            ) : (
              <Archive aria-hidden="true" className="size-4" />
            )}
            {t(archived ? 'restore' : 'archive')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={open}
        onOpenChange={(value): void => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={false} finalFocus={triggerRef}>
          <DialogHeader>
            <DialogTitle>{t(archived ? 'restoreTitle' : 'archiveTitle')}</DialogTitle>
            <DialogDescription>
              {t(archived ? 'restoreDescription' : 'archiveDescription', { name })}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={(): void => setOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={pending}
              aria-busy={pending}
              onClick={confirmAction}
            >
              {pending && (
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              )}
              {t(pending ? 'saving' : archived ? 'restore' : 'archive')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
