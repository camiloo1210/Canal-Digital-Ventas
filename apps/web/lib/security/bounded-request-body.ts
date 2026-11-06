import 'server-only';

/** Enforces the limit while reading, including requests without Content-Length. */
export async function readBoundedRequestText(
  request: Request,
  maximumBytes: number,
): Promise<{ text: string } | { tooLarge: true }> {
  if (Number(request.headers.get('content-length') ?? '0') > maximumBytes) {
    await request.body?.cancel();
    return { tooLarge: true };
  }
  if (!request.body) return { text: '' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(value);
    }
    return { text: Buffer.concat(chunks).toString('utf8') };
  } finally {
    reader.releaseLock();
  }
}
