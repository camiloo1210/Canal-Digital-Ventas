import { z } from 'zod';
import {
  EMAIL_INPUT,
  NEW_PASSWORD_INPUT,
  PERSON_NAME_INPUT,
  STORE_NAME_INPUT,
  STORE_SLUG_INPUT,
} from '@/lib/input-attributes';
import { constrainedString } from '@/lib/input-schemas';

/*
 * Syntax-only validation of the authentication and onboarding forms. Every message is a key under
 * `Storefront.auth.errors`, and every rule is built from the same attributes the forms declare
 * natively, so the browser and the server agree on what is valid.
 */
const personName = (minLength: number, message: string): z.ZodString =>
  constrainedString({ ...PERSON_NAME_INPUT, minLength }, message);
const email = z
  .string('email')
  .trim()
  .max(EMAIL_INPUT.maxLength, 'email')
  .pipe(z.string().email('email'));
const newPassword = z
  .string('passwordLength')
  .min(NEW_PASSWORD_INPUT.minLength ?? 1, 'passwordLength')
  .max(NEW_PASSWORD_INPUT.maxLength, 'passwordTooLong');
const storeName = constrainedString(STORE_NAME_INPUT, 'storeNameInvalid');
const storeSlug = constrainedString(STORE_SLUG_INPUT, 'storeSlugInvalid');

export const signupBusinessSchema = z.object({
  firstName: personName(1, 'firstNameInvalid'),
  lastName: personName(1, 'lastNameInvalid'),
  email,
  password: newPassword,
  storeName,
  storeSlug,
});

export const onboardingSchema = z.object({
  firstName: personName(2, 'firstNameInvalid'),
  lastName: personName(2, 'lastNameInvalid'),
  storeName,
  storeSlug,
});

export const customerSignupSchema = z.object({ email, password: newPassword });
export const clientSignupSchema = customerSignupSchema;
