'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import {
  KiviConnectionNotFoundException,
  KiviGatewayException,
  KiviKnowledgeLimitException,
  KiviLinkForbiddenException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { getActiveTenantQuery } from '@/features/iam/queries/active-tenant.query';
import { getConfigureKiviKnowledgeUseCase } from '@/features/kivi/di/kivi.di';
import {
  KIVI_KNOWLEDGE_ALLOWED_EXTENSIONS,
  KIVI_KNOWLEDGE_MAX_FILE_BYTES,
  kiviKnowledgeSchema,
} from '@/features/kivi/schemas/kivi-knowledge.schema';

export interface KiviKnowledgeActionState {
  success: boolean;
  message: string | null;
  fieldErrors?: Partial<Record<'title' | 'content' | 'file', string>>;
  /** Echoed back so a rejected form does not lose what the user typed. */
  values?: { title: string; text: string };
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

function stemOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).trim();
}

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

export async function configureKiviKnowledgeAction(
  previous: KiviKnowledgeActionState,
  data: FormData,
): Promise<KiviKnowledgeActionState> {
  void previous;
  const t = await getTranslations('KiviKnowledge');
  const values = { title: text(data, 'title'), text: text(data, 'text') };
  const failure = (
    key: string,
    fieldErrors?: KiviKnowledgeActionState['fieldErrors'],
  ): KiviKnowledgeActionState => ({
    success: false,
    message: t(key),
    values,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return failure('unauthorized');
    const tenantId = await getActiveTenantQuery(user.id);
    if (!tenantId) return failure('unauthorized');

    const operation = text(data, 'operation');
    let title = values.title;
    let content = values.text;
    if (operation === 'upload') {
      const file = data.get('file');
      if (file instanceof File && file.size > 0) {
        if (!KIVI_KNOWLEDGE_ALLOWED_EXTENSIONS.includes(extensionOf(file.name)))
          return failure('invalidInput', { file: t('validation.fileType') });
        if (file.size > KIVI_KNOWLEDGE_MAX_FILE_BYTES)
          return failure('invalidInput', { file: t('validation.fileSize') });
        content = await file.text();
        if (title.trim() === '') title = stemOf(file.name);
      }
      // Binary content (e.g. a PDF renamed to .txt) would corrupt the index.
      if (content.includes('\u0000'))
        return failure('invalidInput', { file: t('validation.fileType') });
    }

    const parsed = kiviKnowledgeSchema.safeParse({
      operation,
      documentId: text(data, 'documentId'),
      title,
      content,
    });
    if (!parsed.success) {
      const fieldErrors: NonNullable<KiviKnowledgeActionState['fieldErrors']> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'title') fieldErrors.title = t('validation.title');
        if (field === 'content') fieldErrors.content = t('validation.content');
      }
      return failure('invalidInput', fieldErrors);
    }
    const input = parsed.data;
    await getConfigureKiviKnowledgeUseCase().execute({
      userId: user.id,
      tenantId,
      operation: input.operation,
      documentId: input.documentId,
      title: input.operation === 'upload' ? input.title : '',
      content: input.operation === 'upload' ? input.content : '',
    });
    revalidatePath('/dashboard/integrations');
    return {
      success: true,
      message: t(
        input.operation === 'upload'
          ? 'uploaded'
          : input.operation === 'delete'
            ? 'deleted'
            : 'retried',
      ),
    };
  } catch (error: unknown) {
    if (error instanceof KiviLinkForbiddenException) return failure('forbidden');
    if (error instanceof KiviConnectionNotFoundException) return failure('notLinked');
    if (error instanceof KiviKnowledgeLimitException) return failure('limitReached');
    if (error instanceof KiviGatewayException) {
      if (error.status === 403) return failure('missingScope');
      if (error.status === 404) return failure('notFound');
      if (error.status === 409) return failure('conflict');
      if (error.status === 413 || error.status === 422) return failure('rejected');
    }
    return failure('unavailable');
  }
}
