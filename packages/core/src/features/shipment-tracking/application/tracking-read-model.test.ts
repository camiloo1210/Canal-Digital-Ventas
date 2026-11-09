import { describe, expect, it } from 'vitest';
import { projectTrackingState } from '@/shipment-tracking/application/tracking-read-model';

describe('tracking read projection', (): void => {
  it('does not present an absent first poll as a confirmed status', (): void => {
    expect(
      projectTrackingState(
        { active: true, result: null, lastSuccessfulAt: null },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('pending');
  });
  it('does not hide repeated failed polls as waiting for the first update', (): void => {
    expect(
      projectTrackingState(
        { active: true, result: null, lastSuccessfulAt: null, lastErrorAt: '2026-11-09T11:00:00Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('unavailable');
  });
  it('reports a paused connection even when previous data is recent', (): void => {
    expect(
      projectTrackingState(
        { active: true, paused: true, result: 'found', lastSuccessfulAt: '2026-11-09T11:00:00Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('unavailable');
  });
  it('marks old successful data stale even after a later failure', (): void => {
    expect(
      projectTrackingState(
        { active: true, result: 'found', lastSuccessfulAt: '2026-11-09T08:00:00Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('stale');
  });
  it('distinguishes unsupported, not found and disabled', (): void => {
    expect(
      projectTrackingState(
        { active: true, result: 'unsupported', lastSuccessfulAt: '2026-11-09T11:00:00Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('unsupported');
    expect(
      projectTrackingState(
        { active: true, result: 'not_found', lastSuccessfulAt: '2026-11-09T11:00:00Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('not_found');
    expect(
      projectTrackingState(
        { active: false, result: 'found', lastSuccessfulAt: '2026-11-09T11:00:00Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('disabled');
  });
  it('keeps a successful result current at the freshness limit and stale immediately after', (): void => {
    const source = {
      active: true,
      result: 'found' as const,
      lastSuccessfulAt: '2026-11-09T10:00:00Z',
    };
    expect(projectTrackingState(source, '2026-11-09T12:00:00Z', 7200000)).toBe('current');
    expect(projectTrackingState(source, '2026-11-09T12:00:00.001Z', 7200000)).toBe('stale');
  });
  it('does not present a future or invalid consultation date as current', (): void => {
    expect(
      projectTrackingState(
        { active: true, result: 'found', lastSuccessfulAt: '2026-11-09T12:00:01Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('stale');
    expect(
      projectTrackingState(
        { active: true, result: 'found', lastSuccessfulAt: 'invalid' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('stale');
  });
  it('gives disabled state priority over a paused connection or old data', (): void => {
    expect(
      projectTrackingState(
        { active: false, paused: true, result: 'found', lastSuccessfulAt: '2020-01-01T00:00:00Z' },
        '2026-11-09T12:00:00Z',
        7200000,
      ),
    ).toBe('disabled');
  });
});
