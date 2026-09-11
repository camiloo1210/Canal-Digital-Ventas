import Image from 'next/image';
import Logo from '@/public/Logo.svg';
import { LoginForm } from '@/features/iam/ui/components/login-form';

export default async function LoginPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const message = typeof searchParams.message === 'string' ? searchParams.message : undefined;

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Image src={Logo} alt="Papeleria costa azul Logo" width={24} height={24} />
            <span className="font-semibold text-lg">Papeleria costa azul</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm message={message} />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:flex items-center justify-center">
        <Image src={Logo} alt="Papeleria costa azul Logo" width={400} height={400} className="object-contain" />
      </div>
    </div>
  );
}
