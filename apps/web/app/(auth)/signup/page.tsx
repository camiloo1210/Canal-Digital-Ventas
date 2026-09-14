import Image from 'next/image';
import Logo from '@/public/Logo.svg';
import { SignupCustomerForm } from '@/features/iam/ui/components/signup-customer-form';

export const metadata = {
  title: 'Sign Up | Canal Digital',
};

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <Image src={Logo} alt="Canal Digital Logo" width={24} height={24} />
            <span className="font-semibold text-lg">Canal Digital</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupCustomerForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:flex items-center justify-center sticky top-0 h-svh">
        <Image
          src={Logo}
          alt="Canal Digital Logo"
          width={400}
          height={400}
          className="object-contain"
        />
      </div>
    </div>
  );
}
