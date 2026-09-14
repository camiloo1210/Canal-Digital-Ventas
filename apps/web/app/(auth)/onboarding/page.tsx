import { OnboardingForm } from '@/features/iam/ui/components/onboarding-form';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Onboarding | Canal Digital',
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If there's no user, the proxy should have redirected them to /login,
  // but we double-check here just in case.
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      {/* Background gradients for premium feel */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-indigo-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-4">
            Welcome to Canal Digital
          </h1>
          <p className="text-lg text-gray-400">
            Let's get your store set up. It only takes a minute.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl backdrop-blur-xl">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
