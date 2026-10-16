/** Safe operational metadata only: never serialize vendor errors, SQL arguments or URLs. */
export function paymentFailureCode(error: unknown): string {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== 'object' || current === null) break;
    if (
      'code' in current &&
      typeof current.code === 'string' &&
      /^(?:[0-9A-Z]{5}|ECONNREFUSED|ENOTFOUND|ETIMEDOUT)$/.test(current.code)
    )
      return current.code;
    if (
      'message' in current &&
      typeof current.message === 'string' &&
      /^Evidence requires HTTP [0-9]{3}\.$/.test(current.message)
    )
      return current.message.replace(/[^A-Z0-9]/g, '');
    if (!('originalError' in current)) break;
    current = current.originalError;
  }
  return 'UNAVAILABLE';
}
