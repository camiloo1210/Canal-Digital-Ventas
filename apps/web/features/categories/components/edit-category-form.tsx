'use client';

import { useActionState, useRef } from 'react';
import { updateCategoryAction, CategoryActionState } from '@/features/categories/actions/categories.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFormStatus } from 'react-dom';
import { CategoryFormFields } from '@/features/categories/components/category-form-fields';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

const initialState: CategoryActionState = {
  success: false,
  error: null,
};

function SubmitButton(): React.JSX.Element {
  const { pending } = useFormStatus();
  const t = useTranslations('Categories');

  return (
    <Button type="submit" className="w-full h-11" disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          {t('submit_updating')}
        </span>
      ) : (
        <span>{t('submit_update')}</span>
      )}
    </Button>
  );
}

interface EditCategoryFormProps {
  initialData: {
    id: string;
    version: number;
    name: string;
    description: string;
  };
}

export function EditCategoryForm({ initialData }: EditCategoryFormProps): React.JSX.Element {
  const [state, formAction] = useActionState(updateCategoryAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations('Categories');

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    if (!navigator.onLine) {
      e.preventDefault();
      toast.error(t('offline_error'));
    }
  };

  return (
    <Card className="border shadow-sm rounded-xl overflow-hidden bg-card">
      <CardContent className="pt-6">
        <form ref={formRef} action={formAction} onSubmit={handleFormSubmit} className="space-y-8">
          <input type="hidden" name="categoryId" value={initialData.id} />
          <input type="hidden" name="expectedVersion" value={initialData.version} />

          {state?.error && (
            <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {state.error}
            </div>
          )}

          <CategoryFormFields 
            revision={state.revision}
            defaultValues={state.values ?? initialData} 
            fieldErrors={state.fieldErrors}
          />

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
