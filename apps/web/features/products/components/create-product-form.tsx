'use client';

import { useActionState, useRef } from 'react';
import { createProductAction } from '@/features/products/actions/products.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, DollarSign, Tag, UploadCloud, FolderTree } from 'lucide-react';
import { useFormStatus } from 'react-dom';

const initialState = {
  success: false,
  error: null as string | null,
};

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
          Creating Product...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Save Product
        </span>
      )}
    </Button>
  );
}

export function CreateProductForm() {
  const [state, formAction, isPending] = useActionState(createProductAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  if (state?.success) {
    formRef.current?.reset();
  }

  return (
    <Card className="max-w-2xl mx-auto border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden relative">
      {/* Decorative gradient blob */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />

      <CardHeader className="space-y-2 relative z-10">
        <CardTitle className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400">
          New Product
        </CardTitle>
        <CardDescription className="text-gray-400 text-base">
          Fill in the details to list a new product in the catalog.
        </CardDescription>
      </CardHeader>

      <CardContent className="relative z-10">
        <form ref={formRef} action={formAction} className="space-y-6">
          {state?.error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              🎉 Product created successfully!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300 font-medium">
                Product Name
              </Label>
              <div className="relative group">
                <Tag className="absolute left-3 top-3 h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  id="name"
                  name="name"
                  placeholder="E.g., Wireless Mouse"
                  required
                  className="pl-10 h-11 bg-black/40 border-gray-700/50 focus-visible:ring-indigo-500 text-white rounded-xl transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku" className="text-gray-300 font-medium">
                SKU
              </Label>
              <div className="relative group">
                <Package className="absolute left-3 top-3 h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  id="sku"
                  name="sku"
                  placeholder="SKU-12345"
                  required
                  className="pl-10 h-11 bg-black/40 border-gray-700/50 focus-visible:ring-indigo-500 text-white rounded-xl transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price" className="text-gray-300 font-medium">
                Price ($)
              </Label>
              <div className="relative group">
                <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="99.99"
                  required
                  className="pl-10 h-11 bg-black/40 border-gray-700/50 focus-visible:ring-indigo-500 text-white rounded-xl transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost" className="text-gray-300 font-medium">
                Cost ($)
              </Label>
              <div className="relative group">
                <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input
                  id="cost"
                  name="cost"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="50.00"
                  required
                  className="pl-10 h-11 bg-black/40 border-gray-700/50 focus-visible:ring-indigo-500 text-white rounded-xl transition-all"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId" className="text-gray-300 font-medium">
              Category ID (UUID)
            </Label>
            <div className="relative group">
              <FolderTree className="absolute left-3 top-3 h-5 w-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
              <Input
                id="categoryId"
                name="categoryId"
                placeholder="00000000-0000-0000-0000-000000000000"
                required
                className="pl-10 h-11 bg-black/40 border-gray-700/50 focus-visible:ring-indigo-500 text-white rounded-xl transition-all"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Temporary text input until Categories UI is built.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300 font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Product details and specifications..."
              className="min-h-[100px] resize-none bg-black/40 border-gray-700/50 focus-visible:ring-indigo-500 text-white rounded-xl transition-all"
            />
          </div>

          <div className="flex items-center space-x-3 p-4 bg-black/20 rounded-xl border border-white/5">
            <input
              type="checkbox"
              id="isVatExempt"
              name="isVatExempt"
              className="w-5 h-5 text-indigo-500 bg-black border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-black transition-all"
            />
            <Label htmlFor="isVatExempt" className="text-gray-300 font-medium cursor-pointer">
              VAT Exempt (Tax Free)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image" className="text-gray-300 font-medium">
              Product Image
            </Label>
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="image"
                className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer bg-black/20 border-gray-700/50 hover:bg-black/40 hover:border-indigo-500/50 transition-all group"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="p-3 bg-white/5 rounded-full mb-3 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="mb-1 text-sm text-gray-400">
                    <span className="font-semibold text-indigo-400">Click to upload</span> or drag
                    and drop
                  </p>
                  <p className="text-xs text-gray-500">SVG, PNG, JPG (Max 5MB)</p>
                </div>
                <Input id="image" name="image" type="file" accept="image/*" className="hidden" />
              </label>
            </div>
          </div>

          <div className="pt-2">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
