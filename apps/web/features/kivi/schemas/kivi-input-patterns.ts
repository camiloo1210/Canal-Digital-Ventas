/**
 * Whole-value regex sources of the Kivi form fields, shared by the inputs (`pattern`) and checked
 * against the Zod schemas by a test so the browser and the server agree.
 */
export const KIVI_CODE_PATTERN = String.raw`kvp_[A-Za-z0-9_\-]{8,200}`;
export const KIVI_PHONE_NUMBER_ID_PATTERN = String.raw`[A-Za-z0-9_\-]{1,64}`;
export const KIVI_TEMPLATE_PATTERN = String.raw`[a-z][a-z0-9_]{0,99}`;
export const KIVI_LANGUAGE_PATTERN = String.raw`(?:es|en)(?:_[A-Z]{2})?`;
