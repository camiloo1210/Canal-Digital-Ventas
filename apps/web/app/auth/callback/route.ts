import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getExchangeOAuthCodeUseCase } from '@/features/iam/di/iam.di';

const oauthQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is missing')
});

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const codeParam = requestUrl.searchParams.get('code');

  const validation = oauthQuerySchema.safeParse({ code: codeParam });

  if (validation.success) {
    try {
      const useCase = await getExchangeOAuthCodeUseCase();
      await useCase.execute(validation.data.code);
    } catch (error) {
      console.error('Error exchanging code:', error);
      return NextResponse.redirect(`${requestUrl.origin}/login?message=Authentication failed`);
    }
  }


  return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
}
