'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { onboardBusinessAction, ActionState } from '../../actions/onboarding.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: ActionState = {
  success: false,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Setting up your business...' : 'Complete Setup'}
    </Button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(onboardBusinessAction, initialState);

  const [storeSlug, setStoreSlug] = useState('');
  const [manualSlug, setManualSlug] = useState(false);

  // Auto-generate slug from store name
  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!manualSlug) {
      setStoreSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, ''),
      );
    }
  };

  const handleSlugInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualSlug(true);
    setStoreSlug(e.target.value);
  };

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-destructive/15 text-destructive border border-destructive/50 p-3 rounded-md text-sm mb-6 font-medium">
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-4">Tu Perfil</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input id="firstName" name="firstName" type="text" required placeholder="Juan" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" name="lastName" type="text" required placeholder="Pérez" />
            </div>
          </div>
        </div>

        <div className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Tu Negocio</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Nombre de la Tienda</Label>
              <Input
                id="storeName"
                name="storeName"
                type="text"
                required
                placeholder="Mi Super Tienda"
                onChange={handleStoreNameChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeSlug">URL de la Tienda (Slug)</Label>
              <Input
                id="storeSlug"
                name="storeSlug"
                type="text"
                required
                placeholder="mi-super-tienda"
                value={storeSlug}
                onChange={handleSlugInput}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tu tienda estará disponible en {`https://{slug}.canaldigital.com`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6">
        <SubmitButton />
      </div>
    </form>
  );
}
