import { describe, it, expect, vi } from 'vitest';
import {
  GeminiBusinessAdvisorAdapter,
  parseAdvice,
} from '@/dashboard/infrastructure/gemini-business-advisor.adapter';
import type { BusinessAdvisorDigest } from '@/dashboard/application/ports/out/business-advisor.port';

const digest = {
  locale: 'es',
  currency: 'USD',
  currencyExponent: 2,
} as unknown as BusinessAdvisorDigest;
const good = JSON.stringify({
  summary: 'Resumen',
  tips: [{ category: 'promotions', title: 'Promo fin de semana', detail: 'Haz una promo.' }],
});
const reply = (text: string): Response =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });

describe('Gemini business advisor', (): void => {
  it('sends the digest with the key in a header, not in the URL, and parses structured output', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(reply(good));
    const advice = await new GeminiBusinessAdvisorAdapter('secret', 'gemini-test', fetcher).advise(
      digest,
    );
    expect(advice.tips[0].category).toBe('promotions');
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-test:generateContent');
    expect(url).not.toContain('secret');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret');
    expect(JSON.parse(init.body as string).contents[0].parts[0].text).toContain('"currency":"USD"');
  });
  it('reports a missing key without calling the network', async (): Promise<void> => {
    const fetcher = vi.fn();
    await expect(
      new GeminiBusinessAdvisorAdapter(undefined, 'm', fetcher).advise(digest),
    ).rejects.toMatchObject({ name: 'BusinessAdvisorException', reason: 'not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('translates HTTP and network failures without leaking provider detail', async (): Promise<void> => {
    for (const fetcher of [
      vi.fn().mockResolvedValue(new Response('quota detail', { status: 429 })),
      vi.fn().mockRejectedValue(new Error('socket hang up')),
    ])
      await expect(
        new GeminiBusinessAdvisorAdapter('k', 'm', fetcher).advise(digest),
      ).rejects.toMatchObject({
        reason: 'unavailable',
        message: 'Unable to generate business advice',
      });
  });
  it('rejects malformed or empty model output', async (): Promise<void> => {
    for (const text of ['not json', '{}', JSON.stringify({ summary: 's', tips: [] })])
      await expect(
        new GeminiBusinessAdvisorAdapter('k', 'm', vi.fn().mockResolvedValue(reply(text))).advise(
          digest,
        ),
      ).rejects.toMatchObject({ reason: 'invalid_response' });
  });
  it('translates malformed response envelopes into typed invalid-response errors', async (): Promise<void> => {
    for (const payload of [
      null,
      [],
      {},
      { candidates: null },
      { candidates: [null] },
      { candidates: [{ content: null }] },
      { candidates: [{ content: { parts: [null] } }] },
      { candidates: [{ content: { parts: [{ text: 42 }] } }] },
    ]) {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));
      await expect(
        new GeminiBusinessAdvisorAdapter('k', 'm', fetcher).advise(digest),
      ).rejects.toMatchObject({ name: 'BusinessAdvisorException', reason: 'invalid_response' });
    }
  });
  it('translates invalid response JSON into a typed invalid-response error', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(new Response('not json'));
    await expect(
      new GeminiBusinessAdvisorAdapter('k', 'm', fetcher).advise(digest),
    ).rejects.toMatchObject({ name: 'BusinessAdvisorException', reason: 'invalid_response' });
  });
  it('drops tips outside the contract, caps lengths and the tip count', (): void => {
    const tips = [
      { category: 'hacking', title: 'x', detail: 'y' },
      { category: 'pricing', title: '', detail: 'y' },
      ...Array.from({ length: 12 }, (_, index): object => ({
        category: 'growth',
        title: `t${index}`,
        detail: 'd'.repeat(2000),
      })),
    ];
    const advice = parseAdvice(JSON.stringify({ summary: 's', tips }));
    expect(advice.tips).toHaveLength(8);
    expect(advice.tips.every((tip): boolean => tip.detail.length <= 700)).toBe(true);
  });
  it('trims api key whitespace and uses default gemini-2.5-flash-lite model when omitted', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(reply(good));
    await new GeminiBusinessAdvisorAdapter('  secret-key  ', undefined, fetcher).advise(digest);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-2.5-flash-lite:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key');
    const parsedBody = JSON.parse(init.body as string) as {
      generationConfig: { temperature?: number };
    };
    expect(parsedBody.generationConfig.temperature).toBe(0.4);
  });
  it('omits temperature from generation config when model starts with gemini-3', async (): Promise<void> => {
    const fetcher = vi.fn().mockResolvedValue(reply(good));
    await new GeminiBusinessAdvisorAdapter('secret', 'gemini-3-flash', fetcher).advise(digest);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-3-flash:generateContent');
    const parsedBody = JSON.parse(init.body as string) as {
      generationConfig: { temperature?: number };
    };
    expect(parsedBody.generationConfig.temperature).toBeUndefined();
  });
});
