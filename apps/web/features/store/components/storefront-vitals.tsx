'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { useEffect } from 'react';

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// Opt-in local diagnostics only: no customer identifiers or network reporting.
const report: Parameters<typeof useReportWebVitals>[0] = (metric): void => {
  console.info(
    '[storefront-vitals]',
    JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
    }),
  );
};

export function StorefrontVitals(): null {
  useReportWebVitals(report);
  // A live session-window snapshot also works in embedded browsers that never
  // notify visibilitychange. Final Web Vitals reporting above remains canonical.
  useEffect((): (() => void) | undefined => {
    if (!PerformanceObserver.supportedEntryTypes.includes('layout-shift')) return;
    let first = 0;
    let last = 0;
    let current = 0;
    let maximum = 0;
    const snapshot = (): void => {
      console.info('[storefront-cls-snapshot]', JSON.stringify({ value: maximum }));
    };
    const observer = new PerformanceObserver((list): void => {
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (entry.hadRecentInput) continue;
        if (entry.startTime - last < 1000 && entry.startTime - first < 5000) {
          current += entry.value;
        } else {
          first = entry.startTime;
          current = entry.value;
        }
        last = entry.startTime;
        maximum = Math.max(maximum, current);
      }
      snapshot();
    });
    observer.observe({ type: 'layout-shift', buffered: true });
    snapshot();
    return (): void => observer.disconnect();
  }, []);
  return null;
}
