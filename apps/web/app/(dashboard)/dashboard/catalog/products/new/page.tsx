import { CreateProductForm } from '@/features/products/components/create-product-form';

export const metadata = {
  title: 'New Product | Canal Digital',
};

export default function NewProductPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
          Catalog Management
        </h1>
        <CreateProductForm />
      </div>
    </div>
  );
}
