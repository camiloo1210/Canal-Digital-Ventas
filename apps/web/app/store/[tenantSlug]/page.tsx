export default async function StorePage(props: { params: Promise<{ tenantSlug: string }> }) {
  const params = await props.params;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-6">Welcome to {params.tenantSlug}</h1>
      <p className="text-lg text-gray-600 mb-8">
        This is a B2B2C tenant store. As a global buyer, you can browse products here. When you
        check out, the JIT provisioning will link your global account to this specific store.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dummy Products */}
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <div className="w-full h-48 bg-gray-200 rounded-md mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Premium Product {item}</h3>
            <p className="text-gray-500 mt-1">$99.99</p>
            <button className="mt-4 w-full bg-black text-white py-2 rounded-md font-medium hover:bg-gray-800 transition-colors">
              Add to Cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
