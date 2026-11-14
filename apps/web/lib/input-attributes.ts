/**
 * Native HTML constraints for dashboard text fields. They steer the browser (mobile keyboard,
 * autofill, `:user-invalid` styling, length cap) without blocking keystrokes or rewriting what the
 * user typed. The Zod schemas in each feature remain the security boundary; a test keeps these
 * patterns aligned with them.
 */
export interface TextInputAttributes {
  type?: 'text' | 'tel';
  inputMode: 'numeric' | 'decimal' | 'tel' | 'text';
  /** Whole-value regex source, as the browser evaluates `pattern`. */
  pattern: string;
  /** Minimum length, for fields whose rule is a length range rather than a character class. */
  minLength?: number;
  maxLength: number;
  autoComplete: string;
}

/** Credentials have no character class to enforce, only length and the right autofill hint. */
export interface CredentialInputAttributes {
  type: 'email' | 'password';
  minLength?: number;
  maxLength: number;
  autoComplete: string;
}

/** Whole non-negative numbers: stock, minimum quantities. Nine digits, like the server cap. */
export const WHOLE_NUMBER_INPUT: TextInputAttributes = {
  inputMode: 'numeric',
  pattern: '[0-9]*',
  maxLength: 9,
  autoComplete: 'off',
};

/** Non-negative decimals with "." as separator: prices, weights, sizes. */
export const DECIMAL_INPUT: TextInputAttributes = {
  inputMode: 'decimal',
  pattern: String.raw`[0-9]*\.?[0-9]*`,
  maxLength: 15,
  autoComplete: 'off',
};

export const PHONE_INPUT: TextInputAttributes = {
  type: 'tel',
  inputMode: 'tel',
  pattern: String.raw`[+\(]?[0-9][0-9 \(\)\-]{5,18}[0-9]`,
  maxLength: 20,
  autoComplete: 'tel',
};

export const POSTAL_CODE_INPUT: TextInputAttributes = {
  inputMode: 'text',
  pattern: String.raw`[A-Za-z0-9][A-Za-z0-9 \-]{1,8}[A-Za-z0-9]`,
  maxLength: 10,
  autoComplete: 'postal-code',
};

/** Starts with a letter; no digits. Accents, apostrophes, dots, spaces and hyphens allowed. */
export const PERSON_NAME_INPUT: TextInputAttributes = {
  inputMode: 'text',
  pattern: String.raw`\p{L}[\p{L}\p{M}' .\-]*`,
  maxLength: 60,
  autoComplete: 'off',
};

/** A buyer's full name at checkout: same letter-only rule as a person name, longer. */
export const FULL_NAME_INPUT: TextInputAttributes = {
  ...PERSON_NAME_INPUT,
  maxLength: 100,
};

/** City, state or country: letters only, so "Quito2" or "12345" never reach the carrier. */
export const PLACE_NAME_INPUT: TextInputAttributes = {
  ...PERSON_NAME_INPUT,
  maxLength: 80,
};

/** National id, RUC or passport: letters and digits, with dots or hyphens; 5 to 20 characters. */
export const DOCUMENT_ID_INPUT: TextInputAttributes = {
  inputMode: 'text',
  pattern: String.raw`[A-Za-z0-9][A-Za-z0-9.\-]{3,18}[A-Za-z0-9]`,
  maxLength: 20,
  autoComplete: 'off',
};

/**
 * The same constraint the browser applies, as a RegExp for the Zod schemas. Building both from one
 * source means the form and the server can never disagree about what a valid value looks like.
 */
export function inputPatternRegex(attributes: TextInputAttributes): RegExp {
  return new RegExp('^(?:' + attributes.pattern + ')$', 'u');
}

/** Email address: RFC 5321 caps it at 254 characters. */
export const EMAIL_INPUT: CredentialInputAttributes = {
  type: 'email',
  maxLength: 254,
  autoComplete: 'email',
};

/** New password at signup. 128 is far above any real passphrase and below hashing truncation. */
export const NEW_PASSWORD_INPUT: CredentialInputAttributes = {
  type: 'password',
  minLength: 6,
  maxLength: 128,
  autoComplete: 'new-password',
};

/** Store (business) name: 3 to 100 characters, not blank. Digits and symbols are fine here. */
export const STORE_NAME_INPUT: TextInputAttributes = {
  inputMode: 'text',
  pattern: String.raw`\s*\S.*\S\s*`,
  minLength: 3,
  maxLength: 100,
  autoComplete: 'organization',
};

/** Store URL segment: lowercase letters and digits joined by single hyphens, 3 to 50 characters. */
export const STORE_SLUG_INPUT: TextInputAttributes = {
  inputMode: 'text',
  pattern: String.raw`[a-z0-9]+(?:-[a-z0-9]+)*`,
  minLength: 3,
  maxLength: 50,
  autoComplete: 'off',
};

/** Product SKU: letters, digits and hyphens, 5 to 20 characters. */
export const SKU_INPUT: TextInputAttributes = {
  inputMode: 'text',
  pattern: String.raw`[a-zA-Z0-9\-]{5,20}`,
  minLength: 5,
  maxLength: 20,
  autoComplete: 'off',
};
