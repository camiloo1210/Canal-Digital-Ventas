import 'server-only';
import '@/lib/security/sentry.server';
import * as Sentry from '@sentry/nextjs';
import { claimSecurityReport, type RateLimitDecision } from '@/lib/security/request-rate-limit';
export async function reportSecurityDecision(decision: RateLimitDecision): Promise<void> {
  try {
    if (!(await claimSecurityReport(decision))) return;
    const reportScope = new Sentry.Scope();
    reportScope.setClient(Sentry.getClient());
    Sentry.withScope(reportScope, (scope: Sentry.Scope): void => {
      scope.setTags({ component: 'request-rate-limit', policy: decision.policy });
      scope.setFingerprint(['request-rate-limit', decision.policy, decision.signal]);
      Sentry.captureMessage(`request-rate-limit:${decision.signal}`, {
        level: decision.signal === 'blocked' ? 'warning' : 'error',
      });
    });
    await Sentry.flush(1500);
  } catch {
    // Telemetry must never change the HTTP security decision.
  }
}
