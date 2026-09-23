'use client';

import { useState } from 'react';
import { archiveCategoryAction, unarchiveCategoryAction } from '@/features/categories/actions/categories.actions';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Archive, ArchiveRestore, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useTranslations } from 'next-intl';

interface CategoryCardActionsProps {
  category: {
    id: string;
    status: string;
  };
}

export function CategoryCardActions({ category }: CategoryCardActionsProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);
  const router = useRouter();
  const t = useTranslations('Categories');
  const tShared = useTranslations('Products');

  const handleArchive = async () => {
    if (!navigator.onLine) {
      toast.error(tShared('offline_error', { fallback: 'You are currently offline.' }));
      return;
    }

    if (!confirm(t('archive_confirm_title') + '\n' + t('archive_confirm_desc'))) {
      return;
    }

    try {
      setIsArchiving(true);
      const result = await archiveCategoryAction(category.id);
      
      if (!result.success) {
        toast.error(result.error || t('archive_error'));
      } else {
        toast.success(t('archive_success'));
        router.refresh();
      }
    } catch (error) {
      toast.error(t('unexpected_error'));
    } finally {
      setIsArchiving(false);
    }
  };


  const handleUnarchive = async () => {
    if (!navigator.onLine) {
      toast.error(tShared('offline_error', { fallback: 'You are currently offline.' }));
      return;
    }

    if (!confirm(t('unarchive_confirm_title') + '\n' + t('unarchive_confirm_desc'))) {
      return;
    }

    try {
      setIsUnarchiving(true);
      const result = await unarchiveCategoryAction(category.id);
      
      if (!result.success) {
        toast.error(result.error || t('unarchive_error'));
      } else {
        toast.success(t('unarchive_success'));
        router.refresh();
      }
    } catch (error) {
      toast.error(t('unexpected_error'));
    } finally {
      setIsUnarchiving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-8 w-8 p-0" />}
      >
        <span className="sr-only">Open menu</span>
        {isArchiving || isUnarchiving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuItem
          onClick={() => router.push(`/dashboard/catalog/categories/${category.id}/edit`)}
          className="cursor-pointer flex items-center"
        >
          <Edit className="mr-2 h-4 w-4" />
          <span>{t('action_edit')}</span>
        </DropdownMenuItem>
        
        {category.status !== 'archived' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleArchive} 
              disabled={isArchiving}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer flex items-center"
            >
              <Archive className="mr-2 h-4 w-4" />
              <span>{isArchiving ? t('archiving') : t('action_archive')}</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleUnarchive} 
              disabled={isUnarchiving}
              className="text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600 cursor-pointer flex items-center"
            >
              <ArchiveRestore className="mr-2 h-4 w-4" />
              <span>{isUnarchiving ? t('unarchiving') : t('action_unarchive')}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
