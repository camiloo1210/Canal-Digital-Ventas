'use client';

import { useActionState, useRef, useEffect } from 'react';
import { updateCategoryAction } from '@/features/categories/actions/categories.actions';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
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
          {t('submit_updating')}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          {t('submit_update')}
        </span>
      )}
    </Button>
  );
}

export interface EditCategoryFormProps {
  initialData: {
    id: string;
    name: string;
    description: string;
    version: number;
  };
}

export function EditCategoryForm({ initialData }: EditCategoryFormProps): React.JSX.Element {
  const [state, formAction] = useActionState(updateCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations('Categories');
  const tShared = useTranslations('Products'); // Reuse offline error

  useEffect(() => {
    if (state?.success) {
      toast.success(t('success_message'));
    }
  }, [state?.success, t]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    if (!navigator.onLine) {
      e.preventDefault();
      toast.error(tShared('offline_error', { fallback: 'You are currently offline.' }));
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t('edit_desc')}</p>

      <form ref={formRef} action={formAction} onSubmit={handleFormSubmit} className="space-y-8">
        <input type="hidden" name="categoryId" value={initialData.id} />
        <input type="hidden" name="expectedVersion" value={initialData.version} />

        {state?.error && (
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2">
            {state.error === 'concurrency_error'
              ? 'This category was modified by someone else while you were editing it. Please refresh the page and try again.'
              : state.error}
          </div>
        )}

        <CategoryFormFields defaultValues={initialData} />

        <div className="pt-2">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
