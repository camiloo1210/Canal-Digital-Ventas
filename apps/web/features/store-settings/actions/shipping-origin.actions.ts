'use server';

import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import {
  UserPermission,
  DomainException,
  ShippingOriginForbiddenException,
} from '@canaldigital/packages/core';
import { createClient } from '@/lib/supabase/server';
import { resolveActionTenant } from '@/features/dashboard/server/resolve-action-tenant';
import { userHasAnyPermission } from '@/features/users/queries/member-permissions.query';
import { getSaveShippingOriginUseCase } from '@/features/store-settings/di/store-settings.di';
import { shippingOriginSchema } from '@/features/store-settings/schemas/shipping-origin.schema';

export type ShippingOriginField =
  'contactName' | 'phone' | 'street' | 'city' | 'state' | 'zipCode' | 'country';

const FIELDS: readonly ShippingOriginField[] = [
  'contactName',
  'phone',
  'street',
  'city',
  'state',
  'zipCode',
  'country',
];

export interface ShippingOriginState {
  success: boolean;
  message: string | null;
  fieldErrors?: Partial<Record<ShippingOriginField, string[]>>;
  values?: Record<ShippingOriginField, string>;
  revision?: number;
}

export async function saveShippingOriginAction(
  previous: ShippingOriginState,
  formData: FormData,
): Promise<ShippingOriginState> {
  const t = await getTranslations('ShippingOrigin');
  const values = Object.fromEntries(
    FIELDS.map((field: ShippingOriginField): [ShippingOriginField, string] => {
      const raw = formData.get(field);
      return [field, typeof raw === 'string' ? raw : ''];
    }),
  ) as Record<ShippingOriginField, string>;
  const failure = (
    message: string,
    fieldErrors?: ShippingOriginState['fieldErrors'],
  ): ShippingOriginState => ({
    success: false,
    message,
    values,
    fieldErrors,
    revision: (previous.revision ?? 0) + 1,
  });
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return failure(t('unauthorized'));
    const tenant = await resolveActionTenant(formData, user.id);
    if (!tenant) return failure(t('contextChanged'));
    if (!(await userHasAnyPermission(user.id, tenant.tenantId, [UserPermission.MANAGE_STORE])))
      return failure(t('unauthorized'));
    const parsed = shippingOriginSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: NonNullable<ShippingOriginState['fieldErrors']> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && (FIELDS as readonly string[]).includes(field))
          fieldErrors[field as ShippingOriginField] = [t('validation.' + field)];
      }
      return failure(t('invalidInput'), fieldErrors);
    }
    await getSaveShippingOriginUseCase().execute({
      tenantId: tenant.tenantId,
      authenticatedUserId: user.id,
      ...parsed.data,
    });
    revalidatePath('/dashboard/store');
    return {
      success: true,
      message: t('saved'),
      values: parsed.data,
      revision: (previous.revision ?? 0) + 1,
    };
  } catch (error: unknown) {
    if (error instanceof ShippingOriginForbiddenException) return failure(t('unauthorized'));
    if (error instanceof DomainException) return failure(t('invalidInput'));
    return failure(t('unexpected'));
  }
}
