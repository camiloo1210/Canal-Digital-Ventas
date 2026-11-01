import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(
  (): {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    incr: ReturnType<typeof vi.fn>;
    expire: ReturnType<typeof vi.fn>;
    options: unknown[];
  } => ({ get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn(), options: [] }),
);
vi.mock('server-only', (): object => ({}));
vi.mock('@upstash/redis', (): object => ({
  Redis: class {
    constructor(options: unknown) {
      mocks.options.push(options);
    }
    get = mocks.get;
    set = mocks.set;
    incr = mocks.incr;
    expire = mocks.expire;
  },
}));

async function load(): Promise<typeof import('@/lib/cache/public-catalog-cache')> {
  return import('@/lib/cache/public-catalog-cache');
}

function redisContents(value: string | null, version: string | null = null): void {
  mocks.get.mockImplementation(async (key: string): Promise<string | null> =>
    key.includes(':version:') ? version : value,
  );
}

beforeEach((): void => {
  vi.resetModules();
  vi.resetAllMocks();
  mocks.options.length = 0;
  vi.unstubAllEnvs();
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.test');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
});

describe('rememberPublicCatalogValue', (): void => {
  it('disables automatic deserialization so cached JSON strings are parsed once', async (): Promise<void> => {
    redisContents(null);
    const { rememberPublicCatalogValue } = await load();
    await rememberPublicCatalogValue('a', ['tenant'], async (): Promise<string> => 'x');
    expect(mocks.options[0]).toMatchObject({ automaticDeserialization: false });
  });

  it('returns the cached value without calling the source', async (): Promise<void> => {
    redisContents(JSON.stringify({ id: 1 }));
    const source = vi.fn();
    const { rememberPublicCatalogValue } = await load();
    await expect(rememberPublicCatalogValue('a', ['tenant'], source)).resolves.toEqual({ id: 1 });
    expect(source).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('serves a cached null as a hit', async (): Promise<void> => {
    redisContents('null');
    const source = vi.fn();
    const { rememberPublicCatalogValue } = await load();
    await expect(rememberPublicCatalogValue('a', ['tenant'], source)).resolves.toBeNull();
    expect(source).not.toHaveBeenCalled();
  });

  it('loads and stores with a TTL on a miss', async (): Promise<void> => {
    redisContents(null);
    const { rememberPublicCatalogValue } = await load();
    const value = await rememberPublicCatalogValue(
      'a',
      ['tenant'],
      async (): Promise<{ id: number }> => ({ id: 2 }),
    );
    expect(value).toEqual({ id: 2 });
    expect(mocks.set).toHaveBeenCalledWith(expect.stringContaining('cdv:catalog:'), '{"id":2}', {
      ex: expect.any(Number),
    });
    const ttl = (mocks.set.mock.calls[0][2] as { ex: number }).ex;
    expect(ttl).toBeGreaterThanOrEqual(15);
    expect(ttl).toBeLessThan(18);
  });

  it('stores a missing value with a short TTL so new stores appear quickly', async (): Promise<void> => {
    redisContents(null);
    const { rememberPublicCatalogValue } = await load();
    await rememberPublicCatalogValue('new', ['tenant'], async (): Promise<null> => null);
    expect(mocks.set).toHaveBeenCalledWith(expect.any(String), 'null', { ex: 5 });
  });

  it('shares one source call between concurrent requests for the same key', async (): Promise<void> => {
    redisContents(null);
    const source = vi.fn(async (): Promise<number> => 5);
    const { rememberPublicCatalogValue } = await load();
    const results = await Promise.all([
      rememberPublicCatalogValue('a', ['tenant'], source),
      rememberPublicCatalogValue('a', ['tenant'], source),
      rememberPublicCatalogValue('a', ['tenant'], source),
    ]);
    expect(results).toEqual([5, 5, 5]);
    expect(source).toHaveBeenCalledTimes(1);
  });

  it('falls back to the source when Redis fails', async (): Promise<void> => {
    mocks.get.mockRejectedValue(new Error('down'));
    mocks.set.mockRejectedValue(new Error('down'));
    const { rememberPublicCatalogValue } = await load();
    await expect(
      rememberPublicCatalogValue('a', ['tenant'], async (): Promise<number> => 3),
    ).resolves.toBe(3);
  });

  it('skips Redis when it is not configured', async (): Promise<void> => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    const { rememberPublicCatalogValue } = await load();
    await expect(
      rememberPublicCatalogValue('a', ['tenant'], async (): Promise<number> => 4),
    ).resolves.toBe(4);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('separates entries by tenant version so invalidation misses old data', async (): Promise<void> => {
    const { rememberPublicCatalogValue } = await load();
    redisContents(null, '1');
    await rememberPublicCatalogValue('a', ['tenant'], async (): Promise<number> => 1);
    redisContents(null, '2');
    await rememberPublicCatalogValue('a', ['tenant'], async (): Promise<number> => 1);
    expect(mocks.set.mock.calls[0][0]).not.toBe(mocks.set.mock.calls[1][0]);
  });

  it('skips the cache when the tenant version cannot be read', async (): Promise<void> => {
    mocks.get.mockRejectedValue(new Error('redis down'));
    const source = vi.fn(async (): Promise<number> => 7);
    const { rememberPublicCatalogValue } = await load();
    await expect(rememberPublicCatalogValue('a', ['tenant'], source)).resolves.toBe(7);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe('invalidatePublicCatalog', (): void => {
  it('bumps the tenant version and bounds its lifetime', async (): Promise<void> => {
    const { invalidatePublicCatalog } = await load();
    await invalidatePublicCatalog('a');
    expect(mocks.incr).toHaveBeenCalledWith(expect.stringContaining(':version:'));
    expect(mocks.expire).toHaveBeenCalledWith(mocks.incr.mock.calls[0][0], 86_400);
  });

  it('never throws when Redis fails', async (): Promise<void> => {
    mocks.incr.mockRejectedValue(new Error('redis down'));
    const { invalidatePublicCatalog } = await load();
    await expect(invalidatePublicCatalog('a')).resolves.toBeUndefined();
  });
});
