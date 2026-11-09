export interface TrackingPoller {
  execute(
    now: string,
    leaseToken: string,
    retryAt: string,
  ): Promise<'idle' | 'applied' | 'stale' | 'paused'>;
}
export async function runTrackingLoop(
  poller: TrackingPoller,
  signal: AbortSignal,
  pause: (milliseconds: number, signal: AbortSignal) => Promise<void>,
  clock: () => string = (): string => new Date().toISOString(),
  makeToken: () => string = (): string => crypto.randomUUID(),
  onError: (error: unknown) => void = (): void => {},
  observe: (result: 'idle' | 'applied' | 'stale' | 'paused' | 'error') => void = (): void => {},
  minimumSpacingMs: number = 1000,
  maintain: (now: string) => Promise<void> = async (): Promise<void> => {},
  collectMetrics: () => Promise<void> = async (): Promise<void> => {},
): Promise<void> {
  let lastMaintenance = Number.NEGATIVE_INFINITY;
  let lastMetrics = Number.NEGATIVE_INFINITY;
  while (!signal.aborted) {
    let delayMs = 5000;
    try {
      const now = clock();
      if (Date.parse(now) - lastMaintenance >= 86400000) {
        await maintain(now);
        lastMaintenance = Date.parse(now);
      }
      if (Date.parse(now) - lastMetrics >= 300000) {
        await collectMetrics();
        lastMetrics = Date.parse(now);
      }
      const retryAt = new Date(Date.parse(now) + 60000).toISOString();
      const result = await poller.execute(now, makeToken(), retryAt);
      observe(result);
      if (result !== 'idle') delayMs = minimumSpacingMs;
    } catch (error: unknown) {
      observe('error');
      onError(error);
      delayMs = 60000;
    }
    if (!signal.aborted) await pause(delayMs, signal);
  }
}
