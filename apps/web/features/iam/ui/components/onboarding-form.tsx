'use client';

import { useActionState } from 'react';
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
    <Button
      type="submit"
      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-6 text-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={pending}
    >
      {pending ? 'Setting up your business...' : 'Complete Setup'}
    </Button>
  );
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(onboardBusinessAction, initialState);

  // Auto-generate slug from store name
  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slugInput = document.getElementById('storeSlug') as HTMLInputElement;
    if (slugInput && !slugInput.dataset.manual) {
      slugInput.value = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }
  };

  const handleSlugInput = (e: React.FormEvent<HTMLInputElement>) => {
    e.currentTarget.dataset.manual = 'true';
  };

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg text-sm mb-6">
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Your Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-gray-300">
                First Name
              </Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                required
                placeholder="John"
                className="bg-white/5 border-white/10 text-white focus-visible:ring-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-gray-300">
                Last Name
              </Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                required
                placeholder="Doe"
                className="bg-white/5 border-white/10 text-white focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Your Business</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName" className="text-gray-300">
                Store Name
              </Label>
              <Input
                id="storeName"
                name="storeName"
                type="text"
                required
                placeholder="Acme Corp"
                onChange={handleStoreNameChange}
                className="bg-white/5 border-white/10 text-white focus-visible:ring-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeSlug" className="text-gray-300">
                Store URL (Slug)
              </Label>
              <Input
                id="storeSlug"
                name="storeSlug"
                type="text"
                required
                placeholder="acme-corp"
                onInput={handleSlugInput}
                className="bg-white/5 border-white/10 text-white focus-visible:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your store will be available at {`https://{slug}.canaldigital.com`}
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
