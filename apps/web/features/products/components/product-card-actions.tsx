'use client';

import { useState } from 'react';
import { MoreHorizontal, Edit, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslations } from 'next-intl';
import { archiveProductAction } from '@/features/products/actions/products.actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ProductCardActionsProps {
  productId: string;
}

export function ProductCardActions({ productId }: ProductCardActionsProps): React.JSX.Element {
  const t = useTranslations('Products');
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async (): Promise<void> => {
    if (
      confirm(
        t('archive_confirm_title', { fallback: 'Archive Product?' }) +
          '\n' +
          t('archive_confirm_desc', {
            fallback: 'This product will no longer be visible in the active catalog.',
          }),
      )
    ) {
      setIsArchiving(true);
      const result = await archiveProductAction(productId);
      setIsArchiving(false);

      if (!result.success && result.error) {
        toast.error(result.error);
      } else {
        toast.success(t('archive_success', { fallback: 'Product archived successfully' }));
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="h-8 w-8 relative z-10" />}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Open menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem
          onClick={() => router.push(`/dashboard/catalog/products/${productId}/edit`)}
          className="cursor-pointer"
        >
          <Edit className="mr-2 h-4 w-4" />
          <span>{t('action_edit', { fallback: 'Edit' })}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleArchive}
          disabled={isArchiving}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <Archive className="mr-2 h-4 w-4" />
          <span>
            {isArchiving
              ? t('archiving', { fallback: 'Archiving...' })
              : t('action_archive', { fallback: 'Archive' })}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
