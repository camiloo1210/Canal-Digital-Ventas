import { z } from 'zod';
import { inputPatternRegex, type TextInputAttributes } from '@/lib/input-attributes';

/**
 * Required, trimmed text that obeys the same length range and pattern the form declares natively.
 * `message` is returned for every failure so callers can map it to one translated error.
 */
export function constrainedString(attributes: TextInputAttributes, message: string): z.ZodString {
  return z
    .string(message)
    .trim()
    .min(attributes.minLength ?? 1, message)
    .max(attributes.maxLength, message)
    .regex(inputPatternRegex(attributes), message);
}
