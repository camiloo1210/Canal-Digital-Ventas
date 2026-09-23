'use client';

import { useActionState, useRef, useEffect } from 'react';
import { createCategoryAction } from '@/features/categories/actions/categories.actions';
import { Button } from '@/components/ui/button';
import { Layers, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { CategoryFormFields } from '@/features/categories/components/category-form-fields';
import { toast } from 'sonner';

import { useTranslations } from 'next-intl';

const initialState = {
  success: false,
  error: null as string | null,
};

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  const t = useTranslations('Categories');

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('submit_creating')}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Layers className="w-4 h-4" />
          {t('submit_save')}
        </span>
      )}
    </Button>
  );
}

export function CreateCategoryForm(): React.JSX.Element {
  const [state, formAction] = useActionState(createCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations('Categories');
  const tShared = useTranslations('Products'); // Reuse offline error

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state?.success]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    if (!navigator.onLine) {
      e.preventDefault();
      toast.error(tShared('offline_error', { fallback: 'You are currently offline.' }));
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t('new_desc')}</p>

      <form ref={formRef} action={formAction} onSubmit={handleFormSubmit} className="space-y-8">
        {state?.error && (
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="p-4 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
            {t('success_message')}
          </div>
        )}

        <CategoryFormFields />

        <div className="pt-2">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
