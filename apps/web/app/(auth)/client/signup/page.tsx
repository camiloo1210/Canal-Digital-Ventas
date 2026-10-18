import { SignupClientForm } from '@/features/iam/ui/components/signup-client-form';

export const metadata = {
  title: 'Client Signup | Canal Digital',
};

export default async function ClientSignupPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const tenantSlug =
    typeof searchParams.tenantSlug === 'string' ? searchParams.tenantSlug : undefined;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 flex flex-col items-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">
            Create an Account
          </h1>
          <p className="text-sm text-gray-500">Join to manage your purchases and track orders.</p>
        </div>

        <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-xl">
          <SignupClientForm tenantSlug={tenantSlug} />
        </div>
      </div>
    </div>
  );
}
