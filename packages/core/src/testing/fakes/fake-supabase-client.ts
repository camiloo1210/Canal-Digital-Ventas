import type { SupabaseClient } from '@supabase/supabase-js';

export interface FakeSupabaseError {
  code?: string;
  message: string;
}

export interface FakeSupabaseResult {
  data: unknown;
  error: FakeSupabaseError | null;
  count?: number | null;
}

export interface FakeSupabaseCall {
  target: string;
  method: string;
  args: unknown[];
}

/** Chainable, thenable stand-in for a PostgREST query builder. Every call is recorded. */
class FakeQuery implements PromiseLike<FakeSupabaseResult> {
  constructor(
    private readonly target: string,
    private readonly result: FakeSupabaseResult,
    private readonly calls: FakeSupabaseCall[],
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ target: this.target, method, args });
    return this;
  }

  select(...args: unknown[]): this {
    return this.record('select', args);
  }
  eq(...args: unknown[]): this {
    return this.record('eq', args);
  }
  neq(...args: unknown[]): this {
    return this.record('neq', args);
  }
  in(...args: unknown[]): this {
    return this.record('in', args);
  }
  ilike(...args: unknown[]): this {
    return this.record('ilike', args);
  }
  or(...args: unknown[]): this {
    return this.record('or', args);
  }
  order(...args: unknown[]): this {
    return this.record('order', args);
  }
  range(...args: unknown[]): this {
    return this.record('range', args);
  }
  delete(...args: unknown[]): this {
    return this.record('delete', args);
  }
  single(): Promise<FakeSupabaseResult> {
    this.record('single', []);
    return Promise.resolve(this.result);
  }
  then<TResult1 = FakeSupabaseResult, TResult2 = never>(
    onfulfilled?: ((value: FakeSupabaseResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

/**
 * Minimal Supabase client double. Results are registered per target:
 * `schema.table` (default schema is `public`) or `rpc:name`. Unregistered targets resolve to
 * an empty successful result.
 */
export class FakeSupabase {
  readonly calls: FakeSupabaseCall[] = [];
  private readonly results = new Map<string, FakeSupabaseResult>();

  on(target: string, result: Partial<FakeSupabaseResult>): this {
    this.results.set(target, { data: null, error: null, ...result });
    return this;
  }

  callsFor(target: string): FakeSupabaseCall[] {
    return this.calls.filter((call): boolean => call.target === target);
  }

  asClient(): SupabaseClient {
    const rpc = (name: string, args: unknown): Promise<FakeSupabaseResult> => {
      this.calls.push({ target: `rpc:${name}`, method: 'rpc', args: [args] });
      return Promise.resolve(this.results.get(`rpc:${name}`) ?? { data: null, error: null });
    };
    const build = (schema: string): Record<string, unknown> => ({
      rpc,
      from: (table: string): FakeQuery => {
        const target = `${schema}.${table}`;
        return new FakeQuery(
          target,
          this.results.get(target) ?? { data: null, error: null },
          this.calls,
        );
      },
    });
    return {
      schema: (schema: string): Record<string, unknown> => build(schema),
      ...build('public'),
    } as unknown as SupabaseClient;
  }
}
