'use client';

// Note: A corresponding `updateProductAction` should be built in the future
// if the architecture requires a full update mutation. Right now we scaffold the UI orchestrator.
import { useActionState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { ProductFormFields, CategoryOption } from './product-form-fields';
import { toast } from 'sonner';

const initialState = {
  success: false,
  error: null as string | null,
};

// Placeholder action until Edit Product Use case is wired.
async function updateProductActionPlaceholder(prevState: unknown, formData: FormData) {
  return { success: true, error: null };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition-all duration-300 rounded-xl h-12 text-lg font-medium"
      disabled={pending}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Updating Product...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Update Product
        </span>
      )}
    </Button>
  );
}

interface EditProductFormProps {
  categories: CategoryOption[];
  productId: string;
  defaultValues: {
    name?: string;
    sku?: string;
    price?: number;
    cost?: number;
    wholesalePrice?: number | null;
    categoryId?: string;
    description?: string;
    stock?: number;
    isVatExempt?: boolean;
  };
}

export function EditProductForm({ categories, defaultValues, productId }: EditProductFormProps) {
  const [state, formAction] = useActionState(updateProductActionPlaceholder, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!navigator.onLine) {
      e.preventDefault();
      toast.error('You are offline. Please check your connection and try again.');
    }
  };

  return (
    <Card className="max-w-2xl mx-auto border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden relative">
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />

      <CardHeader className="space-y-2 relative z-10">
        <CardTitle className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400">
          Edit Product
        </CardTitle>
        <CardDescription className="text-gray-400 text-base">
          Modify the details of your existing product.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative z-10">
        <form ref={formRef} action={formAction} onSubmit={handleFormSubmit} className="space-y-8">
          {/* Secret hidden ID to identify the product to update */}
          <input type="hidden" name="productId" value={productId} />

          {state?.error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              Product updated successfully!
            </div>
          )}

          <ProductFormFields categories={categories} defaultValues={defaultValues} />

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
