'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  quickCreateCategoryAction,
  ActionState,
} from '@/features/dashboard/actions/dashboard.actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const initialState: ActionState = {
  success: false,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Creating...' : 'Create Category'}
    </Button>
  );
}

export function CreateCategoryForm() {
  const [state, formAction] = useActionState(quickCreateCategoryAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Category Name</Label>
        <Input id="name" name="name" placeholder="e.g. Electronics" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Optional description" />
      </div>

      {state.error && <div className="text-sm text-red-500 font-medium">{state.error}</div>}

      {state.success && (
        <div className="text-sm text-green-500 font-medium">Category created successfully!</div>
      )}

      <SubmitButton />
    </form>
  );
}
