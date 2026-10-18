import { paymentsDi } from '@/features/payments/di/payments.di';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('X-Signature');
  const eventName = request.headers.get('X-Event-Name');
  if (
    !signature ||
    !/^[a-fA-F0-9]{64}$/.test(signature) ||
    !eventName ||
    eventName.length > 128 ||
    !request.body
  ) {
    return new Response(null, { status: 400 });
  }
  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    if (size === 0) return new Response(null, { status: 400 });
    const result = await paymentsDi.resolveIngestWebhook().execute({
      payloadBase64: Buffer.concat(chunks).toString('base64'),
      signature,
      eventName,
    });
    const status =
      result.outcome === 'INVALID_SIGNATURE'
        ? 401
        : ['MALFORMED', 'CHANNEL_MISMATCH'].includes(result.outcome)
          ? 400
          : 200;
    return new Response(null, { status });
  } catch {
    // The provider must retry when the original bytes have not been durably accepted.
    return new Response(null, { status: 503 });
  }
}
