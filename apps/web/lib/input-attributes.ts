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
